// Did the proof-of-income checks predict anything? Each read document is matched to the first loan
// funded around it (admin_income_doc_outcomes), then grouped by label. With few loans the honest
// answer is a range, so each group shows the highest late-or-unpaid rate the results still allow
// (Wilson 95% upper bound): 0 bad out of 26 still allows up to about 13%.

export type IncomeDocOutcome = {
   doc_id: string;
   sent_at: string;
   authenticity: string | null;
   affordability: string | null;
   score: number | null;
   verdict: string | null;
   decision: string | null;
   loan_amount: number | null;
   due_date: string | null;
   outcome: 'no_loan' | 'on_time' | 'late' | 'unpaid' | 'not_due';
   days_late: number | null;
};

export type OutcomeGroup = {
   key: string;
   due: number;
   onTime: number;
   late: number;
   unpaid: number;
   notDue: number;
   upperBadRate: number | null;
};

/** Highest plausible rate (95%) for `bad` out of `n`; null with nothing to go on. Pure. */
export const wilsonUpper = (bad: number, n: number, z = 1.96): number | null => {
   if (n <= 0) return null;
   const p = bad / n;
   const z2 = z * z;
   return Math.min(1, (p + z2 / (2 * n) + z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n));
};

/** Outcomes per label value, in the given order (missing labels group as "none"). Pure. */
export const groupOutcomes = (rows: IncomeDocOutcome[], by: 'affordability' | 'authenticity', order: string[]): OutcomeGroup[] => {
   const keys = [...order, ...new Set(rows.map((r) => r[by] ?? 'none').filter((k) => !order.includes(k)))];
   return keys
      .map((key) => {
         const mine = rows.filter((r) => (r[by] ?? 'none') === key && r.outcome !== 'no_loan');
         const onTime = mine.filter((r) => r.outcome === 'on_time').length;
         const late = mine.filter((r) => r.outcome === 'late').length;
         const unpaid = mine.filter((r) => r.outcome === 'unpaid').length;
         const due = onTime + late + unpaid;
         return {
            key,
            due,
            onTime,
            late,
            unpaid,
            notDue: mine.filter((r) => r.outcome === 'not_due').length,
            upperBadRate: wilsonUpper(late + unpaid, due)
         };
      })
      .filter((g) => g.due + g.notDue > 0 || order.includes(g.key));
};
