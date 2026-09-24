import { type ReactNode, useState } from 'react';

import { Clock3, HeartHandshake } from 'lucide-react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { LoanAccessStatus } from '@/types/authTypes';
import ContactsStep from '@/views/dashboard/components/ContactsStep';
import VideoCallStep from '@/views/dashboard/components/VideoCallStep';

// PART 1 of Connect → Approve → Apply (docs/HANDOFF_BORROWER_VERIFICATION.md §13) — shown in the
// 'approval' and 'call' borrower flows (never in 'open').
//
// A borrower who hasn't been approved yet can't post a loan request. Instead they reach out to the
// team first — B2C treated like a B2B lead:
//   1. "Let's connect": open Messenger (proves a real line we can message back on — same SendPulse
//      one-tap flow as ContactsStep; skipped straight through if they're already verified),
//   2. about you — the two-page bio (work, income, payday), rendered by LoanRequestModal and saved to
//      the profile right away, so admins see it before the call and the application skips it later,
//   3. a short intro (what they need the loan for),
//   4. call mode only: book the video call (the request unlocks only after they actually show up),
//   5. "Send to the team" → loan-access edge function flips them to pending and pings admins, who
//      decide from Telegram (Approve/Reject, or Showed up/No-show after the call). The borrower
//      then gets a push (+ Telegram, + Messenger reminders for the call).
// The referral card (optional credit boost) runs before this, inside LoanRequestModal. A referral
// never skips approval — everyone goes through the same process.

const MIN_REASON = 10;
const MAX_REASON = 500;

const ERROR_COPY: Record<string, string> = {
   contact_not_verified: 'Please confirm Messenger first, then send.',
   reason_required: 'Tell us a little about what you need.',
   not_borrower: 'Only borrower accounts can apply for loans.',
   call_not_booked: 'Please book your call first.',
   account_inactive: "Your account can't apply right now. Message us on Messenger for help."
};

