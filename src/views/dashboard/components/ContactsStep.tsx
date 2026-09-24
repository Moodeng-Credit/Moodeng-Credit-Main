import { type ReactNode, useEffect, useRef, useState } from 'react';

import { CheckCircle, Facebook, MessageCircle } from 'lucide-react';

import { buildMessengerVerifyLink, buildWhatsAppVerifyLink, WHATSAPP_VERIFY_ENABLED } from '@/config/contactVerification';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

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

const VerifiedBadge = () => (
   <div className="flex items-center gap-1.5 rounded-md-md bg-[#eefbf2] px-md-2 py-md-1 text-md-b3 font-normal text-[#178447]">
      <CheckCircle aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
      <span>Verified</span>
   </div>
);

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
   // Replaces the default "so we can reach you" line — e.g. the warmer ask for existing borrowers.
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

   const canContinue = whatsappVerified || messengerVerified;
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
      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain px-5 py-5 text-md-b2 text-md-heading">
         {intro ?? (
            <p className="text-[13px] font-normal leading-[18px] text-md-neutral-1200">
               So we can reach you if you ever need help — like withdrawing, or extending a loan.{' '}
               {showWhatsApp ? 'Verify WhatsApp or Facebook Messenger; either one is enough.' : 'Verify your Facebook Messenger.'} Only Moodeng
               sees this; it&apos;s never shown to lenders.
            </p>
         )}

         {showWhatsApp ? (
            <div className="flex flex-col gap-3 rounded-[16px] border border-[#ded6e8] bg-white p-4">
               <div className="flex items-center gap-2">
                  <MessageCircle className="size-5 shrink-0 text-[#25D366]" strokeWidth={2} aria-hidden="true" />
                  <span className="text-[15px] font-[590] leading-5 text-md-heading">WhatsApp</span>
                  {whatsappVerified ? null : <span className="text-[12px] font-normal text-md-neutral-1200">(one option)</span>}
               </div>

               {whatsappVerified ? (
                  <VerifiedBadge />
               ) : (
                  <>
                     <p className="text-[13px] font-normal leading-[18px] text-md-neutral-1200">
                        Tap below, then just hit send on WhatsApp — no code to type.
                     </p>
                     <button
                        className="w-fit rounded-[12px] bg-[#25D366] px-md-2 py-md-1 text-md-b2 font-semibold text-white transition duration-150 ease-out hover:bg-[#1fb958] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={startingChannel !== null}
                        onClick={() => handleVerify('whatsapp')}
                        type="button"
                     >
                        {startingChannel === 'whatsapp' ? 'Opening WhatsApp...' : 'Verify via WhatsApp'}
                     </button>
                  </>
               )}
            </div>
         ) : null}

         <div className="flex flex-col gap-3 rounded-[16px] border border-[#ded6e8] bg-white p-4">
            <div className="flex items-center gap-2">
               <Facebook className="size-5 shrink-0 text-[#0866FF]" strokeWidth={2} aria-hidden="true" />
               <span className="text-[15px] font-[590] leading-5 text-md-heading">Facebook Messenger</span>
               {messengerVerified || !showWhatsApp ? null : (
                  <span className="text-[12px] font-normal text-md-neutral-1200">(one option)</span>
               )}
            </div>

            {messengerVerified ? (
               <VerifiedBadge />
            ) : messengerLink ? (
               <>
                  <p className="text-[13px] font-normal leading-[18px] text-md-neutral-1200">
                     Waiting for Messenger… If it shows a <span className="font-[590] text-md-heading">Get Started</span> button, tap it.
                     The check appears here as soon as you&apos;re confirmed.
                  </p>
                  <button
                     className="w-fit rounded-[12px] border border-[#0866FF] bg-white px-md-2 py-md-1 text-md-b2 font-semibold text-[#0866FF] transition duration-150 ease-out hover:bg-[#eef4ff] active:scale-[0.97]"
                     onClick={() => window.open(messengerLink, '_blank', 'noopener,noreferrer')}
                     type="button"
                  >
                     Open Messenger again
                  </button>
               </>
            ) : (
               <>
                  <p className="text-[13px] font-normal leading-[18px] text-md-neutral-1200">
                     Tap below. Messenger opens and confirms you automatically — no code to type.
                  </p>
                  <button
                     className="w-fit rounded-[12px] bg-[#0866FF] px-md-2 py-md-1 text-md-b2 font-semibold text-white transition duration-150 ease-out hover:bg-[#0654d1] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
                     disabled={startingChannel !== null}
                     onClick={() => handleVerify('messenger')}
                     type="button"
                  >
                     {startingChannel === 'messenger' ? 'Opening Messenger...' : 'Verify via Messenger'}
                  </button>
               </>
            )}
         </div>

         {verifyError ? <p className="text-md-b3 font-normal text-md-red-500">{verifyError}</p> : null}

         <div className="mt-auto flex flex-col gap-2">
            <button
               className={`w-full rounded-md-lg px-md-4 py-md-3 text-md-b1 font-medium text-md-neutral-100 ${
                  canContinue
                     ? 'bg-md-primary-1200 transition duration-150 ease-out hover:bg-[#5200c8] active:scale-[0.98]'
                     : 'bg-md-neutral-600'
               }`}
               disabled={!canContinue}
               onClick={handleContinue}
               type="button"
            >
               Continue
            </button>
            <button
               className="w-full rounded-md-lg px-md-4 py-md-2 text-md-b2 font-medium text-md-neutral-1200 transition duration-150 ease-out hover:text-md-heading"
               onClick={onBack}
               type="button"
            >
               Back
            </button>
         </div>
      </div>
   );
}
