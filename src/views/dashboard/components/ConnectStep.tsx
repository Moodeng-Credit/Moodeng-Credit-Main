import { type ReactNode, useEffect, useState } from 'react';

import { Camera, Gift, IdCard, MessagesSquare, ShieldCheck, Sparkles, Unlock, Video, Wallet } from 'lucide-react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { LoanAccessStatus } from '@/types/authTypes';
import { CONNECT_HIPPOS, ConnectHero, GhostButton, PerkRow, PrimaryButton, StepTrail } from '@/views/dashboard/components/connectKit';
import ContactsStep from '@/views/dashboard/components/ContactsStep';
import VideoCallStep from '@/views/dashboard/components/VideoCallStep';

// PART 1 of Connect → Approve → Apply (docs/HANDOFF_BORROWER_VERIFICATION.md §13) — shown in the
// 'approval' and 'call' borrower flows (never in 'open').
//
// A borrower who hasn't been approved yet can't post a loan request. Instead they reach out to the
// team first — B2C treated like a B2B lead:
//   1. Messenger: one tap proves a real line we can message back on (same SendPulse flow as
//      ContactsStep; skipped straight through if they're already verified),
//   2. about you — the two-page bio (work, income, payday), rendered by LoanRequestModal and saved to
//      the profile right away, so admins see it before the call and the application skips it later,
//   3. their goal — what the loan is for (quick-pick chips + a sentence),
//   4. call mode only: book the video call (the request unlocks only after they actually show up),
//   5. booking (or "Send" in approval mode) → loan-access edge function flips them to pending and
//      pings admins, who decide from Telegram. The borrower then gets a push (+ Telegram/Messenger).
// Visual language follows the Milestone_9.23 Figma (see connectKit): hippo hero, step trail, big
// option cards, gradient CTA — one short line per idea instead of paragraphs.

const MIN_REASON = 10;
const MAX_REASON = 500;

