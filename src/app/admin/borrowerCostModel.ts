// Admin → Finance → Borrower real cost. Borrowers borrow and repay in USDC but live in pesos or rupiah,
// so what a loan really costs them is: our fee, plus how the exchange rate moved between cashing out and
// buying USDC back, plus the exchange's own fees on both trips. Team-only: it tells us whether our
// pricing is competitive once those are counted.
//
// Timing (George, 2026-10-13): borrowers cash out the day the loan is funded and buy USDC back the day
// they repay. Rates are mid-market (ECB daily reference via Frankfurter; weekends use the last weekday).

export type LocalCurrency = 'PHP' | 'IDR';

// One trip each way. Flat USDC fees are network/send fees; percentages are the exchange's trading cut
// (fee or spread); flat local fees are bank / e-wallet transfers.
export interface ExchangeCosts {
   label: string;
   sendToExchangeUsdc: number; // Moodeng wallet → exchange, when cashing out
   sellPct: number; // USDC → local
   cashOutLocal: number; // exchange → bank / e-wallet
   cashInLocal: number; // bank / e-wallet → exchange
   buyPct: number; // local → USDC
   withdrawToWalletUsdc: number; // exchange → Moodeng wallet on Base, when repaying
}

// Defaults the team can edit on the page. Sources: PDAX withdrawal-fee table (USDC on Base 0.08), PDAX
// trading fee 0.4–0.5%, InstaPay cash-out ₱15; Tokocrypto buy 0.2222% and USDC-on-Base send 0.2
// (see memory: Indonesia repay sources). Sending from the Moodeng wallet costs about 0.01 USDC (George).
export const DEFAULT_COSTS: Record<LocalCurrency, ExchangeCosts> = {
   PHP: {
      label: 'PDAX',
      sendToExchangeUsdc: 0.01,
      sellPct: 0.005,
      cashOutLocal: 15,
      cashInLocal: 0,
      buyPct: 0.005,
      withdrawToWalletUsdc: 0.08
   },
   IDR: {
      label: 'Tokocrypto',
      sendToExchangeUsdc: 0.01,
      sellPct: 0.002222,
      cashOutLocal: 0,
      cashInLocal: 0,
      buyPct: 0.002222,
      withdrawToWalletUsdc: 0.2
   }
};

// Local units per 1 USD, by date (YYYY-MM-DD).
export type RateSeries = Map<string, number>;

/** The rate on `date`, or the latest one before it (ECB doesn't publish on weekends or holidays). */
export const rateOn = (series: RateSeries, date: string): number | null => {
   let best: string | null = null;
   for (const day of series.keys()) if (day <= date && (best === null || day > best)) best = day;
   return best === null ? null : (series.get(best) ?? null);
};

/** Which currency a borrower lives in: their ID's country first, then their loan's time zone. */
export const borrowerCurrency = (issuingState: string | null | undefined, timezone: string | null | undefined): LocalCurrency => {
   const state = issuingState?.toUpperCase() ?? '';
   if (state === 'IDN' || state === 'ID') return 'IDR';
   if (state === 'PHL' || state === 'PH') return 'PHP';
   if (/^Asia\/(Jakarta|Makassar|Jayapura|Pontianak)$/.test(timezone ?? '')) return 'IDR';
   return 'PHP';
};

export interface CostLoan {
   id: string;
   trackingId: string;
   borrower: string;
   currency: LocalCurrency;
   principal: number; // USDC
   repayment: number; // USDC owed in total
   fundedDate: string;
   repaidDate: string | null; // null = still open
}

