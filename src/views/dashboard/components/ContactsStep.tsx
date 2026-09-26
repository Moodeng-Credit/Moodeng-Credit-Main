import { type ReactNode, useEffect, useRef, useState } from 'react';

import { BellRing, Facebook, MessageCircle } from 'lucide-react';

import { usePushNotifications } from '@/hooks/usePushNotifications';

import { buildMessengerVerifyLink, buildWhatsAppVerifyLink, WHATSAPP_VERIFY_ENABLED } from '@/config/contactVerification';
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

export default function ContactsStep({
   userId,
   onBack,
   onContinue,
   intro,
   whatsappEnabled = WHATSAPP_VERIFY_ENABLED
}: {
   userId: string;
   onBack: () => void;
   onContinue: () => void;
   // Replaces the default "so we can reach you" line — ConnectStep uses it for its "let's meet" pitch.
   intro?: ReactNode;
   // Facebook first: WhatsApp is hidden until a real business number is connected.
   whatsappEnabled?: boolean;
}) {
   const [whatsappVerified, setWhatsappVerified] = useState(false);
   const [messengerVerified, setMessengerVerified] = useState(false);
   const [startingChannel, setStartingChannel] = useState<Channel | null>(null);
   // The Messenger link we opened. Once set, the card shows a short "waiting" state with a button to
   // reopen it — a direct tap, which also rescues phones that block the async window.open below.
   const [messengerLink, setMessengerLink] = useState<string | null>(null);
   const [verifyError, setVerifyError] = useState('');
   const pollRef = useRef<number | null>(null);

   // Due-date reminders by push are required too, wherever the browser can do push. Some can't (an
   // iPhone that hasn't added Moodeng to its Home Screen, the Facebook/Messenger in-app browser):
   // those borrowers see how to fix it but aren't blocked — Messenger and email still reach them.
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

   const stopPolling = () => {
      if (pollRef.current) {
         window.clearInterval(pollRef.current);
         pollRef.current = null;
      }
   };
   useEffect(() => stopPolling, []);

   const handleVerify = async (channel: Channel) => {
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
         if (channel === 'messenger') setMessengerLink(link);
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
         setVerifyError("Couldn't start verification — try again in a moment.");
      } finally {
         setStartingChannel(null);
      }
   };

   const handleContinue = () => {
      if (!canContinue) return;
      onContinue();
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
            <OptionCard
               icon={<Facebook aria-hidden="true" className="size-9 text-[#0866FF]" strokeWidth={2} />}
               onClick={() => window.open(messengerLink, '_blank', 'noopener,noreferrer')}
               subtitle={
                  <>
                     Waiting… tap <b>Get Started</b> if Messenger asks
                  </>
               }
               title="Open Messenger again"
            />
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
         ) : (
            <div className="rounded-[18px] border border-dashed border-[#d9d2f7] bg-[#faf8ff] px-4 py-3 text-md-b3 text-[#594d65]">
               <p className="font-semibold text-[#4c239f]">Get due-date reminders on your phone</p>
               <p className="mt-1">
                  On iPhone: tap <b>Share</b> → <b>Add to Home Screen</b>, open Moodeng from there and turn on notifications. In the
                  Facebook app, open this page in Chrome or Safari instead.
               </p>
            </div>
         )}

         {pushError ? <p className="text-center text-md-b3 font-normal text-md-red-500">{pushError}</p> : null}

         <div className="mt-auto flex flex-col gap-1 pt-2">
            <PrimaryButton disabled={!canContinue} onClick={handleContinue}>
               Continue
            </PrimaryButton>
            {contactVerified && pushRequired && !pushOn ? (
               <p className="text-center text-md-b3 text-[#877897]">Turn on reminders to continue.</p>
            ) : null}
            <GhostButton onClick={onBack}>Back</GhostButton>
         </div>
      </div>
   );
}
