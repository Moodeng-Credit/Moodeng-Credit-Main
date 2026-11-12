import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { Eye, EyeOff } from 'lucide-react';

import { type LenderReportData, loadLenderReport, manilaToday } from '@/lib/creditLineReport';
import { BITREPO_ROLLOVER_ADDRESS, buildRollover, type ChainTransfer, listUsdcTransfersTo } from '@/lib/creditLineRollover';
import { txExplorerUrl } from '@/lib/txExplorer';

// moodeng.app/repaidcreditline — BitRepo sees the original advance being rolled back to their address
// (to redeploy into the new vault): what is owed (principal + interest), what has arrived on Base, what the
// open loans will still pay them directly, and what Moodeng sends itself. Same password as /creditline.

const SESSION_KEY = 'md_creditline_pw';
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const manilaDay = (iso: string) => new Date(Date.parse(iso) + 8 * 3600 * 1000).toISOString().slice(0, 10);

const readSaved = () => {
   try {
      return window.sessionStorage.getItem(SESSION_KEY) ?? '';
   } catch {
      return '';
   }
};

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'due' }) {
   const color = tone === 'good' ? 'text-green-700' : tone === 'due' ? 'text-[#b45309]' : 'text-[#26143f]';
   return (
      <div className="rounded-2xl border border-[#e7e0ec] bg-white p-4">
         <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8a7c9c]">{label}</p>
         <p className={`mt-1 text-[22px] font-extrabold ${color}`}>{value}</p>
         {sub ? <p className="mt-0.5 text-[12px] text-[#695b7b]">{sub}</p> : null}
      </div>
   );
}

