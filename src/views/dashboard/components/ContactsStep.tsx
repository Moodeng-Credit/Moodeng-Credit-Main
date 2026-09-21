import { useEffect, useRef, useState } from 'react';

import { CheckCircle, MessageCircle } from 'lucide-react';

import { buildWhatsAppVerifyLink } from '@/config/contactVerification';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// End-of-application "how we reach you" step: WhatsApp (verified) OR Facebook (collected only) —
// not everyone has WhatsApp, so either one is enough to continue. Platform-only, private — never
// shown to lenders. Sits between the bio step and the referral-gated video-call step in
// LoanRequestModal.
//
// The WhatsApp side never asks the borrower to type a code back. They tap a link that opens
// WhatsApp with a one-time code pre-filled and just hit send; our whatsapp-webhook edge function
// matches it server-side. This component polls users.whatsapp_verified_at rather than trusting
// anything the client says, since the client never actually proves the message was sent.
export default function ContactsStep({
   userId,
   onBack,
   onContinue
}: {
   userId: string;
   onBack: () => void;
   onContinue: () => void;
}) {
   const [facebookContact, setFacebookContact] = useState('');
   const [isVerified, setIsVerified] = useState(false);
   const [isStartingVerify, setIsStartingVerify] = useState(false);
   const [isSaving, setIsSaving] = useState(false);
   const [verifyError, setVerifyError] = useState('');
   const pollRef = useRef<number | null>(null);

   // Either channel is enough to continue: a verified WhatsApp number, or a filled-in Facebook
   // contact. Not everyone has WhatsApp, so we don't force it.
   const hasFacebook = facebookContact.trim().length > 0;
   const canContinue = isVerified || hasFacebook;

   // Pick up an already-verified number from a previous application — this is an account-level
   // fact, not a per-loan one, so a returning borrower shouldn't have to re-verify every time.
   useEffect(() => {
      let cancelled = false;
      (async () => {
         const { data } = await getSupabaseBrowserClient()
            .from('users')
            .select('whatsapp_verified_at, facebook_contact')
            .eq('id', userId)
            .maybeSingle();
         if (cancelled || !data) return;
         if (data.whatsapp_verified_at) setIsVerified(true);
         if (data.facebook_contact) setFacebookContact(data.facebook_contact);
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

   const handleVerifyWhatsApp = async () => {
      setVerifyError('');
      setIsStartingVerify(true);
      try {
         const { data: code, error } = await getSupabaseBrowserClient().rpc('start_whatsapp_verification');
         if (error || !code) throw error ?? new Error('No code returned');

         window.open(buildWhatsAppVerifyLink(code), '_blank', 'noopener,noreferrer');

         // Poll rather than wait for a page-visibility event — the borrower may switch apps for
         // a while before coming back, and we want the checkmark to appear the moment they do.
         stopPolling();
         pollRef.current = window.setInterval(async () => {
            const { data } = await getSupabaseBrowserClient()
               .from('users')
               .select('whatsapp_verified_at')
               .eq('id', userId)
               .maybeSingle();
            if (data?.whatsapp_verified_at) {
               setIsVerified(true);
               stopPolling();
            }
         }, 3000);
      } catch (err) {
         console.error('start_whatsapp_verification failed', err);
         setVerifyError("Couldn't start verification — try again in a moment.");
      } finally {
         setIsStartingVerify(false);
      }
   };

   const handleContinue = async () => {
      if (!canContinue || isSaving) return;
      setIsSaving(true);
      try {
         const trimmed = facebookContact.trim();
         if (trimmed) {
            await getSupabaseBrowserClient().from('users').update({ facebook_contact: trimmed }).eq('id', userId);
         }
         onContinue();
      } finally {
         setIsSaving(false);
      }
   };

   return (
      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain px-5 py-5 text-md-b2 text-md-heading">
         <p className="text-[13px] font-normal leading-[18px] text-md-neutral-1200">
            So we can reach you if you ever need help — like withdrawing, or extending a loan. Add WhatsApp or Facebook; either one is
            enough. Only Moodeng sees this; it's never shown to lenders.
         </p>

         <div className="flex flex-col gap-3 rounded-[16px] border border-[#ded6e8] bg-white p-4">
            <div className="flex items-center gap-2">
               <MessageCircle className="size-5 shrink-0 text-[#25D366]" strokeWidth={2} aria-hidden="true" />
               <span className="text-[15px] font-[590] leading-5 text-md-heading">WhatsApp</span>
               {isVerified ? null : <span className="text-[12px] font-normal text-md-neutral-1200">(one option)</span>}
            </div>

            {isVerified ? (
               <div className="flex items-center gap-1.5 rounded-md-md bg-[#eefbf2] px-md-2 py-md-1 text-md-b3 font-normal text-[#178447]">
                  <CheckCircle aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
                  <span>Verified</span>
               </div>
            ) : (
               <>
                  <p className="text-[13px] font-normal leading-[18px] text-md-neutral-1200">
                     Tap below, then just hit send on WhatsApp — no code to type.
                  </p>
                  <button
                     className="w-fit rounded-[12px] bg-[#25D366] px-md-2 py-md-1 text-md-b2 font-semibold text-white transition duration-150 ease-out hover:bg-[#1fb958] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
                     disabled={isStartingVerify}
                     onClick={handleVerifyWhatsApp}
                     type="button"
                  >
                     {isStartingVerify ? 'Opening WhatsApp...' : 'Verify via WhatsApp'}
                  </button>
                  {verifyError ? <p className="text-md-b3 font-normal text-md-red-500">{verifyError}</p> : null}
               </>
            )}
         </div>

         <div className="flex flex-col gap-3 rounded-[16px] border border-[#ded6e8] bg-white p-4">
            <div className="flex items-center gap-2">
               <span className="text-[15px] font-[590] leading-5 text-md-heading">Facebook</span>
               <span className="text-[12px] font-normal text-md-neutral-1200">(one option)</span>
            </div>
            <label className="sr-only" htmlFor="facebook-contact">
               Facebook profile link or name
            </label>
            <input
               className="min-w-0 flex-1 rounded-md-input border border-md-neutral-600 bg-md-neutral-100 px-md-3 py-md-2 text-md-b1 font-normal text-md-heading placeholder:text-md-neutral-1200 focus:border-md-primary-900 focus:outline-none focus:ring-2 focus:ring-md-primary-100"
               id="facebook-contact"
               onChange={(event) => setFacebookContact(event.target.value)}
               placeholder="facebook.com/yourname"
               type="text"
               value={facebookContact}
            />
         </div>

         <div className="mt-auto flex flex-col gap-2">
            <button
               className={`w-full rounded-md-lg px-md-4 py-md-3 text-md-b1 font-medium text-md-neutral-100 ${
                  canContinue && !isSaving
                     ? 'bg-md-primary-1200 transition duration-150 ease-out hover:bg-[#5200c8] active:scale-[0.98]'
                     : 'bg-md-neutral-600'
               }`}
               disabled={!canContinue || isSaving}
               onClick={handleContinue}
               type="button"
            >
               {isSaving ? 'Saving...' : 'Continue'}
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
