'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
   type AdminVoucherClaim,
   type AdminVoucherClaimStatus,
   listVoucherClaims,
   logAdminAction,
   updateVoucherClaimStatus
} from '@/app/admin/adminSupabase';

type ClaimFilter = AdminVoucherClaimStatus | 'all';

const REWARD_LABEL: Record<AdminVoucherClaim['reward'], string> = {
   first_on_time_repayment: 'First on-time repayment',
   referral_inviter: 'Referral — inviter',
   referral_invitee: 'Referral — invited friend'
};

function statusClass(status: AdminVoucherClaimStatus) {
   if (status === 'sent') return 'bg-[#123d2a] text-[#6ee7a8]';
   if (status === 'rejected') return 'bg-[#3d1220] text-[#ff8fa3]';
   return 'bg-[#3d2d12] text-[#facc6b]';
}

/**
 * GrabFood voucher claims from the dashboard's "Claim" buttons. Eligibility is checked by the database
 * when the borrower submits; here the team sends the voucher code and records the outcome.
 */
export default function VoucherClaimsSection() {
   const [claims, setClaims] = useState<AdminVoucherClaim[]>([]);
   const [filter, setFilter] = useState<ClaimFilter>('pending');
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [busyId, setBusyId] = useState<string | null>(null);

   const refresh = useCallback(async () => {
      setIsLoading(true);
      setError(null);
      try {
         setClaims(await listVoucherClaims());
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
                  <div className="mt-4 flex gap-2">
                     <button
                        type="button"
                        disabled={busyId === claim.id}
                        onClick={() => void setStatus(claim, 'sent')}
                        className="rounded-xl bg-[#8336f0] px-5 py-2 text-base font-black text-white disabled:opacity-50"
                     >
                        Mark voucher sent
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