// Tap to start the sentence — most borrowers need one of these, and typing on a phone is friction.
const GOAL_CHIPS = ['Rent', 'Bills', 'School fees', 'Medical', 'Family', 'Business stock', 'Transport'];

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

   // The step trail shown on every page — this borrower's actual path, nothing more.
   const steps = ['Messenger', ...(showAbout ? ['About you'] : []), 'Your goal', ...(mode === 'call' ? ['Book call'] : [])];
   const stepIndex = (key: 'contact' | 'about' | 'intro' | 'call') =>
      Math.max(0, steps.indexOf({ contact: 'Messenger', about: 'About you', intro: 'Your goal', call: 'Book call' }[key]));
   const trail = (key: 'contact' | 'about' | 'intro' | 'call') => <StepTrail current={stepIndex(key)} steps={steps} />;

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

   const addGoal = (chip: string) =>
      setReason((current) => {
         if (!current.trim()) return `${chip} — `;
         if (current.toLowerCase().includes(chip.toLowerCase())) return current;
         return `${current.trim().replace(/[—-]\s*$/, '').trim()}, ${chip.toLowerCase()} — `;
      });

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
               <ConnectHero
                  image={CONNECT_HIPPOS.hello}
                  subtitle={
                     wasRejected
                        ? "Want us to take another look? Reach out again and tell us what's changed."
                        : withEmma
                          ? 'A quick 15-min call with Emma sets you up to cash out and repay easily.'
                          : mode === 'call'
                            ? 'We meet every borrower on a quick 15-min video call before their first loan.'
                            : 'Before your first loan, we like to meet every borrower — we approve within a day.'
                  }
                  title={wasRejected ? 'Welcome back' : "Glad you're here!"}
                  trail={trail('contact')}
               />
            }
         />
      );
   }

   if (page === 'about' && renderAbout) {
      return (
         <div className="flex min-h-0 flex-col">
            <div className="border-b border-[#f0ecf5] bg-gradient-to-b from-[#f3ecff] to-white px-5 py-3">{trail('about')}</div>
            {renderAbout({ onBack: () => setPage('contact'), onDone: () => setPage('intro') })}
         </div>
      );
   }

   if (page === 'call') {
      return (
         <div className="flex min-h-0 flex-col">
            <VideoCallStep
               continueLabel={isSending ? 'Sending…' : 'Send to the team'}
               host={withEmma ? 'emma' : undefined}
               intro={
                  <>
                     <ConnectHero
                        image={CONNECT_HIPPOS.call}
                        subtitle="15 minutes · on Zoom · you pick the time"
                        title={withEmma ? 'Book your call with Emma' : 'Book your 15-min call'}
                        trail={trail('call')}
                     />
                     <ul className="flex flex-col gap-2.5">
                        {withEmma ? (
                           <>
                              <PerkRow icon={<Wallet aria-hidden="true" className="size-[18px]" strokeWidth={2} />}>Set up cash-out to your local currency</PerkRow>
                              <PerkRow icon={<ShieldCheck aria-hidden="true" className="size-[18px]" strokeWidth={2} />}>Quick ID check — have it ready</PerkRow>
                              <PerkRow icon={<Gift aria-hidden="true" className="size-[18px]" strokeWidth={2} />}>
                                 <b className="text-[#6b55f7]">$10 cash</b> for every friend you refer
                              </PerkRow>
                           </>
                        ) : (
                           <>
                              <PerkRow icon={<MessagesSquare aria-hidden="true" className="size-[18px]" strokeWidth={2} />}>Meet the team, ask anything</PerkRow>
                              <PerkRow icon={<ShieldCheck aria-hidden="true" className="size-[18px]" strokeWidth={2} />}>Quick ID check — have it ready</PerkRow>
                              <PerkRow icon={<Unlock aria-hidden="true" className="size-[18px]" strokeWidth={2} />}>Apply right after the call</PerkRow>
                           </>
                        )}
                     </ul>
                  </>
               }
               onBack={() => setPage('intro')}
               onBooked={() => void handleSend()}
               onContinue={() => void handleSend()}
               requireUpcoming
               userId={userId}
            />
            {error ? <p className="px-5 pb-4 text-center text-md-b3 font-normal text-md-red-500">{error}</p> : null}
         </div>
      );
   }

   return (
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-5 text-md-b2 text-md-heading">
         <ConnectHero image={CONNECT_HIPPOS.hello} subtitle="A quick note so the team knows how to help." title="What's the loan for?" trail={trail('intro')} />

         <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Quick picks">
            {GOAL_CHIPS.map((chip) => {
               const picked = reason.toLowerCase().includes(chip.toLowerCase());
               return (
                  <button
                     className={`min-h-[40px] rounded-full border px-4 text-[14px] font-semibold transition active:scale-[0.97] ${
                        picked ? 'border-[#6b55f7] bg-[#6b55f7] text-white' : 'border-[#e2dcee] bg-white text-[#594d65] hover:border-[#7661f9]'
                     }`}
                     key={chip}
                     onClick={() => addGoal(chip)}
                     type="button"
                  >
                     {chip}
                  </button>
               );
            })}
         </div>

         <label className="flex flex-col gap-1.5" htmlFor="connect-reason">
            <span className="sr-only">What do you need a loan for?</span>
            <textarea
               className="min-h-[104px] w-full resize-none rounded-[18px] border-2 border-[#e2dcee] bg-white px-4 py-3 text-[15px] font-normal leading-[21px] text-[#594d65] placeholder:text-[#b3a9bf] focus:border-[#7661f9] focus:outline-none focus:ring-4 focus:ring-[#6b55f7]/15"
               id="connect-reason"
               maxLength={MAX_REASON}
               onChange={(event) => setReason(event.target.value)}
               placeholder="e.g. Rent is due before payday on the 15th"
               value={reason}
            />
            <span className={`self-end text-[12px] font-medium ${trimmedReason.length < MIN_REASON ? 'text-[#b3a9bf]' : 'text-[#4aa256]'}`}>
               {trimmedReason.length < MIN_REASON ? `${MIN_REASON - trimmedReason.length} more characters` : '✓ Looks good'}
            </span>
         </label>

         {referralCode ? (
            <p className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-[#fff6d6] px-3 py-1 text-[13px] font-semibold text-[#704518]">
               <Sparkles aria-hidden="true" className="size-4" strokeWidth={2} />
               Referral {referralCode} applied
            </p>
         ) : null}

         {error ? <p className="text-center text-md-b3 font-normal text-md-red-500">{error}</p> : null}

         <div className="mt-auto flex flex-col gap-1 pt-1">
            <PrimaryButton disabled={!canSend} onClick={() => (mode === 'call' ? setPage('call') : void handleSend())}>
               {mode === 'call' ? 'Next: book your call' : isSending ? 'Sending…' : 'Send to the team'}
            </PrimaryButton>
            <GhostButton onClick={() => setPage(showAbout ? 'about' : 'contact')}>Back</GhostButton>
         </div>
      </div>
   );
}

