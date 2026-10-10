'use client';

import { useState } from 'react';

import { type AdminDirectoryUser, approveAdminUser, decideAdminCall } from '@/app/admin/adminSupabase';

// Approve a borrower straight from their Directory card — the same decisions as Call approvals and
// the Telegram buttons. With a booked, undecided call: Showed up / No-show. Otherwise: Approve
// (decides their pending request if they have one, else approves them without a call).

type ApprovalUser = Pick<AdminDirectoryUser, 'id' | 'username' | 'user_role' | 'loan_access_status' | 'video_call_starts_at' | 'video_call_outcome'>;

const STATUS_LABEL: Record<string, string> = {
   approved: 'Approved to continue',
   pending: 'Waiting for approval',
   rejected: 'Rejected',
   none: 'Not approved yet'
};

export default function DirectoryApprovalControl({ user }: { user: ApprovalUser }) {
   const [status, setStatus] = useState(user.loan_access_status ?? 'none');
   const [outcome, setOutcome] = useState(user.video_call_outcome);
   const [busy, setBusy] = useState(false);
   const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

   if (user.user_role === 'lender') return null;

   const callPending = Boolean(user.video_call_starts_at) && !outcome && status !== 'approved';
   const callLabel = user.video_call_starts_at
      ? `Call ${new Date(user.video_call_starts_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
      : null;

   const run = async (
      action: () => Promise<{ ok: boolean; summary: string }>,
      after: (result: { ok: boolean; summary: string }) => void,
      confirmText?: string
   ) => {
      if (confirmText && !window.confirm(confirmText)) return;
      setBusy(true);
      setMessage(null);
      try {
         const result = await action();
         if (result.ok) after(result);
         setMessage({ ok: result.ok, text: result.summary });
      } catch (err) {
         setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not save.' });
      } finally {
         setBusy(false);
      }
   };

   const base = 'rounded-xl px-4 py-2 text-base font-black disabled:opacity-50';

   return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
         <span className={`text-base font-black ${status === 'approved' ? 'text-emerald-300' : status === 'rejected' ? 'text-red-300' : 'text-[#c9a7ff]'}`}>
            {STATUS_LABEL[status] ?? status}
            {callLabel ? ` · ${callLabel}${outcome ? ` (${outcome === 'attended' ? 'showed up' : 'no-show'})` : ''}` : ''}
         </span>
         {callPending ? (
            <>
               <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                     run(
                        () => decideAdminCall({ userId: user.id, decision: 'attended' }),
                        (result) => {
                           setOutcome('attended');
                           // "Showed up" approves only a borrower still waiting on access; for others
                           // (e.g. verified, open flow) it just records attendance — the server's
                           // summary says which, so don't claim "Approved" when nothing was.
                           if (/approved/i.test(result.summary)) setStatus('approved');
                        }
                     )
                  }
                  className={`${base} bg-emerald-600 text-white hover:bg-emerald-500`}
               >
                  ✅ Showed up — approve
               </button>
               <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                     run(
                        () => decideAdminCall({ userId: user.id, decision: 'no_show' }),
                        () => {
                           setOutcome('no_show');
                           setStatus('none');
                        },
                        `Mark ${user.username} a no-show? They'll be asked to book again.`
                     )
                  }
                  className={`${base} border border-[#3d1f6e] text-white hover:bg-[#2a1453]`}
               >
                  ❌ No-show
               </button>
            </>
         ) : status !== 'approved' ? (
            <button
               type="button"
               disabled={busy}
               onClick={() =>
                  run(
                     () => approveAdminUser(user.id),
                     () => setStatus('approved'),
                     outcome === 'attended' ? undefined : `Approve ${user.username} without a video call?`
                  )
               }
               className={`${base} bg-emerald-600 text-white hover:bg-emerald-500`}
            >
               ✅ Approve
            </button>
         ) : null}
         {message ? <span className={`w-full text-sm font-bold ${message.ok ? 'text-emerald-300' : 'text-amber-300'}`}>{message.text}</span> : null}
      </div>
   );
}
