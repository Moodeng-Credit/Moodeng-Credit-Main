import { useQuery } from '@tanstack/react-query';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Proof of income for bigger loans. Admins set the line in telegram_bot_settings.income_doc_min_usd
 * ($60 today; 0 = off): a request of that amount or more needs a proof of income sent in the last
 * 90 days that wasn't declined or sent back to fix (moodeng.app/documents).
 *
 * Anything unexpected — the RPC not deployed yet, a network error, loading — reads as "not needed",
 * so this can never lock a borrower out.
 */
export type IncomeDocRequirement = { minUsd: number | null; ok: boolean };

const OFF: IncomeDocRequirement = { minUsd: null, ok: true };

export const fetchIncomeDocRequirement = async (): Promise<IncomeDocRequirement> => {
   const { data, error } = await getSupabaseBrowserClient().rpc('get_income_doc_requirement');
   if (error || !data) return OFF;
   const value = data as { min_usd?: unknown; ok?: unknown };
   const minUsd = Number(value.min_usd);
   return { minUsd: Number.isFinite(minUsd) && minUsd > 0 ? minUsd : null, ok: value.ok === true };
};

export function useIncomeDocRequirement(enabled: boolean): IncomeDocRequirement {
   const { data } = useQuery({
      queryKey: ['income-doc-requirement'],
      queryFn: fetchIncomeDocRequirement,
      enabled,
      staleTime: 0,
      refetchOnMount: 'always'
   });
   return data ?? OFF;
}
