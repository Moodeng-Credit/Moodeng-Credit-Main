'use client';

import { useCallback, useEffect, useState } from 'react';

import {
   type AdminLoanRecord,
   LOAN_REMOVAL_MESSAGE_LIMIT,
   LOAN_REMOVAL_REASONS,
   type LoanRemovalReasonCode,
   previewLoanRequestRemoval,
   type RemoveLoanRequestResult,
   removeLoanRequest
} from './adminSupabase';

interface Props {
   loan: AdminLoanRecord;
   onClose: () => void;
   onRemoved: (result: RemoveLoanRequestResult) => void;
}

function money(value: number | null | undefined): string {
   return Number(value ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export default function RemoveLoanRequestDialog({ loan, onClose, onRemoved }: Props) {
   const [reasonCode, setReasonCode] = useState<LoanRemovalReasonCode>(LOAN_REMOVAL_REASONS[0].code);
   const [message, setMessage] = useState('');
   const [canReapply, setCanReapply] = useState(true);
   const [sendEmail, setSendEmail] = useState(true);
   const [sendTelegram, setSendTelegram] = useState(true);
   const [preview, setPreview] = useState<string | null>(null);
   const [busy, setBusy] = useState<'preview' | 'remove' | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [result, setResult] = useState<RemoveLoanRequestResult | null>(null);

   // 'Other' has no preset copy, so the borrower would get a bare "we removed it" without a note.
   const missingMessage = reasonCode === 'other' && !message.trim();
   const disabled = busy !== null || missingMessage;

   useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
         if (e.key === 'Escape' && busy === null) onClose();
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
   }, [busy, onClose]);

   const input = useCallback(
      () => ({
         loanId: loan.id,
         borrowerUserId: loan.borrower_user_id,
         reasonCode,
         personalMessage: message,
         canReapply,
         channels: { email: sendEmail, telegram: sendTelegram }
      }),
      [canReapply, loan.borrower_user_id, loan.id, message, reasonCode, sendEmail, sendTelegram]
   );

   const runPreview = useCallback(async () => {
      setBusy('preview');
      setError(null);
      try {
         setPreview(await previewLoanRequestRemoval(input()));
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not render the preview.');
      } finally {
         setBusy(null);
      }
   }, [input]);

   const runRemove = useCallback(async () => {
      setBusy('remove');
      setError(null);
      try {
         const outcome = await removeLoanRequest(input());
         setResult(outcome);
         onRemoved(outcome);
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not remove the request.');
      } finally {
         setBusy(null);
      }
   }, [input, onRemoved]);

   const delivered = result
      ? [result.emailSent ? 'email' : null, result.telegramSent ? 'Telegram' : null].filter(Boolean).join(' + ')
      : '';

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
         <div className="w-full max-w-xl space-y-4 rounded-3xl border border-[#2a1453] bg-[#150730] p-6">
            <div>
               <h3 className="text-2xl font-black text-white">{result ? 'Request removed' : 'Remove loan request'}</h3>
               <p className="mt-1 font-mono text-sm font-bold text-[#cfc6dd]">
                  {loan.tracking_id} <span className="font-sans text-[#a89bb8]">· {loan.borrower?.username ?? '—'} · {money(loan.loan_amount)}</span>
               </p>
            </div>

            {result ? (
               <>
                  <p className="text-base font-bold text-white">
                     {result.alreadyRemoved ? 'The request was already gone. ' : 'The request has been deleted. '}
                     {delivered ? `Borrower notified by ${delivered}.` : 'No channel reached the borrower.'}
                  </p>
                  {result.errors.length ? (
                     <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-sm font-bold text-red-300">
                        {result.errors.join('; ')}
                     </div>
                  ) : null}
                  <div className="flex justify-end">
                     <button type="button" onClick={onClose} className="rounded-full bg-[#8336f0] px-5 py-2 text-sm font-black text-white">
                        Close
                     </button>
                  </div>
               </>
            ) : (
               <>
                  {loan.reason ? (
                     <p className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4 text-sm font-medium italic text-[#cfc6dd]">
                        “{loan.reason}”
                     </p>
                  ) : null}

                  <div>
                     <label htmlFor="removal-reason" className="mb-2 block text-sm font-black uppercase tracking-wide text-[#a89bb8]">
                        Reason
                     </label>
                     <select
                        id="removal-reason"
                        value={reasonCode}
                        onChange={(e) => {
                           setReasonCode(e.target.value as LoanRemovalReasonCode);
                           setPreview(null);
                        }}
                        className="w-full rounded-xl border border-[#3d1f6e] bg-[#241044] px-4 py-3 text-base font-bold text-white"
                     >
                        {LOAN_REMOVAL_REASONS.map((r) => (
                           <option key={r.code} value={r.code}>
                              {r.label}
                           </option>
                        ))}
                     </select>
                  </div>

                  <div>
                     <label htmlFor="removal-message" className="mb-2 block text-sm font-black uppercase tracking-wide text-[#a89bb8]">
                        Personal message {reasonCode === 'other' ? '(required)' : '(optional)'}
                     </label>
                     <textarea
                        id="removal-message"
                        rows={3}
                        maxLength={LOAN_REMOVAL_MESSAGE_LIMIT}
                        value={message}
                        onChange={(e) => {
                           setMessage(e.target.value);
                           setPreview(null);
                        }}
                        placeholder="Anything you want to say to this borrower in your own words."
                        className="w-full rounded-xl border border-[#3d1f6e] bg-[#241044] px-4 py-3 text-base font-bold text-white placeholder:text-[#6f6385]"
                     />
                     <p className="mt-1 text-xs font-medium text-[#a89bb8]">
                        {message.length}/{LOAN_REMOVAL_MESSAGE_LIMIT} · sent as “A note from the team”
                     </p>
                  </div>

                  <div className="space-y-2 text-sm font-bold text-[#cfc6dd]">
                     <label className="flex items-center gap-2">
                        <input
                           type="checkbox"
                           checked={canReapply}
                           onChange={(e) => {
                              setCanReapply(e.target.checked);
                              setPreview(null);
                           }}
                        />
                        Tell them they can submit a new request
                     </label>
                     <label className="flex items-center gap-2">
                        <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
                        Send email
                     </label>
                     <label className="flex items-center gap-2">
                        <input type="checkbox" checked={sendTelegram} onChange={(e) => setSendTelegram(e.target.checked)} />
                        Send Telegram message (if connected)
                     </label>
                  </div>

                  {preview !== null ? (
                     <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4">
                        <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#a89bb8]">What the borrower will read</p>
                        <p className="whitespace-pre-wrap text-sm font-medium text-white">{preview}</p>
                     </div>
                  ) : null}

                  {error ? (
                     <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-sm font-bold text-red-300">{error}</div>
                  ) : null}

                  {missingMessage ? (
                     <p className="text-sm font-bold text-amber-300">Write a message to use the “Other” reason.</p>
                  ) : null}

                  <div className="flex flex-wrap justify-end gap-2">
                     <button
                        type="button"
                        onClick={onClose}
                        disabled={busy !== null}
                        className="rounded-full bg-[#241044] px-5 py-2 text-sm font-black text-[#a89bb8] disabled:opacity-50"
                     >
                        Cancel
                     </button>
                     <button
                        type="button"
                        onClick={runPreview}
                        disabled={disabled}
                        className="rounded-full border border-[#8336f0] px-5 py-2 text-sm font-black text-[#c9a6ff] disabled:opacity-50"
                     >
                        {busy === 'preview' ? '…' : 'Preview message'}
                     </button>
                     <button
                        type="button"
                        onClick={runRemove}
                        disabled={disabled}
                        className="rounded-full bg-red-600 px-5 py-2 text-sm font-black text-white disabled:opacity-50"
                     >
                        {busy === 'remove' ? 'Removing…' : 'Remove and notify'}
                     </button>
                  </div>
               </>
            )}
         </div>
      </div>
   );
}