export default function ConnectStep({
   userId,
   displayName,
   referralCode,
   wasRejected = false,
   mode = 'approval',
   withEmma = false,
   needsAbout = false,
   renderAbout,
   onBack,
   onSubmitted
}: {
   userId: string;
   displayName: string;
   referralCode?: string;
   wasRejected?: boolean;
   mode?: 'approval' | 'call';
   // Referred borrowers: the call is Emma's setup call (local exchange — deposit, cash out, repay).
   withEmma?: boolean;
   // Bio not saved yet → show the "about you" page (rendered by the modal, which owns the bio state).
   needsAbout?: boolean;
   renderAbout?: (nav: { onBack: () => void; onDone: () => void }) => ReactNode;
   onBack: () => void;
   onSubmitted: (status: LoanAccessStatus) => void | Promise<void>;
}) {
   const [page, setPage] = useState<'contact' | 'about' | 'intro' | 'call'>('contact');
   const showAbout = needsAbout && Boolean(renderAbout);
   const [reason, setReason] = useState('');
   const [isSending, setIsSending] = useState(false);
   const [error, setError] = useState('');

   const trimmedReason = reason.trim();
   const canSend = trimmedReason.length >= MIN_REASON && !isSending;

   const handleSend = async () => {
      if (!canSend) return;
      setError('');
      setIsSending(true);
      try {
         const { data, error: invokeError } = await getSupabaseBrowserClient().functions.invoke('loan-access', {
            body: { action: 'submit', reason: trimmedReason, displayName, referralCode: referralCode || undefined }
         });
         // functions.invoke surfaces non-2xx as an error whose context holds the JSON body.
         let payload = data as { ok?: boolean; status?: LoanAccessStatus; error?: string } | null;
         if (invokeError) {
            const ctx = (invokeError as { context?: Response }).context;
            payload = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
         }
         if (!payload?.ok || !payload.status) {
            setError(ERROR_COPY[payload?.error ?? ''] ?? "Couldn't send right now — please try again in a moment.");
            if (payload?.error === 'contact_not_verified') setPage('contact');
            if (payload?.error === 'call_not_booked') setPage('call');
            return;
         }
         await onSubmitted(payload.status);
      } catch (err) {
         console.error('loan-access submit failed', err);
         setError("Couldn't send right now — please try again in a moment.");
      } finally {
         setIsSending(false);
      }
   };

   if (page === 'contact') {
      return (
         <ContactsStep
            userId={userId}
            onBack={onBack}
            onContinue={() => {
               setError('');
               setPage(showAbout ? 'about' : 'intro');
            }}
            intro={
               <div className="flex items-start gap-3">
                  <HeartHandshake aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-md-primary-1200" strokeWidth={1.8} />
                  <p className="text-[13px] font-normal leading-[18px] text-md-neutral-1200">
                     {wasRejected
                        ? "Want us to take another look? Reach out again and tell us what's changed."
                        : withEmma
                          ? 'Glad you’re here! Next, let’s talk in person: a quick 15-minute call with Emma to set you up with a local exchange — how to deposit, cash out and pay back. First, confirm your Messenger so we can remind you about it.'
                          : mode === 'call'
                            ? 'Glad you’re here! Next, let’s talk in person about your loan needs and how we can serve you best — before your first loan, we meet every borrower on a quick 15-minute video call. First, confirm your Messenger so we can remind you about it.'
                          : 'Before your first loan, we like to meet every borrower. Confirm your Messenger so the team can chat with you — we review and approve, usually within a day.'}
                  </p>
               </div>
            }
         />
      );
   }

   if (page === 'about' && renderAbout) {
      return <>{renderAbout({ onBack: () => setPage('contact'), onDone: () => setPage('intro') })}</>;
   }

   if (page === 'call') {
      return (
         <div className="flex min-h-0 flex-col">
            <VideoCallStep
               userId={userId}
               requireUpcoming
               host={withEmma ? 'emma' : undefined}
               intro={
                  <div className="flex flex-col gap-2 text-[13px] font-normal leading-[18px] text-md-neutral-1200">
                     <p>
                        <span className="font-[590] text-md-heading">Important — next step:</span> book a 15-minute meeting
                        {withEmma ? ' with Emma' : ' with our team'} to set up your account, complete verification, and walk you through
                        cashing out — so switching to your local currency is smooth once your USDC funding arrives.
                     </p>
                     <p>We’ll also unlock perks in the meeting, including your referral bonus. Once you’ve joined it, you can apply straight away.</p>
                  </div>
               }
               continueLabel={isSending ? 'Sending...' : 'Send to the team'}
               onBack={() => setPage('intro')}
               onContinue={() => void handleSend()}
            />
            {error ? <p className="px-5 pb-4 text-md-b3 font-normal text-md-red-500">{error}</p> : null}
         </div>
      );
   }

   return (
      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain px-5 py-5 text-md-b2 text-md-heading">
         <p className="text-[13px] font-normal leading-[18px] text-md-neutral-1200">
            {mode === 'call'
               ? 'A quick hello before your call, so the team knows what you need. Only Moodeng sees this — it isn’t shown to lenders.'
               : 'Last step: a quick hello to the team. Only Moodeng sees this — it isn’t shown to lenders.'}
         </p>

         <label className="flex flex-col gap-2" htmlFor="connect-reason">
            <span className="text-[15px] font-[590] leading-5 text-md-heading">What do you need a loan for?</span>
            <textarea
               className="min-h-[112px] w-full resize-none rounded-[12px] border border-md-neutral-600 bg-md-neutral-100 px-md-2 py-md-2 text-md-b2 font-normal text-md-heading placeholder:text-md-neutral-1200 focus:border-md-primary-900 focus:outline-none focus:ring-2 focus:ring-md-primary-100"
               id="connect-reason"
               maxLength={MAX_REASON}
               onChange={(event) => setReason(event.target.value)}
               placeholder="e.g. Rent is due before my payday on the 15th — I work at a café in Makati."
               value={reason}
            />
            <span className="self-end text-[12px] font-normal text-md-neutral-1200">
               {trimmedReason.length < MIN_REASON ? `At least ${MIN_REASON} characters` : `${trimmedReason.length}/${MAX_REASON}`}
            </span>
         </label>

         {referralCode ? (
            <p className="text-[12px] font-normal text-md-neutral-1200">
               Referral code <span className="font-[590] text-md-heading">{referralCode}</span> is on your account.
            </p>
         ) : null}

         {error ? <p className="text-md-b3 font-normal text-md-red-500">{error}</p> : null}

         <div className="mt-auto flex flex-col gap-2">
            <button
               className={`w-full rounded-md-lg px-md-4 py-md-3 text-md-b1 font-medium text-md-neutral-100 ${
                  canSend
                     ? 'bg-md-primary-1200 transition duration-150 ease-out hover:bg-[#5200c8] active:scale-[0.98]'
                     : 'bg-md-neutral-600'
               }`}
               disabled={!canSend}
               onClick={() => (mode === 'call' ? setPage('call') : void handleSend())}
               type="button"
            >
               {mode === 'call' ? 'Next: book your call' : isSending ? 'Sending...' : 'Send to the team'}
            </button>
            <button
               className="w-full rounded-md-lg px-md-4 py-md-2 text-md-b2 font-medium text-md-neutral-1200 transition duration-150 ease-out hover:text-md-heading"
               onClick={() => setPage(showAbout ? 'about' : 'contact')}
               type="button"
            >
               Back
            </button>
         </div>
      </div>
   );
}

