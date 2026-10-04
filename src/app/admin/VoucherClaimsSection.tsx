'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
   addVoucherCodes,
   type AdminVoucherClaim,
   type AdminVoucherClaimStatus,
   getVoucherCodeStock,
   listVoucherClaims,
   logAdminAction,
   sendVoucherCodeForClaim,
   updateVoucherClaimStatus,
   type VoucherCodeStock
} from '@/app/admin/adminSupabase';
import { parseVoucherCodes, VOUCHER_VALUES_PHP } from '@/app/admin/voucherCodes';

type ClaimFilter = AdminVoucherClaimStatus | 'all';

const REWARD_LABEL: Record<AdminVoucherClaim['reward'], string> = {
   first_on_time_repayment: 'First on-time repayment',
   referral_inviter: 'Referral — inviter',
   referral_invitee: 'Referral — invited friend',
   tier_rising: 'Moodeng reached Rising',
   tier_prime: 'Moodeng reached Prime',
   tier_apex: 'Moodeng reached Apex'
};

function statusClass(status: AdminVoucherClaimStatus) {
   if (status === 'sent') return 'bg-[#123d2a] text-[#6ee7a8]';
   if (status === 'rejected') return 'bg-[#3d1220] text-[#ff8fa3]';
   return 'bg-[#3d2d12] text-[#facc6b]';
}

/**
 * GrabFood voucher claims from the dashboard's "Claim" buttons. Eligibility is checked by the database
 * when the borrower submits. The team keeps a pool of pre-bought codes here; "Send code" (or ✅ on the
 * Telegram card) emails the next unused code of the claim's value and marks it sent.
 */
