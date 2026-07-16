'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { STARTING_CREDIT_LIMIT } from '../../config/creditTiers';
import {
   type AdminReferralCode,
   createReferralCode,
   deleteReferralCode,
   listReferralCodes,
   logAdminAction,
   setReferralCodeActive
} from './adminSupabase';

type CodeFilter = 'active' | 'inactive' | 'all';

// A code can be nominally active but no longer redeemable (expired / maxed out).
type CodeStatus = 'active' | 'inactive' | 'expired' | 'maxed out';

function codeStatus(c: AdminReferralCode): CodeStatus {
   if (!c.is_active) return 'inactive';
   if (c.expires_at && new Date(c.expires_at) <= new Date()) return 'expired';
   if (c.max_uses != null && c.current_uses >= c.max_uses) return 'maxed out';
   return 'active';
}

function statusClass(s: CodeStatus): string {
   if (s === 'active') return 'bg-emerald-900/50 text-emerald-300';
   if (s === 'inactive') return 'bg-[#241044] text-[#a89bb8]';
   return 'bg-amber-900/50 text-amber-300';
}

function errorMessage(err: unknown): string {
   const anyErr = err as { code?: string; message?: string } | null;
   if (anyErr?.code === '23505') return 'That code already exists.';
   if (anyErr?.code === '23503') return 'This code was already redeemed by someone — deactivate it instead of deleting.';
   return anyErr?.message || 'Something went wrong. Try again.';
}

