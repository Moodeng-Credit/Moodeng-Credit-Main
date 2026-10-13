import { type FormEvent, useMemo, useState } from 'react';

import { downloadCreditLineExcel } from '@/lib/creditLineExcel';
import { buildPeriodReport, type LenderLoan, type LenderReportData, loadLenderReport, periodsFor } from '@/lib/creditLineReport';

// moodeng.app/creditline — the facility lender (BitRepo) sees the live monthly report and downloads it as
// Excel. Password-checked on the server (credit_line_lender_report); the password is kept for this tab only.

const SESSION_KEY = 'md_creditline_pw';
const usd = (n: number, digits = 2) => `$${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// Loans table filters (the Excel download always has every loan).
type SortKey = 'funded' | 'due' | 'principal' | 'repaid';
type StatusFilter = 'all' | 'active' | 'repaid' | 'overdue';
const loanStatus = (loan: LenderLoan, asOf: string): Exclude<StatusFilter, 'all'> =>
   loan.repaidDate && loan.repaidDate <= asOf ? 'repaid' : loan.dueDate && loan.dueDate < asOf ? 'overdue' : 'active';
const SORT_VALUE: Record<SortKey, (loan: LenderLoan) => string | number> = {
   funded: (l) => l.fundedDate ?? '',
   due: (l) => l.dueDate ?? '',
   principal: (l) => Number(l.loan_amount),
   repaid: (l) => l.repaidDate ?? ''
};
const control = 'min-h-[40px] rounded-xl border-2 border-[#e5ddf0] bg-white px-3 text-[13px] font-semibold text-[#26143f]';

const readSaved = () => {
   try {
      return window.sessionStorage.getItem(SESSION_KEY) ?? '';
   } catch {
      return '';
   }
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
   return (
      <div className="rounded-2xl border border-[#e7e0ec] bg-white p-4">
         <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8a7c9c]">{label}</p>
         <p className="mt-1 text-[22px] font-extrabold text-[#26143f]">{value}</p>
         {sub ? <p className="mt-0.5 text-[12px] text-[#695b7b]">{sub}</p> : null}
      </div>
   );
}

export default function CreditLineLenderPage() {
   const [password, setPassword] = useState(readSaved);
   const [data, setData] = useState<LenderReportData | null>(null);
   const [error, setError] = useState('');
   const [loading, setLoading] = useState(false);
   const [periodIndex, setPeriodIndex] = useState(0);
   const [downloading, setDownloading] = useState(false);
   const [sortKey, setSortKey] = useState<SortKey>('funded');
   const [ascending, setAscending] = useState(true);
   const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
   const [fundedFrom, setFundedFrom] = useState('');
   const [fundedTo, setFundedTo] = useState('');
   const [search, setSearch] = useState('');

   const unlock = async (pw: string) => {
      setLoading(true);
      setError('');
      const result = await loadLenderReport(pw);
      setLoading(false);
      if ('error' in result) {
         setError(
            result.error === 'wrong_password'
               ? 'That password isn’t right.'
               : result.error === 'locked'
                 ? 'Too many tries — please wait 15 minutes and try again.'
                 : 'Couldn’t load the report. Please try again in a moment.'
         );
         return;
      }
      try {
         window.sessionStorage.setItem(SESSION_KEY, pw);
      } catch {
         // Storage blocked — they'll just enter it again after a reload.
      }
      setData(result.data);
   };

   const periods = useMemo(() => (data ? periodsFor(data.facility) : []), [data]);
   const report = useMemo(() => (data && periods[periodIndex] ? buildPeriodReport(data, periods[periodIndex]) : null), [data, periods, periodIndex]);
   const shownLoans = useMemo(() => {
      if (!report) return [];
      const q = search.trim().toLowerCase();
      const value = SORT_VALUE[sortKey];
      return report.loans
         .filter((l) => statusFilter === 'all' || loanStatus(l, report.asOf) === statusFilter)
         .filter((l) => (!fundedFrom || l.fundedDate >= fundedFrom) && (!fundedTo || l.fundedDate <= fundedTo))
         .filter((l) => !q || [l.tracking_id, l.privateId, l.borrower.username].some((v) => String(v ?? '').toLowerCase().includes(q)))
         .sort((a, b) => {
            const x = value(a);
            const y = value(b);
            const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
            return ascending ? cmp : -cmp;
         });
   }, [report, sortKey, ascending, statusFilter, fundedFrom, fundedTo, search]);
   const filtered = shownLoans.length !== (report?.loans.length ?? 0);

   if (!data || !report) {
      const submit = (e: FormEvent) => {
         e.preventDefault();
         if (password.trim()) void unlock(password.trim());
      };
      return (
         <div className="flex min-h-screen items-center justify-center bg-[#f7f4fb] px-5">
            <form className="w-full max-w-[380px] rounded-3xl bg-white p-6 shadow-[0_10px_30px_rgba(38,20,63,0.08)]" onSubmit={submit}>
               <img alt="" className="mx-auto h-20 w-auto" src="/hippos/wallet-grow/wallet-4-grown.webp" />
               <h1 className="mt-3 text-center text-[22px] font-extrabold text-[#26143f]">Moodeng credit line</h1>
               <p className="mt-1 text-center text-[14px] text-[#695b7b]">Lender report. Enter the password you were given.</p>
               <input
                  autoComplete="current-password"
                  className="mt-5 min-h-[48px] w-full rounded-2xl border-2 border-[#e5ddf0] px-4 text-[16px] focus:border-[#6b55f7] focus:outline-none"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  type="password"
                  value={password}
               />
               {error ? <p className="mt-2 text-[13px] font-semibold text-red-600">{error}</p> : null}
               <button
                  className="mt-4 min-h-[52px] w-full rounded-2xl bg-[#6b55f7] font-bold text-white shadow-[0_4px_0_#4a35c9] active:translate-y-[4px] active:shadow-none disabled:opacity-60"
                  disabled={loading || !password.trim()}
                  type="submit"
               >
                  {loading ? 'Checking…' : 'View report'}
               </button>
            </form>
         </div>
      );
   }

   const f = data.facility;
   const m = report.medians;
   return (
      <div className="min-h-screen bg-[#f7f4fb] px-4 pb-16 pt-6">
         <div className="mx-auto flex max-w-[1100px] flex-col gap-5">
            <header className="flex flex-wrap items-end justify-between gap-3">
               <div>
                  <p className="text-[13px] font-semibold text-[#6b55f7]">{f.lender_name}</p>
                  <h1 className="text-[26px] font-extrabold text-[#26143f]">{f.name} — monthly report</h1>
                  <p className="text-[14px] text-[#695b7b]">
                     Live data · as of {report.asOf} (Philippine time) · report due {report.period.due}
                  </p>
               </div>
               <div className="flex flex-wrap items-center gap-2">
                  <select
                     className="min-h-[44px] rounded-xl border-2 border-[#e5ddf0] bg-white px-3 text-[14px] font-semibold"
                     onChange={(e) => setPeriodIndex(Number(e.target.value))}
                     value={periodIndex}
                  >
                     {periods.map((p, i) => (
                        <option key={p.start} value={i}>
                           {p.start} → {p.end}
                           {i === 0 ? ' (current)' : ''}
                        </option>
                     ))}
                  </select>
                  <button
                     className="min-h-[44px] rounded-xl bg-[#6b55f7] px-4 font-bold text-white shadow-[0_3px_0_#4a35c9] active:translate-y-[3px] active:shadow-none disabled:opacity-60"
                     disabled={downloading}
                     onClick={async () => {
                        setDownloading(true);
                        try {
                           await downloadCreditLineExcel(data, report);
                        } finally {
                           setDownloading(false);
                        }
                     }}
                     type="button"
                  >
                     {downloading ? 'Preparing…' : 'Download Excel'}
                  </button>
               </div>
            </header>

            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
               <Stat label="Deployed now" sub={`${pct(report.utilization)} of ${usd(Number(f.commitment_usd), 0)}`} value={usd(report.deployed)} />
               <Stat label="Available" value={usd(report.available)} />
               <Stat label="Interest owed to you" sub={`So far this period (15%/yr on deployed funds) · projected ${usd(report.interestProjected)}`} value={usd(report.interestAccrued)} />
               <Stat
                  label="Loans"
                  sub={`${report.counts.active} active · ${report.counts.repaid} repaid · ${report.counts.overdue} overdue`}
                  value={String(report.counts.funded)}
               />
               <Stat label="Median loan" sub={`All loans: ${usd(m.loan)}`} value={usd(m.loanStandard)} />
               <Stat label="Median term" sub={`All loans: ${m.term} days`} value={`${m.termStandard} days`} />
               {/* A flat fee for the whole loan, not a monthly rate — said in words so nobody reads it as one. */}
               <Stat label="Typical borrower fee" sub="Flat fee for the whole loan (usually 30 days), e.g. $2 on $15" value={`${pct(m.feeStandard)} per loan`} />
               <Stat label="Lent / repaid" sub={`Fees collected: ${usd(report.feesCollected)}`} value={`${usd(report.lent, 0)} / ${usd(report.principalRepaid, 0)}`} />
            </section>
            <p className="-mt-2 text-[12px] text-[#8a7c9c]">
               Borrower fees are a one-time flat fee on each loan, paid back with the principal — not a monthly or annual rate. Medians use
               standard pricing (the 0% bridge loan is excluded; including it, the median fee is {pct(m.fee)}). Interest: {(Number(f.annual_rate) * 100).toFixed(0)}% simple,
               actual/365, on principal deployed each day. Advanced to Moodeng: {usd(report.advanced)}.
            </p>

            <section className="overflow-hidden rounded-2xl border border-[#e7e0ec] bg-white">
               <div className="flex flex-wrap items-center gap-2 border-b border-[#f0ecf5] px-4 py-3">
                  <h2 className="mr-auto text-[16px] font-bold text-[#26143f]">
                     Loans (Schedule B){' '}
                     <span className="font-semibold text-[#8a7c9c]">
                        {filtered ? `${shownLoans.length} of ${report.loans.length}` : report.loans.length}
                     </span>
                  </h2>
                  <input
                     aria-label="Search loans"
                     className={`${control} w-[170px]`}
                     onChange={(e) => setSearch(e.target.value)}
                     placeholder="Search borrower or loan"
                     value={search}
                  />
                  <select aria-label="Status" className={control} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} value={statusFilter}>
                     <option value="all">All statuses</option>
                     <option value="active">Active</option>
                     <option value="repaid">Repaid</option>
                     <option value="overdue">Overdue</option>
                  </select>
                  <label className="flex items-center gap-1 text-[12px] font-semibold text-[#695b7b]">
                     Funded
                     <input aria-label="Funded from" className={control} onChange={(e) => setFundedFrom(e.target.value)} type="date" value={fundedFrom} />
                     –
                     <input aria-label="Funded to" className={control} onChange={(e) => setFundedTo(e.target.value)} type="date" value={fundedTo} />
                  </label>
                  <select aria-label="Sort by" className={control} onChange={(e) => setSortKey(e.target.value as SortKey)} value={sortKey}>
                     <option value="funded">Sort: funded date</option>
                     <option value="due">Sort: due date</option>
                     <option value="repaid">Sort: repaid date</option>
                     <option value="principal">Sort: principal</option>
                  </select>
                  <button className={control} onClick={() => setAscending((a) => !a)} type="button">
                     {ascending ? '↑ Oldest / smallest first' : '↓ Newest / largest first'}
                  </button>
                  {filtered || sortKey !== 'funded' || !ascending ? (
                     <button
                        className="text-[13px] font-bold text-[#6b55f7] underline"
                        onClick={() => {
                           setSearch('');
                           setStatusFilter('all');
                           setFundedFrom('');
                           setFundedTo('');
                           setSortKey('funded');
                           setAscending(true);
                        }}
                        type="button"
                     >
                        Reset
                     </button>
                  ) : null}
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left text-[13px]">
                     <thead className="bg-[#f8f4fc] text-[12px] uppercase text-[#695b7b]">
                        <tr>
                           {['Loan', 'Borrower', 'Funded', 'Due', 'Principal', 'Total due', 'Status', 'KYC', 'Facebook', 'Call', 'Disbursement tx'].map((h) => (
                              <th className="px-3 py-2 font-semibold" key={h}>
                                 {h}
                              </th>
                           ))}
                        </tr>
                     </thead>
                     <tbody>
                        {shownLoans.length === 0 ? (
                           <tr>
                              <td className="px-3 py-6 text-center text-[#8a7c9c]" colSpan={11}>
                                 No loans match these filters.
                              </td>
                           </tr>
                        ) : null}
                        {shownLoans.map((loan) => {
                           const repaid = loan.repaidDate && loan.repaidDate <= report.asOf;
                           const overdue = !repaid && loan.dueDate && loan.dueDate < report.asOf;
                           return [
                              <tr className="border-t border-[#f0ecf5] align-top" key={loan.id}>
                                 <td className="px-3 py-2 font-mono text-[11px]">{loan.tracking_id}</td>
                                 <td className="px-3 py-2">
                                    <span className="font-semibold">{loan.privateId}</span>
                                    <br />
                                    <span className="text-[#695b7b]">{loan.borrower.username}</span>
                                 </td>
                                 <td className="px-3 py-2">{loan.fundedDate}</td>
                                 <td className="px-3 py-2">{loan.dueDate}</td>
                                 <td className="px-3 py-2">{usd(Number(loan.loan_amount))}</td>
                                 <td className="px-3 py-2">{usd(Number(loan.total_repayment_amount))}</td>
                                 <td className="px-3 py-2 font-semibold">
                                    {repaid ? <span className="text-green-700">Repaid {loan.repaidDate}</span> : overdue ? <span className="text-red-600">Overdue</span> : 'Active'}
                                    {loan.restructured ? <span className="block text-[11px] font-normal text-[#8a7c9c]">Restructure</span> : null}
                                 </td>
                                 <td className="px-3 py-2">{loan.borrower.kyc_passed ? `✓ ${loan.kycProvider ?? ''}` : '—'}</td>
                                 <td className="px-3 py-2">{loan.borrower.facebook_verified ? '✓' : '—'}</td>
                                 <td className="px-3 py-2">{loan.borrower.video_call_attended ? '✓' : '—'}</td>
                                 <td className="max-w-[160px] px-3 py-2 font-mono text-[11px]">
                                    {loan.disbursementTxs.map((tx) => (
                                       <a className="block truncate text-[#6b55f7] underline" href={`https://basescan.org/tx/${tx}`} key={tx} rel="noreferrer" target="_blank">
                                          {tx}
                                       </a>
                                    ))}
                                 </td>
                              </tr>,
                              // Why it was approved: a full-width line under the loan, so rows stay short.
                              <tr key={`${loan.id}-why`}>
                                 <td className="px-3 pb-3 text-[12px] leading-[17px] text-[#45556c]" colSpan={11}>
                                    <span className="font-semibold text-[#6b55f7]">Why approved: </span>
                                    {loan.rationale ?? '—'}
                                 </td>
                              </tr>
                           ];
                        })}
                     </tbody>
                  </table>
               </div>
            </section>

         </div>
      </div>
   );
}
