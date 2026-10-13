'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
   addSpend,
   type CreditLineData,
   deleteSpend,
   loadCreditLine,
   loadMarketing,
   type MarketingData,
   saveGoal,
   setCodeChannel,
   setGoalExcluded
} from '@/app/admin/adminFinance';
import { addDays, buildFacilityLoans, facilitySummary, manilaDate } from '@/app/admin/creditLineModel';
import GoalSlotsBoard from '@/app/admin/GoalSlotsBoard';
import {
   averageYield,
   cacReport,
   funnel,
   goalSlots,
   type MarketingSpendRow,
   type MonthlyGoals,
   type ReferralCodeRow,
   retention,
   unitEconomics,
   whoToContact
} from '@/app/admin/marketingModel';

// Admin → Growth → Marketing: are we on track for the month's lending goal, what each week still needs, what
// marketing costs per real borrower (vs the CAC target), and who to contact today. Spend is logged here.

const usd = (n: number, digits = 0) =>
   `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`);
const name = (u: { username: string | null; display_name: string | null; facebook_name: string | null } | null) =>
   u ? `${u.display_name || u.username || '?'}${u.facebook_name ? ` (FB ${u.facebook_name})` : ''}` : '?';

const lastDayOf = (month: string) => {
   const [y, mo] = month.split('-').map(Number);
   return addDays(mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`, -1);
};

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'warn' | 'bad' }) {
   const color = tone === 'good' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : tone === 'bad' ? 'text-red-300' : 'text-white';
   return (
      <div className="rounded-2xl border border-[#2a1453] bg-[#1a0838] p-4">
         <p className="text-sm text-[#a89bb8]">{label}</p>
         <p className={`mt-1 text-2xl font-black ${color}`}>{value}</p>
         {sub ? <p className="mt-1 text-xs text-[#a89bb8]">{sub}</p> : null}
      </div>
   );
}

// Game-style progress bar: solid = done, faded = where the current pace lands, tick = target.
function Gauge({ value, projected, target, label }: { value: number; projected?: number; target: number; label: string }) {
   const done = target > 0 ? Math.min(100, (value / target) * 100) : 0;
   const proj = projected !== undefined && target > 0 ? Math.min(100, (projected / target) * 100) : done;
   return (
      <div>
         <div className="flex items-baseline justify-between text-sm">
            <span className="font-bold">{label}</span>
            <span className="text-[#a89bb8]">
               {usd(value)} / {usd(target)} · {Math.round(done)}%
            </span>
         </div>
         <div className="relative mt-1 h-5 overflow-hidden rounded-full bg-[#241044]">
            <div className="absolute inset-y-0 left-0 bg-amber-400/40" style={{ width: `${proj}%` }} />
            <div className="absolute inset-y-0 left-0 bg-[#8336f0]" style={{ width: `${done}%` }} />
         </div>
      </div>
   );
}

export default function MarketingSection() {
   const today = manilaDate(new Date().toISOString());
   const [month, setMonth] = useState(today.slice(0, 7));
   const [data, setData] = useState<MarketingData | null>(null);
   const [credit, setCredit] = useState<CreditLineData | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);
   const [goalDraft, setGoalDraft] = useState<MonthlyGoals | null>(null);
   const [spendDraft, setSpendDraft] = useState({
      spent_on: today,
      channel: 'poster' as MarketingSpendRow['channel'],
      amount_usd: '',
      referral_code_id: '',
      note: ''
   });
   const [defaults, setDefaults] = useState({ first: 8, later: 3 });

   const load = useCallback(async () => {
      setError(null);
      try {
         const [m, c] = await Promise.all([loadMarketing(month), loadCreditLine().catch(() => null)]);
         setData(m);
         setCredit(c);
         setGoalDraft(m.goals);
      } catch (err) {
         setError((err as { message?: string })?.message ?? 'Could not load marketing data.');
      }
   }, [month]);

   useEffect(() => {
      void load();
   }, [load]);

   const run = async (fn: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      try {
         await fn();
         await load();
      } catch (err) {
         setError((err as { message?: string })?.message ?? 'Save failed.');
      } finally {
         setBusy(false);
      }
   };

   // A past month is complete; a future month hasn't started.
   const effectiveToday = month < today.slice(0, 7) ? lastDayOf(month) : month > today.slice(0, 7) ? addDays(`${month}-01`, -1) : today;

   const m = useMemo(() => {
      if (!data) return null;
      const goals = data.goals;
      const slots = goalSlots(data.loans, data.users, data.excluded, month, effectiveToday, goals.lent_usd, goals.cac_target_usd);
      const cac = cacReport(data.loans, data.users, data.spend, data.codes, month, goals);
      const funnel30 = funnel(data.users, data.loans, addDays(today, -29), today);
      const funnel60 = funnel(data.users, data.loans, addDays(today, -59), today);
      const ret = retention(data.loans);
      const contacts = whoToContact(data.loans, data.users, today);
      const yieldPerLoan = averageYield(data.loans, addDays(today, -60));
      return { slots, cac, funnel30, funnel60, ret, contacts, yieldPerLoan };
   }, [data, month, effectiveToday, today]);

   const creditSummary = useMemo(() => {
      if (!credit?.facility) return null;
      const loans = buildFacilityLoans(credit.loans, credit.ledger, today);
      return { facility: credit.facility, ...facilitySummary(credit.facility, loans, credit.ledger, today) };
   }, [credit, today]);

   const economics = useMemo(() => {
      if (!m || !data) return [];
      const r1 = m.ret.find((r) => r.loanNumber === 1)?.reborrowRate ?? 0.85;
      const later = m.ret.filter((r) => r.loanNumber > 1 && r.reborrowRate !== null);
      const r2 = later.length ? later.reduce((s, r) => s + (r.reborrowRate ?? 0), 0) / later.length : 0.7;
      const amounts = m.ret.map((r) => r.avgAmount);
      while (amounts.length < 6) amounts.push(amounts[amounts.length - 1] ?? 20);
      const base = {
         yieldPerLoan: m.yieldPerLoan || 0.13,
         reborrowAfterFirst: r1,
         reborrowLater: r2,
         amounts,
         defaultFirst: defaults.first / 100,
         defaultLater: defaults.later / 100,
         costOfFundsMonthly: creditSummary ? Number(creditSummary.facility.annual_rate) / 12 : 0.0125,
         opsPerBorrower: 1
      };
      const target = data.goals.cac_target_usd;
      return [
         { channel: `At your CAC target ($${target})`, ...unitEconomics({ ...base, cac: target, repayBonus: 0 }) },
         { channel: 'Poster ($20 for 4 borrowers)', ...unitEconomics({ ...base, cac: 5, repayBonus: 0 }) },
         { channel: 'Referral $5 + $5 on repay', ...unitEconomics({ ...base, cac: 5, repayBonus: 5 }) },
         { channel: 'Referral $5 + $10 on repay', ...unitEconomics({ ...base, cac: 5, repayBonus: 10 }) },
         { channel: 'Re-engaging existing users', ...unitEconomics({ ...base, cac: 0, repayBonus: 0 }) }
      ].map((row) => ({ ...row, inputs: base }));
   }, [m, data, defaults, creditSummary]);

   if (error && !data) return <p className="text-red-300">{error}</p>;
   if (!data || !m || !goalDraft) return <p className="text-[#a89bb8]">Loading…</p>;
   const { cac } = m;

   return (
      <div className="space-y-8">
         <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-sm text-[#a89bb8]">
               Month
               <input
                  className="mt-1 rounded-lg bg-[#12052a] px-3 py-2 text-white"
                  onChange={(e) => setMonth(e.target.value)}
                  type="month"
                  value={month}
               />
            </label>
            {error ? <p className="text-red-300">{error}</p> : null}
         </div>

         {/* 1. Goal, by name */}
         <section className="space-y-4 rounded-3xl border border-[#2a1453] bg-[#160631] p-5">
            <GoalSlotsBoard
               budget={data.goals.marketing_budget_usd}
               busy={busy}
               cacTarget={data.goals.cac_target_usd}
               isCurrentMonth={month === today.slice(0, 7)}
               onExclude={(userId, who) => {
                  if (window.confirm(`Leave ${who} out of this month's plan?`)) void run(() => setGoalExcluded(userId, true));
               }}
               onRestore={(userId) => void run(() => setGoalExcluded(userId, false))}
               slots={m.slots}
            />
            {creditSummary ? (
               <div className="pt-2">
                  <Gauge
                     label={`Credit line used (${creditSummary.facility.name})`}
                     target={Number(creditSummary.facility.commitment_usd)}
                     value={creditSummary.deployed}
                  />
                  <p className="mt-1 text-xs text-[#a89bb8]">
                     {usd(creditSummary.unallocated)} not lent yet. Loans run ~30 days, so this line can fund about{' '}
                     {usd(Number(creditSummary.facility.commitment_usd))} a month.
                  </p>
               </div>
            ) : null}
         </section>

         {/* 2. Marketing spend and CAC */}
         <section className="space-y-4 rounded-3xl border border-[#2a1453] bg-[#160631] p-5">
            <h3 className="text-xl font-black">Marketing spend and cost per borrower</h3>
            <Gauge label="Budget used" target={cac.budget} value={cac.spent} />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
               <Tile label="Spent this month" sub={`Budget ${usd(cac.budget)}`} value={usd(cac.spent, 2)} />
               <Tile label="Left in budget" tone={cac.left < 0 ? 'bad' : undefined} value={usd(cac.left, 2)} />
               <Tile
                  label="Cost per new borrower"
                  sub={`${cac.newBorrowers} new borrowers this month${cac.spent ? '' : ' · log spend to see cost'}`}
                  tone={cac.cacPerBorrower === null ? undefined : cac.cacPerBorrower <= cac.cacTarget ? 'good' : 'bad'}
                  value={cac.cacPerBorrower === null ? '—' : usd(cac.cacPerBorrower, 2)}
               />
               <Tile
                  label="Cost per repaying borrower"
                  sub={`Target ${usd(cac.cacTarget, 2)} · ${cac.repaying} repaid so far${cac.spent ? '' : ' · log spend to see cost'}`}
                  tone={cac.cacPerRepaying === null ? undefined : cac.cacPerRepaying <= cac.cacTarget ? 'good' : 'bad'}
                  value={cac.cacPerRepaying === null ? '—' : usd(cac.cacPerRepaying, 2)}
               />
            </div>
            {cac.byChannel.length ? (
               <table className="w-full text-left text-sm">
                  <thead className="text-[#a89bb8]">
                     <tr>
                        <th className="p-2">Channel</th>
                        <th className="p-2">Spend</th>
                        <th className="p-2">New borrowers</th>
                        <th className="p-2">Repaid</th>
                        <th className="p-2">Per borrower</th>
                        <th className="p-2">Per repaying</th>
                     </tr>
                  </thead>
                  <tbody>
                     {cac.byChannel.map((c) => (
                        <tr className="border-t border-[#2a1453]" key={c.channel}>
                           <td className="p-2 capitalize">{c.channel}</td>
                           <td className="p-2">{usd(c.spend, 2)}</td>
                           <td className="p-2">{c.newBorrowers}</td>
                           <td className="p-2">{c.repaying}</td>
                           <td className="p-2">{c.cacPerBorrower === null ? '—' : usd(c.cacPerBorrower, 2)}</td>
                           <td className={`p-2 ${c.cacPerRepaying !== null && c.cacPerRepaying > cac.cacTarget ? 'text-red-300' : ''}`}>
                              {c.cacPerRepaying === null ? '—' : usd(c.cacPerRepaying, 2)}
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            ) : null}
            <form
               className="grid grid-cols-2 gap-2 lg:grid-cols-6"
               onSubmit={(e) => {
                  e.preventDefault();
                  const amount = Number(spendDraft.amount_usd);
                  if (!spendDraft.spent_on || !Number.isFinite(amount) || amount <= 0) {
                     setError('Enter a date and an amount above $0.');
                     return;
                  }
                  void run(async () => {
                     await addSpend({
                        spent_on: spendDraft.spent_on,
                        channel: spendDraft.channel,
                        amount_usd: amount,
                        referral_code_id: spendDraft.referral_code_id || null,
                        note: spendDraft.note.trim() || null
                     });
                     setSpendDraft({ ...spendDraft, amount_usd: '', note: '' });
                  });
               }}
            >
               <input
                  className="rounded-lg bg-[#12052a] px-2 py-2 text-sm"
                  onChange={(e) => setSpendDraft({ ...spendDraft, spent_on: e.target.value })}
                  type="date"
                  value={spendDraft.spent_on}
               />
               <select
                  className="rounded-lg bg-[#12052a] px-2 py-2 text-sm"
                  onChange={(e) => setSpendDraft({ ...spendDraft, channel: e.target.value as MarketingSpendRow['channel'] })}
                  value={spendDraft.channel}
               >
                  <option value="poster">Poster</option>
                  <option value="referral">Referral payout</option>
                  <option value="ads">Ads</option>
                  <option value="other">Other</option>
               </select>
               <input
                  className="rounded-lg bg-[#12052a] px-2 py-2 text-sm"
                  onChange={(e) => setSpendDraft({ ...spendDraft, amount_usd: e.target.value })}
                  placeholder="Amount $"
                  value={spendDraft.amount_usd}
               />
               <select
                  className="rounded-lg bg-[#12052a] px-2 py-2 text-sm"
                  onChange={(e) => setSpendDraft({ ...spendDraft, referral_code_id: e.target.value })}
                  value={spendDraft.referral_code_id}
               >
                  <option value="">No code</option>
                  {data.codes.map((c) => (
                     <option key={c.id} value={c.id}>
                        {c.code} ({c.channel})
                     </option>
                  ))}
               </select>
               <input
                  className="rounded-lg bg-[#12052a] px-2 py-2 text-sm"
                  onChange={(e) => setSpendDraft({ ...spendDraft, note: e.target.value })}
                  placeholder="Note (where, who)"
                  value={spendDraft.note}
               />
               <button className="rounded-full bg-[#8336f0] px-3 py-2 text-sm font-black disabled:opacity-40" disabled={busy} type="submit">
                  Log spend
               </button>
            </form>
            {data.spend.filter((s) => s.spent_on.startsWith(month)).length ? (
               <ul className="space-y-1 text-sm">
                  {data.spend
                     .filter((s) => s.spent_on.startsWith(month))
                     .map((s) => (
                        <li className="flex flex-wrap items-center gap-2 rounded-lg bg-[#12052a] px-3 py-2" key={s.id}>
                           <span>{s.spent_on}</span>
                           <span className="capitalize text-[#a89bb8]">{s.channel}</span>
                           <b>{usd(s.amount_usd, 2)}</b>
                           <span className="text-[#a89bb8]">{data.codes.find((c) => c.id === s.referral_code_id)?.code ?? ''}</span>
                           <span className="text-[#a89bb8]">{s.note}</span>
                           <button
                              className="ml-auto text-xs text-red-300 underline"
                              onClick={() => window.confirm('Delete this spend entry?') && void run(() => deleteSpend(s.id))}
                              type="button"
                           >
                              delete
                           </button>
                        </li>
                     ))}
               </ul>
            ) : (
               <p className="text-sm text-[#a89bb8]">No spend logged for {month} yet.</p>
            )}
         </section>

         {/* 3. Unit economics */}
         <section className="space-y-3 rounded-3xl border border-[#2a1453] bg-[#160631] p-5">
            <h3 className="text-xl font-black">Does the spend pay off?</h3>
            <p className="text-sm text-[#a89bb8]">
               Profit per new borrower over 6 loan cycles, from your real numbers: {pct(economics[0]?.inputs.yieldPerLoan ?? 0)} average
               interest per loan, {pct(economics[0]?.inputs.reborrowAfterFirst ?? 0)} borrow again after the 1st loan,{' '}
               {pct(economics[0]?.inputs.reborrowLater ?? 0)} after later ones, credit line cost{' '}
               {pct(economics[0]?.inputs.costOfFundsMonthly ?? 0)}/month, $1 KYC/ops per borrower. Default rates are guesses until loans
               come due:
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
               <label>
                  1st-loan defaults{' '}
                  <input
                     className="w-16 rounded bg-[#12052a] px-2 py-1"
                     min={0}
                     max={60}
                     onChange={(e) => setDefaults({ ...defaults, first: Number(e.target.value) })}
                     type="number"
                     value={defaults.first}
                  />
                  %
               </label>
               <label>
                  Later defaults{' '}
                  <input
                     className="w-16 rounded bg-[#12052a] px-2 py-1"
                     min={0}
                     max={60}
                     onChange={(e) => setDefaults({ ...defaults, later: Number(e.target.value) })}
                     type="number"
                     value={defaults.later}
                  />
                  %
               </label>
            </div>
            <table className="w-full text-left text-sm">
               <thead className="text-[#a89bb8]">
                  <tr>
                     <th className="p-2">Channel</th>
                     <th className="p-2">Lent per borrower</th>
                     <th className="p-2">Profit before CAC</th>
                     <th className="p-2">Total CAC</th>
                     <th className="p-2">LTV : CAC</th>
                     <th className="p-2">Pays back</th>
                  </tr>
               </thead>
               <tbody>
                  {economics.map((e) => (
                     <tr className="border-t border-[#2a1453]" key={e.channel}>
                        <td className="p-2">{e.channel}</td>
                        <td className="p-2">{usd(e.lent)}</td>
                        <td className="p-2">{usd(e.profitBeforeCac, 2)}</td>
                        <td className="p-2">{usd(e.totalCac, 2)}</td>
                        <td
                           className={`p-2 font-bold ${e.ltvToCac === null || e.ltvToCac >= 3 ? 'text-emerald-300' : e.ltvToCac >= 1 ? 'text-amber-300' : 'text-red-300'}`}
                        >
                           {e.ltvToCac === null ? 'free' : `${e.ltvToCac.toFixed(1)}×`}
                        </td>
                        <td className="p-2">{e.paybackMonth ? `month ${e.paybackMonth}` : <span className="text-red-300">never</span>}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
            <p className="text-xs text-[#a89bb8]">Healthy: LTV : CAC 3× or more and payback within 3 months.</p>
         </section>

         {/* 4. Funnel + re-borrowing */}
         <section className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2 rounded-3xl border border-[#2a1453] bg-[#160631] p-5">
               <h3 className="text-xl font-black">Signup funnel (last 30 / 60 days)</h3>
               {m.funnel60.map((s, i) => (
                  <div key={s.label}>
                     <div className="flex justify-between text-sm">
                        <span>{s.label}</span>
                        <span className="text-[#a89bb8]">
                           {m.funnel30[i].count} / {s.count} · {pct(s.pctOfSignups)}
                        </span>
                     </div>
                     <div className="h-2 overflow-hidden rounded-full bg-[#241044]">
                        <div className="h-full bg-[#8336f0]" style={{ width: `${s.pctOfSignups * 100}%` }} />
                     </div>
                  </div>
               ))}
            </div>
            <div className="space-y-2 rounded-3xl border border-[#2a1453] bg-[#160631] p-5">
               <h3 className="text-xl font-black">Borrowing again</h3>
               <table className="w-full text-left text-sm">
                  <thead className="text-[#a89bb8]">
                     <tr>
                        <th className="p-2">Loan #</th>
                        <th className="p-2">Loans</th>
                        <th className="p-2">Avg size</th>
                        <th className="p-2">Borrow again</th>
                        <th className="p-2">Next is bigger by</th>
                     </tr>
                  </thead>
                  <tbody>
                     {m.ret.map((r) => (
                        <tr className="border-t border-[#2a1453]" key={r.loanNumber}>
                           <td className="p-2">{r.loanNumber === 4 ? '4th+' : r.loanNumber}</td>
                           <td className="p-2">{r.loans}</td>
                           <td className="p-2">{usd(r.avgAmount)}</td>
                           <td className="p-2">
                              {pct(r.reborrowRate)} <span className="text-xs text-[#a89bb8]">of {r.repaid} repaid</span>
                           </td>
                           <td className="p-2">{r.avgStepUp === null ? '—' : usd(r.avgStepUp, 2)}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </section>

         {/* 5. Who to contact */}
         <section className="space-y-3 rounded-3xl border border-[#2a1453] bg-[#160631] p-5">
            <h3 className="text-xl font-black">Who to contact today (free loans)</h3>
            <div className="grid gap-4 lg:grid-cols-3">
               <div>
                  <p className="font-bold">Can borrow again ({m.contacts.canReborrow.length})</p>
                  <p className="text-xs text-[#a89bb8]">Repaid, nothing open. Tell them their new limit.</p>
                  <ul className="mt-2 space-y-1 text-sm">
                     {m.contacts.canReborrow.slice(0, 15).map((c) => (
                        <li key={c.user.id}>
                           {name(c.user)} · limit {usd(c.user.credit_limit ?? 0)} · repaid {c.daysSince}d ago
                        </li>
                     ))}
                  </ul>
               </div>
               <div>
                  <p className="font-bold">ID verified, never borrowed ({m.contacts.verifiedNeverBorrowed.length})</p>
                  <p className="text-xs text-[#a89bb8]">Ready to borrow; nudge them.</p>
                  <ul className="mt-2 space-y-1 text-sm">
                     {m.contacts.verifiedNeverBorrowed.slice(0, 15).map((c) => (
                        <li key={c.user.id}>
                           {name(c.user)} · joined {c.signedUp}
                           {c.requested ? ' · has a request' : ''}
                        </li>
                     ))}
                  </ul>
               </div>
               <div>
                  <p className="font-bold">Due in the next 2 days ({m.contacts.dueSoon.length})</p>
                  <p className="text-xs text-[#a89bb8]">Remind them; offer the next loan after.</p>
                  <ul className="mt-2 space-y-1 text-sm">
                     {m.contacts.dueSoon.map((c) => (
                        <li key={c.loan.id}>
                           {name(c.user)} · {usd(Number(c.loan.total_repayment_amount), 2)} due {c.due}
                        </li>
                     ))}
                  </ul>
               </div>
            </div>
         </section>

         {/* 6. Goals and poster codes */}
         <section className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-3xl border border-[#2a1453] bg-[#160631] p-5">
               <h3 className="text-xl font-black">Targets for {month}</h3>
               {(
                  [
                     ['lent_usd', 'Lending goal ($ lent this month)'],
                     ['marketing_budget_usd', 'Marketing budget ($)'],
                     ['cac_target_usd', 'CAC target ($ per repaying borrower)']
                  ] as Array<[keyof MonthlyGoals, string]>
               ).map(([key, label]) => (
                  <label className="flex items-center justify-between gap-3 text-sm" key={key}>
                     {label}
                     <input
                        className="w-28 rounded-lg bg-[#12052a] px-2 py-1 text-right"
                        min={0}
                        onChange={(e) => setGoalDraft({ ...goalDraft, [key]: Number(e.target.value) })}
                        type="number"
                        value={goalDraft[key]}
                     />
                  </label>
               ))}
               <button
                  className="rounded-full bg-[#8336f0] px-4 py-2 text-sm font-black disabled:opacity-40"
                  disabled={busy}
                  onClick={() =>
                     run(async () => {
                        for (const key of Object.keys(goalDraft) as Array<keyof MonthlyGoals>) {
                           if (goalDraft[key] !== data.goals[key]) await saveGoal(month, key, goalDraft[key]);
                        }
                     })
                  }
                  type="button"
               >
                  Save targets
               </button>
            </div>
            <div className="space-y-3 rounded-3xl border border-[#2a1453] bg-[#160631] p-5">
               <h3 className="text-xl font-black">Referral and poster codes</h3>
               <p className="text-xs text-[#a89bb8]">
                  Mark codes as poster codes (with where the poster is) so cost per borrower can be split by channel. Create codes under
                  Growth → Referrals.
               </p>
               <ul className="space-y-1 text-sm">
                  {data.codes.map((c) => (
                     <CodeRow
                        busy={busy}
                        code={c}
                        key={c.id}
                        onSave={(channel, label) => run(() => setCodeChannel(c.id, channel, label))}
                     />
                  ))}
               </ul>
            </div>
         </section>
      </div>
   );
}

function CodeRow({
   code,
   busy,
   onSave
}: {
   code: ReferralCodeRow;
   busy: boolean;
   onSave: (channel: ReferralCodeRow['channel'], label: string | null) => void;
}) {
   const [channel, setChannel] = useState(code.channel);
   const [label, setLabel] = useState(code.label ?? '');
   const dirty = channel !== code.channel || label !== (code.label ?? '');
   return (
      <li className="flex flex-wrap items-center gap-2">
         <b className="w-28">{code.code}</b>
         <select
            className="rounded bg-[#12052a] px-2 py-1"
            onChange={(e) => setChannel(e.target.value as ReferralCodeRow['channel'])}
            value={channel}
         >
            <option value="person">Person</option>
            <option value="ambassador">Ambassador</option>
            <option value="poster">Poster</option>
         </select>
         <input
            className="min-w-0 flex-1 rounded bg-[#12052a] px-2 py-1"
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Where / who"
            value={label}
         />
         <button
            className="rounded-full bg-[#8336f0] px-3 py-1 text-xs font-black disabled:opacity-40"
            disabled={!dirty || busy}
            onClick={() => onSave(channel, label.trim() || null)}
            type="button"
         >
            Save
         </button>
      </li>
   );
}
