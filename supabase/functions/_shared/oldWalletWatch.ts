// Old-wallet watch (security-heartbeat, action "old_wallet_watch", hourly).
//
// A borrower's account points at ONE wallet (users.wallet_address): the repay page copies that address and
// watches only that balance. When an account is moved to a different wallet (the Nov 2026 Instant Wallet
// switch), the borrower's exchange app may still have the OLD address saved. Money sent there is safe but
// invisible: the site shows 0 and "Waiting for your USDC" forever, and nobody on the team hears about it.
//
// This check looks at every borrower who still owes on a funded loan, reads the USDC balance of each wallet
// they used before (earlier loans' borrower_wallet, their Instant Wallet grant) that is not their current
// one, and tells the team once when real money is sitting there. It only flags: nothing is moved or switched.
//
// It reads balances (eth_call) rather than transfer logs on purpose, same as vaultWatch.ts: free Base RPC
// plans cap or drop eth_getLogs.
//
// pickOldWallets and assessOldWallets are pure (no Deno.* or npm: imports) so vitest covers them; the reads
// are in oldWalletWatchRead.ts.

// Old wallets keep exchange dust (up to about $1 seen), so only a real top-up counts.
export const OLD_WALLET_MIN_USD = 3;

export interface OpenLoanBorrower {
   userId: string;
   username: string | null;
   currentWallet: string | null;
   // What they still owe across funded, unrepaid loans (USDC).
   owed: number;
   trackingIds: string[];
   // Every wallet on record as theirs as a borrower: borrower_wallet of any of their loans, Instant Wallet grant.
   knownWallets: string[];
}

export interface OldWalletCandidate {
   userId: string;
   username: string | null;
   currentWallet: string | null;
   owed: number;
   trackingIds: string[];
   wallet: string; // lowercase
}

export interface OldWalletFinding {
   severity: 'high';
   title: string;
   body: string;
   wallet: string;
   userId: string;
   balance: number;
}

// wallet (lowercase) → balance we already told the team about.
export type OldWalletWatchState = Record<string, number>;

const norm = (a: string | null | undefined): string => (a ?? '').trim().toLowerCase();
const isAddress = (a: string) => /^0x[0-9a-f]{40}$/.test(a);
const usd = (n: number) => `$${n.toFixed(2)}`;
const short = (a: string | null) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : (a ?? 'none'));

/** Each borrower's wallets that are NOT the one their account points at now. */
export function pickOldWallets(borrowers: OpenLoanBorrower[]): OldWalletCandidate[] {
   const out: OldWalletCandidate[] = [];
   for (const b of borrowers) {
      const current = norm(b.currentWallet);
      const seen = new Set<string>();
      for (const raw of b.knownWallets) {
         const wallet = norm(raw);
         if (!isAddress(wallet) || wallet === current || seen.has(wallet)) continue;
         seen.add(wallet);
         out.push({
            userId: b.userId,
            username: b.username,
            currentWallet: b.currentWallet,
            owed: b.owed,
            trackingIds: b.trackingIds,
            wallet
         });
      }
   }
   return out;
}

/**
 * Which old wallets to tell the team about now. A wallet alerts once while money sits in it, and again only
 * if more arrives. Once it empties it is forgotten, so a later deposit alerts afresh.
 */
export function assessOldWallets(
   candidates: OldWalletCandidate[],
   balances: Record<string, number>,
   previous: OldWalletWatchState | null,
   opts: { minUsd?: number; adminUrl?: (userId: string, username: string | null) => string } = {}
): { findings: OldWalletFinding[]; state: OldWalletWatchState } {
   const minUsd = opts.minUsd ?? OLD_WALLET_MIN_USD;
   const findings: OldWalletFinding[] = [];
   const state: OldWalletWatchState = {};

   for (const c of candidates) {
      const balance = balances[c.wallet];
      if (typeof balance !== 'number' || !Number.isFinite(balance) || balance < minUsd) continue;
      const alerted = previous?.[c.wallet] ?? 0;
      // A cent of slack so rounding never re-alerts the same money.
      if (balance <= alerted + 0.01) {
         state[c.wallet] = alerted;
         continue;
      }
      state[c.wallet] = balance;
      const who = c.username ? `@${c.username}` : `user ${c.userId}`;
      const link = opts.adminUrl ? `\n${opts.adminUrl(c.userId, c.username)}` : '';
      findings.push({
         severity: 'high',
         wallet: c.wallet,
         userId: c.userId,
         balance,
         title: `${who} has ${usd(balance)} sitting in an old wallet`,
         body:
            `They owe ${usd(c.owed)} (${c.trackingIds.join(', ') || 'no loan id'}) and their site shows only the wallet their account points at now, so this money looks missing to them.\n\n` +
            `Old wallet with the money: ${c.wallet}\n` +
            `Wallet on their account now: ${short(c.currentWallet)}\n\n` +
            `Nothing was moved. To fix it, point their account back at the old wallet (users.wallet_address, provider and connector) or have them send the USDC on to their current wallet, then ask them to open Repay again.${link}`
      });
   }
   return { findings, state };
}
