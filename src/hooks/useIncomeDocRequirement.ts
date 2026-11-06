import { useQuery } from '@tanstack/react-query';

import { type IncomeDocFacts, parseSteps } from '@/lib/incomeDocSteps';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * What the loan form needs to decide whether this borrower's proof of income is enough for the
 * amount they're asking (incomeDocGate in @/lib/incomeDocSteps). The steps come from
 * telegram_bot_settings.income_doc_tiers, so the team changes them without a deploy.
 *
 * Anything unexpected — the RPC not deployed yet, a network error, loading — reads as "no steps",
 * so this can never lock a borrower out. Re-read on every open, so a document they just sent counts.
 */
const OFF: IncomeDocFacts = { steps: [], doc: null, lastFundedAt: null };

export const fetchIncomeDocFacts = async (): Promise<IncomeDocFacts> => {
   const { data, error } = await getSupabaseBrowserClient().rpc('get_income_doc_requirement');
   if (error || !data) return OFF;
   const value = data as { tiers?: unknown; doc?: Record<string, unknown> | null; last_funded_at?: string | null };
   const doc = value.doc;
   return {
      steps: parseSteps(value.tiers),
      doc: doc
         ? {
              createdAt: Date.parse(String(doc.created_at)),
              months: typeof doc.months === 'number' ? doc.months : null,
              read: doc.read === true,
              approved: doc.approved === true,
              payday: typeof doc.payday === 'number' ? doc.payday : null
           }
         : null,
      lastFundedAt: value.last_funded_at ? Date.parse(value.last_funded_at) : null
   };
};

export function useIncomeDocFacts(enabled: boolean): IncomeDocFacts {
   const { data } = useQuery({
      queryKey: ['income-doc-requirement'],
      queryFn: fetchIncomeDocFacts,
      enabled,
      staleTime: 0,
      refetchOnMount: 'always'
   });
   return data ?? OFF;
}
