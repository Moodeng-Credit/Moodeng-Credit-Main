import { type MouseEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BellRing, Facebook, Loader2, MessageCircle } from 'lucide-react';
import posthog from 'posthog-js';

import { usePushNotifications } from '@/hooks/usePushNotifications';

import {
   buildMessengerHandoffLink,
   buildMessengerVerifyLink,
   buildWhatsAppVerifyLink,
   isAndroidBrowser,
   isDesktopBrowser,
   MESSENGER_APP_CHAT_LINK,
   MESSENGER_PAGE_CHAT_LINK,
   MESSENGER_PAGE_ID,
   WHATSAPP_VERIFY_ENABLED
} from '@/config/contactVerification';
import { detectInAppBrowser, openInSafari, setInAppNoticeHidden } from '@/lib/inAppBrowser';
import { getLastPushFailure, type PushFailure } from '@/lib/push/webPushClient';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { playSuccess } from '@/lib/uiSounds';
import { CONNECT_HIPPOS, ConnectHero, GhostButton, LockedStepCard, OptionCard, PrimaryButton, StepLabel } from '@/views/dashboard/components/connectKit';
import DesktopMessengerCard from '@/views/dashboard/components/DesktopMessengerCard';
import NotificationsUnblockGuide from '@/views/dashboard/components/NotificationsUnblockGuide';
import WhatsAppRemindersCard from '@/views/dashboard/components/WhatsAppRemindersCard';

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
//     (first-time chatters tap Facebook's own "Get Started" once). Not on Android: Chrome there never
//     opens m.me in Messenger (see MESSENGER_APP_CHAT_LINK), so Android borrowers get the code on
//     screen, one tap copies it and opens our chat, and they paste and send it.
//     Not on computers either (the code gets lost on the way to facebook.com/messages): they scan a QR
//     with their phone (MessengerHandoff) or paste the code into our chat here (DesktopMessengerCard).
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
// Messenger didn't really open: the page was hidden for less than this (a tab or app flashing open
// and shut — every failed Android attempt looked like this, 0.2–0.5s), or never hidden at all within
// NOT_OPENED_AFTER_MS of the tap. Either way, go straight to the backups instead of "keep waiting".
const BOUNCE_MS = 1_500;
// Reminders that fail to turn on this many times (not blocked — broken) stop blocking Continue.
const PUSH_FAILURES_BEFORE_OPTIONAL = 2;
const NOT_OPENED_AFTER_MS = 3_000;
const MOODENG_FACEBOOK_PAGE_URL = `https://www.facebook.com/${MESSENGER_PAGE_ID}`;

// On Android without the Messenger app, the chat link opens Facebook's messages page in this same tab,
// so the borrower leaves the app. Remember the attempt so coming back lands on the same code instead
// of a fresh card (and a new code they haven't sent). Codes live 30 minutes.
const PENDING_KEY = 'moodeng.messengerVerifyPending';
const PENDING_TTL_MS = 25 * 60 * 1000;
type PendingMessenger = { userId: string; code: string; link: string; at: number };

const readPending = (userId: string): PendingMessenger | null => {
   try {
      const raw = window.sessionStorage.getItem(PENDING_KEY);
      const pending = raw ? (JSON.parse(raw) as PendingMessenger) : null;
      return pending && pending.userId === userId && Date.now() - pending.at < PENDING_TTL_MS ? pending : null;
   } catch {
      return null;
   }
};
const writePending = (pending: PendingMessenger | null) => {
   try {
      if (pending) window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      else window.sessionStorage.removeItem(PENDING_KEY);
   } catch {
      // Storage blocked: they just get a fresh card if they leave and come back.
   }
};

const openVerifyLink = (link: string) => {
   window.open(link, '_blank', 'noopener,noreferrer');
};

// iPhone/iPad. Opening m.me from script (after the code request) puts it in a NEW Safari tab: Messenger
// opens, but coming back to Safari lands on that leftover tab, and borrowers had to go "one step back"
// to find Moodeng again (Emma, 2026-10-12). So on iOS the code is fetched as soon as the card shows and
// the button is a real m.me link they tap: iOS hands it straight to Messenger and leaves this page as it
// was. Without Messenger installed it opens m.me in this tab, and coming back resumes the same code.
const isIOSBrowser = () =>
   /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// Codes live 30 minutes; a prepared one older than this is fetched fresh on the tap instead.
const PREPARED_CODE_TTL_MS = 20 * 60 * 1000;
// Onboarding: how long the green "Verified" shows before moving on to the success screen.
const AUTO_CONTINUE_MS = 900;