export default function VoucherClaimsSection() {
   const [claims, setClaims] = useState<AdminVoucherClaim[]>([]);
   const [filter, setFilter] = useState<ClaimFilter>('pending');
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [busyId, setBusyId] = useState<string | null>(null);
   const [notice, setNotice] = useState<string | null>(null);
   const [stock, setStock] = useState<VoucherCodeStock[]>([]);
   const [newCodesValue, setNewCodesValue] = useState<number>(VOUCHER_VALUES_PHP[0]);
   const [newCodesText, setNewCodesText] = useState('');
   const [newCodesSource, setNewCodesSource] = useState('');
   const [isAddingCodes, setIsAddingCodes] = useState(false);

   const refresh = useCallback(async () => {
      setIsLoading(true);
      setError(null);
      try {
         const [nextClaims, nextStock] = await Promise.all([listVoucherClaims(), getVoucherCodeStock()]);
         setClaims(nextClaims);
         setStock(nextStock);
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not load voucher claims.');
      } finally {
         setIsLoading(false);
      }
   }, []);

   useEffect(() => {
      void refresh();
   }, [refresh]);

   const visible = useMemo(() => (filter === 'all' ? claims : claims.filter((claim) => claim.status === filter)), [claims, filter]);
   const pendingCount = claims.filter((claim) => claim.status === 'pending').length;
   const availableFor = (amountPhp: number) => stock.find((row) => row.amount_php === amountPhp)?.available ?? 0;
   const parsedNewCodes = useMemo(() => parseVoucherCodes(newCodesText), [newCodesText]);

   const addCodes = async () => {
      if (!parsedNewCodes.length) return;
      setIsAddingCodes(true);
      setError(null);
      setNotice(null);
      try {
         const { added, skipped } = await addVoucherCodes(newCodesValue, parsedNewCodes, newCodesSource);
         setNotice(`Added ${added} ₱${newCodesValue} code${added === 1 ? '' : 's'}${skipped ? ` (${skipped} already in the pool, skipped)` : ''}.`);
         setNewCodesText('');
         await refresh();
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not add the codes.');
      } finally {
         setIsAddingCodes(false);
      }
   };

   // Approve: emails the next pool code of the claim's value and marks it sent.
   const sendCode = async (claim: AdminVoucherClaim) => {
      setBusyId(claim.id);
      setError(null);
      setNotice(null);
      try {
         const result = await sendVoucherCodeForClaim(claim.id);
         if (result.ok) setNotice(result.summary);
         else setError(result.summary);
         await refresh();
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not send the code.');
      } finally {
         setBusyId(null);
      }
   };

   const setStatus = async (claim: AdminVoucherClaim, status: AdminVoucherClaimStatus) => {
      const note =
         status === 'rejected' ? window.prompt('Reason for rejecting (shown to the team only):', claim.admin_note ?? '') : claim.admin_note;
      if (status === 'rejected' && note === null) return;
      setBusyId(claim.id);
      try {
         await updateVoucherClaimStatus(claim.id, status, note);
         await logAdminAction({
            action: `voucher_claim_${status}`,
            target_table: 'voucher_claims',
            target_id: claim.id,
            target_user_id: claim.user_id,
            metadata: { reward: claim.reward, amount_php: claim.amount_php }
         }).catch(() => undefined);
         await refresh();
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not update the claim.');
      } finally {
         setBusyId(null);
      }
   };

   return (
      <div className="space-y-4">
         <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-2xl font-black">GrabFood voucher claims</h3>
            <span className="text-xl font-bold text-[#a89bb8]">({pendingCount} to send)</span>
            <div className="ml-auto flex gap-2">
               {(['pending', 'sent', 'rejected', 'all'] as const).map((value) => (
                  <button
                     key={value}
                     type="button"
                     onClick={() => setFilter(value)}
                     className={`rounded-full px-4 py-1.5 text-sm font-black capitalize ${filter === value ? 'bg-[#8336f0] text-white' : 'bg-[#241044] text-[#a89bb8]'}`}
                  >
                     {value}
                  </button>
               ))}
            </div>
         </div>

         <div className="rounded-2xl border border-[#2a1453] bg-[#160830] p-5">
            <div className="flex flex-wrap items-center gap-3">
               <h4 className="text-lg font-black">Code pool</h4>
               {VOUCHER_VALUES_PHP.map((value) => {
                  const left = availableFor(value);
                  return (
                     <span
                        key={value}
                        className={`rounded-full px-3 py-1 text-sm font-black ${left === 0 ? 'bg-[#3d1220] text-[#ff8fa3]' : left <= 3 ? 'bg-[#3d2d12] text-[#facc6b]' : 'bg-[#123d2a] text-[#6ee7a8]'}`}
                     >
                        ₱{value}: {left} left
                     </span>
                  );
               })}
            </div>
            <p className="mt-2 text-sm text-[#a89bb8]">
               Paste GrabFood codes (or redemption links), one per line. Approving a claim emails the next unused code of its value.
            </p>
            <div className="mt-3 flex flex-wrap items-start gap-3">
               <select
                  value={newCodesValue}
                  onChange={(event) => setNewCodesValue(Number(event.target.value))}
                  aria-label="Voucher value"
                  className="rounded-xl bg-[#241044] px-3 py-2 font-bold text-white"
               >
                  {VOUCHER_VALUES_PHP.map((value) => (
                     <option key={value} value={value}>
                        ₱{value}
                     </option>
                  ))}
               </select>
               <textarea
                  value={newCodesText}
                  onChange={(event) => setNewCodesText(event.target.value)}
                  rows={3}
                  placeholder={'CODE-1\nCODE-2'}
                  aria-label="Voucher codes, one per line"
                  className="min-w-[220px] flex-1 rounded-xl bg-[#241044] px-3 py-2 font-mono text-sm text-white"
               />
               <input
                  value={newCodesSource}
                  onChange={(event) => setNewCodesSource(event.target.value)}
                  placeholder="Bought from (optional)"
                  aria-label="Where the codes were bought"
                  className="rounded-xl bg-[#241044] px-3 py-2 text-sm text-white"
               />
               <button
                  type="button"
                  disabled={isAddingCodes || parsedNewCodes.length === 0}
                  onClick={() => void addCodes()}
                  className="rounded-xl bg-[#8336f0] px-5 py-2 text-base font-black text-white disabled:opacity-50"
               >
                  {parsedNewCodes.length ? `Add ${parsedNewCodes.length} ₱${newCodesValue} code${parsedNewCodes.length === 1 ? '' : 's'}` : 'Add codes'}
               </button>
            </div>
         </div>

         {notice ? <p className="rounded-xl bg-[#123d2a] px-4 py-3 font-bold text-[#6ee7a8]">{notice}</p> : null}
         {error ? <p className="rounded-xl bg-[#3d1220] px-4 py-3 font-bold text-[#ff8fa3]">{error}</p> : null}
         {isLoading ? <p className="text-[#a89bb8]">Loading…</p> : null}
         {!isLoading && visible.length === 0 ? <p className="text-[#6f6385]">No {filter === 'all' ? '' : filter} claims.</p> : null}

         {visible.map((claim) => (
            <div key={claim.id} className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5">
               <div className="flex flex-wrap items-center gap-3">
                  <span className="text-2xl font-black">₱{claim.amount_php}</span>
                  <span className="font-bold text-[#a89bb8]">{REWARD_LABEL[claim.reward]}</span>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-black uppercase ${statusClass(claim.status)}`}>
                     {claim.status}
                  </span>
                  <span className="ml-auto text-sm text-[#6f6385]">{new Date(claim.created_at).toLocaleString()}</span>
               </div>
               <dl className="mt-3 grid gap-x-6 gap-y-1 text-base sm:grid-cols-2">
                  <div>
                     <dt className="inline font-bold text-[#a89bb8]">Name: </dt>
                     <dd className="inline">{claim.full_name}</dd>
                  </div>
                  <div>
                     <dt className="inline font-bold text-[#a89bb8]">Mobile (GCash): </dt>
                     <dd className="inline">{claim.mobile}</dd>
                  </div>
                  <div>
                     <dt className="inline font-bold text-[#a89bb8]">Email: </dt>
                     <dd className="inline">{claim.email ?? '—'}</dd>
                  </div>
                  <div>
                     <dt className="inline font-bold text-[#a89bb8]">User: </dt>
                     <dd className="inline">{claim.username ?? claim.user_id}</dd>
                  </div>
                  {claim.admin_note ? (
                     <div className="sm:col-span-2">
                        <dt className="inline font-bold text-[#a89bb8]">Note: </dt>
                        <dd className="inline">{claim.admin_note}</dd>
                     </div>
                  ) : null}
               </dl>
               {claim.status === 'pending' ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                     <button
                        type="button"
                        disabled={busyId === claim.id || availableFor(claim.amount_php) === 0}
                        onClick={() => void sendCode(claim)}
                        title={availableFor(claim.amount_php) === 0 ? `No ₱${claim.amount_php} codes left. Add some above.` : undefined}
                        className="rounded-xl bg-[#8336f0] px-5 py-2 text-base font-black text-white disabled:opacity-50"
                     >
                        {busyId === claim.id ? 'Sending…' : `Send code (${availableFor(claim.amount_php)} left)`}
                     </button>
                     <button
                        type="button"
                        disabled={busyId === claim.id}
                        onClick={() => void setStatus(claim, 'sent')}
                        title="Use when you sent a voucher by hand, outside the pool"
                        className="rounded-xl bg-[#34234f] px-5 py-2 text-base font-black text-white disabled:opacity-50"
                     >
                        Mark sent manually
                     </button>
                     <button
                        type="button"
                        disabled={busyId === claim.id}
                        onClick={() => void setStatus(claim, 'rejected')}
                        className="rounded-xl bg-[#34234f] px-5 py-2 text-base font-black text-white disabled:opacity-50"
                     >
                        Reject
                     </button>
                  </div>
               ) : null}
            </div>
         ))}
      </div>
   );
}
