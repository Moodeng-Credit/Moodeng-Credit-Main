'use client';

import type { goalSlots } from '@/app/admin/marketingModel';

// The month's lending goal as one bar filled by name: loans already made (solid), people who can borrow
// again this month (dashed, click to leave someone out), and empty slots for the new borrowers still needed.

type Slots = ReturnType<typeof goalSlots>;

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;
const shortDate = (d: string) =>
   new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const userLink = (id: string, username: string | null) =>
   `/admin?${new URLSearchParams({ ...(username ? { q: username } : {}), user: id }).toString()}`;

export default function GoalSlotsBoard({
   slots,
   cacTarget,
   budget,
   isCurrentMonth,
   busy,
   onExclude,
   onRestore
}: {
   slots: Slots;
   cacTarget: number;
   budget: number;
   isCurrentMonth: boolean;
   busy: boolean;
   onExclude: (userId: string, name: string) => void;
   onRestore: (userId: string) => void;
}) {
   const { target, done, lent, comeback, comebackSum, leftOut, firstLoan, gap, need, cost, posters, weeks } = slots;
   const scale = Math.max(target, lent + comebackSum + gap);
   const width = (amount: number) => `${(amount / scale) * 100}%`;
   const lined = lent + comebackSum;
   const hit = lent >= target;

   return (
      <div className="space-y-4">
         <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-xl font-black">Goal: {usd(target)} lent</h3>
            <span className="text-sm text-[#a89bb8]">
               <b className="text-white">{usd(lent)} lent</b>
               {isCurrentMonth ? ` · ${usd(comebackSum)} can come back · ${usd(gap)} still open` : ''}
            </span>
         </div>

         <div className="flex h-16 w-full overflow-hidden rounded-xl border border-[#2a1453] bg-[#12052a]">
            {done.map((d) => (
               <a
                  className="flex min-w-0 flex-col items-center justify-center overflow-hidden border-r-2 border-[#12052a] bg-[#8336f0] px-1 text-center text-[11px] leading-tight text-white"
                  href={userLink(d.userId, d.username)}
                  key={d.loanId}
                  style={{ width: width(d.amount) }}
                  title={`${d.name}: ${usd(d.amount)} on ${shortDate(d.date)}`}
               >
                  <b className="w-full truncate text-xs">{d.name.split(' ')[0]}</b>
                  {usd(d.amount)}
               </a>
            ))}
            {comeback.map((c) => (
               <button
                  className="flex min-w-0 flex-col items-center justify-center overflow-hidden border-r-2 border-[#12052a] bg-emerald-900/40 px-1 text-center text-[11px] leading-tight text-emerald-200 outline-dashed outline-1 -outline-offset-4 outline-emerald-400 hover:bg-emerald-900/70 disabled:opacity-50"
                  disabled={busy}
                  key={c.userId}
                  onClick={() => onExclude(c.userId, c.name)}
                  style={{ width: width(c.amount) }}
                  title={`${c.name}: next loan ${usd(c.amount)}, ${c.when ? `after repaying ${shortDate(c.when)}` : 'now'}. Click to leave out.`}
                  type="button"
               >
                  <b className="w-full truncate text-xs">{c.name.split(' ')[0]}</b>
                  {usd(c.amount)}
               </button>
            ))}
            {Array.from({ length: need }, (_, i) => (
               <div
                  className="flex min-w-0 items-center justify-center border-r-2 border-[#12052a] text-[11px] text-[#7a6b8f] outline-dashed outline-1 -outline-offset-4 outline-[#4a3a66]"
                  key={i}
                  style={{ width: width(Math.min(firstLoan, gap - i * firstLoan)) }}
                  title={`New borrower #${i + 1}: about ${usd(firstLoan)}, costs about ${usd(cacTarget)}`}
               >
                  #{i + 1}
               </div>
            ))}
         </div>
         <div className="flex flex-wrap gap-4 text-xs text-[#a89bb8]">
            <span>
               <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#8336f0] align-middle" />
               Already lent (real money)
            </span>
            {isCurrentMonth ? (
               <>
                  <span>
                     <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-900/60 align-middle outline-dashed outline-1 outline-emerald-400" />
                     Can borrow again this month (click to leave out)
                  </span>
                  <span>
                     <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle outline-dashed outline-1 outline-[#4a3a66]" />
                     Needs a new borrower
                  </span>
               </>
            ) : null}
         </div>

         <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl bg-[#1a0838] p-4">
               <p className="font-bold text-emerald-300">Already lent</p>
               <p className="mt-1 text-2xl font-black">
                  {usd(lent)} · {done.length} loans
               </p>
               <ul className="mt-2 divide-y divide-[#2a1453] text-sm">
                  {done.map((d) => (
                     <li className="flex justify-between gap-2 py-1.5" key={d.loanId}>
                        <a className="truncate underline decoration-[#4a3a66]" href={userLink(d.userId, d.username)}>
                           {d.name}
                        </a>
                        <span className="text-[#a89bb8]">
                           {usd(d.amount)} · {shortDate(d.date)}
                        </span>
                     </li>
                  ))}
                  {!done.length ? <li className="py-1.5 text-[#a89bb8]">No loans yet this month.</li> : null}
               </ul>
            </div>

            {isCurrentMonth ? (
               <>
                  <div className="rounded-2xl bg-[#1a0838] p-4">
                     <p className="font-bold text-emerald-300">Can borrow again</p>
                     <p className="mt-1 text-2xl font-black">
                        {usd(comebackSum)} · {comeback.length} people
                     </p>
                     <ul className="mt-2 divide-y divide-[#2a1453] text-sm">
                        {comeback.map((c) => (
                           <li className="flex items-center justify-between gap-2 py-1.5" key={c.userId}>
                              <a className="truncate underline decoration-[#4a3a66]" href={userLink(c.userId, c.username)}>
                                 {c.name}
                              </a>
                              <span className="whitespace-nowrap text-[#a89bb8]">
                                 {usd(c.amount)} · {c.when ? `after ${shortDate(c.when)}` : 'now'}
                              </span>
                           </li>
                        ))}
                        {!comeback.length ? <li className="py-1.5 text-[#a89bb8]">Nobody is free to borrow again this month.</li> : null}
                     </ul>
                     {leftOut.length ? (
                        <p className="mt-2 text-xs text-[#a89bb8]">
                           Left out:{' '}
                           {leftOut.map((l, i) => (
                              <span key={l.userId}>
                                 {i ? ', ' : ''}
                                 {l.name}{' '}
                                 <button className="underline" disabled={busy} onClick={() => onRestore(l.userId)} type="button">
                                    add back
                                 </button>
                              </span>
                           ))}
                        </p>
                     ) : null}
                  </div>

                  <div className="rounded-2xl bg-[#1a0838] p-4">
                     <p className="font-bold text-[#b99cff]">Still need from new people</p>
                     <p className="mt-1 text-2xl font-black">{hit ? 'Goal reached' : `${need} new borrowers`}</p>
                     <ul className="mt-2 divide-y divide-[#2a1453] text-sm">
                        <li className="flex justify-between py-1.5">
                           <span>Each first loan</span>
                           <span className="text-[#a89bb8]">about {usd(firstLoan)}</span>
                        </li>
                        <li className="flex justify-between py-1.5">
                           <span>Cost at {usd(cacTarget)} each</span>
                           <span className={cost > budget ? 'text-red-300' : 'text-[#a89bb8]'}>
                              {usd(cost)}
                              {cost > budget ? ` (budget ${usd(budget)})` : ''}
                           </span>
                        </li>
                        <li className="flex justify-between py-1.5">
                           <span>Posters (about 4 people each)</span>
                           <span className="text-[#a89bb8]">{posters} × $20</span>
                        </li>
                        {weeks.map((w, i) => (
                           <li className="flex justify-between py-1.5" key={w.start}>
                              <span>
                                 {i === 0 ? 'This week' : 'Week'} ({shortDate(w.start)}–{shortDate(w.end)})
                              </span>
                              <span className="font-bold">{w.count}</span>
                           </li>
                        ))}
                     </ul>
                  </div>
               </>
            ) : null}
         </div>
         {isCurrentMonth && !hit ? (
            <p className="text-sm text-[#a89bb8]">
               {usd(lined)} of {usd(target)} is lined up if everyone shown comes back at their full limit; the rest needs {need} new
               borrowers.
            </p>
         ) : null}
      </div>
   );
}
