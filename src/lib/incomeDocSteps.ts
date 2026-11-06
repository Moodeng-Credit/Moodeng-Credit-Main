// Proof-of-income steps that follow the credit ladder: the more someone asks for, the more we need.
// The steps come from telegram_bot_settings.income_doc_tiers (via get_income_doc_requirement), so
// the team can change them without a deploy. The same rules run in the AI checks
// (supabase/functions/_shared/incomeDocs.ts).

export type IncomeDocStep = {
   /** Applies from this many USD up to the next step. */
   min: number;
   /** Months of history the document must cover (0 = any recent one). */
   months: number;
   /** A new document for each loan: sent after their last funded loan, within FRESH_DAYS. */
   fresh: boolean;
   /** Approved automatically when every check passes. */
   autoApprove: boolean;
   /** Repayment as a share of monthly income above which it's flagged (null = not checked). */
   maxShare: number | null;
   /** Average balance must cover the repayment. */
   balance: boolean;
   /** The team asks them to show GCash live on the call. */
   liveCall: boolean;
};

export type IncomeDocFacts = {
   steps: IncomeDocStep[];
   /** Their latest usable send (last 90 days, not declined, not sent back to fix). */
   /** payday: the day of the month their main income lands, from the document (null if none seen). */
   doc: { createdAt: number; months: number | null; read: boolean; approved: boolean; payday?: number | null } | null;
   lastFundedAt: number | null;
};

export type IncomeDocGate =
   | { ok: true; step: IncomeDocStep | null }
   | { ok: false; step: IncomeDocStep; missing: 'doc' | 'months' | 'fresh'; haveMonths?: number };

export const FRESH_DAYS = 14;

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** Clean up the steps from the setting; anything malformed is dropped. Pure. */
export const parseSteps = (raw: unknown): IncomeDocStep[] =>
   (Array.isArray(raw) ? raw : [])
      .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object' && num((s as Record<string, unknown>).min, 0) > 0)
      .map((s) => ({
         min: num(s.min, 0),
         months: num(s.months, 0),
         fresh: s.fresh === true,
         autoApprove: s.autoApprove === true,
         maxShare: typeof s.maxShare === 'number' ? s.maxShare : null,
         balance: s.balance === true,
         liveCall: s.liveCall === true
      }))
      .sort((a, b) => a.min - b.min);

/** The step for an amount: the highest one whose `min` it reaches, or null below the first. Pure. */
export const stepFor = (amount: number, steps: IncomeDocStep[]) =>
   Number.isFinite(amount) ? ([...steps].reverse().find((s) => amount >= s.min) ?? null) : null;

/** Is their proof of income enough for this amount, and if not, what's missing? Pure. */
export const incomeDocGate = (amount: number, facts: IncomeDocFacts, now = Date.now()): IncomeDocGate => {
   const step = stepFor(amount, facts.steps);
   if (!step) return { ok: true, step: null };
   const doc = facts.doc;
   if (!doc) return { ok: false, step, missing: 'doc' };
   if (
      step.fresh &&
      ((facts.lastFundedAt != null && doc.createdAt <= facts.lastFundedAt) || now - doc.createdAt > FRESH_DAYS * 86_400_000)
   ) {
      return { ok: false, step, missing: 'fresh' };
   }
   // Not read yet: let the request through; the team still reviews it.
   if (step.months > 0 && doc.read && doc.months != null && doc.months < step.months - 0.25) {
      return { ok: false, step, missing: 'months', haveMonths: doc.months };
   }
   return { ok: true, step };
};

/**
 * What to send for a step, in the borrower's words. From the first step that asks for months, a
 * payslip or invoice alone isn't enough: we need the account the money lands in. Pure.
 */
export const stepAsk = (step: IncomeDocStep) => {
   const ask =
      step.months >= 2
         ? `your last ${step.months}–3 months of GCash, Maya or bank history (screenshots are fine). Add your payslips or invoices too if you have them`
         : step.months === 1
           ? 'your last month of GCash, Maya or bank history (screenshots are fine). A payslip or invoice alone isn’t enough, so send the history with it'
           : 'one recent GCash or Maya screenshot, bank statement or payslip';
   return step.liveCall ? `${ask}. We’ll also ask you to open GCash or Maya on a quick video call` : ask;
};

/**
 * A due date the day after their usual payday, if one fits: at least `minDays` away and no later than
 * `maxDate`. Paydays past the 28th fall back to the month's last day, so a payday of the 31st still
 * works in a 30-day month. Research on online lenders found repayment rises when the due date lands
 * just after payday. Pure.
 */
export const dueDateAfterPayday = (today: Date, payday: number | null | undefined, maxDate: Date, minDays = 7): Date | null => {
   if (!payday || payday < 1 || payday > 31) return null;
   const earliest = new Date(today.getFullYear(), today.getMonth(), today.getDate() + minDays);
   for (let i = 0; i < 5; i++) {
      const lastDay = new Date(today.getFullYear(), today.getMonth() + i + 1, 0).getDate();
      const paid = new Date(today.getFullYear(), today.getMonth() + i, Math.min(payday, lastDay));
      const due = new Date(paid.getFullYear(), paid.getMonth(), paid.getDate() + 1);
      if (due >= earliest) return due <= maxDate ? due : null;
   }
   return null;
};

/** The card's headline reason. Pure. */
export const gateMessage = (gate: Extract<IncomeDocGate, { ok: false }>) => {
   const amount = `$${gate.step.min}`;
   if (gate.missing === 'fresh')
      return `Loans of ${amount} or more need a new proof of income for each loan. Please send ${stepAsk(gate.step)}.`;
   if (gate.missing === 'months') {
      const weeks = gate.haveMonths != null ? Math.max(1, Math.round(gate.haveMonths * 4.3)) : null;
      const have = weeks != null ? ` Your last one shows about ${weeks} week${weeks === 1 ? '' : 's'}.` : '';
      return `Loans of ${amount} or more need at least ${gate.step.months} months of history.${have} Please send ${stepAsk(gate.step)}.`;
   }
   return `Loans of ${amount} or more need proof of income. Please send ${stepAsk(gate.step)}.`;
};
