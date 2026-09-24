import { useQuery } from '@tanstack/react-query';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Which borrower flow is live — switched by an admin from Telegram (/loanflow), no deploy needed.
 *   open      no gate: book a video call (no referral) and the request posts right away
 *   call      Connect → book a call → an admin marks ✅ Showed up → the borrower can apply
 *   approval  Connect → an admin approves in Telegram → the borrower can apply (no call)
 *
 * Anything unexpected — the RPC not deployed yet, a network error, loading — reads as 'open',
 * the flow that never locks anyone out. The server enforces the real rule either way.
 */
export type LoanFlow = 'open' | 'call' | 'approval';

const isLoanFlow = (value: unknown): value is LoanFlow => value === 'open' || value === 'call' || value === 'approval';

export const fetchLoanFlow = async (): Promise<LoanFlow> => {
   const { data, error } = await getSupabaseBrowserClient().rpc('get_loan_flow');
   if (error) return 'open';
   return isLoanFlow(data) ? data : 'open';
};

export function useLoanFlow(override?: LoanFlow): LoanFlow {
   const { data } = useQuery({
      queryKey: ['loan-flow'],
      queryFn: fetchLoanFlow,
      enabled: !override,
      staleTime: 60_000
   });
   return override ?? data ?? 'open';
}
