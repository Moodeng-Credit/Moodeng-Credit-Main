// Pure on-chain hop-walker for the follow-the-money tracer (Part A).
// No Deno.* at module top so vitest can import it directly (masterplan §2.8).
//
// Given the USDC transfers we fetched starting from a borrower's wallet, walk the money
// forward until it reaches an EXTERNAL address (not one of our own wallets/infra) — that
// terminal address is where the loan actually went (e.g. a Coins.ph deposit address).
//
// Two things this has to get right, both seen in the 2026-08-15 incident:
//   1. Net-zero reversals — the borrower sent 15 USDC into a Base send-via-link (Linkdrop)
//      escrow and it bounced straight back ~2 min later. That branch must NOT be reported
//      as a destination; the real destination is the Coins.ph deposit (step 4).
//   2. Multi-hop — a fraudster may add a personal wallet between the borrower and the
//      exchange, so we walk up to `maxHops`, passing THROUGH our own/intermediary wallets
//      but stopping at the first external address on each path.

export type UsdcTransfer = {
   from: string;
   to: string;
   hash: string;
   value: bigint; // raw 6-decimal USDC amount
   timestamp: string; // ISO 8601
};

export type FundFlowTerminal = {
   address: string; // lower-cased external destination
   hopCount: number; // hops from the root wallet to this address
   txHashes: string[]; // the transfer hash(es) that reached it
   amountOut: bigint; // raw USDC summed into this address along the traced path
   firstOutAt: string; // earliest hop timestamp toward this address
};

const norm = (a: string): string => (a ?? '').trim().toLowerCase();

// An address is a net-zero passthrough (a reversal like the Linkdrop escrow) when it sent
// back to the root wallet at least `returnRatio` of what it received from the root. Such an
// address is neither a real destination nor worth walking through.
const REVERSAL_RETURN_RATIO = 0.9;

const isReversalToRoot = (addr: string, root: string, transfers: UsdcTransfer[]): boolean => {
   let received = 0n;
   let returned = 0n;
   for (const t of transfers) {
      if (norm(t.from) === root && norm(t.to) === addr) received += t.value;
      if (norm(t.from) === addr && norm(t.to) === root) returned += t.value;
   }
   if (received === 0n) return false;
   // returned >= received * ratio, done in integer math to avoid float drift on bigints.
   return returned * 100n >= received * BigInt(Math.round(REVERSAL_RETURN_RATIO * 100));
};

export type TraceParams = {
   rootWallet: string;
   transfers: UsdcTransfer[];
   internalAddresses: Set<string>; // our own wallets + infra to walk THROUGH (lower-cased)
   maxHops?: number;
};

/**
 * Walk the money from `rootWallet` to its external terminal destinations.
 * Deterministic and side-effect free — the edge function fetches the transfers and
 * persists the result; all the logic that needs testing lives here.
 */
export const traceFundFlow = ({ rootWallet, transfers, internalAddresses, maxHops = 3 }: TraceParams): FundFlowTerminal[] => {
   const root = norm(rootWallet);
   const internal = new Set(Array.from(internalAddresses, norm));

   // Outbound index: from-address -> its transfers.
   const outbound = new Map<string, UsdcTransfer[]>();
   for (const t of transfers) {
      const from = norm(t.from);
      if (!outbound.has(from)) outbound.set(from, []);
      outbound.get(from)!.push(t);
   }

   const terminals = new Map<string, FundFlowTerminal>();
   const visited = new Set<string>([root]);
   let frontier: Array<{ addr: string; hop: number }> = [{ addr: root, hop: 0 }];

   while (frontier.length && frontier[0].hop < maxHops) {
      const next: Array<{ addr: string; hop: number }> = [];
      for (const node of frontier) {
         for (const t of outbound.get(node.addr) ?? []) {
            const dest = norm(t.to);
            if (dest === root || visited.has(dest)) continue; // skip cycles / return-to-root
            if (isReversalToRoot(dest, root, transfers)) continue; // Linkdrop-style bounce

            const hop = node.hop + 1;
            if (internal.has(dest)) {
               // Our own/intermediary wallet — keep following the money through it.
               visited.add(dest);
               next.push({ addr: dest, hop });
               continue;
            }

            // External address — this is a real destination. Accumulate and stop here.
            const existing = terminals.get(dest);
            if (existing) {
               existing.amountOut += t.value;
               if (!existing.txHashes.includes(t.hash)) existing.txHashes.push(t.hash);
               existing.hopCount = Math.min(existing.hopCount, hop);
               if (t.timestamp < existing.firstOutAt) existing.firstOutAt = t.timestamp;
            } else {
               terminals.set(dest, {
                  address: dest,
                  hopCount: hop,
                  txHashes: [t.hash],
                  amountOut: t.value,
                  firstOutAt: t.timestamp
               });
            }
         }
      }
      frontier = next;
   }

   // Largest flow first — the dominant destination is the one worth alerting on.
   return Array.from(terminals.values()).sort((a, b) => (b.amountOut > a.amountOut ? 1 : b.amountOut < a.amountOut ? -1 : 0));
};
