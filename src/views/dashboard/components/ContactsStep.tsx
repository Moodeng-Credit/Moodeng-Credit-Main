import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { BellRing, Facebook, Loader2, MessageCircle } from 'lucide-react';
import posthog from 'posthog-js';

import { usePushNotifications } from '@/hooks/usePushNotifications';

import {
   buildMessengerVerifyLink,
   buildWhatsAppVerifyLink,
   MESSENGER_PAGE_ID,
   WHATSAPP_VERIFY_ENABLED
} from '@/config/contactVerification';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { CONNECT_HIPPOS, ConnectHero, GhostButton, OptionCard, PrimaryButton } from '@/views/dashboard/components/connectKit';

// End-of-application "how we reach you" step: a *verified* WhatsApp line OR a *verified* Facebook
// Messenger line — either one is enough, since not everyone uses WhatsApp. Both are platform-only
// and private, never shown to lenders. Sits between the bio step and the referral-gated
// video-call step in LoanRequestModal.
//
// Neither channel asks the borrower to type a code. They tap a link that carries a one-time code and
// the chat opens in the app they're already logged into:
//   * WhatsApp — wa.me pre-fills the code; whatsapp-webhook matches it when they hit send.
//   * Messenger — the m.me link launches SendPulse's "Confirm Facebook" flow with the code attached;
//     the flow calls sendpulse-messenger-verify, which matches it. Just opening the link is enough
//     (first-time chatters tap Facebook's own "Get Started" once).
// Both stamp the verified-at column plus an id we can message them on. This component polls those
// columns rather than trusting anything the client says — the point is a line we can prove works.
type Channel = 'whatsapp' | 'messenger';

// Where this card is shown — sent with every analytics event so we can compare the flows.
export type ContactsStepSource = 'verify_review' | 'verify_declined' | 'loan_request' | 'connect';

// Every step of the "connect your Facebook" flow is logged to PostHog (contact_verify_*), so a stuck
// borrower's story is one query instead of a reconstruction from page views and DB timestamps, and
// we can see how often the first Messenger tap fails. Best-effort: analytics never blocks the flow.
const track = (event: string, properties: Record<string, unknown>) => {
   try {
      posthog.capture(event, properties);
   } catch {
      // Analytics unavailable (blocked, not initialised) — the flow carries on.
   }
};
const secondsSince = (startedAt: number | null) => (startedAt === null ? null : Math.round((Date.now() - startedAt) / 1000));

const SHOW_TYPED_CODE_AFTER_MS = 60_000;
// Coming back from Messenger still unconfirmed: give the bot a few seconds to land, then offer the
// backups right away instead of making them sit out the full minute. Meta doesn't guarantee the m.me
// code arrives (a first-time "Get Started", some Android Messenger versions), and Aya on 2026-09-29
// left without ever seeing the backups.
const RETURN_GRACE_MS = 4_000;
const MOODENG_FACEBOOK_PAGE_URL = `https://www.facebook.com/${MESSENGER_PAGE_ID}`;