// Shown instead of the application while an admin decides (or, in call mode, until the call has
// happened): the waiting hippo, the booked time with a Join button, and what to have ready.
export function LoanAccessPendingCard({
   onClose,
   mode = 'approval',
   withEmma = false,
   userId
}: {
   onClose: () => void;
   mode?: 'approval' | 'call';
   withEmma?: boolean;
   // When given (call mode), the card shows the booked time and this meeting's own join link.
   userId?: string;
}) {
   const [meeting, setMeeting] = useState<{ startsAt: string | null; joinUrl: string | null } | null>(null);
   useEffect(() => {
      if (mode !== 'call' || !userId) return;
      let cancelled = false;
      (async () => {
         const { data } = await getSupabaseBrowserClient()
            .from('users')
            .select('video_call_starts_at, video_call_join_url')
            .eq('id', userId)
            .maybeSingle();
         if (cancelled || !data) return;
         const row = data as { video_call_starts_at?: string | null; video_call_join_url?: string | null };
         setMeeting({ startsAt: row.video_call_starts_at ?? null, joinUrl: row.video_call_join_url ?? null });
      })();
      return () => {
         cancelled = true;
      };
   }, [mode, userId]);
   const meetingDay = meeting?.startsAt ? new Date(meeting.startsAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) : null;
   const meetingTime = meeting?.startsAt ? new Date(meeting.startsAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null;

   return (
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-5 text-center text-md-b2 text-md-heading">
         <ConnectHero
            image={CONNECT_HIPPOS.waiting}
            subtitle={
               mode === 'call'
                  ? 'Thank you for confirming! You can apply right after the call.'
                  : 'Thanks for reaching out! We usually reply within a day on Messenger.'
            }
            title={mode === 'call' ? (withEmma ? 'See you on the call with Emma' : 'See you on the call') : 'We’re reviewing your request'}
         />

         {mode === 'call' ? (
            <>
               <div className="flex flex-col items-center gap-3 rounded-[18px] border-2 border-[#7661f9] bg-[#f8f1ff] px-4 py-4">
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-[#6b55f7]">
                     <Video aria-hidden="true" className="size-4" strokeWidth={2.2} />
                     {withEmma ? 'With Emma Moodeng · Zoom' : 'Moodeng team · Zoom'}
                  </span>
                  {meetingDay ? (
                     <span className="flex flex-col">
                        <span className="text-[26px] font-bold leading-[30px] text-[#594d65]">{meetingTime}</span>
                        <span className="text-[14px] text-[#7b6b8c]">{meetingDay} · your local time</span>
                     </span>
                  ) : (
                     <span className="text-[15px] text-[#7b6b8c]">Your time is in your email</span>
                  )}
                  {meeting?.joinUrl ? (
                     <a
                        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full text-[16px] font-semibold text-white shadow-[0_6px_16px_rgba(107,85,247,0.35)] active:scale-[0.98]"
                        href={meeting.joinUrl}
                        rel="noreferrer"
                        style={{ backgroundImage: 'linear-gradient(85deg, #9584ff 0%, #6b55f7 98%)' }}
                        target="_blank"
                     >
                        <Video aria-hidden="true" className="size-4" strokeWidth={2.2} />
                        Join the meeting
                     </a>
                  ) : null}
               </div>

               <div className="text-left">
                  <p className="mb-2 text-[13px] font-bold uppercase tracking-[0.06em] text-[#877897]">Have ready</p>
                  <ul className="flex flex-col gap-2.5">
                     <PerkRow icon={<IdCard aria-hidden="true" className="size-[18px]" strokeWidth={2} />}>Your original ID or passport</PerkRow>
                     <PerkRow icon={<Camera aria-hidden="true" className="size-[18px]" strokeWidth={2} />}>Camera on, good light, phone nearby</PerkRow>
                  </ul>
               </div>

               <a className="text-[15px] font-semibold text-[#4492f1]" href="https://www.facebook.com/emmamoodengcredit" rel="noreferrer" target="_blank">
                  Say hi to Emma on Facebook ›
               </a>
            </>
         ) : null}

         <div className="mt-auto pt-1">
            <PrimaryButton onClick={onClose}>Got it</PrimaryButton>
         </div>
      </div>
   );
}
