'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
   CartesianGrid,
   ComposedChart,
   Legend,
   Line,
   LineChart,
   ReferenceLine,
   ResponsiveContainer,
   Scatter,
   Tooltip,
   XAxis,
   YAxis
} from 'recharts';

import {
   borrowerCurrency,
   breakEvenSize,
   type CostLoan,
   DEFAULT_COSTS,
   type ExchangeCosts,
   exchangeCostShare,
   fxAdjustment,
   type LoanRealCost,
   type LocalCurrency,
   type MonthForecast,
   parseFrankfurter,
   type RateSeries,
   realCost,
   seasonalForecast,
   sizeCurve,
   sizeFloor,
   suggestedFee,
   summarize
} from '@/app/admin/borrowerCostModel';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// Admin → Finance → Borrower real cost (team-only; never shown to borrowers or lenders). Live USDC→PHP
// and USDC→IDR, then for every loan funded in the last 40 days what it really cost the
// borrower in their own money: our fee + the exchange-rate move + exchange fees. See borrowerCostModel.

const WINDOW_DAYS = 40;
const CHART_DAYS = 90;
const COSTS_KEY = 'md_admin_exchange_costs';
const CURRENCIES: LocalCurrency[] = ['PHP', 'IDR'];
const SYMBOL: Record<LocalCurrency, string> = { PHP: '₱', IDR: 'Rp' };

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const localDate = (iso: string, zone: string | null) => {
   try {
      return new Date(iso).toLocaleDateString('en-CA', { timeZone: zone || 'Asia/Manila' });
   } catch {
      return iso.slice(0, 10);
   }
};
const usd = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;
const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1)}%`);
const local = (n: number, c: LocalCurrency) =>
   `${n < 0 ? '-' : ''}${SYMBOL[c]}${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: c === 'IDR' ? 0 : 2 })}`;

const readCosts = (): Record<LocalCurrency, ExchangeCosts> => {
   try {
      const saved = JSON.parse(window.localStorage.getItem(COSTS_KEY) ?? 'null') as Partial<Record<LocalCurrency, ExchangeCosts>> | null;
      return { PHP: { ...DEFAULT_COSTS.PHP, ...saved?.PHP }, IDR: { ...DEFAULT_COSTS.IDR, ...saved?.IDR } };
   } catch {
      return DEFAULT_COSTS;
   }
};

type AnyRow = Record<string, any>;

interface Loaded {
   loans: CostLoan[];
   rates: Record<LocalCurrency, RateSeries>;
   live: Partial<Record<LocalCurrency, number>>;
   forecast: Record<LocalCurrency, MonthForecast[]>;
}

async function loadData(): Promise<Loaded> {
   const supabase = getSupabaseBrowserClient();
   const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
   const { data: loanRows, error } = await supabase
      .from('loans')
      .select(
         'id,tracking_id,borrower_user_id,loan_amount,total_repayment_amount,funded_at,repaid_at,repayment_status,due_timezone,is_test,loan_status'
      )
      .eq('loan_status', 'Lent')
      .eq('is_test', false)
      .gte('funded_at', since);
   if (error) throw error;
   const rows = (loanRows ?? []) as AnyRow[];
   const borrowerIds = [...new Set(rows.map((r) => r.borrower_user_id).filter(Boolean))] as string[];
   const [users, kyc] = await Promise.all([
      borrowerIds.length ? supabase.from('users').select('id,username').in('id', borrowerIds) : Promise.resolve({ data: [] }),
      borrowerIds.length
         ? supabase.from('kyc_identities').select('user_id,issuing_state').in('user_id', borrowerIds)
         : Promise.resolve({ data: [] })
   ]);
   const nameById = new Map(((users.data ?? []) as AnyRow[]).map((u) => [u.id as string, (u.username as string) ?? '—']));
   const stateById = new Map(((kyc.data ?? []) as AnyRow[]).map((k) => [k.user_id as string, k.issuing_state as string | null]));

   const loans: CostLoan[] = rows
      // Paid but no repayment date recorded (some older loans): we can't price the buy-back, so skip it
      // rather than treat it as still open.
      .filter((r) => r.funded_at && !(r.repayment_status === 'Paid' && !r.repaid_at))
      .map((r) => ({
         id: r.id,
         trackingId: r.tracking_id ?? r.id,
         borrower: nameById.get(r.borrower_user_id) ?? '—',
         currency: borrowerCurrency(stateById.get(r.borrower_user_id), r.due_timezone),
         principal: Number(r.loan_amount ?? 0),
         repayment: Number(r.total_repayment_amount ?? 0),
         fundedDate: localDate(r.funded_at, r.due_timezone),
         repaidDate: r.repayment_status === 'Paid' && r.repaid_at ? localDate(r.repaid_at, r.due_timezone) : null
      }));

   // Daily history from the earliest loan (or the chart window) to today; then the live price on top.
   const earliest = loans.reduce(
      (min, l) => (l.fundedDate < min ? l.fundedDate : min),
      ymd(new Date(Date.now() - CHART_DAYS * 86_400_000))
   );
   const start = ymd(new Date(Date.parse(earliest) - 7 * 86_400_000));
   const [history, longHistory, liveBody] = await Promise.all([
      fetch(`https://api.frankfurter.dev/v1/${start}..?base=USD&symbols=PHP,IDR`).then((r) => r.json()),
      // Every day since 2000, for the seasonal forecast.
      fetch('https://api.frankfurter.dev/v1/2000-01-01..?base=USD&symbols=PHP,IDR').then((r) => r.json()),
      fetch('https://api.coinbase.com/v2/exchange-rates?currency=USDC')
         .then((r) => r.json())
         .catch(() => null)
   ]);
   const rates = parseFrankfurter(history);
   const live: Partial<Record<LocalCurrency, number>> = {};
   for (const c of CURRENCIES) {
      const value = Number(liveBody?.data?.rates?.[c]);
      if (Number.isFinite(value) && value > 0) {
         live[c] = value;
         rates[c].set(ymd(new Date()), value); // today = live
      }
   }
   const long = parseFrankfurter(longHistory);
   const forecast = { PHP: seasonalForecast(long.PHP), IDR: seasonalForecast(long.IDR) };
   return { loans, rates, live, forecast };
}

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
   const color = tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-red-300' : 'text-white';
   return (
      <div className="rounded-2xl border border-[#2a1453] bg-[#1a0838] p-4">
         <p className="text-sm text-[#a89bb8]">{label}</p>
         <p className={`mt-1 text-2xl font-black ${color}`}>{value}</p>
         {sub ? <p className="mt-1 text-xs text-[#a89bb8]">{sub}</p> : null}
      </div>
   );
}

