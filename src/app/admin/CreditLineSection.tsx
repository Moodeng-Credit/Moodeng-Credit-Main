'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
   addFacilityLoan,
   addLedgerEntry,
   type CreditLineData,
   deleteLedgerEntry,
   loadCreditLine,
   removeFacilityLoan,
   setFacilityLoanRationale
} from '@/app/admin/adminFinance';
import {
   buildFacilityLoans,
   draftRationale,
   facilityExceptions,
   facilitySummary,
   type LedgerKind,
   lenderLoanRows,
   manilaDate,
   reportingPeriods,
   toCsv
} from '@/app/admin/creditLineModel';
import { useAdminLiveReload } from '@/app/admin/useAdminLive';

// Admin → Finance → Credit line: everything a credit-line lender's monthly report needs (BitRepo: Schedule B),
// live from our records — balances, interest owed, every loan with its txs and rationale, the fund-flow ledger,
// and what doesn't match the agreement. Exports use private borrower IDs only.

const usd = (n: number, digits = 2) =>
   `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const shortTx = (tx: string) => `${tx.slice(0, 8)}…${tx.slice(-4)}`;
const SCAN = 'https://basescan.org/tx/';
const LEDGER_KINDS: LedgerKind[] = [
   'advance',
   'transfer',
   'draw',
   'disbursement',
   'repayment',
   'interest_payment',
   'principal_return',
   'fee',
   'other'
];

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'warn' | 'bad' }) {
   const color = tone === 'good' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : tone === 'bad' ? 'text-red-300' : 'text-white';
   return (
      <div className="rounded-2xl border border-[#2a1453] bg-[#1a0838] p-4">
         <p className="text-sm text-[#a89bb8]">{label}</p>
         <p className={`mt-1 text-2xl font-black ${color}`}>{value}</p>
         {sub ? <p className="mt-1 text-xs text-[#a89bb8]">{sub}</p> : null}
      </div>
   );
}

function TxLinks({ txs }: { txs: string[] }) {
   if (!txs.length) return <span className="text-red-300">missing</span>;
   return (
      <span className="flex flex-col">
         {txs.map((tx) => (
            <a className="font-mono text-xs text-[#b99cff] underline" href={`${SCAN}${tx}`} key={tx} rel="noreferrer" target="_blank">
               {shortTx(tx)}
            </a>
         ))}
      </span>
   );
}

function download(name: string, rows: unknown[][]) {
   const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = name;
   a.click();
   URL.revokeObjectURL(url);
}

export default function CreditLineSection() {
   const today = manilaDate(new Date().toISOString());
   const [data, setData] = useState<CreditLineData | null>(null);
   const [facilityId, setFacilityId] = useState<string | undefined>();
   const [asOf, setAsOf] = useState(today);
   const [error, setError] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);
   const [drafts, setDrafts] = useState<Record<string, string>>({});
   const [addLoanId, setAddLoanId] = useState('');
   const [entry, setEntry] = useState({
      occurred_at: '',
      kind: 'draw' as LedgerKind,
      description: '',
      from_label: '',
      to_label: '',
      amount_usd: '',
      tx_hash: ''
   });

   const load = useCallback(async () => {
      setError(null);
      try {
         setData(await loadCreditLine(facilityId));
      } catch (err) {
         setError((err as { message?: string })?.message ?? 'Could not load the credit line.');
      }
   }, [facilityId]);

   useEffect(() => {
      void load();
   }, [load]);

   // Live: new facility loans and repayments show up without a refresh.
   useAdminLiveReload(['loans'], load);

   const facility = data?.facility ?? null;
   const loans = useMemo(() => (data ? buildFacilityLoans(data.loans, data.ledger, asOf) : []), [data, asOf]);
   const summary = useMemo(
      () => (facility && data ? facilitySummary(facility, loans, data.ledger, asOf) : null),
      [facility, data, loans, asOf]
   );
   const periods = useMemo(() => (facility ? reportingPeriods(facility, today) : []), [facility, today]);
   const currentPeriod = periods.find((p) => asOf >= p.start && asOf <= p.end) ?? periods[periods.length - 1];
   const pastMonthsInterest = useMemo(() => {
      if (!summary) return 0;
      const thisMonth = asOf.slice(0, 7);
      const owedPast = summary.interest.filter((m) => m.month < thisMonth).reduce((s, m) => s + m.interest, 0);
      return Math.max(0, owedPast - summary.interestPaid);
   }, [summary, asOf]);
   const exceptions = useMemo(
      () => (facility ? facilityExceptions(facility, loans, pastMonthsInterest) : []),
      [facility, loans, pastMonthsInterest]
   );

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

   if (error && !data) return <p className="text-red-300">{error}</p>;
   if (!data) return <p className="text-[#a89bb8]">Loading…</p>;
   if (!facility || !summary) return <p className="text-[#a89bb8]">No credit facility set up yet.</p>;

   const exportLoans = () => download(`${facility.name.replace(/\s+/g, '_')}_loans_${asOf}.csv`, lenderLoanRows(loans, asOf));
   const exportLedger = () =>
      download(`${facility.name.replace(/\s+/g, '_')}_ledger_${asOf}.csv`, [
         ['Date/time (Manila)', 'Kind', 'Description', 'From', 'To', 'Amount (USDC)', 'Tx hash'],
         ...data.ledger.map((r) => [manilaDate(r.occurred_at), r.kind, r.description, r.from_label, r.to_label, r.amount_usd, r.tx_hash]),
         ...loans.flatMap((l) => [
            ...l.disbursementTxs
               .filter((tx) => (l.hash ?? []).includes(tx))
               .map((tx) => [
                  l.fundedDate,
                  'disbursement',
                  `${l.tracking_id} (${l.privateId})`,
                  'Lending wallet',
                  l.privateId,
                  -Number(l.loan_amount),
                  tx
               ]),
            ...l.repaymentTxs
               .filter((tx) => (l.hash ?? []).includes(tx))
               .map((tx) => [
                  l.repaidDate ?? '',
                  'repayment',
                  `${l.tracking_id} (${l.privateId})`,
                  l.privateId,
                  'Lending wallet',
                  Number(l.total_repayment_amount),
                  tx
               ])
         ])
      ]);
   const exportSummary = () =>
      download(`${facility.name.replace(/\s+/g, '_')}_summary_${asOf}.csv`, [
         ['Facility', facility.name],
         ['Lender', facility.lender_name],
         ['Reporting period', currentPeriod ? `${currentPeriod.start} to ${currentPeriod.end}` : ''],
         ['As of', asOf],
         ['Interest rate (simple, actual/365, on deployed principal)', pct(facility.annual_rate)],
         ['Advance received', summary.advanced],
         ['Total disbursed', summary.disbursed],
         ['Principal repaid by borrowers', summary.principalRepaid],
         ['Deployed principal (lent out)', summary.deployed],
         ['Unallocated funds', summary.unallocated],
         ['Principal owed to lender', summary.principalOwed],
         ...summary.interest.map((m) => [`Interest accrued ${m.month}`, m.interest.toFixed(4)]),
         ['Interest paid', summary.interestPaid],
         ['Interest owed', summary.interestOwed.toFixed(4)],
         ['Open loans', summary.openLoans],
         ['Overdue loans', summary.overdue],
         [],
         ['Exceptions'],
         ...exceptions.map((e) => [e.privateId ?? '', e.message])
      ]);

   return (
      <div className="space-y-6">
         <div className="flex flex-wrap items-end gap-3">
            {data.facilities.length > 1 ? (
               <label className="flex flex-col text-sm text-[#a89bb8]">
                  Facility
                  <select
                     className="mt-1 rounded-lg bg-[#12052a] px-3 py-2 text-white"
                     onChange={(e) => setFacilityId(e.target.value)}
                     value={facility.id}
                  >
                     {data.facilities.map((f) => (
                        <option key={f.id} value={f.id}>
                           {f.name}
                        </option>
                     ))}
                  </select>
               </label>
            ) : null}
            <label className="flex flex-col text-sm text-[#a89bb8]">
               Report period
               <select
                  className="mt-1 rounded-lg bg-[#12052a] px-3 py-2 text-white"
                  onChange={(e) => {
                     const p = periods[Number(e.target.value)];
                     setAsOf(p.end < today ? p.end : today);
                  }}
                  value={currentPeriod ? periods.indexOf(currentPeriod) : 0}
               >
                  {periods.map((p, i) => (
                     <option key={p.start} value={i}>
                        {p.start} → {p.end} (due {p.due})
                     </option>
                  ))}
               </select>
            </label>
            <label className="flex flex-col text-sm text-[#a89bb8]">
               Data as of
               <input
                  className="mt-1 rounded-lg bg-[#12052a] px-3 py-2 text-white"
                  onChange={(e) => setAsOf(e.target.value)}
                  type="date"
                  value={asOf}
               />
            </label>
            <div className="ml-auto flex flex-wrap gap-2">
               <button className="rounded-full bg-[#8336f0] px-4 py-2 text-sm font-black text-white" onClick={exportLoans} type="button">
                  Loans CSV (for lender)
               </button>
               <button
                  className="rounded-full border border-[#8336f0] px-4 py-2 text-sm font-bold text-white"
                  onClick={exportLedger}
                  type="button"
               >
                  Ledger CSV
               </button>
               <button
                  className="rounded-full border border-[#8336f0] px-4 py-2 text-sm font-bold text-white"
                  onClick={exportSummary}
                  type="button"
               >
                  Summary CSV
               </button>
            </div>
         </div>
         {error ? <p className="text-red-300">{error}</p> : null}

         <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card
               label="Advance received"
               sub={`${facility.lender_name} · ${pct(facility.annual_rate)}/yr on lent-out funds`}
               value={usd(summary.advanced)}
            />
            <Card
               label="Lent out now"
               sub={`${pct(summary.utilization)} of ${usd(facility.commitment_usd, 0)} · ${summary.openLoans} open loans`}
               value={usd(summary.deployed)}
            />
            <Card label="Not lent yet" sub="Costs nothing; ready to lend" value={usd(summary.unallocated)} />
            <Card
               label="Interest owed to lender"
               sub={summary.interest.map((m) => `${m.month}: ${usd(m.interest)}`).join(' · ') || 'none yet'}
               tone={pastMonthsInterest > 0.005 ? 'warn' : undefined}
               value={usd(summary.interestOwed)}
            />
            <Card label="Disbursed in total" sub={`${loans.length} loans`} value={usd(summary.disbursed)} />
            <Card
               label="Repaid by borrowers"
               sub={`+ ${usd(summary.interestCollected)} interest we keep`}
               value={usd(summary.principalRepaid)}
            />
            <Card label="Overdue loans" tone={summary.overdue ? 'bad' : 'good'} value={String(summary.overdue)} />
            <Card
               label="Next report due"
               sub={currentPeriod ? `Covers ${currentPeriod.start} → ${currentPeriod.end}` : ''}
               value={currentPeriod?.due ?? '—'}
            />
         </div>
         <div>
            <div className="h-3 overflow-hidden rounded-full bg-[#241044]">
               <div className="h-full bg-[#8336f0]" style={{ width: `${Math.min(100, summary.utilization * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-[#a89bb8]">Credit line used: {pct(summary.utilization)}</p>
         </div>

         <section>
            <h3 className="text-lg font-black">Needs attention ({exceptions.length})</h3>
            {exceptions.length ? (
               <ul className="mt-2 space-y-1 text-sm">
                  {exceptions.map((e) => (
                     <li
                        className="rounded-lg bg-[#2a0f1f] px-3 py-2 text-[#f2c4c4]"
                        key={`${e.kind}:${e.loanId ?? e.privateId ?? 'all'}:${e.message}`}
                     >
                        {e.privateId ? <b>{e.privateId} · </b> : null}
                        {e.message}
                     </li>
                  ))}
               </ul>
            ) : (
               <p className="mt-2 text-sm text-emerald-300">Nothing outside the agreement.</p>
            )}
         </section>

         <section>
            <h3 className="text-lg font-black">Loans ({loans.length})</h3>
            <div className="mt-2 overflow-x-auto">
               <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="text-[#a89bb8]">
                     <tr>
                        <th className="p-2">ID</th>
                        <th className="p-2">Borrower (internal)</th>
                        <th className="p-2">Funded</th>
                        <th className="p-2">Principal → repay</th>
                        <th className="p-2">Term / due</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Disbursed tx</th>
                        <th className="p-2">Repaid tx</th>
                        <th className="p-2">Checks</th>
                        <th className="p-2">Underwriting rationale (sent to lender)</th>
                     </tr>
                  </thead>
                  <tbody>
                     {loans.map((l) => {
                        const draft = drafts[l.id] ?? l.rationale ?? '';
                        const hist = data.history.get(l.id);
                        return (
                           <tr className="border-t border-[#2a1453] align-top" key={l.id}>
                              <td className="p-2 font-bold">
                                 {l.privateId}
                                 <div className="font-mono text-[10px] text-[#7a6b8f]">{l.tracking_id}</div>
                              </td>
                              <td className="p-2">
                                 {l.borrower.username}
                                 {l.borrower.facebook_name ? (
                                    <div className="text-xs text-[#a89bb8]">FB: {l.borrower.facebook_name}</div>
                                 ) : null}
                              </td>
                              <td className="p-2">{l.fundedDate}</td>
                              <td className="p-2">
                                 {usd(Number(l.loan_amount))} → {usd(Number(l.total_repayment_amount))}
                                 <div className="text-xs text-[#a89bb8]">{pct(l.impliedCost)} cost</div>
                              </td>
                              <td className="p-2">
                                 {l.termDays} days
                                 <div className="text-xs text-[#a89bb8]">{l.dueDate}</div>
                              </td>
                              <td className="p-2">
                                 <span className={l.status === 'Late' ? 'text-red-300' : l.status === 'Closed' ? 'text-emerald-300' : ''}>
                                    {l.restructured && l.status !== 'Closed' ? 'Restructured' : l.status}
                                 </span>
                                 {l.daysPastDue ? <div className="text-xs text-red-300">{l.daysPastDue} days late</div> : null}
                                 {l.outstanding ? <div className="text-xs text-[#a89bb8]">{usd(l.outstanding)} open</div> : null}
                              </td>
                              <td className="p-2">
                                 <TxLinks txs={l.disbursementTxs} />
                              </td>
                              <td className="p-2">
                                 {l.status === 'Closed' ? <TxLinks txs={l.repaymentTxs} /> : <span className="text-[#7a6b8f]">—</span>}
                              </td>
                              <td className="p-2 text-xs">
                                 <div className={l.borrower.kyc_passed ? 'text-emerald-300' : 'text-red-300'}>
                                    {l.borrower.kyc_passed ? `KYC ✓ ${l.borrower.kyc_document ?? '(no doc on file)'}` : 'KYC ✗'}
                                 </div>
                                 {l.borrower.liveness ? <div>Liveness ✓</div> : null}
                                 {l.borrower.facebook_verified ? <div>Facebook ✓</div> : null}
                                 {l.borrower.video_call_attended ? <div>Video call ✓</div> : null}
                              </td>
                              <td className="p-2">
                                 <textarea
                                    className="min-h-20 w-80 rounded-lg border border-[#2a1453] bg-[#12052a] p-2 text-sm text-white"
                                    onChange={(e) => setDrafts((d) => ({ ...d, [l.id]: e.target.value }))}
                                    value={draft}
                                 />
                                 <div className="mt-1 flex gap-2">
                                    <button
                                       className="rounded-full bg-[#8336f0] px-3 py-1 text-xs font-black disabled:opacity-40"
                                       disabled={busy || draft === (l.rationale ?? '')}
                                       onClick={() => run(() => setFacilityLoanRationale(facility.id, l.id, draft))}
                                       type="button"
                                    >
                                       Save
                                    </button>
                                    <button
                                       className="rounded-full border border-[#8336f0] px-3 py-1 text-xs"
                                       onClick={() =>
                                          setDrafts((d) => ({
                                             ...d,
                                             [l.id]: draftRationale(
                                                l,
                                                hist?.prior ?? 0,
                                                hist?.repaid ?? 0,
                                                hist?.late ?? 0,
                                                hist?.creditLimit ?? null
                                             )
                                          }))
                                       }
                                       type="button"
                                    >
                                       Draft from data
                                    </button>
                                    <button
                                       className="rounded-full border border-red-400 px-3 py-1 text-xs text-red-300"
                                       disabled={busy}
                                       onClick={() => {
                                          if (
                                             window.confirm(
                                                `Remove ${l.tracking_id} from ${facility.name}? The loan itself is not changed.`
                                             )
                                          )
                                             void run(() => removeFacilityLoan(facility.id, l.id));
                                       }}
                                       type="button"
                                    >
                                       Remove
                                    </button>
                                 </div>
                              </td>
                           </tr>
                        );
                     })}
                  </tbody>
               </table>
            </div>
            {data.candidates.length ? (
               <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                     className="rounded-lg bg-[#12052a] px-3 py-2 text-sm text-white"
                     onChange={(e) => setAddLoanId(e.target.value)}
                     value={addLoanId}
                  >
                     <option value="">Add a loan funded since {facility.start_date}…</option>
                     {data.candidates.map((c) => (
                        <option key={c.id} value={c.id}>
                           {manilaDate(c.funded_at)} · {usd(c.loan_amount, 0)} · {c.username ?? '?'}{' '}
                           {c.funding_method === 'credit_line' ? '(credit line)' : ''}
                        </option>
                     ))}
                  </select>
                  <button
                     className="rounded-full bg-[#8336f0] px-4 py-2 text-sm font-black disabled:opacity-40"
                     disabled={!addLoanId || busy}
                     onClick={() =>
                        run(async () => {
                           await addFacilityLoan(facility.id, addLoanId, null);
                           setAddLoanId('');
                        })
                     }
                     type="button"
                  >
                     Add to {facility.name}
                  </button>
               </div>
            ) : null}
         </section>

         <section>
            <h3 className="text-lg font-black">Fund-flow ledger</h3>
            <p className="text-sm text-[#a89bb8]">
               The advance, transfers, draws into the lending wallet, interest paid and principal returned. Loan disbursements and
               repayments come from the loans above.
            </p>
            <div className="mt-2 overflow-x-auto">
               <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="text-[#a89bb8]">
                     <tr>
                        <th className="p-2">When (Manila)</th>
                        <th className="p-2">Kind</th>
                        <th className="p-2">Description</th>
                        <th className="p-2">From → to</th>
                        <th className="p-2 text-right">USDC</th>
                        <th className="p-2">Tx</th>
                        <th className="p-2" />
                     </tr>
                  </thead>
                  <tbody>
                     {data.ledger.map((r) => (
                        <tr className="border-t border-[#2a1453]" key={r.id}>
                           <td className="p-2">
                              {new Date(r.occurred_at).toLocaleString('en-PH', {
                                 timeZone: 'Asia/Manila',
                                 dateStyle: 'medium',
                                 timeStyle: 'short'
                              })}
                           </td>
                           <td className="p-2">{r.kind.replace('_', ' ')}</td>
                           <td className="p-2">{r.description}</td>
                           <td className="p-2 text-xs text-[#a89bb8]">
                              {r.from_label} → {r.to_label}
                           </td>
                           <td className={`p-2 text-right font-bold ${r.amount_usd < 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                              {r.amount_usd.toFixed(2)}
                           </td>
                           <td className="p-2">{r.tx_hash ? <TxLinks txs={[r.tx_hash]} /> : '—'}</td>
                           <td className="p-2">
                              <button
                                 className="text-xs text-red-300 underline"
                                 onClick={() => {
                                    if (window.confirm('Delete this ledger entry?')) void run(() => deleteLedgerEntry(r.id));
                                 }}
                                 type="button"
                              >
                                 delete
                              </button>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
            <form
               className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-7"
               onSubmit={(e) => {
                  e.preventDefault();
                  const amount = Number(entry.amount_usd);
                  if (!entry.occurred_at || !entry.description.trim() || !Number.isFinite(amount)) {
                     setError('Enter a date, a description and an amount.');
                     return;
                  }
                  void run(async () => {
                     await addLedgerEntry({
                        facility_id: facility.id,
                        occurred_at: new Date(`${entry.occurred_at}:00+08:00`).toISOString(),
                        kind: entry.kind,
                        description: entry.description.trim(),
                        from_label: entry.from_label.trim() || null,
                        to_label: entry.to_label.trim() || null,
                        amount_usd: amount,
                        tx_hash: entry.tx_hash.trim() || null,
                        loan_id: null
                     });
                     setEntry({
                        occurred_at: '',
                        kind: 'draw',
                        description: '',
                        from_label: '',
                        to_label: '',
                        amount_usd: '',
                        tx_hash: ''
                     });
                  });
               }}
            >
               <input
                  className="rounded-lg bg-[#12052a] px-2 py-2 text-sm"
                  onChange={(e) => setEntry({ ...entry, occurred_at: e.target.value })}
                  type="datetime-local"
                  value={entry.occurred_at}
               />
               <select
                  className="rounded-lg bg-[#12052a] px-2 py-2 text-sm"
                  onChange={(e) => setEntry({ ...entry, kind: e.target.value as LedgerKind })}
                  value={entry.kind}
               >
                  {LEDGER_KINDS.map((k) => (
                     <option key={k} value={k}>
                        {k.replace('_', ' ')}
                     </option>
                  ))}
               </select>
               <input
                  className="rounded-lg bg-[#12052a] px-2 py-2 text-sm"
                  onChange={(e) => setEntry({ ...entry, description: e.target.value })}
                  placeholder="Interest paid for October"
                  value={entry.description}
               />
               <input
                  className="rounded-lg bg-[#12052a] px-2 py-2 text-sm"
                  onChange={(e) => setEntry({ ...entry, from_label: e.target.value })}
                  placeholder="From"
                  value={entry.from_label}
               />
               <input
                  className="rounded-lg bg-[#12052a] px-2 py-2 text-sm"
                  onChange={(e) => setEntry({ ...entry, to_label: e.target.value })}
                  placeholder="To"
                  value={entry.to_label}
               />
               <input
                  className="rounded-lg bg-[#12052a] px-2 py-2 text-sm"
                  onChange={(e) => setEntry({ ...entry, amount_usd: e.target.value })}
                  placeholder="Amount (− = out)"
                  value={entry.amount_usd}
               />
               <div className="flex gap-2">
                  <input
                     className="min-w-0 flex-1 rounded-lg bg-[#12052a] px-2 py-2 text-sm"
                     onChange={(e) => setEntry({ ...entry, tx_hash: e.target.value })}
                     placeholder="0x tx hash"
                     value={entry.tx_hash}
                  />
                  <button className="rounded-full bg-[#8336f0] px-3 text-sm font-black disabled:opacity-40" disabled={busy} type="submit">
                     Add
                  </button>
               </div>
            </form>
         </section>
      </div>
   );
}
