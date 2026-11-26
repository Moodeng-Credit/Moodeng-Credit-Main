// Proof of income → credit ladder (George, 2026-11-27). Pure; no imports, so the app's tests can load it.
//
// The monthly amount a document shows, read the same way the document checks read it: net pay, else the
// biggest regular deposit, else money in per month. A payslip's net pay is scaled to a full month by the
// period it covers (a ₱9k half-month payslip ≈ ₱18k a month). Mirrors app_private.income_doc_monthly_php
// (migration 20261127030000), which the income ceiling uses for team-approved documents from the last
// 3 months.

export type DocMonthlyInput = {
   currency?: string | null;
   net_pay?: number | null;
   months_covered?: number | null;
   regular_deposits?: Array<{ amount: number }> | null;
   monthly_in?: number | null;
};

export const docMonthlyPhp = (input: DocMonthlyInput): number | null => {
   if ((input.currency ?? 'PHP').toUpperCase() !== 'PHP') return null;
   const net = Number(input.net_pay ?? 0);
   if (net > 0) {
      const months = Number(input.months_covered ?? 0);
      return Math.round(months >= 0.2 && months <= 3 ? net / months : net);
   }
   const regular = Number(input.regular_deposits?.[0]?.amount ?? 0);
   if (regular > 0) return Math.round(regular);
   const monthlyIn = Number(input.monthly_in ?? 0);
   return monthlyIn > 0 ? Math.round(monthlyIn) : null;
};

// Sign-up answer (users.monthly_income, US dollars a month) in pesos, as the team thinks about it.
const BANDS: Record<string, { label: string; low: number; high: number }> = {
   under_200: { label: 'under ₱12k', low: 0, high: 12_000 },
   '200_400': { label: '₱12k–23k', low: 12_000, high: 23_000 },
   '400_700': { label: '₱23k–41k', low: 23_000, high: 41_000 },
   '700_plus': { label: '₱41k+', low: 41_000, high: Number.POSITIVE_INFINITY }
};

/** The ladder an approved document puts them on (same thresholds as app_private.limit_ceiling). */
export const ladderForMonthlyPhp = (php: number) =>
   php >= 23_000 ? 'normal steps, no $60 top' : php >= 12_000 ? 'normal steps, top $60' : 'small steps, top $35';

/**
 * One line for the team's proof-of-income card, so approving is also a conscious ladder decision:
 * "🪜 Said: under ₱12k · Shows: about ₱18,400/month → if approved: normal steps, top $60 · ⚠️ more than they said".
 */
export const incomeLadderLine = (signUpBand: string | null | undefined, monthlyPhp: number | null): string => {
   const band = signUpBand ? BANDS[signUpBand] : undefined;
   const said = `Said: ${band?.label ?? 'nothing'}`;
   if (monthlyPhp == null) return `🪜 ${said} · Shows: no monthly amount → their ladder stays on what they said`;
   const shows = `Shows: about ₱${monthlyPhp.toLocaleString('en-US')}/month`;
   const mismatch = band
      ? monthlyPhp >= band.high
         ? ' · ⚠️ more than they said'
         : monthlyPhp < band.low
           ? ' · ⚠️ less than they said'
           : ''
      : '';
   return `🪜 ${said} · ${shows} → if approved: ${ladderForMonthlyPhp(monthlyPhp)}${mismatch}`;
};
