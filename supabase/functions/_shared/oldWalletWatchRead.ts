// Reads for the old-wallet watch (see oldWalletWatch.ts): who still owes, which wallets they used before, and
// what USDC sits in each. Kept apart from the pure check so vitest never has to resolve Deno imports.
import type { OpenLoanBorrower } from './oldWalletWatch.ts';
import { rpcCall, USDC_ADDRESS } from './usdcTransfer.ts';

// deno-lint-ignore no-explicit-any
type SupabaseLike = { from: (table: string) => any };

type LoanRow = {
   borrower_user_id: string | null;
   borrower_wallet: string | null;
   tracking_id: string | null;
   total_repayment_amount: number | string | null;
   repaid_amount: number | string | null;
   funded_at: string | null;
   repaid_at: string | null;
   refunded_at: string | null;
   offplatform_settled_at: string | null;
};

const num = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

/** Borrowers with a funded loan still owing, each with every wallet on record as theirs. */
export async function readOpenLoanBorrowers(supabase: SupabaseLike): Promise<OpenLoanBorrower[]> {
   // Paged: the API returns at most 1000 rows per request.
   const PAGE = 1000;
   const loans: LoanRow[] = [];
   for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
         .from('loans')
         .select(
            'borrower_user_id, borrower_wallet, tracking_id, total_repayment_amount, repaid_amount, funded_at, repaid_at, refunded_at, offplatform_settled_at'
         )
         .not('borrower_user_id', 'is', null)
         .not('funded_at', 'is', null)
         .order('id', { ascending: true })
         .range(from, from + PAGE - 1);
      if (error) throw new Error(`loans: ${error.message}`);
      loans.push(...((data ?? []) as LoanRow[]));
      if ((data ?? []).length < PAGE) break;
   }

   const byUser = new Map<string, { owed: number; trackingIds: string[]; wallets: Set<string> }>();
   const entry = (id: string) => {
      let e = byUser.get(id);
      if (!e) {
         e = { owed: 0, trackingIds: [], wallets: new Set<string>() };
         byUser.set(id, e);
      }
      return e;
   };
   for (const l of loans) {
      // Test-flagged accounts are kept in: real money sent to a wrong address matters whoever sent it.
      if (!l.borrower_user_id) continue;
      const e = entry(l.borrower_user_id);
      if (l.borrower_wallet) e.wallets.add(l.borrower_wallet);
      const open = !l.repaid_at && !l.refunded_at && !l.offplatform_settled_at;
      const left = num(l.total_repayment_amount) - num(l.repaid_amount);
      if (open && left > 0.005) {
         e.owed += left;
         if (l.tracking_id) e.trackingIds.push(l.tracking_id);
      }
   }

   const owing = [...byUser.entries()].filter(([, e]) => e.owed > 0.005);
   if (!owing.length) return [];
   const ids = owing.map(([id]) => id);

   const [{ data: users, error: usersErr }, { data: grants, error: grantsErr }] = await Promise.all([
      supabase.from('users').select('id, username, wallet_address').in('id', ids),
      supabase.from('embedded_wallet_grants').select('user_id, wallet_address').in('user_id', ids)
   ]);
   if (usersErr) throw new Error(`users: ${usersErr.message}`);
   if (grantsErr) throw new Error(`embedded_wallet_grants: ${grantsErr.message}`);

   const userById = new Map<string, { username: string | null; wallet_address: string | null }>(
      ((users ?? []) as { id: string; username: string | null; wallet_address: string | null }[]).map((u) => [u.id, u])
   );
   for (const g of (grants ?? []) as { user_id: string; wallet_address: string | null }[]) {
      if (g.wallet_address) byUser.get(g.user_id)?.wallets.add(g.wallet_address);
   }

   return owing.map(([id, e]) => ({
      userId: id,
      username: userById.get(id)?.username ?? null,
      currentWallet: userById.get(id)?.wallet_address ?? null,
      owed: Math.round(e.owed * 100) / 100,
      trackingIds: e.trackingIds,
      knownWallets: [...e.wallets]
   }));
}

/** USDC balance (in dollars) of each wallet on Base. A wallet whose read fails is left out, not counted as 0. */
export async function readUsdcBalances(rpcUrl: string, wallets: string[]): Promise<{ balances: Record<string, number>; failed: string[] }> {
   const balances: Record<string, number> = {};
   const failed: string[] = [];
   for (const wallet of wallets) {
      try {
         const data = `0x70a08231000000000000000000000000${wallet.slice(2)}`;
         const result = (await rpcCall(rpcUrl, 'eth_call', [{ to: USDC_ADDRESS, data }, 'latest'])) as string;
         balances[wallet] = Number(BigInt(result && result !== '0x' ? result : '0x0')) / 1e6;
      } catch (_err) {
         failed.push(wallet);
      }
   }
   return { balances, failed };
}