export default function ReferralCodesSection() {
   const [codes, setCodes] = useState<AdminReferralCode[]>([]);
   const [loading, setLoading] = useState(false);
   const [busy, setBusy] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [filter, setFilter] = useState<CodeFilter>('all');

   const [newCode, setNewCode] = useState('');
   const [newBoost, setNewBoost] = useState('5');
   const [newMaxUses, setNewMaxUses] = useState('');
   const [newExpiresAt, setNewExpiresAt] = useState('');
   const [creating, setCreating] = useState(false);

   const load = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
         setCodes(await listReferralCodes());
      } catch (err) {
         setError(errorMessage(err));
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      void load();
   }, [load]);

   const create = useCallback(async () => {
      const code = newCode.trim().toUpperCase();
      const boost = Number(newBoost);
      if (!code) {
         setError('Enter a code first.');
         return;
      }
      if (!Number.isFinite(boost) || boost <= 0) {
         setError('Boost must be a positive number.');
         return;
      }
      const maxUses = newMaxUses.trim() === '' ? null : Number(newMaxUses);
      if (maxUses != null && (!Number.isInteger(maxUses) || maxUses <= 0)) {
         setError('Max uses must be a whole number above zero, or empty for unlimited.');
         return;
      }
      // Date input gives a day; the code stays valid through the end of that day.
      const expiresAt = newExpiresAt ? new Date(`${newExpiresAt}T23:59:59`).toISOString() : null;

      setCreating(true);
      setError(null);
      try {
         const created = await createReferralCode({
            code,
            boost_amount: boost,
            max_uses: maxUses,
            expires_at: expiresAt
         });
         await logAdminAction({
            action: 'referral_code_created',
            target_table: 'referral_codes',
            target_id: created.id,
            metadata: { code: created.code, boost_amount: boost, max_uses: maxUses, expires_at: expiresAt }
         });
         setCodes((prev) => [created, ...prev]);
         setNewCode('');
         setNewBoost('5');
         setNewMaxUses('');
         setNewExpiresAt('');
      } catch (err) {
         setError(errorMessage(err));
      } finally {
         setCreating(false);
      }
   }, [newBoost, newCode, newExpiresAt, newMaxUses]);

   const toggleActive = useCallback(async (c: AdminReferralCode) => {
      setBusy(c.id);
      setError(null);
      try {
         const updated = await setReferralCodeActive(c.id, !c.is_active);
         await logAdminAction({
            action: updated.is_active ? 'referral_code_activated' : 'referral_code_deactivated',
            target_table: 'referral_codes',
            target_id: c.id,
            metadata: { code: c.code }
         });
         setCodes((prev) => prev.map((row) => (row.id === c.id ? updated : row)));
      } catch (err) {
         setError(errorMessage(err));
      } finally {
         setBusy(null);
      }
   }, []);

   const remove = useCallback(async (c: AdminReferralCode) => {
      if (!window.confirm(`Delete ${c.code} for good? It has never been redeemed, so nothing else is affected.`)) {
         return;
      }
      setBusy(c.id);
      setError(null);
      try {
         await deleteReferralCode(c.id);
         await logAdminAction({
            action: 'referral_code_deleted',
            target_table: 'referral_codes',
            target_id: c.id,
            metadata: { code: c.code }
         });
         setCodes((prev) => prev.filter((row) => row.id !== c.id));
      } catch (err) {
         setError(errorMessage(err));
      } finally {
         setBusy(null);
      }
   }, []);

   const shown = useMemo(() => {
      if (filter === 'all') return codes;
      if (filter === 'active') return codes.filter((c) => c.is_active);
      return codes.filter((c) => !c.is_active);
   }, [codes, filter]);

   const activeCount = useMemo(() => codes.filter((c) => c.is_active).length, [codes]);

   // New borrowers start at STARTING_CREDIT_LIMIT; a boost lands them at start + boost.
   const newTotalLimit = useMemo(() => {
      const boost = Number(newBoost);
      return Number.isFinite(boost) && boost > 0 ? STARTING_CREDIT_LIMIT + boost : null;
   }, [newBoost]);

   return (
      <div className="space-y-4">
         <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-3xl font-black">
               Codes <span className="text-xl font-bold text-[#a89bb8]">({activeCount} active)</span>
            </h3>
            <div className="flex items-center gap-2">
               {(['all', 'active', 'inactive'] as const).map((f) => (
                  <button
                     key={f}
                     type="button"
                     onClick={() => setFilter(f)}
                     className={`rounded-full px-4 py-1.5 text-sm font-black capitalize ${filter === f ? 'bg-[#8336f0] text-white' : 'bg-[#241044] text-[#a89bb8]'}`}
                  >
                     {f}
                  </button>
               ))}
               <button
                  type="button"
                  onClick={load}
                  disabled={loading}
                  className="rounded-full bg-[#1c053d] px-4 py-1.5 text-sm font-black text-white disabled:opacity-50"
               >
                  {loading ? '…' : 'Refresh'}
               </button>
            </div>
         </div>

         {error ? (
            <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-lg font-bold text-red-300">
               {error}
            </div>
         ) : null}

         <article className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5">
            <h4 className="text-xl font-black">New code</h4>
            <div className="mt-3 flex flex-wrap items-end gap-3">
               <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm font-bold text-[#a89bb8]">
                  Code
                  <input
                     value={newCode}
                     onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                     placeholder="e.g. JAMIE"
                     className="rounded-xl border border-[#3d1f6e] bg-[#241044] px-3 py-2 font-mono text-base font-bold uppercase text-white placeholder:normal-case placeholder:text-[#6f6385]"
                  />
               </label>
               <label className="flex w-28 flex-col gap-1 text-sm font-bold text-[#a89bb8]">
                  Boost ($)
                  <input
                     value={newBoost}
                     onChange={(e) => setNewBoost(e.target.value)}
                     inputMode="decimal"
                     className="rounded-xl border border-[#3d1f6e] bg-[#241044] px-3 py-2 text-base font-bold text-white"
                  />
               </label>
               <label className="flex w-32 flex-col gap-1 text-sm font-bold text-[#a89bb8]">
                  Max uses
                  <input
                     value={newMaxUses}
                     onChange={(e) => setNewMaxUses(e.target.value)}
                     inputMode="numeric"
                     placeholder="unlimited"
                     className="rounded-xl border border-[#3d1f6e] bg-[#241044] px-3 py-2 text-base font-bold text-white placeholder:text-[#6f6385]"
                  />
               </label>
               <label className="flex w-44 flex-col gap-1 text-sm font-bold text-[#a89bb8]">
                  Expires
                  <input
                     type="date"
                     value={newExpiresAt}
                     onChange={(e) => setNewExpiresAt(e.target.value)}
                     className="rounded-xl border border-[#3d1f6e] bg-[#241044] px-3 py-2 text-base font-bold text-white [color-scheme:dark]"
                  />
               </label>
               <button
                  type="button"
                  onClick={create}
                  disabled={creating}
                  className="rounded-xl bg-[#8336f0] px-5 py-2 text-base font-black text-white disabled:opacity-50"
               >
                  {creating ? 'Adding…' : 'Add code'}
               </button>
            </div>
            {newTotalLimit != null ? (
               <p className="mt-3 rounded-xl bg-[#241044] px-3 py-2 text-base font-black text-[#cfc6dd]">
                  New borrower total credit limit: <span className="text-white">${STARTING_CREDIT_LIMIT} start + ${Number(newBoost)} boost = ${newTotalLimit}</span>
               </p>
            ) : null}
            <p className="mt-2 text-sm font-medium text-[#6f6385]">
               Leave max uses and expiry empty for a code that works forever. Boost is the starting-limit bump in USDC — a new
               borrower starts at ${STARTING_CREDIT_LIMIT} and lands at ${STARTING_CREDIT_LIMIT} + boost.
            </p>
         </article>

         {shown.length ? (
            <div className="space-y-3">
               {shown.map((c) => {
                  const status = codeStatus(c);
                  return (
                     <article key={c.id} className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                           <div className="min-w-0">
                              <div className="flex items-center gap-3">
                                 <span className="font-mono text-2xl font-black tracking-wide">{c.code}</span>
                                 <span className="rounded-full bg-[#241044] px-2 py-0.5 text-sm font-black text-[#cfc6dd]">
                                    +${c.boost_amount} boost
                                 </span>
                                 <span className="rounded-full bg-emerald-900/50 px-2 py-0.5 text-sm font-black text-emerald-300">
                                    ${STARTING_CREDIT_LIMIT + Number(c.boost_amount)} total limit
                                 </span>
                              </div>
                              <p className="mt-1 text-lg font-bold text-[#cfc6dd]">
                                 {c.current_uses} used{c.max_uses != null ? ` of ${c.max_uses}` : ''}
                                 {c.expires_at ? ` · expires ${new Date(c.expires_at).toLocaleDateString()}` : ''}
                              </p>
                              <p className="mt-1 text-sm font-medium text-[#6f6385]">
                                 created {new Date(c.created_at).toLocaleDateString()}
                              </p>
                           </div>
                           <span
                              className={`shrink-0 rounded-full px-3 py-1 text-sm font-black uppercase ${statusClass(status)}`}
                           >
                              {status}
                           </span>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                           <button
                              type="button"
                              onClick={() => toggleActive(c)}
                              disabled={busy === c.id}
                              className={`rounded-xl px-4 py-2 text-base font-black text-white disabled:opacity-50 ${c.is_active ? 'bg-[#34234f]' : 'bg-[#8336f0]'}`}
                           >
                              {c.is_active ? 'Deactivate' : 'Reactivate'}
                           </button>
                           {c.current_uses === 0 ? (
                              <button
                                 type="button"
                                 onClick={() => remove(c)}
                                 disabled={busy === c.id}
                                 className="rounded-xl bg-red-600 px-4 py-2 text-base font-black text-white disabled:opacity-50"
                              >
                                 Delete
                              </button>
                           ) : null}
                        </div>
                     </article>
                  );
               })}
            </div>
         ) : (
            <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5 text-xl font-black text-[#a89bb8]">
               {loading ? 'Loading codes…' : `No ${filter === 'all' ? '' : filter} codes yet.`}
            </div>
         )}
      </div>
   );
}