// Shown instead of the application while an admin decides (or, in call mode, until the call has
// happened). Nothing to do but wait — so say so, say how they'll hear back, and let them close.
export function LoanAccessPendingCard({
   onClose,
   mode = 'approval',
   withEmma = false
}: {
   onClose: () => void;
   mode?: 'approval' | 'call';
   withEmma?: boolean;
}) {
   return (
      <div className="flex min-h-0 flex-col items-center gap-4 overflow-y-auto overscroll-contain px-5 py-8 text-center text-md-b2 text-md-heading">
         <span className="grid size-14 place-items-center rounded-full bg-md-primary-100">
            <Clock3 aria-hidden="true" className="size-7 text-md-primary-1200" strokeWidth={1.8} />
         </span>
         <h3 className="text-[20px] font-[590] leading-6">
            {mode === 'call' ? (withEmma ? 'See you on the call with Emma' : 'See you on the call') : 'We’re reviewing your request'}
         </h3>
         <p className="max-w-[320px] text-[13px] font-normal leading-[18px] text-md-neutral-1200">
            {mode === 'call'
               ? 'Thank you for confirming! Your meeting is booked — the Zoom link is in your email and we’ll remind you on Messenger. Right after the call, the team unlocks your application and you can apply straight away.'
               : 'Thanks for reaching out! The team usually replies within a day. We’ll message you on Messenger and send a notification the moment you’re approved — then you can apply right away.'}
         </p>
         {mode === 'call' ? (
            <div className="w-full max-w-[320px] rounded-[12px] border border-[#ded6e8] bg-white p-3 text-left text-[13px] font-normal leading-[18px] text-md-neutral-1200">
               <p className="font-[590] text-md-heading">Please have ready for the call:</p>
               <ol className="mt-1 list-decimal pl-5">
                  <li>Your original physical ID or passport — approval depends on passing this check.</li>
                  <li>Camera on, a well-lit room, and your phone nearby.</li>
               </ol>
               <a
                  className="mt-2 inline-block font-[590] text-md-primary-1200 underline"
                  href="https://www.facebook.com/emmamoodengcredit"
                  rel="noreferrer"
                  target="_blank"
               >
                  Connect with Emma Moodeng on Facebook
               </a>
            </div>
         ) : null}
         <button
            className="mt-2 w-full rounded-md-lg bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-medium text-md-neutral-100 transition duration-150 ease-out hover:bg-[#5200c8] active:scale-[0.98]"
            onClick={onClose}
            type="button"
         >
            Got it
         </button>
      </div>
   );
}