export default function ContactsStep({
   userId,
   onBack,
   onContinue,
   intro,
   whatsappEnabled = WHATSAPP_VERIFY_ENABLED,
   isSubmitting = false,
   source,
   backLabel = 'Back'
}: {
   userId: string;
   onBack: () => void;
   onContinue: () => void;
   // Replaces the default "so we can reach you" line — ConnectStep uses it for its "let's meet" pitch.
   intro?: ReactNode;
   // Facebook first: WhatsApp is hidden until a real business number is connected.
   whatsappEnabled?: boolean;
   // For existing borrowers this is the last step, so Continue fires the real loan submission. When
   // it does, the parent passes isSubmitting so the button disables + reads "Submitting…" instead of
   // sitting there inert during the network call (inviting a double-tap).
   isSubmitting?: boolean;
   source: ContactsStepSource;
   // The secondary button's label. /verify shows this card before the manual-review screen, where
   // "Back" would read oddly, so it passes "Skip for now".
   backLabel?: string;
}) {
   const [whatsappVerified, setWhatsappVerified] = useState(false);
   const [messengerVerified, setMessengerVerified] = useState(false);
   const [startingChannel, setStartingChannel] = useState<Channel | null>(null);
   // The Messenger link we opened. Once set, the card shows a short "waiting" state with a button to
   // reopen it — a direct tap, which also rescues phones that block the async window.open below.
   const [messengerLink, setMessengerLink] = useState<string | null>(null);
   const [verifyError, setVerifyError] = useState('');
   const pollRef = useRef<number | null>(null);
   // Backup when the m.me link never reaches our bot (Facebook Lite, Messenger Lite, no Messenger app:
   // Brian tapped "Open Messenger" ~30 times on 2026-09-26 and our Page never heard from him). After a
   // minute, show the code itself: sending it to the Page from anywhere runs the SendPulse "Confirm
   // Facebook (typed code)" flow (keyword trigger MDNG), which confirms the same Facebook account. The
   // poll below picks it up exactly like the link path.
   const [messengerCode, setMessengerCode] = useState<string | null>(null);
   const [showTypedCode, setShowTypedCode] = useState(false);
   const [codeCopied, setCodeCopied] = useState(false);
   // Set once the tab is hidden after we open Messenger — i.e. they actually went there. Tracked by a
   // listener that exists from mount: the tab can hide before React re-renders after the tap.
   const leftForMessengerRef = useRef(false);
   const awaitingMessengerRef = useRef(false);
   // Analytics bookkeeping (refs: listeners outlive renders).
   const attemptsRef = useRef(0);
   const firstStartedAtRef = useRef<number | null>(null);
   const lastStartedAtRef = useRef<number | null>(null);
   const leftAtRef = useRef<number | null>(null);
   const lastChannelRef = useRef<Channel | null>(null);
   const confirmedTrackedRef = useRef(false);
   const backupTrackedRef = useRef(false);

   // Due-date reminders by push are required too, wherever the browser can do push. Some can't (an
   // iPhone that hasn't added Moodeng to its Home Screen, the Facebook/Messenger in-app browser):
   // those borrowers just don't see the reminders card and aren't blocked — Messenger and email still reach them.
   const push = usePushNotifications(userId);
   const [pushError, setPushError] = useState('');
   const pushOn = push.isSupported && push.permission === 'granted' && push.isSubscribed;
   const pushRequired = push.isSupported;

   const contactVerified = whatsappVerified || messengerVerified;
   const canContinue = contactVerified && (pushOn || !pushRequired);

   const handleEnablePush = async () => {
      setPushError('');
      const outcome = await push.enable();
      if (outcome === 'permission-denied') {
         setPushError('Notifications are blocked. Allow them for moodeng.app in your browser settings, then tap again.');
      } else if (outcome === 'permission-dismissed') {
         setPushError('Tap Allow when your phone asks, so we can remind you before your due date.');
      } else if (outcome === 'failed') {
         setPushError("Couldn't turn on reminders — try again in a moment.");
      }
   };
   // Still show WhatsApp to a returning borrower who verified it before, so they can see why
   // Continue is already enabled.
   const showWhatsApp = whatsappEnabled || whatsappVerified;

   // Pick up an already-verified line from a previous application — this is an account-level fact,
   // not a per-loan one, so a returning borrower shouldn't have to re-verify every time.
   useEffect(() => {
      let cancelled = false;
      (async () => {
         const { data } = await getSupabaseBrowserClient()
            .from('users')
            .select('whatsapp_verified_at, messenger_verified_at')
            .eq('id', userId)
            .maybeSingle();
         if (cancelled || !data) return;
         if (data.whatsapp_verified_at) setWhatsappVerified(true);
         if (data.messenger_verified_at) setMessengerVerified(true);
      })();
      return () => {
         cancelled = true;
      };
   }, [userId]);

   useEffect(() => {
      const onHide = () => {
         if (document.visibilityState !== 'hidden' || !awaitingMessengerRef.current) return;
         leftForMessengerRef.current = true;
         if (leftAtRef.current === null) {
            leftAtRef.current = Date.now();
            track('contact_verify_left_app', {
               source,
               channel: 'messenger',
               attempt: attemptsRef.current,
               seconds_since_start: secondsSince(lastStartedAtRef.current)
            });
         }
      };
      document.addEventListener('visibilitychange', onHide);
      return () => document.removeEventListener('visibilitychange', onHide);
   }, [source]);

   // Confirmed during this visit (not a line verified on an earlier application).
   useEffect(() => {
      if (confirmedTrackedRef.current || attemptsRef.current === 0) return;
      const channel = messengerVerified ? 'messenger' : whatsappVerified ? 'whatsapp' : null;
      if (!channel) return;
      confirmedTrackedRef.current = true;
      // Done waiting: a later app switch (e.g. to Settings for notifications) isn't a Messenger trip.
      awaitingMessengerRef.current = false;
      // Confirmed while they were still away (desktop tabs keep polling): log the return here, since
      // the return listener is gone once the line is verified.
      if (leftAtRef.current !== null) {
         track('contact_verify_returned', {
            source,
            channel: 'messenger',
            attempt: attemptsRef.current,
            seconds_away: secondsSince(leftAtRef.current),
            confirmed: true,
            confirmed_while_away: true
         });
         leftAtRef.current = null;
      }
      track('contact_verify_confirmed', {
         source,
         channel,
         attempts: attemptsRef.current,
         seconds_since_first_start: secondsSince(firstStartedAtRef.current),
         seconds_since_last_start: secondsSince(lastStartedAtRef.current),
         left_app: leftForMessengerRef.current
      });
   }, [messengerVerified, whatsappVerified, source]);

   const showBackup = useCallback(
      (reason: 'timeout' | 'returned_unconfirmed') => {
         setShowTypedCode(true);
         if (backupTrackedRef.current) return;
         backupTrackedRef.current = true;
         track('contact_verify_backup_shown', { source, channel: 'messenger', reason, attempts: attemptsRef.current });
      },
      [source]
   );

   const stopPolling = () => {
      if (pollRef.current) {
         window.clearInterval(pollRef.current);
         pollRef.current = null;
      }
   };
   useEffect(() => stopPolling, []);

   useEffect(() => {
      if (!messengerLink || messengerVerified) return;
      const timer = window.setTimeout(() => showBackup('timeout'), SHOW_TYPED_CODE_AFTER_MS);
      return () => window.clearTimeout(timer);
   }, [messengerLink, messengerVerified, showBackup]);

   // Mobile browsers freeze the 3s poll above while the borrower is away in Messenger, so the
   // checkmark can lag — or never appear if they come back to a still-frozen tab and then close it.
   // Re-check the instant the app tab is shown or focused again: this is what actually makes the
   // card flip to "Verified the moment they return", which the poll alone only promises.
   // Back from Messenger and still not confirmed → show the backups after a short grace (the card
   // flips to Verified instead if the bot lands in the meantime).
   useEffect(() => {
      if (!messengerLink || messengerVerified) return;
      let graceTimer: number | null = null;
      const recheck = async () => {
         if (document.visibilityState !== 'visible') return;
         const { data } = await getSupabaseBrowserClient()
            .from('users')
            .select('whatsapp_verified_at, messenger_verified_at')
            .eq('id', userId)
            .maybeSingle();
         if (data?.whatsapp_verified_at) setWhatsappVerified(true);
         if (leftAtRef.current !== null) {
            track('contact_verify_returned', {
               source,
               channel: 'messenger',
               attempt: attemptsRef.current,
               seconds_away: secondsSince(leftAtRef.current),
               confirmed: Boolean(data?.messenger_verified_at)
            });
            leftAtRef.current = null;
         }
         if (data?.messenger_verified_at) {
            setMessengerVerified(true);
            return;
         }
         if (leftForMessengerRef.current && graceTimer === null) {
            graceTimer = window.setTimeout(() => showBackup('returned_unconfirmed'), RETURN_GRACE_MS);
         }
      };
      document.addEventListener('visibilitychange', recheck);
      window.addEventListener('focus', recheck);
      return () => {
         document.removeEventListener('visibilitychange', recheck);
         window.removeEventListener('focus', recheck);
         if (graceTimer !== null) window.clearTimeout(graceTimer);
      };
   }, [messengerLink, messengerVerified, userId, source, showBackup]);

   const reopenMessenger = (location: 'card' | 'backup') => {
      if (!messengerLink) return;
      track('contact_verify_reopen_tapped', { source, channel: 'messenger', location, attempts: attemptsRef.current });
      window.open(messengerLink, '_blank', 'noopener,noreferrer');
   };

   const copyMessengerCode = async () => {
      if (!messengerCode) return;
      track('contact_verify_code_copied', { source, channel: 'messenger', attempts: attemptsRef.current });
      try {
         await navigator.clipboard.writeText(messengerCode);
         setCodeCopied(true);
         window.setTimeout(() => setCodeCopied(false), 2000);
      } catch {
         // Clipboard blocked: the code is on screen to type by hand.
      }
   };

   const handleVerify = async (channel: Channel) => {
      // The tap itself, before the code request: a slow or failed start would otherwise leave no trace.
      track('contact_verify_tapped', { source, channel, attempt: attemptsRef.current + 1 });
      setVerifyError('');
      setStartingChannel(channel);
      try {
         // WhatsApp keeps its original entry point (unchanged, already proven in prod); Messenger
         // uses the generic starter with its channel.
         const { data: code, error } =
            channel === 'whatsapp'
               ? await getSupabaseBrowserClient().rpc('start_whatsapp_verification')
               : await getSupabaseBrowserClient().rpc('start_contact_verification', { p_channel: 'messenger' });
         if (error || !code) throw error ?? new Error('No code returned');

         const link = channel === 'whatsapp' ? buildWhatsAppVerifyLink(code) : buildMessengerVerifyLink(String(code));
         attemptsRef.current += 1;
         lastStartedAtRef.current = Date.now();
         firstStartedAtRef.current ??= lastStartedAtRef.current;
         lastChannelRef.current = channel;
         leftAtRef.current = null;
         track('contact_verify_started', {
            source,
            channel,
            attempt: attemptsRef.current,
            is_android: /android/i.test(navigator.userAgent),
            is_ios: /iphone|ipad|ipod/i.test(navigator.userAgent),
            in_app_browser: /FBAN|FBAV|FB_IAB|Instagram|Messenger/i.test(navigator.userAgent)
         });
         if (channel === 'messenger') {
            setMessengerLink(link);
            setMessengerCode(String(code));
            leftForMessengerRef.current = false;
            awaitingMessengerRef.current = true;
         }
         window.open(link, '_blank', 'noopener,noreferrer');

         // Poll rather than wait for a page-visibility event — the borrower may switch apps for a
         // while before coming back, and we want the checkmark to appear the moment they do.
         stopPolling();
         pollRef.current = window.setInterval(async () => {
            const { data } = await getSupabaseBrowserClient()
               .from('users')
               .select('whatsapp_verified_at, messenger_verified_at')
               .eq('id', userId)
               .maybeSingle();
            if (data?.whatsapp_verified_at) setWhatsappVerified(true);
            if (data?.messenger_verified_at) setMessengerVerified(true);
            const done = channel === 'whatsapp' ? data?.whatsapp_verified_at : data?.messenger_verified_at;
            if (done) stopPolling();
         }, 3000);
      } catch (err) {
         console.error(`start verification failed (${channel})`, err);
         track('contact_verify_start_failed', { source, channel });
         setVerifyError("Couldn't start verification — try again in a moment.");
      } finally {
         setStartingChannel(null);
      }
   };

   const handleContinue = () => {
      if (!canContinue) return;
      track('contact_verify_continue', { source, channel: messengerVerified ? 'messenger' : 'whatsapp', push_on: pushOn });
      onContinue();
   };

   const handleBack = () => {
      track('contact_verify_back', { source, contact_verified: contactVerified, attempts: attemptsRef.current, label: backLabel });
      onBack();
   };

   return (
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-5 text-md-b2 text-md-heading">
         {intro ?? (
            <ConnectHero image={CONNECT_HIPPOS.hello} subtitle="Only Moodeng sees this — never lenders." title="How can we reach you?" />
         )}

         {showWhatsApp ? (
            <OptionCard
               badge="1 tap"
               disabled={startingChannel !== null}
               done={whatsappVerified}
               doneLabel="Verified"
               icon={<MessageCircle aria-hidden="true" className="size-9 text-[#25D366]" strokeWidth={2} />}
               onClick={() => handleVerify('whatsapp')}
               subtitle={startingChannel === 'whatsapp' ? 'Opening WhatsApp…' : 'Just hit send — nothing to type'}
               title="WhatsApp"
            />
         ) : null}

         {messengerLink && !messengerVerified ? (
            <>
               {/* A live "we're checking" state, like the wallet-creation step — a spinner + a "keep
                   this open, it'll turn green on its own" reassurance so the wait doesn't look frozen.
                   The poll (and the on-return re-check above) flip this whole card to the green
                   Verified state the moment the bot confirms. */}
               <div
                  aria-live="polite"
                  className="flex min-h-[88px] w-full items-center gap-3 rounded-[18px] border-2 border-[#c9bdf5] bg-[#f6f2ff] px-4 py-3"
               >
                  <span className="grid size-11 shrink-0 place-items-center">
                     <Loader2 aria-hidden="true" className="size-7 animate-spin text-[#6b55f7]" strokeWidth={2.5} />
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5 text-left">
                     <span className="text-[18px] font-bold leading-[22px] text-[#4c239f]">Confirming on Messenger…</span>
                     <span className="text-[14px] leading-[18px] text-[#6b5b86]">
                        Keep this screen open — it turns green on its own. Tap <b>Get Started</b> in Messenger if it asks.
                     </span>
                     <button
                        type="button"
                        onClick={() => reopenMessenger('card')}
                        className="mt-1 w-fit text-[14px] font-semibold text-md-primary-1200 underline underline-offset-4"
                     >
                        Open Messenger again
                     </button>
                  </div>
               </div>
               {showTypedCode && messengerCode ? (
                  <div className="rounded-[18px] border border-[#d9d2f7] bg-[#faf8ff] px-4 py-3 text-md-b3 text-[#594d65]">
                     <p className="font-semibold text-[#4c239f]">Not confirmed yet?</p>
                     <p className="mt-1">
                        <b>1.</b> Tap{' '}
                        <button
                           type="button"
                           onClick={() => reopenMessenger('backup')}
                           className="font-semibold text-md-primary-1200 underline underline-offset-4"
                        >
                           Open Messenger again
                        </button>
                        . Now that our chat is open, the second try usually works.
                     </p>
                     <p className="mt-2">
                        <b>2.</b> Or send this code to <b>Moodeng Credit</b> on Facebook Messenger, from any app or device. We confirm you
                        automatically.
                     </p>
                     <div className="mt-2 flex items-center gap-2">
                        <code className="flex-1 rounded-lg bg-white px-3 py-2 text-center text-[16px] font-bold tracking-wide text-md-heading">
                           {messengerCode}
                        </code>
                        <button
                           type="button"
                           onClick={() => void copyMessengerCode()}
                           className="rounded-lg bg-[#6b55f7] px-3 py-2 text-[13px] font-bold text-white"
                        >
                           {codeCopied ? 'Copied' : 'Copy'}
                        </button>
                     </div>
                     <a
                        href={MOODENG_FACEBOOK_PAGE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() =>
                           track('contact_verify_page_link_tapped', { source, channel: 'messenger', attempts: attemptsRef.current })
                        }
                        className="mt-2 inline-block font-semibold text-md-primary-1200 underline underline-offset-4"
                     >
                        Open our Facebook page
                     </a>
                     <p className="mt-2 text-[13px] text-[#877897]">
                        Still stuck? We&apos;ll email you, and our team will help you finish.
                     </p>
                  </div>
               ) : null}
            </>
         ) : (
            <OptionCard
               badge="1 tap"
               disabled={startingChannel !== null}
               done={messengerVerified}
               doneLabel="Verified"
               icon={<Facebook aria-hidden="true" className="size-9 text-[#0866FF]" strokeWidth={2} />}
               onClick={() => handleVerify('messenger')}
               subtitle={startingChannel === 'messenger' ? 'Opening Messenger…' : 'Confirms you automatically — nothing to type'}
               title="Messenger"
            />
         )}

         {verifyError ? <p className="text-center text-md-b3 font-normal text-md-red-500">{verifyError}</p> : null}

         {pushRequired ? (
            <OptionCard
               badge="Required"
               disabled={push.isBusy}
               done={pushOn}
               doneLabel="On"
               icon={<BellRing aria-hidden="true" className="size-9 text-[#6b55f7]" strokeWidth={2} />}
               onClick={() => void handleEnablePush()}
               subtitle={push.isBusy ? 'Turning on…' : 'We remind you before your due date'}
               title="Turn on reminders"
            />
         ) : null}
         {/* Where push can't run (iPhone not on the Home Screen, Facebook's in-app browser) we used
             to show "In Safari, tap Share → Add to Home Screen…" here. It read like a scam and
             confused people into stopping, and it never blocked Continue — Messenger and email
             still reach them — so we just leave it out. */}

         {pushError ? <p className="text-center text-md-b3 font-normal text-md-red-500">{pushError}</p> : null}

         <div className="mt-auto flex flex-col gap-1 pt-2">
            <PrimaryButton disabled={!canContinue || isSubmitting} onClick={handleContinue}>
               {isSubmitting ? 'Submitting…' : 'Continue'}
            </PrimaryButton>
            {contactVerified && pushRequired && !pushOn ? (
               <p className="text-center text-md-b3 text-[#877897]">Turn on reminders to continue.</p>
            ) : null}
            <GhostButton onClick={handleBack}>{backLabel}</GhostButton>
         </div>
      </div>
   );
}