export interface LoanRealCost {
   loan: CostLoan;
   projected: boolean; // still open: priced as if repaid today
   days: number;
   rateOut: number; // local per USD when they cashed out
   rateIn: number; // local per USD when they bought back
   received: number; // local they ended up with after cashing out
   paid: number; // local it cost to repay
   feeLocal: number; // our fee, at the cash-out rate
   fxLocal: number; // + when the local currency weakened (costs them more)
   exchangeLocal: number; // both exchange trips
   totalLocal: number; // paid − received
   ourFeePct: number; // (repayment − principal) / principal
   realPct: number; // totalLocal / received
   realMonthlyPct: number; // realPct scaled to 30 days
   totalUsd: number; // totalLocal at the cash-out rate, for adding up across currencies
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const realCost = (
   loan: CostLoan,
   rates: Record<LocalCurrency, RateSeries>,
   costs: Record<LocalCurrency, ExchangeCosts>,
   today: string
): LoanRealCost | null => {
   const series = rates[loan.currency];
   const c = costs[loan.currency];
   const buyDate = loan.repaidDate ?? today;
   const rateOut = rateOn(series, loan.fundedDate);
   const rateIn = rateOn(series, buyDate);
   if (!rateOut || !rateIn || loan.principal <= 0) return null;

   const received = Math.max(0, loan.principal - c.sendToExchangeUsdc) * rateOut * (1 - c.sellPct) - c.cashOutLocal;
   const paid = (loan.repayment + c.withdrawToWalletUsdc) * rateIn * (1 + c.buyPct) + c.cashInLocal;
   const totalLocal = paid - received;
   const feeLocal = (loan.repayment - loan.principal) * rateOut;
   const fxLocal = loan.repayment * (rateIn - rateOut);
   const days = Math.max(1, Math.round((Date.parse(buyDate) - Date.parse(loan.fundedDate)) / DAY_MS));
   const realPct = received > 0 ? totalLocal / received : 0;
   return {
      loan,
      projected: loan.repaidDate === null,
      days,
      rateOut,
      rateIn,
      received,
      paid,
      feeLocal,
      fxLocal,
      exchangeLocal: totalLocal - feeLocal - fxLocal,
      totalLocal,
      ourFeePct: (loan.repayment - loan.principal) / loan.principal,
      realPct,
      realMonthlyPct: (realPct * 30) / days,
      totalUsd: totalLocal / rateOut
   };
};

export const median = (values: number[]): number | null => {
   const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
   if (!sorted.length) return null;
   const mid = Math.floor(sorted.length / 2);
   return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export interface CostSummary {
   count: number;
   principalUsd: number;
   ourFeeUsd: number;
   fxUsd: number;
   exchangeUsd: number;
   totalUsd: number;
   medianOurFeePct: number | null;
   medianRealPct: number | null;
   medianRealMonthlyPct: number | null;
}

export const summarize = (rows: LoanRealCost[]): CostSummary => ({
   count: rows.length,
   principalUsd: rows.reduce((t, r) => t + r.loan.principal, 0),
   ourFeeUsd: rows.reduce((t, r) => t + r.feeLocal / r.rateOut, 0),
   fxUsd: rows.reduce((t, r) => t + r.fxLocal / r.rateOut, 0),
   exchangeUsd: rows.reduce((t, r) => t + r.exchangeLocal / r.rateOut, 0),
   totalUsd: rows.reduce((t, r) => t + r.totalUsd, 0),
   medianOurFeePct: median(rows.map((r) => r.ourFeePct)),
   medianRealPct: median(rows.map((r) => r.realPct)),
   medianRealMonthlyPct: median(rows.map((r) => r.realMonthlyPct))
});

/** Frankfurter's range response → one series per currency. */
export const parseFrankfurter = (body: { rates?: Record<string, Record<string, number>> }): Record<LocalCurrency, RateSeries> => {
   const out: Record<LocalCurrency, RateSeries> = { PHP: new Map(), IDR: new Map() };
   for (const [day, values] of Object.entries(body.rates ?? {})) {
      if (Number.isFinite(values.PHP)) out.PHP.set(day, values.PHP);
      if (Number.isFinite(values.IDR)) out.IDR.set(day, values.IDR);
   }
   return out;
};

// ---- FX forecast: seasonal model ----------------------------------------------------------------
//
// For a loan funded in a given calendar month, how much the local currency usually moves over the
// next `horizonDays` (+ = it weakens, so buying USDC back costs the borrower more). Built from every
// day since 2000: the move from that day to `horizonDays` later, grouped by the start month. The
// estimate blends all years with the last 10, because the pattern drifts; the bad case is the 90th
// percentile. Checked 2026-10-13: the peso tends to weaken May–Sep and firm Nov–Jan (holiday
// remittances), but a month's average (±0.1–0.9%) is small next to the spread (about 1.8%).

export interface MonthForecast {
   month: number; // 1–12
   meanAll: number;
   meanRecent: number;
   estimate: number;
   weakerShare: number; // share of start days where the currency weakened
   p90: number; // bad case
   samples: number;
}

const percentile = (values: number[], p: number) => {
   const sorted = [...values].sort((a, b) => a - b);
   return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0;
};
const mean = (values: number[]) => (values.length ? values.reduce((t, v) => t + v, 0) / values.length : 0);

export const seasonalForecast = (series: RateSeries, horizonDays = 30, recentYears = 10, now = new Date()): MonthForecast[] => {
   const days = [...series.keys()].sort();
   const times = days.map((d) => Date.parse(d));
   const values = days.map((d) => series.get(d) as number);
   const recentFrom = now.getUTCFullYear() - recentYears;
   const byMonth = Array.from({ length: 12 }, () => ({ all: [] as number[], recent: [] as number[] }));
   let j = 0;
   for (let i = 0; i < days.length; i += 1) {
      const target = times[i] + horizonDays * DAY_MS;
      while (j < days.length && times[j] < target) j += 1;
      if (j >= days.length) break;
      const change = values[j] / values[i] - 1;
      const month = Number(days[i].slice(5, 7)) - 1;
      byMonth[month].all.push(change);
      if (Number(days[i].slice(0, 4)) >= recentFrom) byMonth[month].recent.push(change);
   }
   return byMonth.map(({ all, recent }, index) => {
      const meanAll = mean(all);
      const meanRecent = recent.length ? mean(recent) : meanAll;
      return {
         month: index + 1,
         meanAll,
         meanRecent,
         estimate: (meanAll + meanRecent) / 2,
         weakerShare: all.length ? all.filter((c) => c > 0).length / all.length : 0,
         p90: percentile(all, 0.9),
         samples: all.length
      };
   });
};

/** Exchange fees for one loan of `principal` USDC repaid as `repayment`, as a share of what they receive. */
export const exchangeCostShare = (principal: number, repayment: number, rate: number, c: ExchangeCosts): number => {
   const received = Math.max(0, principal - c.sendToExchangeUsdc) * rate * (1 - c.sellPct) - c.cashOutLocal;
   const paidNoFx = (repayment + c.withdrawToWalletUsdc) * rate * (1 + c.buyPct) + c.cashInLocal;
   return received > 0 ? (paidNoFx - received - (repayment - principal) * rate) / received : 0;
};

// ---- Suggested fee: hold the borrower's all-in cost steady across the year ----------------------
//
// When the currency is expected to weaken more than usual over a loan (e.g. the peso in May), the
// borrower already pays extra through the rate, so the suggested fee drops by that extra; when it is
// expected to firm (Nov–Jan), the fee can rise by the same amount. `baseFee` is the fee we'd charge in
// an average month. A suggestion for the team only; nothing charges it automatically.

/** How much more than an average month the currency is expected to move for a loan funded in `month` (1–12). */
export const fxAdjustment = (forecast: MonthForecast[], month: number): number => {
   if (!forecast.length) return 0;
   const yearAverage = forecast.reduce((t, m) => t + m.estimate, 0) / forecast.length;
   return (forecast[month - 1]?.estimate ?? yearAverage) - yearAverage;
};

export const suggestedFee = (baseFee: number, forecast: MonthForecast[], month: number): number =>
   Math.max(0, baseFee - fxAdjustment(forecast, month));

// ---- Loan size: flat fees fade as loans grow --------------------------------------------------
//
// Most exchange costs are flat (send fees in USDC, the ₱15 cash-out), so as a share of the loan they
// shrink as loans get bigger, and the extra cost settles toward a floor: the two spreads plus the
// expected exchange-rate move. extra(P) ≈ flat / P + sell% + buy% + FX.

export interface SizePoint {
   principal: number;
   exchangePct: number; // exchange fees as a share of what they receive
   fxPct: number; // expected rate move for a loan funded this month
   extraPct: number; // exchange + FX: on top of our fee
}

export const sizeCurve = (
   costs: ExchangeCosts,
   rate: number,
   fxEstimate: number,
   feePct: number,
   sizes: number[] = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200, 300, 500]
): SizePoint[] =>
   sizes.map((principal) => {
      const exchangePct = exchangeCostShare(principal, principal * (1 + feePct), rate, costs);
      // The rate move applies to the whole repayment, as a share of what they received.
      const fxPct = fxEstimate * (1 + feePct);
      return { principal, exchangePct, fxPct, extraPct: exchangePct + fxPct };
   });

/** Where the extra cost settles for very large loans: both spreads plus the expected rate move. */
export const sizeFloor = (costs: ExchangeCosts, fxEstimate: number, feePct: number) =>
   costs.sellPct + costs.buyPct * (1 + feePct) + fxEstimate * (1 + feePct);

/** The smallest loan (in the curve's steps) whose exchange fees are at or under `targetPct`. */
export const breakEvenSize = (curve: SizePoint[], targetPct: number): number | null =>
   curve.find((p) => p.exchangePct <= targetPct)?.principal ?? null;