export default function ContactsStep({
   userId,
   onBack,
   onContinue,
   intro,
   whatsappEnabled = WHATSAPP_VERIFY_ENABLED,
   isSubmitting = false,
   source,
   backLabel = 'Back',
   requireReminders = false
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
   // Loan request for someone only email reaches (no working push, Messenger or WhatsApp): reminders
   // are required even where push can't work — WhatsApp instead, or "I don't have WhatsApp".
   requireReminders?: boolean;
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
   // Android: the app link did nothing (no Messenger app, or Messenger stuck) — say what to do instead.
   const [messengerDidntOpen, setMessengerDidntOpen] = useState(false);
   // Android: code first, then a direct tap on "Copy code & open Messenger" (see the comment at the top).
   const androidMessenger = isAndroidBrowser();
   // iPhone inside Facebook's / Instagram's own browser: the m.me link never reaches our bot there
   // (userbuds, 2026-10-14: tapped, Messenger never came up, left). So it gets the Android card instead:
   // the code first, then "Copy code & open Messenger", plus a way out to Safari, where m.me works.
   const inAppInfo = useMemo(() => detectInAppBrowser(), []);
   const iosInAppMessenger =
      !androidMessenger && isIOSBrowser() && inAppInfo.isInApp && inAppInfo.appName !== null && inAppInfo.appName !== 'Messenger';
   const codeFirstMessenger = androidMessenger || iosInAppMessenger;
   const iosMessenger = !androidMessenger && !iosInAppMessenger && isIOSBrowser();
   const iosInAppCardShown = iosInAppMessenger && Boolean(messengerLink) && !messengerVerified && Boolean(messengerCode);
   // The card explains the in-app browser and offers Safari itself, so the global banner would only
   // cover it (it hid the Safari button and the steps in the 2026-10-14 preview).
   useEffect(() => {
      if (!iosInAppCardShown) return;
      setInAppNoticeHidden(true);
      return () => setInAppNoticeHidden(false);
   }, [iosInAppCardShown]);
   // Computers: a QR for the phone plus copy-and-paste here (see isDesktopBrowser, DesktopMessengerCard).
   const desktopMessenger = !androidMessenger && !iosMessenger && isDesktopBrowser();
   // iOS: a code + m.me link ready before the tap (see isIOSBrowser above).
   const [preparedMessenger, setPreparedMessenger] = useState<{ code: string; link: string; at: number } | null>(null);
   const [tapAgain, setTapAgain] = useState(false);
   // Set once the tab is hidden after we open Messenger — i.e. they actually went there. Tracked by a
   // listener that exists from mount: the tab can hide before React re-renders after the tap.
   const leftForMessengerRef = useRef(false);
   const awaitingMessengerRef = useRef(false);
   // Analytics bookkeeping (refs: listeners outlive renders).
   const attemptsRef = useRef(0);
   const firstStartedAtRef = useRef<number | null>(null);
   const lastStartedAtRef = useRef<number | null>(null);
   const leftAtRef = useRef<number | null>(null);
   const openedAtRef = useRef<number | null>(null);
   const lastHiddenAtRef = useRef<number | null>(null);
   const lastChannelRef = useRef<Channel | null>(null);
   const confirmedTrackedRef = useRef(false);
   // Confirmed while they're on this screen (not a line verified earlier): onboarding moves on by itself.
   const [confirmedNow, setConfirmedNow] = useState(false);
   const backupTrackedRef = useRef(false);

   // Due-date reminders by push are required too, wherever the browser can do push. Some can't (an
   // iPhone that hasn't added Moodeng to its Home Screen, the Facebook/Messenger in-app browser):
   // those borrowers just don't see the reminders card and aren't blocked — Messenger and email still reach them.
   const push = usePushNotifications(userId);
   const [pushError, setPushError] = useState('');
   const pushOn = push.isSupported && push.permission === 'granted' && push.isSubscribed;
   // Blocked in the browser (they tapped "Block" on Chrome's prompt, often the one that pops up on its
   // own after sign-in): the site can't ask again, so a tap only ever said "blocked" and Continue stayed
   // locked. A borrower on 2026-10-13 tapped ~30 times over 17 minutes. Reminders become optional
   // here, the card says how to unblock, and Messenger and email still reach them.
   const pushBlocked = push.isSupported && push.permission === 'denied';
   // Allowed, but this phone can't actually subscribe (Chrome's push service unreachable — e.g. no
   // working Google Play services). Every tap returns 'failed' before reaching our server, so
   // Continue stayed locked: a borrower on 2026-10-15 tapped 22 times, gave up before booking her
   // call, and messaged the Page "the reminder won't turn on". Two failures → reminders are optional.
   const [pushFailures, setPushFailures] = useState(0);
   // Why the last tap failed (Chrome refused vs. our save failed), for PostHog and the team alert.
   const lastPushFailureRef = useRef<PushFailure | null>(null);
   const pushUnavailable = pushFailures >= PUSH_FAILURES_BEFORE_OPTIONAL;
   const pushRequired = push.isSupported && !pushBlocked && !pushUnavailable;

   // Facebook is the required contact line. A WhatsApp line only counts here when the old "WhatsApp
   // instead of Messenger" card is switched on; otherwise WhatsApp is just the reminders channel below.
   const contactVerified = messengerVerified || (whatsappEnabled && whatsappVerified);

   // Where notifications can't work (no push at all here, blocked, or broken on this phone), offer
   // WhatsApp reminders instead. Recommended, not required: someone without WhatsApp still gets
   // Messenger and email. Off until the borrower_whatsapp_card_enabled setting is on (sending has its
   // own switch, borrower_whatsapp_enabled).
   const [whatsappRemindersEnabled, setWhatsappRemindersEnabled] = useState(false);
   useEffect(() => {
      let cancelled = false;
      (async () => {
         try {
            const { data } = await getSupabaseBrowserClient().rpc('get_whatsapp_reminders_enabled');
            if (!cancelled) setWhatsappRemindersEnabled(data === true);
         } catch {
            // Can't tell: leave WhatsApp reminders off, the step works as before.
         }
      })();
      return () => {
         cancelled = true;
      };
   }, []);
   const pushCantWork = !push.isSupported || pushBlocked || pushUnavailable;
   const offerWhatsAppReminders = whatsappRemindersEnabled && pushCantWork;
   // requireReminders: where push can't work, WhatsApp becomes required, with "I don't have WhatsApp" as
   // the way out so nobody is locked in (2026-10-13: ~30 taps on a reminder that could never turn on).
   // Without the WhatsApp card on, there's nothing else to ask for, so it's the old rule.
   const [skippedNoWhatsApp, setSkippedNoWhatsApp] = useState(false);
   const whatsappRequired = requireReminders && offerWhatsAppReminders && !whatsappVerified && !skippedNoWhatsApp;
   const canContinue = contactVerified && (pushOn || !pushRequired) && !whatsappRequired;
   // Two numbered steps whenever there's a reminders step: 1 Connect Facebook, 2 Payment reminders.
   // Step 2 stays locked until Facebook is connected, so nobody starts with reminders thinking that's
   // the Facebook step (WhatsApp in particular looks like a way to "reach you").
   const hasReminderStep = pushRequired || pushBlocked || pushUnavailable || offerWhatsAppReminders;

   // Reminders can't turn on here — blocked, failing on this phone, or Facebook's browser on Android
   // (no push at all, but Chrome has it). Once they've connected Facebook, the bot messages them how
   // to fix it in Chrome/Safari and the team gets a heads-up (messenger-stuck-alerts, `reminders: true`), at most once a day.
   const remindersStuckReason: 'failed' | 'blocked' | 'in_app' | null = !contactVerified || pushOn || whatsappVerified
      ? null
      : pushUnavailable
        ? 'failed'
        : pushBlocked
          ? 'blocked'
          : androidMessenger && inAppInfo.isInApp && !push.isSupported
            ? 'in_app'
            : null;
   const remindersStuckReportedRef = useRef(false);
   useEffect(() => {
      if (!remindersStuckReason || remindersStuckReportedRef.current) return;
      remindersStuckReportedRef.current = true;
      const os = androidMessenger ? 'android' : isIOSBrowser() ? 'ios' : 'other';
      track('contact_push_stuck_reported', { source, reason: remindersStuckReason, os });
      void getSupabaseBrowserClient()
         .functions.invoke('messenger-stuck-alerts', {
            body: {
               reminders: true,
               reason: remindersStuckReason,
               os,
               failures: pushFailures || undefined,
               failure: lastPushFailureRef.current ?? undefined
            }
         })
         .catch(() => undefined);
   }, [remindersStuckReason, androidMessenger, source, pushFailures]);

   // Blocked: the card opens a picture guide to unblocking instead of a tap that can only fail.
   const [showUnblockGuide, setShowUnblockGuide] = useState(false);
   const [guideStillBlocked, setGuideStillBlocked] = useState(false);
   useEffect(() => {
      if (pushOn) setShowUnblockGuide(false);
   }, [pushOn]);

   const handleEnablePush = async () => {
      setPushError('');
      const outcome = await push.enable();
      const failure = outcome === 'failed' ? getLastPushFailure() : null;
      if (failure) lastPushFailureRef.current = failure;
      track('contact_push_outcome', {
         source,
         outcome,
         ...(failure ? { failure_stage: failure.stage, error_name: failure.errorName, error_message: failure.errorMessage } : {})
      });
      if (outcome === 'permission-denied') {
         // Blocked in the browser: show how to unblock (the card now opens the guide), Continue stays open.
         setGuideStillBlocked(showUnblockGuide);
         setShowUnblockGuide(true);
      } else if (outcome === 'permission-dismissed') {
         setPushError('Tap Allow when your phone asks, so we can remind you before your due date.');
      } else if (outcome === 'failed') {
         const failures = pushFailures + 1;
         setPushFailures(failures);
         if (failures >= PUSH_FAILURES_BEFORE_OPTIONAL) {
            track('contact_push_unavailable', { source, failures });
            setPushError('');
         } else {
            setPushError("Couldn't turn on reminders — try once more.");
         }
      } else if (outcome === 'subscribed' || outcome === 'already-subscribed') {
         setPushFailures(0);
      }
   };
   // The "WhatsApp instead of Messenger" card, only when that option is switched on (WhatsApp reminders
   // have their own card below).
   const showWhatsApp = whatsappEnabled;

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
         // requireReminders means WhatsApp can't reach them now (no linked contact, or they sent STOP), so
         // an old confirmation doesn't count: they send a fresh code.
         if (data.whatsapp_verified_at && !requireReminders) setWhatsappVerified(true);
         if (data.messenger_verified_at) {
            setMessengerVerified(true);
            return;
         }
         if (!iosMessenger) return;
         const { data: code, error } = await getSupabaseBrowserClient().rpc('start_contact_verification', { p_channel: 'messenger' });
         if (cancelled || error || !code) return;
         setPreparedMessenger({ code: String(code), link: buildMessengerVerifyLink(String(code)), at: Date.now() });
      })();
      return () => {
         cancelled = true;
      };
   }, [userId, iosMessenger, requireReminders]);

   useEffect(() => {
      const onHide = () => {
         if (document.visibilityState !== 'hidden' || !awaitingMessengerRef.current) return;
         lastHiddenAtRef.current = Date.now();
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
      const channel = messengerVerified ? 'messenger' : whatsappEnabled && whatsappVerified ? 'whatsapp' : null;
      if (!channel) return;
      confirmedTrackedRef.current = true;
      setConfirmedNow(true);
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
   }, [messengerVerified, whatsappVerified, whatsappEnabled, source]);

   // Live push from the database the moment the bot confirms (users is in the realtime publication,
   // and RLS limits it to their own row). The 3s poll and the on-return re-check stay as backups.
   useEffect(() => {
      if (contactVerified) return undefined;
      const client = getSupabaseBrowserClient();
      const channel = client
         .channel(`contact-verify:${userId}`)
         .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` }, (payload) => {
            const row = payload.new as { messenger_verified_at?: string | null; whatsapp_verified_at?: string | null };
            if (row.messenger_verified_at) setMessengerVerified(true);
            // requireReminders: the WhatsApp card watches for its own fresh confirmation instead.
            if (row.whatsapp_verified_at && !requireReminders) setWhatsappVerified(true);
         })
         .subscribe();
      return () => {
         void client.removeChannel(channel);
      };
   }, [userId, contactVerified, requireReminders]);

   // Onboarding: confirmed while they're here → a beat to see the green check, then straight on to the
   // "Facebook connected!" screen, no extra tap. If reminders are still required, the reminders card
   // asks for that one tap first and this fires as soon as they're on.
   const onContinueRef = useRef(onContinue);
   useEffect(() => {
      onContinueRef.current = onContinue;
   }, [onContinue]);
   const autoContinueTimerRef = useRef<number | null>(null);
   useEffect(() => {
      // Not while the WhatsApp reminders offer is up: moving on by itself would hide it before they see it.
      if (source !== 'connect' || !confirmedNow || !canContinue || autoContinueTimerRef.current !== null) return;
      if (offerWhatsAppReminders && !whatsappVerified) return;
      autoContinueTimerRef.current = window.setTimeout(() => {
         track('contact_verify_auto_continue', { source, attempts: attemptsRef.current, push_on: pushOn });
         onContinueRef.current();
      }, AUTO_CONTINUE_MS);
   }, [source, confirmedNow, canContinue, pushOn, offerWhatsAppReminders, whatsappVerified]);
   useEffect(
      () => () => {
         if (autoContinueTimerRef.current !== null) window.clearTimeout(autoContinueTimerRef.current);
      },
      []
   );
   const nudgeReminders = source === 'connect' && confirmedNow && pushRequired && !pushOn;

   const showBackup = useCallback(
      (reason: 'timeout' | 'returned_unconfirmed' | 'bounced' | 'not_opened' | 'resumed') => {
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

   // Poll rather than wait for a page-visibility event — the borrower may switch apps for a while
   // before coming back, and we want the checkmark to appear the moment they do.
   const startPolling = useCallback((channel: Channel) => {
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
   }, [userId]);

   // Back from a page that replaced this tab (Android without the Messenger app lands on Facebook's
   // messages page): pick the attempt back up with the same code showing, rather than a fresh card.
   useEffect(() => {
      const pending = readPending(userId);
      if (!pending) return;
      setMessengerLink(pending.link);
      setMessengerCode(pending.code);
      awaitingMessengerRef.current = true;
      track('contact_verify_resumed', { source, channel: 'messenger', seconds_since_open: secondsSince(pending.at) });
      showBackup('resumed');
      startPolling('messenger');
   }, [userId, source, showBackup, startPolling]);

   // Verified (now or on an earlier application): nothing left to resume.
   useEffect(() => {
      if (messengerVerified) writePending(null);
   }, [messengerVerified]);

   // Tapped, but the page never went to the background: Messenger didn't open at all.
   const armNotOpenedCheck = useCallback(() => {
      const openedAt = Date.now();
      openedAtRef.current = openedAt;
      window.setTimeout(() => {
         if (openedAtRef.current !== openedAt || document.visibilityState !== 'visible') return;
         if (lastHiddenAtRef.current !== null && lastHiddenAtRef.current >= openedAt) return;
         track('contact_verify_not_opened', { source, channel: 'messenger', attempt: attemptsRef.current, android: isAndroidBrowser() });
         setMessengerDidntOpen(true);
         showBackup('not_opened');
      }, NOT_OPENED_AFTER_MS);
   }, [source, showBackup]);

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
         let bounced = false;
         if (leftAtRef.current !== null) {
            const awayMs = Date.now() - leftAtRef.current;
            bounced = awayMs < BOUNCE_MS;
            track('contact_verify_returned', {
               source,
               channel: 'messenger',
               attempt: attemptsRef.current,
               seconds_away: secondsSince(leftAtRef.current),
               away_ms: awayMs,
               bounced,
               android: isAndroidBrowser(),
               confirmed: Boolean(data?.messenger_verified_at)
            });
            leftAtRef.current = null;
         }
         if (data?.messenger_verified_at) {
            setMessengerVerified(true);
            playSuccess();
            return;
         }
         if (bounced) {
            showBackup('bounced');
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
      leftAtRef.current = null;
      if (messengerCode) writePending({ userId, code: messengerCode, link: messengerLink, at: Date.now() });
      armNotOpenedCheck();
      // iOS: rendered as a real link, which opens Messenger by itself (see isIOSBrowser).
      if (!iosMessenger) openVerifyLink(messengerLink);
   };

   const copyMessengerCode = async (via: 'copy_button' | 'open_chat') => {
      if (!messengerCode) return;
      track('contact_verify_code_copied', { source, channel: 'messenger', attempts: attemptsRef.current, via });
      try {
         await navigator.clipboard.writeText(messengerCode);
         setCodeCopied(true);
         window.setTimeout(() => setCodeCopied(false), 2000);
      } catch {
         // Clipboard blocked: the code is on screen to type by hand.
      }
   };

   // Android: the borrower's own tap on the chat link, so copying is allowed and Messenger opens. The
   // link navigates by itself; this only copies the code and keeps the attempt for when they're back.
   const openMessengerChat = (event?: MouseEvent<HTMLAnchorElement>, link: string = MESSENGER_APP_CHAT_LINK) => {
      if (!messengerCode) return;
      track('contact_verify_open_chat_tapped', { source, channel: 'messenger', attempts: attemptsRef.current, desktop: desktopMessenger });
      setMessengerDidntOpen(false);
      void copyMessengerCode('open_chat');
      // The tap time lets the bot connect them by timing (sendpulse-events) when they open the chat
      // without sending the code. Best-effort: the code still works if this never lands.
      const stamp = getSupabaseBrowserClient()
         .rpc('mark_messenger_chat_opened')
         .then(({ error }) => {
            if (error) console.error('mark_messenger_chat_opened failed', error.message);
         });
      leftAtRef.current = null;
      awaitingMessengerRef.current = true;
      writePending({ userId, code: messengerCode, link, at: Date.now() });
      armNotOpenedCheck();
      // iPhone in Facebook's browser: following the link right away cancels the stamp mid-flight (George,
      // 2026-10-16: the preflight reached us, the POST never did), so the bot couldn't match them when
      // they opened Messenger themselves. Wait for it (at most 1.5s), then follow the link.
      if (iosInAppMessenger && event) {
         event.preventDefault();
         void Promise.race([stamp, new Promise((resolve) => window.setTimeout(resolve, 1500))]).then(() => {
            window.location.href = link;
         });
      }
   };

   // Messenger is opening (or about to): remember the attempt and start watching for the bot.
   const beginMessengerWait = (code: string, link: string, flow: 'link' | 'link_tap') => {
      attemptsRef.current += 1;
      lastStartedAtRef.current = Date.now();
      firstStartedAtRef.current ??= lastStartedAtRef.current;
      lastChannelRef.current = 'messenger';
      leftAtRef.current = null;
      track('contact_verify_started', {
         source,
         channel: 'messenger',
         attempt: attemptsRef.current,
         is_android: false,
         is_ios: iosMessenger,
         in_app_browser: /FBAN|FBAV|FB_IAB|Instagram|Messenger/i.test(navigator.userAgent),
         flow
      });
      setMessengerLink(link);
      setMessengerCode(code);
      leftForMessengerRef.current = false;
      awaitingMessengerRef.current = true;
      writePending({ userId, code, link, at: Date.now() });
      armNotOpenedCheck();
      startPolling('messenger');
   };

   // iOS: the tap on the prepared m.me link. The browser follows the link itself (straight into
   // Messenger); a stale code falls back to the normal start.
   const tapPreparedMessenger = (event: MouseEvent<HTMLElement>) => {
      if (!preparedMessenger || Date.now() - preparedMessenger.at > PREPARED_CODE_TTL_MS) {
         event.preventDefault();
         void handleVerify('messenger');
         return;
      }
      track('contact_verify_tapped', { source, channel: 'messenger', attempt: attemptsRef.current + 1 });
      setVerifyError('');
      beginMessengerWait(preparedMessenger.code, preparedMessenger.link, 'link_tap');
      setPreparedMessenger(null);
      setTapAgain(false);
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
         if (channel === 'messenger' && iosMessenger) {
            // iOS without a prepared code (it failed or went stale): opening now, from script, would land
            // in a new tab. Make the card the real link instead and ask for one more tap.
            setPreparedMessenger({ code: String(code), link, at: Date.now() });
            setTapAgain(true);
            return;
         }
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
            in_app_browser: /FBAN|FBAV|FB_IAB|Instagram|Messenger/i.test(navigator.userAgent),
            is_desktop: desktopMessenger,
            ios_in_app: iosInAppMessenger ? inAppInfo.appName : null,
            flow: channel === 'messenger' && codeFirstMessenger ? 'paste_code' : channel === 'messenger' && desktopMessenger ? 'qr' : 'link'
         });
         if (channel === 'messenger' && desktopMessenger) {
            // Nothing opens: the card shows the QR (for their phone) and the code to paste here.
            setMessengerLink(MESSENGER_PAGE_CHAT_LINK);
            setMessengerCode(String(code));
            leftForMessengerRef.current = false;
            awaitingMessengerRef.current = true;
            writePending({ userId, code: String(code), link: MESSENGER_PAGE_CHAT_LINK, at: Date.now() });
            track('contact_verify_qr_shown', { source, channel: 'messenger', attempt: attemptsRef.current });
            startPolling(channel);
            return;
         }
         if (channel === 'messenger' && codeFirstMessenger) {
            // Nothing opens yet: the card now shows the code and the button that opens our chat.
            setMessengerLink(MESSENGER_APP_CHAT_LINK);
            setMessengerCode(String(code));
            leftForMessengerRef.current = false;
            awaitingMessengerRef.current = true;
            writePending({ userId, code: String(code), link: MESSENGER_APP_CHAT_LINK, at: Date.now() });
            startPolling(channel);
            return;
         }
         if (channel === 'messenger') {
            setMessengerLink(link);
            setMessengerCode(String(code));
            leftForMessengerRef.current = false;
            awaitingMessengerRef.current = true;
            writePending({ userId, code: String(code), link, at: Date.now() });
            armNotOpenedCheck();
         }
         openVerifyLink(link);
         startPolling(channel);
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
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-5 text-md-b2 text-md-heading">
         {intro ?? (
            <ConnectHero image={CONNECT_HIPPOS.hello} subtitle="Only Moodeng sees this — never lenders." title="How can we reach you?" />
         )}

         {hasReminderStep ? <StepLabel done={contactVerified} n={1} text="Connect Facebook" /> : null}

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

         {messengerLink && !messengerVerified && codeFirstMessenger && messengerCode ? (
            <div
               aria-live="polite"
               className="flex w-full flex-col gap-3 rounded-[18px] border-2 border-[#c9bdf5] bg-[#f6f2ff] px-4 py-4 text-left"
            >
               <span className="text-[18px] font-bold leading-[22px] text-[#4c239f]">Connect on Messenger</span>
               {iosInAppMessenger ? (
                  <p className="rounded-xl bg-white px-3 py-2 text-[14px] font-semibold leading-[19px] text-[#594d65]">
                     You&apos;re in {inAppInfo.appName}&apos;s browser, which can&apos;t confirm Messenger by itself. Copy the code,
                     send it to us on Messenger, and you&apos;re done.
                  </p>
               ) : null}
               <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-white px-3 py-2 text-center text-[20px] font-bold tracking-wide text-md-heading">
                     {messengerCode}
                  </code>
                  <button
                     type="button"
                     onClick={() => void copyMessengerCode('copy_button')}
                     className="rounded-lg border border-[#c9bdf5] bg-white px-3 py-2 text-[13px] font-bold text-[#6b55f7]"
                  >
                     {codeCopied ? 'Copied' : 'Copy'}
                  </button>
               </div>
               {/* A plain link the borrower taps, as in the Android test: opened from script after the
                   code request, or as m.me, Messenger never comes up. */}
               <a
                  href={MESSENGER_APP_CHAT_LINK}
                  onClick={(event) => openMessengerChat(event)}
                  className="flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#0866FF] px-4 text-[16px] font-bold text-white"
               >
                  <Facebook aria-hidden="true" className="size-5" strokeWidth={2.5} />
                  Copy code & open Messenger
               </a>
               {messengerDidntOpen ? (
                  <p className="rounded-xl bg-[#fff4e0] px-3 py-2 text-[14px] font-semibold leading-[19px] text-[#9a5b00]">
                     {iosInAppMessenger
                        ? 'Messenger didn’t open? Open the Messenger app yourself, search Moodeng Credit, and paste the code (already copied).'
                        : 'Messenger didn’t open? Open Facebook, search Moodeng Credit, tap Message, and say hi.'}
                  </p>
               ) : null}
               {iosInAppMessenger ? (
                  <button
                     type="button"
                     onClick={() => {
                        track('contact_verify_open_in_safari_tapped', { source, channel: 'messenger', app: inAppInfo.appName });
                        // Our no-sign-in page for this code (/fb/<code>), not this page: Safari doesn't share
                        // Facebook's browser's login (guest accounts can't sign back in at all), and there the
                        // m.me link with the code confirms them by itself. This card turns green on its own.
                        openInSafari(messengerCode ? `${buildMessengerHandoffLink(messengerCode)}?from=fb` : window.location.href, inAppInfo);
                     }}
                     className="flex min-h-[44px] items-center justify-center rounded-full border-2 border-[#0866FF] bg-white px-4 text-[15px] font-bold text-[#0866FF]"
                  >
                     Or open Moodeng in Safari instead
                  </button>
               ) : null}
               <ol className="flex flex-col gap-1.5 text-[14px] leading-[19px] text-[#594d65]">
                  <li className="flex gap-2">
                     <b>1.</b>
                     <span>Tap the blue button. Our chat opens in Messenger.</span>
                  </li>
                  {iosInAppMessenger ? (
                     <>
                        <li className="flex gap-2">
                           <b>2.</b>
                           <span>Paste the code (already copied) and send it. We confirm you automatically.</span>
                        </li>
                        <li className="flex gap-2">
                           <b>3.</b>
                           <span>Messenger didn&apos;t open? Open the Messenger app, search Moodeng Credit, and paste the code there.</span>
                        </li>
                     </>
                  ) : (
                     <>
                        <li className="flex gap-2">
                           <b>2.</b>
                           <span>Tap Get Started, or send us a message. We connect you automatically.</span>
                        </li>
                        <li className="flex gap-2">
                           <b>3.</b>
                           <span>Not green after a minute? Paste the code (already copied) and send it.</span>
                        </li>
                     </>
                  )}
               </ol>
               <div className="flex items-center gap-2 text-[14px] leading-[18px] text-[#6b5b86]">
                  <Loader2 aria-hidden="true" className="size-5 shrink-0 animate-spin text-[#6b55f7]" strokeWidth={2.5} />
                  <span>Waiting for your message. This turns green on its own.</span>
               </div>
               <p className="text-[13px] leading-[17px] text-[#877897]">
                  No Messenger app? Open Facebook, search Moodeng Credit, tap Message, and send the code there.
               </p>
               <p className="text-[13px] leading-[17px] text-[#877897]">
                  Still stuck? We&apos;ll email you, and our team will help you finish.
               </p>
            </div>
         ) : messengerLink && !messengerVerified && desktopMessenger && messengerCode ? (
            <DesktopMessengerCard
               code={messengerCode}
               codeCopied={codeCopied}
               onCopy={() => void copyMessengerCode('copy_button')}
               onOpenChat={() => openMessengerChat(undefined, MESSENGER_PAGE_CHAT_LINK)}
               onPageLink={() => track('contact_verify_page_link_tapped', { source, channel: 'messenger', attempts: attemptsRef.current, desktop: true })}
            />
         ) : messengerLink && !messengerVerified ? (
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
                     <ReopenMessengerLink
                        className="mt-1 w-fit text-[14px] font-semibold text-md-primary-1200 underline underline-offset-4"
                        href={iosMessenger ? messengerLink : undefined}
                        onClick={() => reopenMessenger('card')}
                     />
                  </div>
               </div>
               {showTypedCode && messengerCode ? (
                  <div className="rounded-[18px] border border-[#d9d2f7] bg-[#faf8ff] px-4 py-3 text-md-b3 text-[#594d65]">
                     <p className="font-semibold text-[#4c239f]">Not confirmed yet?</p>
                     <p className="mt-1">
                        <b>1.</b> Tap{' '}
                        <ReopenMessengerLink
                           className="font-semibold text-md-primary-1200 underline underline-offset-4"
                           href={iosMessenger ? messengerLink : undefined}
                           onClick={() => reopenMessenger('backup')}
                        />
                        . Now that our chat is open, the second try usually works.
                     </p>
                     <p className="mt-2">
                        <b>2.</b> Or send this code to <b>Moodeng Credit</b> on Facebook Messenger, from any app or device. We confirm you
                        automatically.
                        {' '}No Messenger app? Open our Facebook page below in your browser, tap <b>Message</b> and paste the code.
                     </p>
                     <div className="mt-2 flex items-center gap-2">
                        <code className="flex-1 rounded-lg bg-white px-3 py-2 text-center text-[16px] font-bold tracking-wide text-md-heading">
                           {messengerCode}
                        </code>
                        <button
                           type="button"
                           onClick={() => void copyMessengerCode('copy_button')}
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
               badge={codeFirstMessenger || desktopMessenger ? '1 min' : '1 tap'}
               disabled={startingChannel !== null}
               done={messengerVerified}
               doneLabel="Verified"
               href={iosMessenger && preparedMessenger ? preparedMessenger.link : undefined}
               icon={<Facebook aria-hidden="true" className="size-9 text-[#0866FF]" strokeWidth={2} />}
               onClick={iosMessenger && preparedMessenger ? tapPreparedMessenger : () => void handleVerify('messenger')}
               subtitle={
                  tapAgain && preparedMessenger
                     ? 'Ready — tap again to open Messenger.'
                     : startingChannel === 'messenger'
                     ? codeFirstMessenger || desktopMessenger
                        ? 'Getting your code…'
                        : 'Opening Messenger…'
                     : codeFirstMessenger
                       ? 'Opens our chat. Say hi and you’re connected.'
                       : desktopMessenger
                         ? 'Scan a code with your phone, or chat with us here.'
                       : source === 'connect'
                         ? 'Opens Messenger — tap Get Started there. Confirms you automatically.'
                         : 'Confirms you automatically — nothing to type'
               }
               title={source === 'connect' ? 'Connect Messenger' : 'Messenger'}
            />
         )}

         {verifyError ? <p className="text-center text-md-b3 font-normal text-md-red-500">{verifyError}</p> : null}

         {hasReminderStep ? <StepLabel done={pushOn || whatsappVerified} n={2} text="Payment reminders" /> : null}
         {/* One thing at a time: reminders unlock once Facebook is connected. */}
         {hasReminderStep && !contactVerified ? (
            <LockedStepCard
               hint="Unlocks after step 1"
               icon={
                  offerWhatsAppReminders ? (
                     <MessageCircle aria-hidden="true" className="size-9 text-[#25D366]" strokeWidth={2} />
                  ) : (
                     <BellRing aria-hidden="true" className="size-9 text-[#6b55f7]" strokeWidth={2} />
                  )
               }
               title={offerWhatsAppReminders ? 'Get reminders on WhatsApp' : 'Turn on reminders'}
            />
         ) : null}
         {(pushRequired || pushBlocked || pushUnavailable) && contactVerified ? (
            // Just confirmed Facebook in onboarding: this is the one tap left, so it shakes and says so.
            <div className={nudgeReminders ? 'connect-shake' : undefined}>
               <OptionCard
                  badge={pushBlocked || pushUnavailable ? 'Optional' : 'Required'}
                  disabled={push.isBusy}
                  done={pushOn}
                  doneLabel="On"
                  icon={<BellRing aria-hidden="true" className="size-9 text-[#6b55f7]" strokeWidth={2} />}
                  onClick={() => {
                     if (pushBlocked) {
                        track('contact_push_guide_opened', { source });
                        setGuideStillBlocked(false);
                        setShowUnblockGuide(true);
                        return;
                     }
                     void handleEnablePush();
                  }}
                  subtitle={
                     push.isBusy
                        ? 'Turning on…'
                        : pushBlocked
                          ? 'Blocked in your browser. Tap to see how to turn it on.'
                          : pushUnavailable
                          ? requireReminders
                             ? 'Not working on this phone.'
                             : 'Not working on this phone. You can continue — we’ll remind you on Messenger and email.'
                          : nudgeReminders
                          ? 'One more tap — turn on reminders and you’re through.'
                          : 'We remind you before your due date'
                  }
                  title="Turn on reminders"
               />
            </div>
         ) : null}
         {offerWhatsAppReminders && contactVerified ? (
            <WhatsAppRemindersCard
               onVerified={() => setWhatsappVerified(true)}
               required={requireReminders && !skippedNoWhatsApp}
               source={source}
               userId={userId}
               verified={whatsappVerified}
            />
         ) : null}
         {requireReminders && offerWhatsAppReminders && contactVerified && !whatsappVerified && !skippedNoWhatsApp ? (
            <button
               className="self-center text-md-b3 font-[590] text-[#877897] underline"
               onClick={() => {
                  track('contact_whatsapp_reminders_skipped', { source, push_blocked: pushBlocked, push_failures: pushFailures });
                  setSkippedNoWhatsApp(true);
               }}
               type="button"
            >
               I don&apos;t have WhatsApp
            </button>
         ) : null}

         {/* Where push can't run (iPhone not on the Home Screen, Facebook's in-app browser) we used
             to show "In Safari, tap Share → Add to Home Screen…" here. It read like a scam and
             confused people into stopping, and it never blocked Continue — Messenger and email
             still reach them — so we just leave it out. */}

         {pushError ? <p className="text-center text-md-b3 font-normal text-md-red-500">{pushError}</p> : null}

         <NotificationsUnblockGuide
            open={showUnblockGuide}
            isChecking={push.isBusy}
            stillBlocked={guideStillBlocked}
            onCheckAgain={() => void handleEnablePush()}
            onClose={() => setShowUnblockGuide(false)}
         />

         <div className="mt-auto flex flex-col gap-1 pt-2">
            {/* Onboarding: someone who comes back here (e.g. the phone's back button from About you)
                should see at a glance that this step is done, not think they have to connect again. */}
            {source === 'connect' && canContinue ? (
               <p className="mb-1 text-center text-md-b2 font-[590] text-[#1f7a3d]">
                  You&apos;re connected ✓ Tap Continue for the next step.
               </p>
            ) : null}
            <PrimaryButton disabled={!canContinue || isSubmitting} onClick={handleContinue}>
               {isSubmitting ? 'Submitting…' : 'Continue'}
            </PrimaryButton>
            {!contactVerified && hasReminderStep ? (
               <p className="text-center text-md-b3 text-[#877897]">Connect Facebook to continue.</p>
            ) : null}
            {contactVerified && pushRequired && !pushOn ? (
               <p className="text-center text-md-b3 text-[#877897]">Turn on reminders to continue.</p>
            ) : null}
            {contactVerified && whatsappRequired ? (
               <p className="text-center text-md-b3 text-[#877897]">Turn on WhatsApp reminders to continue.</p>
            ) : null}
            <GhostButton onClick={handleBack}>{backLabel}</GhostButton>
         </div>
      </div>
   );
}

// "Open Messenger again": a real link on iPhone (opens Messenger in place), a button elsewhere.
function ReopenMessengerLink({ href, onClick, className }: { href?: string; onClick: () => void; className: string }) {
   if (href) {
      return (
         <a className={className} href={href} onClick={onClick}>
            Open Messenger again
         </a>
      );
   }
   return (
      <button className={className} onClick={onClick} type="button">
         Open Messenger again
      </button>
   );
}
