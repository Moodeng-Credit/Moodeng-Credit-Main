'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import {
   type AdminUnclaimedVoucher,
   type AdminVoucherClaim,
   type AdminVoucherClaimStatus,
   type AdminVoucherReward,
   listUnclaimedVouchers,
   listVoucherClaims,
   logAdminAction,
   updateVoucherClaimStatus
} from '@/app/admin/adminSupabase';
import { AdminLiveRow, useAdminLiveReload } from '@/app/admin/useAdminLive';

type View = 'to-send' | 'sent' | 'unclaimed' | 'rejected';

const REWARD_LABEL: Record<AdminVoucherReward, string> = {
   first_on_time_repayment: 'First on-time repayment',
   referral_inviter: 'Referral — inviter',
   referral_invitee: 'Referral — invited friend',
   tier_rising: 'Reached Rising',
   tier_prime: 'Reached Prime',
   tier_apex: 'Reached Apex'
};

const EMAIL_SUBJECT = 'Your Moodeng GrabFood voucher';

const php = (amount: number) => `₱${amount.toLocaleString()}`;
const sum = (rows: Array<{ amount_php: number }>) => rows.reduce((total, row) => total + row.amount_php, 0);
const claimEmail = (claim: AdminVoucherClaim) => claim.email ?? claim.account_email;

function formatDate(value: string | null) {
   if (!value) return '—';
   return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number | null>>) {
   const cell = (value: string | number | null) => `"${String(value ?? '').replace(/"/g, '""')}"`;
   const csv = [header, ...rows].map((row) => row.map(cell).join(',')).join('\n');
   const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
   const link = document.createElement('a');
   link.href = url;
   link.download = filename;
   link.click();
   URL.revokeObjectURL(url);
}

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: 'owe' | 'done' }) {
   const border =
      tone === 'owe'
         ? 'border-[#8a6a1f] bg-[#2a2010]'
         : tone === 'done'
           ? 'border-[#1f6b48] bg-[#0f2a1e]'
           : 'border-[#2a1453] bg-[#1c0a3a]';
   return (
      <div className={`rounded-2xl border p-5 ${border}`}>
         <p className="text-xs font-black uppercase tracking-wide text-[#a89bb8]">{label}</p>
         <strong className="mt-2 block text-4xl font-black text-white">{value}</strong>
         <p className="mt-1 text-sm font-bold text-[#a89bb8]">{note}</p>
      </div>
   );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
   return (
      <div className="min-w-0">
         <dt className="text-xs font-black uppercase tracking-wide text-[#6f6385]">{label}</dt>
         <dd className="break-words text-base">{children}</dd>
      </div>
   );
}

/**
 * Admin "GrabFood vouchers" tab: everyone who claimed a voucher, what we still owe, their email to
 * send it to, a sent confirmation (time + who), and borrowers who earned one but haven't claimed yet.
 * Borrowers claim from the dashboard (public.submit_voucher_claim); the Telegram card's "Mark sent"
 * and the button here both flip the same voucher_claims row.
 */
