import { getNextCreditTier } from '@/config/creditTiers';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// Helpers for the two loan request cards (LoanReadyCards.tsx).

export const shortDay = (iso: string) => {
   const date = new Date(`${iso.slice(0, 10)}T12:00:00`);
   return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const money = (usd: number) => (Number.isInteger(usd) ? `$${usd}` : `$${usd.toFixed(2)}`);

export const pesos = (usd: number, rate: number) => `₱${Math.round(usd * rate).toLocaleString('en-US')}`;

export type LoanRulesView = {
   /** Full limit borrowed: paying in the window raises the limit to `nextLimit`. */
   levelUp: { from: number; to: number } | null;
   dueDay: string;
};

/** What card 2 promises. Only a full-limit loan can raise the limit (credit leveling rule). */
export function getLoanRulesView({
   amount,
   creditLimit,
   joinedAt,
   dueIso
}: {
   amount: number;
   creditLimit: number;
   joinedAt?: string | number | Date | null;
   dueIso: string;
}): LoanRulesView {
   const full = creditLimit > 0 && Math.abs(amount - creditLimit) < 0.005;
   const next = full ? getNextCreditTier(creditLimit, joinedAt) : creditLimit;
   return { levelUp: full && next > creditLimit ? { from: creditLimit, to: next } : null, dueDay: shortDay(dueIso) };
}

/** Saves that they agreed (who, when, which terms). Never blocks the request. */
export async function recordLoanRulesAgreed(input: { amount: number; total: number | null; dueIso: string; levelUpTo: number | null }) {
   try {
      await getSupabaseBrowserClient().rpc('agree_loan_rules' as never, {
         p_loan_amount: input.amount,
         p_total: input.total,
         p_due: input.dueIso || null,
         p_level_up_to: input.levelUpTo
      } as never);
   } catch {
      // A failed save must not stop the request.
   }
}