export default function RepaidCreditLinePage() {
   const [password, setPassword] = useState(readSaved);
   const [showPassword, setShowPassword] = useState(false);
   const [data, setData] = useState<LenderReportData | null>(null);
   const [transfers, setTransfers] = useState<ChainTransfer[] | null>(null);
   const [chainError, setChainError] = useState('');
   const [error, setError] = useState('');
   const [loading, setLoading] = useState(false);

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

   useEffect(() => {
      if (!data) return;
      listUsdcTransfersTo()
         .then(setTransfers)
         .catch(() => {
            setTransfers([]);
            setChainError('Couldn’t read Base just now, so payments received may be missing. Reload to try again.');
         });
   }, [data]);

   const roll = useMemo(() => (data && transfers ? buildRollover(data, transfers, manilaToday()) : null), [data, transfers]);

   if (!data) {
      const submit = (e: FormEvent) => {
         e.preventDefault();
         if (password.trim()) void unlock(password.trim());
      };
      return (
         <div className="flex min-h-screen items-center justify-center bg-[#f7f4fb] px-5">
            <form className="w-full max-w-[380px] rounded-3xl bg-white p-6 shadow-[0_10px_30px_rgba(38,20,63,0.08)]" onSubmit={submit}>
               <img alt="" className="mx-auto h-20 w-auto" src="/hippos/wallet-grow/wallet-4-grown.webp" />
               <h1 className="mt-3 text-center text-[22px] font-extrabold text-[#26143f]">Repaid credit line</h1>
               <p className="mt-1 text-center text-[14px] text-[#695b7b]">Lender report. Enter the password you were given.</p>
               <div className="relative mt-5">
                  <input
                     autoComplete="current-password"
                     className="min-h-[48px] w-full rounded-2xl border-2 border-[#e5ddf0] py-2 pl-4 pr-12 text-[16px] focus:border-[#6b55f7] focus:outline-none"
                     onChange={(e) => setPassword(e.target.value)}
                     placeholder="Password"
                     type={showPassword ? 'text' : 'password'}
                     value={password}
                  />
                  <button
                     aria-label={showPassword ? 'Hide password' : 'Show password'}
                     aria-pressed={showPassword}
                     className="absolute inset-y-0 right-1 grid w-11 place-items-center rounded-xl text-[#8a7c9c] hover:text-[#6b55f7]"
                     onClick={() => setShowPassword((v) => !v)}
                     type="button"
                  >
                     {showPassword ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
                  </button>
               </div>
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

   if (!roll) {
      return <div className="flex min-h-screen items-center justify-center bg-[#f7f4fb] text-[14px] text-[#695b7b]">Reading payments on Base…</div>;
   }

   const f = data.facility;
   const ratePct = `${(roll.rate * 100).toFixed(0)}%`;
   const fromBorrowers = roll.receipts.filter((r) => r.source === 'borrower').reduce((t, r) => t + r.amount, 0);
   const fromMoodeng = roll.received - fromBorrowers;
   return (
      <div className="min-h-screen bg-[#f7f4fb] px-4 pb-16 pt-6">
         <div className="mx-auto flex max-w-[1100px] flex-col gap-5">
            <header>
               <p className="text-[13px] font-semibold text-[#6b55f7]">{f.lender_name}</p>
               <h1 className="text-[26px] font-extrabold text-[#26143f]">Repaid credit line</h1>
               <p className="mt-1 max-w-[760px] text-[14px] text-[#695b7b]">
                  The original {usd(roll.principal)} advance, plus interest, going back to your address to be redeployed into the new vault. Only the
                  loans lent directly from the advance count here — vault loans are repaid through the vault.
               </p>
               <a
                  className="mt-1 inline-block break-all font-mono text-[12px] text-[#6b55f7] underline"
                  href={`https://basescan.org/address/${BITREPO_ROLLOVER_ADDRESS}`}
                  rel="noreferrer"
                  target="_blank"
               >
                  {BITREPO_ROLLOVER_ADDRESS}
               </a>
               <p className="text-[12px] text-[#8a7c9c]">Live data · as of {roll.asOf} (Philippine time)</p>
            </header>

            {chainError ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-800">{chainError}</p> : null}

            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
               <Stat
                  label="Owed to you"
                  sub={`${usd(roll.principal)} principal + ${usd(roll.interestProjected)} interest`}
                  value={usd(roll.owedProjected)}
               />
               <Stat
                  label="Received so far"
                  sub={`${usd(fromMoodeng)} from Moodeng · ${usd(fromBorrowers)} from borrowers`}
                  tone="good"
                  value={usd(roll.received)}
               />
               <Stat
                  label="Coming from borrowers"
                  sub={`${roll.openLoans} open ${roll.openLoans === 1 ? 'loan repays' : 'loans repay'} you directly`}
                  value={usd(roll.comingFromBorrowers)}
               />
               {roll.overBy > 0 ? (
                  <Stat label="Moodeng still sends" sub={`Borrowers' repayments cover it, ${usd(roll.overBy)} over`} tone="good" value={usd(0)} />
               ) : (
                  <Stat label="Moodeng still sends" sub="The rest, on top of the borrowers' repayments" tone="due" value={usd(roll.moodengToSend)} />
               )}
            </section>
            <p className="-mt-2 text-[12px] text-[#8a7c9c]">
               Interest: {ratePct}/yr simple, actual/365, on each loan’s principal from the day it was funded until the day it was repaid — the same
               as the monthly report. {usd(roll.interest)} so far; open loans are counted to their due date ({usd(roll.interestProjected)} in total).
               Still left to arrive: {usd(roll.left)}. Received = USDC that reached your address on Base from our lending wallet or from these loans’
               repayments.
            </p>

            <section className="overflow-hidden rounded-2xl border border-[#e7e0ec] bg-white">
               <h2 className="border-b border-[#f0ecf5] px-4 py-3 text-[16px] font-bold text-[#26143f]">
                  Received at your address <span className="font-semibold text-[#8a7c9c]">{roll.receipts.length}</span>
               </h2>
               <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-[13px]">
                     <thead className="bg-[#f8f4fc] text-[12px] uppercase text-[#695b7b]">
                        <tr>
                           {['Date', 'From', 'Amount', 'Transaction'].map((h) => (
                              <th className="px-3 py-2 font-semibold" key={h}>
                                 {h}
                              </th>
                           ))}
                        </tr>
                     </thead>
                     <tbody>
                        {roll.receipts.length === 0 ? (
                           <tr>
                              <td className="px-3 py-6 text-center text-[#8a7c9c]" colSpan={4}>
                                 Nothing received yet.
                              </td>
                           </tr>
                        ) : null}
                        {roll.receipts.map((r) => (
                           <tr className="border-t border-[#f0ecf5]" key={r.hash}>
                              <td className="px-3 py-2">{manilaDay(r.at)}</td>
                              <td className="px-3 py-2">
                                 {r.loan ? (
                                    <>
                                       Borrower {r.loan.privateId} repaid <span className="font-mono text-[11px]">{r.loan.tracking_id}</span>
                                    </>
                                 ) : (
                                    'Moodeng lending wallet'
                                 )}
                              </td>
                              <td className="px-3 py-2 font-semibold">{usd(r.amount)}</td>
                              <td className="px-3 py-2 font-mono text-[11px]">
                                 <a className="text-[#6b55f7] underline" href={txExplorerUrl(r.hash)} rel="noreferrer" target="_blank">
                                    {short(r.hash)}
                                 </a>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-[#e7e0ec] bg-white">
               <h2 className="border-b border-[#f0ecf5] px-4 py-3 text-[16px] font-bold text-[#26143f]">
                  Loans lent from the advance <span className="font-semibold text-[#8a7c9c]">{roll.loans.length}</span>
               </h2>
               <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-[13px]">
                     <thead className="bg-[#f8f4fc] text-[12px] uppercase text-[#695b7b]">
                        <tr>
                           {['Loan', 'Borrower', 'Funded', 'Due', 'Principal', 'Days out', `Interest (${ratePct})`, 'Status', 'Still to repay you'].map((h) => (
                              <th className="px-3 py-2 font-semibold" key={h}>
                                 {h}
                              </th>
                           ))}
                        </tr>
                     </thead>
                     <tbody>
                        {roll.loans.map(({ loan, open, days, interest, interestProjected, stillToRepay, paysBitrepo }) => (
                           <tr className="border-t border-[#f0ecf5]" key={loan.id}>
                              <td className="px-3 py-2 font-mono text-[11px]">{loan.tracking_id}</td>
                              <td className="px-3 py-2 font-semibold">{loan.privateId}</td>
                              <td className="px-3 py-2">{loan.fundedDate}</td>
                              <td className="px-3 py-2">{loan.dueDate}</td>
                              <td className="px-3 py-2">{usd(Number(loan.loan_amount))}</td>
                              <td className="px-3 py-2">{days}</td>
                              <td className="px-3 py-2">
                                 {usd(interest)}
                                 {open && interestProjected > interest ? (
                                    <span className="block text-[11px] text-[#8a7c9c]">{usd(interestProjected)} by due date</span>
                                 ) : null}
                              </td>
                              <td className="px-3 py-2 font-semibold">
                                 {!open ? (
                                    <span className="text-green-700">Repaid {loan.repaidDate}</span>
                                 ) : loan.status === 'Late' ? (
                                    <span className="text-red-600">Late</span>
                                 ) : (
                                    'Active'
                                 )}
                              </td>
                              <td className="px-3 py-2">
                                 {open ? (
                                    <>
                                       {usd(stillToRepay)}
                                       <span className="block text-[11px] text-[#8a7c9c]">{paysBitrepo ? 'Paid straight to you' : 'Paid to Moodeng'}</span>
                                    </>
                                 ) : (
                                    '—'
                                 )}
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </section>
         </div>
      </div>
   );
}