function RateCard({ currency, series, live }: { currency: LocalCurrency; series: RateSeries; live?: number }) {
   const points = [...series.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-CHART_DAYS)
      .map(([date, rate]) => ({ date: date.slice(5), rate }));
   const now = live ?? points.at(-1)?.rate ?? 0;
   const monthAgo = points.at(-31)?.rate ?? points[0]?.rate ?? now;
   const change = monthAgo ? (now - monthAgo) / monthAgo : 0;
   return (
      <div className="rounded-2xl border border-[#2a1453] bg-[#1a0838] p-4">
         <p className="text-sm text-[#a89bb8]">
            1 USDC → {currency}
            {live ? ' (live)' : ''}
         </p>
         <p className="mt-1 text-2xl font-black text-white">{local(now, currency)}</p>
         {/* Local currency weakening = more pesos per USDC = repaying costs borrowers more. */}
         <p className={`mt-1 text-xs ${change > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
            {change >= 0 ? '+' : ''}
            {(change * 100).toFixed(2)}% vs 30 days ago ·{' '}
            {change > 0 ? `${currency} weaker: repaying costs more` : `${currency} stronger: repaying costs less`}
         </p>
         <div className="mt-3 h-28">
            <ResponsiveContainer height="100%" width="100%">
               <LineChart data={points}>
                  <XAxis dataKey="date" hide />
                  <YAxis domain={['auto', 'auto']} hide />
                  <Tooltip
                     contentStyle={{ background: '#12052a', border: '1px solid #2a1453' }}
                     formatter={(v) => local(Number(v), currency)}
                  />
                  <Line dataKey="rate" dot={false} stroke="#a78bfa" strokeWidth={2} type="monotone" />
               </LineChart>
            </ResponsiveContainer>
         </div>
      </div>
   );
}

const COST_FIELDS: Array<{ key: keyof Omit<ExchangeCosts, 'label'>; label: string; unit: 'usdc' | 'pct' | 'local' }> = [
   { key: 'sendToExchangeUsdc', label: 'Send from Moodeng wallet to exchange', unit: 'usdc' },
   { key: 'sellPct', label: 'Sell USDC (fee/spread)', unit: 'pct' },
   { key: 'cashOutLocal', label: 'Cash out to bank / e-wallet', unit: 'local' },
   { key: 'cashInLocal', label: 'Cash in from bank / e-wallet', unit: 'local' },
   { key: 'buyPct', label: 'Buy USDC (fee/spread)', unit: 'pct' },
   { key: 'withdrawToWalletUsdc', label: 'Send USDC on Base to Moodeng wallet', unit: 'usdc' }
];

function CostEditor({
   costs,
   onChange
}: {
   costs: Record<LocalCurrency, ExchangeCosts>;
   onChange: (next: Record<LocalCurrency, ExchangeCosts>) => void;
}) {
   return (
      <div className="grid gap-3 md:grid-cols-2">
         {CURRENCIES.map((c) => (
            <div className="rounded-2xl border border-[#2a1453] bg-[#1a0838] p-4" key={c}>
               <p className="font-black text-white">
                  {c} · {costs[c].label}
               </p>
               <div className="mt-2 space-y-1.5">
                  {COST_FIELDS.map((f) => {
                     const raw = costs[c][f.key];
                     const shown = f.unit === 'pct' ? +(raw * 100).toFixed(4) : raw;
                     return (
                        <label className="flex items-center justify-between gap-3 text-sm text-[#d8cfe6]" key={f.key}>
                           <span>{f.label}</span>
                           <span className="flex items-center gap-1">
                              <input
                                 className="w-24 rounded-lg border border-[#2a1453] bg-[#12052a] px-2 py-1 text-right text-white"
                                 min={0}
                                 onChange={(e) => {
                                    const value = Number(e.target.value);
                                    if (!Number.isFinite(value) || value < 0) return;
                                    onChange({ ...costs, [c]: { ...costs[c], [f.key]: f.unit === 'pct' ? value / 100 : value } });
                                 }}
                                 step="any"
                                 type="number"
                                 value={shown}
                              />
                              <span className="w-10 text-xs text-[#a89bb8]">
                                 {f.unit === 'pct' ? '%' : f.unit === 'usdc' ? 'USDC' : SYMBOL[c]}
                              </span>
                           </span>
                        </label>
                     );
                  })}
               </div>
            </div>
         ))}
      </div>
   );
}

function SummaryBlock({ title, rows, note }: { title: string; rows: LoanRealCost[]; note: string }) {
   const s = summarize(rows);
   return (
      <div className="space-y-3">
         <div>
            <h3 className="text-lg font-black text-white">
               {title} ({s.count})
            </h3>
            <p className="text-xs text-[#a89bb8]">{note}</p>
         </div>
         <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card label="Median Moodeng fee" sub="What the loan shows, in USDC" value={pct(s.medianOurFeePct)} />
            <Card
               label="Median real cost"
               sub={`In their own money · ${pct(s.medianRealMonthlyPct)} per 30 days`}
               tone={s.medianRealPct !== null && s.medianOurFeePct !== null && s.medianRealPct > s.medianOurFeePct ? 'bad' : 'good'}
               value={pct(s.medianRealPct)}
            />
            <Card
               label="Exchange-rate effect"
               sub="Total, + = borrowers paid more"
               tone={s.fxUsd > 0 ? 'bad' : 'good'}
               value={usd(s.fxUsd)}
            />
            <Card
               label="Exchange fees"
               sub={`Total · our fees ${usd(s.ourFeeUsd)} · all-in ${usd(s.totalUsd)}`}
               value={usd(s.exchangeUsd)}
            />
         </div>
      </div>
   );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const signedPct = (n: number) => `${n > 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;
// A typical loan, for turning flat exchange fees into a %: $15 → $16.50 over 30 days.
const TYPICAL = { principal: 15, repayment: 16.5 };

function ForecastBlock({
   forecast,
   costs,
   rates,
   live,
   baseFee,
   medianFee,
   onBaseFee
}: {
   forecast: Record<LocalCurrency, MonthForecast[]>;
   costs: Record<LocalCurrency, ExchangeCosts>;
   rates: Record<LocalCurrency, RateSeries>;
   live: Partial<Record<LocalCurrency, number>>;
   baseFee: number;
   medianFee: number | null;
   onBaseFee: (fee: number) => void;
}) {
   const thisMonth = new Date().getMonth();
   return (
      <div className="space-y-3">
         <div>
            <h3 className="text-lg font-black text-white">FX forecast: what borrowers pay on top of our fee</h3>
            <p className="max-w-3xl text-xs text-[#a89bb8]">
               Seasonal model from every day since 2000: the usual 30-day move for a loan funded in each month (+ = the local currency
               weakens, so repaying costs more). Estimate = average of all years and the last 10. Bad case = 9 in 10 loans do better.
               Exchange fees are for a typical $15 → $16.50 loan with the costs below.
            </p>
         </div>
         <label className="flex flex-wrap items-center gap-2 text-sm text-[#d8cfe6]">
            Base fee in an average month (30 days):
            <input
               className="w-20 rounded-lg border border-[#2a1453] bg-[#12052a] px-2 py-1 text-right text-white"
               min={0}
               onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value) && value >= 0) onBaseFee(value / 100);
               }}
               step="0.1"
               type="number"
               value={+(baseFee * 100).toFixed(2)}
            />
            %<span className="text-xs text-[#a89bb8]">Median fee on the loans above: {pct(medianFee)}</span>
         </label>
         <div className="grid gap-3 md:grid-cols-2">
            {CURRENCIES.map((c) => {
               const rows = forecast[c];
               const now = rows[thisMonth];
               const rate = live[c] ?? [...rates[c].values()].at(-1) ?? 0;
               const exchange = rate ? exchangeCostShare(TYPICAL.principal, TYPICAL.repayment, rate, costs[c]) : 0;
               const fee = suggestedFee(baseFee, rows, thisMonth + 1);
               const baseline = fee + (now?.estimate ?? 0) + exchange;
               return (
                  <div className="rounded-2xl border border-[#2a1453] bg-[#1a0838] p-4" key={c}>
                     <p className="font-black text-white">
                        {c}: a loan funded this month ({MONTHS[thisMonth]})
                     </p>
                     <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-[#d8cfe6]">
                        <span className="font-black text-emerald-300">Suggested fee</span>
                        <span className="text-right font-black text-emerald-300">{pct(fee)}</span>
                        <span>Expected rate move</span>
                        <span className="text-right">{now ? signedPct(now.estimate) : '—'}</span>
                        <span>Exchange fees</span>
                        <span className="text-right">{pct(exchange)}</span>
                        <span className="font-black text-white">Real cost at that fee</span>
                        <span className="text-right font-black text-white">{pct(baseline)}</span>
                        <span>Bad case (rate)</span>
                        <span className="text-right">{now ? signedPct(now.p90) : '—'}</span>
                     </div>
                     <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-left text-xs">
                           <thead className="text-[#a89bb8]">
                              <tr>
                                 <th className="p-1">Funded in</th>
                                 <th className="p-1 text-right">Estimate</th>
                                 <th className="p-1 text-right">All years</th>
                                 <th className="p-1 text-right">Last 10y</th>
                                 <th className="p-1 text-right">Weakened</th>
                                 <th className="p-1 text-right">Bad case</th>
                                 <th className="p-1 text-right">Suggested fee</th>
                              </tr>
                           </thead>
                           <tbody>
                              {rows.map((m) => (
                                 <tr
                                    className={`border-t border-[#2a1453] ${m.month - 1 === thisMonth ? 'bg-[#2a1453] font-bold text-white' : 'text-[#d8cfe6]'}`}
                                    key={m.month}
                                 >
                                    <td className="p-1">{MONTHS[m.month - 1]}</td>
                                    <td className={`p-1 text-right ${m.estimate > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                                       {signedPct(m.estimate)}
                                    </td>
                                    <td className="p-1 text-right">{signedPct(m.meanAll)}</td>
                                    <td className="p-1 text-right">{signedPct(m.meanRecent)}</td>
                                    <td className="p-1 text-right">{Math.round(m.weakerShare * 100)}%</td>
                                    <td className="p-1 text-right">{signedPct(m.p90)}</td>
                                    <td className="p-1 text-right text-emerald-300">{pct(suggestedFee(baseFee, rows, m.month))}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
               );
            })}
         </div>
      </div>
   );
}

// The same loan's fee, moved by how much more (or less) than usual its currency was expected to shift
// over a loan funded that month — what we'd charge it with the dynamic fee.
const SIZE_ROWS = [15, 30, 50, 100, 200, 500];

// How the extra cost (exchange fees + expected rate move) shrinks as loans get bigger, with our real
// loans plotted on the same axes so the curve can be checked against them.
function SizeBlock({
   costs,
   forecast,
   rates,
   live,
   baseFee,
   loans
}: {
   costs: Record<LocalCurrency, ExchangeCosts>;
   forecast: Record<LocalCurrency, MonthForecast[]>;
   rates: Record<LocalCurrency, RateSeries>;
   live: Partial<Record<LocalCurrency, number>>;
   baseFee: number;
   loans: LoanRealCost[];
}) {
   const thisMonth = new Date().getMonth();
   return (
      <div className="space-y-3">
         <div>
            <h3 className="text-lg font-black text-white">Loan size: the extra cost shrinks as loans grow</h3>
            <p className="max-w-3xl text-xs text-[#a89bb8]">
               Most exchange fees are flat (send fees, the cash-out), so on a bigger loan they are a smaller share. The extra cost on top of
               our fee settles toward a floor: the two spreads plus the expected rate move for a loan funded this month. Dots are our real
               loans (extra cost actually paid; open loans at today&apos;s rate).
            </p>
         </div>
         <div className="grid gap-3 md:grid-cols-2">
            {CURRENCIES.map((c) => {
               const rate = live[c] ?? [...rates[c].values()].at(-1) ?? 0;
               const fx = forecast[c][thisMonth]?.estimate ?? 0;
               const curve = rate ? sizeCurve(costs[c], rate, fx, baseFee) : [];
               const floor = sizeFloor(costs[c], fx, baseFee);
               const under2 = breakEvenSize(curve, 0.02);
               const dots = loans
                  .filter((r) => r.loan.currency === c && r.received > 0)
                  .map((r) => ({ principal: r.loan.principal, actual: ((r.exchangeLocal + r.fxLocal) / r.received) * 100 }));
               const data = curve.map((p) => ({ principal: p.principal, extra: p.extraPct * 100, exchange: p.exchangePct * 100 }));
               return (
                  <div className="rounded-2xl border border-[#2a1453] bg-[#1a0838] p-4" key={c}>
                     <p className="font-black text-white">
                        {c} · {costs[c].label}
                     </p>
                     <p className="mt-1 text-xs text-[#a89bb8]">
                        Floor for big loans: {pct(floor)} · exchange fees fall under 2% from about{' '}
                        {under2 ? `$${under2}` : 'more than $500'}
                     </p>
                     <div className="mt-3 h-56">
                        <ResponsiveContainer height="100%" width="100%">
                           <ComposedChart margin={{ left: -10, right: 8, top: 4 }}>
                              <CartesianGrid stroke="#2a1453" />
                              <XAxis
                                 dataKey="principal"
                                 domain={[5, 500]}
                                 scale="log"
                                 stroke="#a89bb8"
                                 tickFormatter={(v) => `$${v}`}
                                 ticks={[5, 15, 30, 50, 100, 200, 500]}
                                 type="number"
                              />
                              <YAxis stroke="#a89bb8" tickFormatter={(v) => `${v}%`} />
                              <Tooltip
                                 contentStyle={{ background: '#12052a', border: '1px solid #2a1453' }}
                                 formatter={(v) => `${Number(v).toFixed(2)}%`}
                                 labelFormatter={(v) => `$${v} loan`}
                              />
                              <Legend wrapperStyle={{ fontSize: 12 }} />
                              <ReferenceLine
                                 label={{ value: 'floor', fill: '#a89bb8', fontSize: 11 }}
                                 stroke="#a89bb8"
                                 strokeDasharray="4 4"
                                 y={floor * 100}
                              />
                              <Line
                                 data={data}
                                 dataKey="extra"
                                 dot={false}
                                 name="Extra cost (fees + FX)"
                                 stroke="#f472b6"
                                 strokeWidth={2}
                                 type="monotone"
                              />
                              <Line
                                 data={data}
                                 dataKey="exchange"
                                 dot={false}
                                 name="Exchange fees only"
                                 stroke="#a78bfa"
                                 strokeWidth={2}
                                 type="monotone"
                              />
                              <Scatter data={dots} dataKey="actual" fill="#34d399" name="Our loans" />
                           </ComposedChart>
                        </ResponsiveContainer>
                     </div>
                     <table className="mt-3 w-full text-left text-xs">
                        <thead className="text-[#a89bb8]">
                           <tr>
                              <th className="p-1">Loan</th>
                              <th className="p-1 text-right">Exchange fees</th>
                              <th className="p-1 text-right">+ rate move</th>
                              <th className="p-1 text-right">+ our fee</th>
                              <th className="p-1 text-right">= real cost</th>
                           </tr>
                        </thead>
                        <tbody>
                           {SIZE_ROWS.map((size) => {
                              const point = rate ? sizeCurve(costs[c], rate, fx, baseFee, [size])[0] : null;
                              return (
                                 <tr className="border-t border-[#2a1453] text-[#d8cfe6]" key={size}>
                                    <td className="p-1">${size}</td>
                                    <td className="p-1 text-right">{point ? pct(point.exchangePct) : '—'}</td>
                                    <td className="p-1 text-right">{point ? signedPct(point.fxPct) : '—'}</td>
                                    <td className="p-1 text-right">{pct(baseFee)}</td>
                                    <td className="p-1 text-right font-bold text-white">{point ? pct(baseFee + point.extraPct) : '—'}</td>
                                 </tr>
                              );
                           })}
                        </tbody>
                     </table>
                  </div>
               );
            })}
         </div>
      </div>
   );
}

function LoanTable({ rows, forecast }: { rows: LoanRealCost[]; forecast: Record<LocalCurrency, MonthForecast[]> }) {
   if (!rows.length) return <p className="text-sm text-[#a89bb8]">No loans.</p>;
   return (
      <div className="overflow-x-auto rounded-2xl border border-[#2a1453]">
         <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="text-[#a89bb8]">
               <tr>
                  {[
                     'Borrower',
                     'Loan',
                     'Funded → repaid',
                     'Rate out → in',
                     'Got (local)',
                     'Paid back (local)',
                     'Moodeng fee',
                     'Rate move',
                     'Exchange fees',
                     'Real cost',
                     'Per 30 days',
                     'Suggested fee'
                  ].map((h) => (
                     <th className="p-2" key={h}>
                        {h}
                     </th>
                  ))}
               </tr>
            </thead>
            <tbody>
               {rows.map((r) => {
                  const c = r.loan.currency;
                  return (
                     <tr className="border-t border-[#2a1453] align-top text-[#e9e2f3]" key={r.loan.id}>
                        <td className="p-2">
                           <span className="font-bold">{r.loan.borrower}</span>
                           <span className="block text-xs text-[#a89bb8]">{c}</span>
                        </td>
                        <td className="p-2">
                           {usd(r.loan.principal)} → {usd(r.loan.repayment)}
                           <span className="block text-xs text-[#a89bb8]">fee {pct(r.ourFeePct)}</span>
                        </td>
                        <td className="p-2">
                           {r.loan.fundedDate} → {r.loan.repaidDate ?? 'today*'}
                           <span className="block text-xs text-[#a89bb8]">{r.days} days</span>
                        </td>
                        <td className="p-2">
                           {r.rateOut.toFixed(c === 'IDR' ? 0 : 3)} → {r.rateIn.toFixed(c === 'IDR' ? 0 : 3)}
                        </td>
                        <td className="p-2">{local(r.received, c)}</td>
                        <td className="p-2">{local(r.paid, c)}</td>
                        <td className="p-2">{local(r.feeLocal, c)}</td>
                        <td className={`p-2 ${r.fxLocal > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                           {r.fxLocal > 0 ? '+' : ''}
                           {local(r.fxLocal, c)}
                        </td>
                        <td className="p-2">{local(r.exchangeLocal, c)}</td>
                        <td className="p-2 font-black">
                           {local(r.totalLocal, c)}
                           <span className="block text-xs font-normal text-[#a89bb8]">{pct(r.realPct)}</span>
                        </td>
                        <td className="p-2">{pct(r.realMonthlyPct)}</td>
                        <td className="p-2 text-emerald-300">
                           {pct(Math.max(0, r.ourFeePct - fxAdjustment(forecast[c], Number(r.loan.fundedDate.slice(5, 7)))))}
                           <span className="block text-xs text-[#a89bb8]">vs {pct(r.ourFeePct)} charged</span>
                        </td>
                     </tr>
                  );
               })}
            </tbody>
         </table>
      </div>
   );
}

export default function BorrowerCostSection() {
   const [data, setData] = useState<Loaded | null>(null);
   const [error, setError] = useState('');
   const [costs, setCosts] = useState(readCosts);
   const [baseFeeInput, setBaseFeeInput] = useState<number | null>(null);

   const load = useCallback(async () => {
      setError('');
      try {
         setData(await loadData());
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not load');
      }
   }, []);
   useEffect(() => {
      void load();
   }, [load]);

   const updateCosts = (next: Record<LocalCurrency, ExchangeCosts>) => {
      setCosts(next);
      try {
         window.localStorage.setItem(COSTS_KEY, JSON.stringify(next));
      } catch {
         // Storage blocked: edits last for this visit.
      }
   };

   const rows = useMemo(() => {
      if (!data) return [];
      const today = ymd(new Date());
      return data.loans
         .map((loan) => realCost(loan, data.rates, costs, today))
         .filter((r): r is LoanRealCost => r !== null)
         .sort((a, b) => b.loan.fundedDate.localeCompare(a.loan.fundedDate));
   }, [data, costs]);
   const repaid = rows.filter((r) => !r.projected);
   const open = rows.filter((r) => r.projected);
   const medianFee = summarize(rows).medianOurFeePct;
   const baseFee = baseFeeInput ?? medianFee ?? 0.1;

   if (error) return <p className="rounded-lg bg-[#2a0f1f] px-3 py-2 text-[#f2c4c4]">{error}</p>;
   if (!data) return <p className="text-[#a89bb8]">Loading rates and loans…</p>;

   return (
      <div className="space-y-8">
         <div className="grid gap-3 md:grid-cols-2">
            {CURRENCIES.map((c) => (
               <RateCard currency={c} key={c} live={data.live[c]} series={data.rates[c]} />
            ))}
         </div>

         <SummaryBlock
            note={`Funded in the last ${WINDOW_DAYS} days. Cash-out on the funding day, buy-back on the repay day.`}
            rows={repaid}
            title="Repaid loans"
         />
         <LoanTable forecast={data.forecast} rows={repaid} />

         <SummaryBlock
            note="Still open: priced as if they bought USDC back at today's live rate (*)."
            rows={open}
            title="Open loans (if repaid today)"
         />
         <LoanTable forecast={data.forecast} rows={open} />

         <ForecastBlock
            baseFee={baseFee}
            costs={costs}
            forecast={data.forecast}
            live={data.live}
            medianFee={medianFee}
            onBaseFee={setBaseFeeInput}
            rates={data.rates}
         />

         <SizeBlock baseFee={baseFee} costs={costs} forecast={data.forecast} live={data.live} loans={rows} rates={data.rates} />

         <div className="space-y-3">
            <div>
               <h3 className="text-lg font-black text-white">Expected exchange costs</h3>
               <p className="text-xs text-[#a89bb8]">
                  Per trip, used above. Edit to match what the apps charge; saved on this browser. Rates are mid-market (ECB daily via
                  Frankfurter; live from Coinbase), so a real exchange&apos;s spread belongs in the buy/sell %.
               </p>
            </div>
            <CostEditor costs={costs} onChange={updateCosts} />
            <button
               className="rounded-full border border-[#8336f0] px-4 py-2 text-sm font-bold text-white"
               onClick={() => updateCosts(DEFAULT_COSTS)}
               type="button"
            >
               Reset to defaults
            </button>
         </div>
      </div>
   );
}