export default function GrabVouchersSection() {
   const [claims, setClaims] = useState<AdminVoucherClaim[]>([]);
   const [unclaimed, setUnclaimed] = useState<AdminUnclaimedVoucher[]>([]);
   const [view, setView] = useState<View>('to-send');
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [busyId, setBusyId] = useState<string | null>(null);
   const [copied, setCopied] = useState<string | null>(null);

   const refresh = useCallback(async () => {
      setError(null);
      try {
         const [claimRows, unclaimedRows] = await Promise.all([listVoucherClaims(), listUnclaimedVouchers()]);
         setClaims(claimRows);
         setUnclaimed(unclaimedRows);
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not load vouchers.');
      } finally {
         setIsLoading(false);
      }
   }, []);

   useEffect(() => {
      void refresh();
   }, [refresh]);
   useAdminLiveReload(['voucher_claims', 'loans'], refresh);

   const pending = useMemo(() => claims.filter((claim) => claim.status === 'pending'), [claims]);
   const sent = useMemo(
      () => claims.filter((claim) => claim.status === 'sent').sort((a, b) => (b.sent_at ?? '').localeCompare(a.sent_at ?? '')),
      [claims]
   );
   const rejected = useMemo(() => claims.filter((claim) => claim.status === 'rejected'), [claims]);
   // Oldest first, so whoever has waited longest is at the top.
   const toSend = useMemo(() => [...pending].reverse(), [pending]);

   const copy = async (key: string, text: string) => {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1500);
   };

   const uniqueEmails = (emails: Array<string | null>) =>
      [...new Set(emails.filter((email): email is string => Boolean(email)))].join(', ');

   const setStatus = async (claim: AdminVoucherClaim, status: AdminVoucherClaimStatus) => {
      let note: string | null = 'Sent from admin panel';
      if (status === 'rejected') {
         note = window.prompt('Reason for rejecting (team only):', claim.admin_note ?? '');
         if (note === null) return;
      } else if (status === 'pending') {
         if (!window.confirm(`Move ${claim.full_name}'s ${php(claim.amount_php)} voucher back to "to send"?`)) return;
         note = null;
      }
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

   const exportClaims = () =>
      downloadCsv(
         `grab-vouchers-${new Date().toISOString().slice(0, 10)}.csv`,
         ['Status', 'Name', 'Email', 'Mobile', 'Username', 'Reward', 'Amount PHP', 'Claimed', 'Sent', 'Note'],
         claims.map((claim) => [
            claim.status,
            claim.full_name,
            claimEmail(claim),
            claim.mobile,
            claim.username,
            REWARD_LABEL[claim.reward] ?? claim.reward,
            claim.amount_php,
            claim.created_at,
            claim.sent_at,
            claim.admin_note
         ])
      );

   const views: Array<{ id: View; label: string; count: number }> = [
      { id: 'to-send', label: 'To send', count: pending.length },
      { id: 'sent', label: 'Sent', count: sent.length },
      { id: 'unclaimed', label: 'Earned, not claimed', count: unclaimed.length },
      { id: 'rejected', label: 'Rejected', count: rejected.length }
   ];

   const claimCard = (claim: AdminVoucherClaim) => {
      const email = claimEmail(claim);
      return (
         <AdminLiveRow key={claim.id} ids={[claim.id]} className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5">
            <div className="flex flex-wrap items-center gap-3">
               <span className="text-2xl font-black">{php(claim.amount_php)}</span>
               <span className="text-lg font-black">{claim.full_name}</span>
               <span className="font-bold text-[#a89bb8]">{REWARD_LABEL[claim.reward] ?? claim.reward}</span>
               {claim.status === 'sent' ? (
                  <span className="ml-auto rounded-full bg-[#123d2a] px-3 py-1 text-sm font-black text-[#6ee7a8]">
                     ✓ Sent {formatDate(claim.sent_at)}
                  </span>
               ) : (
                  <span className="ml-auto text-sm text-[#6f6385]">Claimed {formatDate(claim.created_at)}</span>
               )}
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-3">
               <Field label="Email">
                  {email ? (
                     <span className="inline-flex flex-wrap items-center gap-2">
                        <a
                           className="font-bold text-[#c4a2ff] underline"
                           href={`mailto:${email}?subject=${encodeURIComponent(EMAIL_SUBJECT)}`}
                        >
                           {email}
                        </a>
                        <button
                           type="button"
                           onClick={() => void copy(`email-${claim.id}`, email)}
                           className="rounded-lg bg-[#241044] px-2 py-0.5 text-xs font-black text-[#a89bb8]"
                        >
                           {copied === `email-${claim.id}` ? 'Copied' : 'Copy'}
                        </button>
                        {!claim.email ? <span className="text-xs text-[#6f6385]">(account email)</span> : null}
                     </span>
                  ) : (
                     <span className="text-[#ff8fa3]">No email — use mobile</span>
                  )}
               </Field>
               <Field label="Mobile (GCash)">{claim.mobile}</Field>
               <Field label="User">{claim.username ? `@${claim.username}` : claim.user_id}</Field>
               {claim.admin_note ? <Field label="Note">{claim.admin_note}</Field> : null}
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
               {claim.status === 'pending' ? (
                  <>
                     <button
                        type="button"
                        disabled={busyId === claim.id}
                        onClick={() => void setStatus(claim, 'sent')}
                        className="rounded-xl bg-[#8336f0] px-5 py-2 text-base font-black text-white disabled:opacity-50"
                     >
                        ✓ Mark sent
                     </button>
                     <button
                        type="button"
                        disabled={busyId === claim.id}
                        onClick={() => void setStatus(claim, 'rejected')}
                        className="rounded-xl bg-[#34234f] px-5 py-2 text-base font-black text-white disabled:opacity-50"
                     >
                        Reject
                     </button>
                  </>
               ) : (
                  <button
                     type="button"
                     disabled={busyId === claim.id}
                     onClick={() => void setStatus(claim, 'pending')}
                     className="rounded-xl bg-[#241044] px-4 py-1.5 text-sm font-black text-[#a89bb8] disabled:opacity-50"
                  >
                     Undo — back to “to send”
                  </button>
               )}
            </div>
         </AdminLiveRow>
      );
   };

   const listFor: Record<Exclude<View, 'unclaimed'>, AdminVoucherClaim[]> = { 'to-send': toSend, sent, rejected };
   const emailsForView =
      view === 'unclaimed' ? uniqueEmails(unclaimed.map((row) => row.email)) : uniqueEmails(listFor[view].map(claimEmail));

   return (
      <section className="space-y-6">
         <div>
            <h2 className="break-words text-2xl font-black sm:text-3xl">GrabFood vouchers</h2>
            <p className="mt-1.5 max-w-3xl text-base text-[#a89bb8]">
               Who claimed a voucher, what we still owe, and where to send it. Buy a GrabFood e-gift (gifted.ph or udialpinoy.com), send it
               to their email, then tap Mark sent — the borrower sees “Sent” in the app.
            </p>
         </div>

         <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="We owe now" value={php(sum(pending))} note={`${pending.length} claimed, not sent yet`} tone="owe" />
            <Stat label="Sent" value={php(sum(sent))} note={`${sent.length} vouchers delivered`} tone="done" />
            <Stat label="Earned, not claimed" value={php(sum(unclaimed))} note={`${unclaimed.length} vouchers could still be claimed`} />
            <Stat label="Total if all claimed" value={php(sum(pending) + sum(unclaimed))} note="Owed now + earned, not claimed" />
         </div>

         <div className="flex flex-wrap items-center gap-2">
            {views.map((item) => (
               <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-black ${view === item.id ? 'bg-[#8336f0] text-white' : 'bg-[#241044] text-[#a89bb8]'}`}
               >
                  {item.label} ({item.count})
               </button>
            ))}
            <div className="ml-auto flex gap-2">
               <button
                  type="button"
                  disabled={!emailsForView}
                  onClick={() => void copy('all-emails', emailsForView)}
                  className="rounded-xl bg-[#241044] px-4 py-1.5 text-sm font-black text-white disabled:opacity-40"
               >
                  {copied === 'all-emails' ? 'Copied' : 'Copy emails in this list'}
               </button>
               <button
                  type="button"
                  disabled={claims.length === 0}
                  onClick={exportClaims}
                  className="rounded-xl bg-[#241044] px-4 py-1.5 text-sm font-black text-white disabled:opacity-40"
               >
                  Download CSV
               </button>
            </div>
         </div>

         {error ? <p className="rounded-xl bg-[#3d1220] px-4 py-3 font-bold text-[#ff8fa3]">{error}</p> : null}
         {isLoading ? <p className="text-[#a89bb8]">Loading…</p> : null}

         {!isLoading && view !== 'unclaimed' ? (
            <div className="space-y-3">
               {listFor[view].length === 0 ? (
                  <p className="text-[#6f6385]">{view === 'to-send' ? 'Nothing to send — all caught up.' : `No ${view} vouchers.`}</p>
               ) : (
                  listFor[view].map(claimCard)
               )}
            </div>
         ) : null}

         {!isLoading && view === 'unclaimed' ? (
            <div className="space-y-3">
               <p className="text-sm text-[#a89bb8]">
                  These borrowers earned a voucher but haven’t tapped Claim in the app yet. Nudge them to claim it there — the claim form
                  collects their name and number.
               </p>
               {unclaimed.length === 0 ? (
                  <p className="text-[#6f6385]">Everyone who earned a voucher has claimed it.</p>
               ) : (
                  <div className="overflow-x-auto rounded-2xl border border-[#2a1453]">
                     <table className="w-full min-w-[640px] text-left">
                        <thead className="bg-[#1c0a3a] text-xs font-black uppercase tracking-wide text-[#a89bb8]">
                           <tr>
                              <th className="px-4 py-3">Borrower</th>
                              <th className="px-4 py-3">Email</th>
                              <th className="px-4 py-3">Earned for</th>
                              <th className="px-4 py-3 text-right">Amount</th>
                           </tr>
                        </thead>
                        <tbody>
                           {unclaimed.map((row) => (
                              <tr
                                 key={`${row.user_id}-${row.reward}-${row.friend_referral_id ?? ''}`}
                                 className="border-t border-[#2a1453]"
                              >
                                 <td className="px-4 py-3 font-bold">
                                    {row.display_name || (row.username ? `@${row.username}` : row.user_id.slice(0, 8))}
                                 </td>
                                 <td className="px-4 py-3">
                                    {row.email ? (
                                       <a className="text-[#c4a2ff] underline" href={`mailto:${row.email}`}>
                                          {row.email}
                                       </a>
                                    ) : (
                                       <span className="text-[#6f6385]">—</span>
                                    )}
                                 </td>
                                 <td className="px-4 py-3 text-[#a89bb8]">{REWARD_LABEL[row.reward] ?? row.reward}</td>
                                 <td className="px-4 py-3 text-right font-black">{php(row.amount_php)}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               )}
            </div>
         ) : null}
      </section>
   );
}
