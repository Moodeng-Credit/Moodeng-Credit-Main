'use client';

import { useCallback, useEffect, useState } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import { AffiliatePayCard } from '@/app/admin/AffiliatePayCard';
import { listOwedAffiliates, type OwedAffiliate } from '@/app/admin/affiliatePayouts';
import { type AdminInvoice, fetchAdminInvoices, invoiceMonthName } from '@/lib/affiliateInvoice';

/** Admin → Affiliate payouts: everyone we owe referral money, a Pay button each, and a way into anyone's dashboard. */
export default function AffiliatePayoutsSection() {
   const navigate = useNavigate();
   const [rows, setRows] = useState<OwedAffiliate[]>([]);
   const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [who, setWho] = useState('');

   const load = useCallback(async () => {
      try {
         const [owed, inv] = await Promise.all([listOwedAffiliates(), fetchAdminInvoices().catch(() => [])]);
         setRows(owed);
         setInvoices(inv);
         setError(null);
      } catch (err) {
         setError((err as Error)?.message || 'Could not load payouts.');
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      void load();
   }, [load]);

   const total = rows.reduce((s, r) => s + r.owed, 0);

   const open = (e: React.FormEvent) => {
      e.preventDefault();
      const v = who.trim();
      if (v) navigate(`/affiliate?user=${encodeURIComponent(v.startsWith('@') || /^[0-9a-f-]{36}$/i.test(v) ? v : `@${v}`)}`);
   };

   return (
      <section className="space-y-6">
         <div>
            <h2 className="break-words text-2xl font-black sm:text-3xl">Affiliate payouts</h2>
            <p className="mt-1.5 max-w-3xl text-base text-[#a89bb8]">
               Everyone we owe for friends who repaid. Pay sends USDC on Base from your connected wallet to their Moodeng wallet and marks
               it paid.
            </p>
         </div>

         <form onSubmit={open} className="flex max-w-xl flex-wrap gap-2">
            <input
               value={who}
               onChange={(e) => setWho(e.target.value)}
               placeholder="@username or user id"
               className="min-w-0 flex-1 rounded-xl bg-[#241044] px-3 py-2 text-white"
            />
            <button type="submit" className="rounded-xl bg-[#6d3cff] px-4 py-2 font-bold text-white">
               Open their dashboard
            </button>
         </form>

         {loading ? <p className="text-[#a89bb8]">Loading…</p> : null}
         {error ? <p className="text-red-300">{error}</p> : null}
         {!loading && !error ? (
            <p className="text-lg font-bold text-white">
               {rows.length ? (
                  <>
                     Owed now: <span className="text-amber-300">${total.toFixed(2)}</span> to {rows.length}{' '}
                     {rows.length === 1 ? 'person' : 'people'}
                  </>
               ) : (
                  'Nothing owed right now ✓'
               )}
            </p>
         ) : null}

         {invoices.length ? (
            <div className="max-w-3xl space-y-2">
               <h3 className="text-lg font-bold text-white">🧾 Monthly invoices</h3>
               <p className="text-sm text-[#a89bb8]">Affiliates send these from the 25th to the 5th. Pay below; an invoice turns Paid once every line is paid.</p>
               <ul className="divide-y divide-white/10 rounded-xl bg-[#241044]">
                  {invoices.map((i) => (
                     <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm text-white">
                        <span>
                           <Link to={`/affiliate?user=${i.owner_user_id}`} className="font-bold underline">
                              {i.display_name?.trim() || (i.username ? `@${i.username}` : 'Someone')}
                           </Link>{' '}
                           · {invoiceMonthName(i.month)} · <b>${i.amount.toFixed(2)}</b> · {i.items.length}{' '}
                           {i.items.length === 1 ? 'line' : 'lines'}
                           {i.note ? <span className="text-[#a89bb8]"> · “{i.note}”</span> : null}
                        </span>
                        <span
                           className={
                              i.paid
                                 ? 'rounded-full bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300'
                                 : 'rounded-full bg-amber-400/20 px-2 py-0.5 font-bold text-amber-300'
                           }
                        >
                           {i.paid ? 'Paid ✓' : 'To pay'}
                        </span>
                     </li>
                  ))}
               </ul>
            </div>
         ) : null}

         <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((r) => (
               <div key={r.user_id} className="space-y-1">
                  <AffiliatePayCard affiliate={r} onPaid={load} />
                  <Link to={`/affiliate?user=${r.user_id}`} className="inline-block px-1 text-sm text-[#b99cff] underline">
                     Open their affiliate dashboard →
                  </Link>
               </div>
            ))}
         </div>
      </section>
   );
}
