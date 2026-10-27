import { useState } from 'react';

import posthog from 'posthog-js';

import { checkPhPhone, formatPhPhone, SMS_CODE_LENGTH, SMS_NON_PH_MESSAGE } from '@/lib/phoneAuth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { CONNECT_HIPPOS, ConnectHero, GhostButton, PrimaryButton } from '@/views/dashboard/components/connectKit';

// TikTok sign-ups have no email or phone (TikTok shares neither), so before Messenger they add a
// Philippine mobile number for loan updates: texted a code, confirmed the same way as Account settings'
// "Add a phone number" (updateUser + phone_change), which also lets them log in by SMS later. Ticking
// WhatsApp saves whatsapp_opt_in on their profile metadata so the team can message them there too.
// Not in the Philippines (SMS codes are PH-only): skip — Indonesia's next step is WhatsApp anyway.

const skipKey = (userId: string) => `moodeng:tiktok-phone-skipped:${userId}`;

export const wasTikTokPhoneSkipped = (userId: string) => {
   try {
      return localStorage.getItem(skipKey(userId)) === '1';
   } catch {
      return false;
   }
};

const track = (event: string, props: Record<string, unknown> = {}) => {
   if (import.meta.env.PROD) posthog.capture(event, props);
};

export default function TikTokPhoneStep({
   userId,
   onDone,
   preview = false
}: {
   userId: string;
   onDone: () => void;
   /** Dev preview (/onboarding/connect-preview?view=tiktok-phone): screens only, nothing is sent. */
   preview?: boolean;
}) {
   const [stage, setStage] = useState<'phone' | 'code'>('phone');
   const [phone, setPhone] = useState('');
   const [e164, setE164] = useState('');
   const [code, setCode] = useState('');
   const [whatsapp, setWhatsapp] = useState(true);
   const [error, setError] = useState('');
   const [busy, setBusy] = useState(false);

   const sendCode = async () => {
      setError('');
      const check = checkPhPhone(phone);
      if (check.kind === 'non_ph') {
         setError(SMS_NON_PH_MESSAGE.replace('Use your email instead', 'Not in the Philippines? Tap Skip below'));
         return;
      }
      if (check.kind !== 'ok') {
         setError('Enter a Philippine mobile number, like 0917 123 4567.');
         return;
      }
      if (preview) {
         setE164(check.e164);
         setStage('code');
         return;
      }
      setBusy(true);
      const { error: updateError } = await getSupabaseBrowserClient().auth.updateUser({ phone: check.e164 });
      setBusy(false);
      if (updateError) {
         const taken = updateError.code === 'phone_exists' || /already (been )?registered|already exists/i.test(updateError.message ?? '');
         setError(taken ? 'This number already has a Moodeng account.' : updateError.message || 'Could not send a code. Try again in a minute.');
         track('tiktok_phone_code_failed', { taken });
         return;
      }
      setE164(check.e164);
      setStage('code');
      track('tiktok_phone_code_sent');
   };

   const confirmCode = async () => {
      setError('');
      if (code.length < SMS_CODE_LENGTH) {
         setError('Enter the code from the text message.');
         return;
      }
      if (preview) return onDone();
      setBusy(true);
      const supabase = getSupabaseBrowserClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({ phone: e164, token: code, type: 'phone_change' });
      if (verifyError) {
         setBusy(false);
         setError('That code did not work. Check the latest text from Moodeng.');
         return;
      }
      await supabase.auth.updateUser({ data: { whatsapp_opt_in: whatsapp } });
      setBusy(false);
      track('tiktok_phone_confirmed', { whatsapp });
      onDone();
   };

   const skip = () => {
      try {
         localStorage.setItem(skipKey(userId), '1');
      } catch {
         // Private mode: they'll just see the step again next time.
      }
      track('tiktok_phone_skipped');
      onDone();
   };

   return (
      <div className="flex min-h-0 flex-1 flex-col px-5 pt-5">
         <ConnectHero
            image={CONNECT_HIPPOS.notifications}
            subtitle={
               stage === 'phone'
                  ? 'TikTok doesn’t share your number, so add it here for loan updates and reminders.'
                  : `Enter the ${SMS_CODE_LENGTH}-digit code we texted to ${formatPhPhone(e164)}.`
            }
            title={stage === 'phone' ? 'Where should we text you?' : 'Check your texts'}
         />

         <div className="mt-5 flex flex-col gap-3">
            {stage === 'phone' ? (
               <>
                  <label className="flex min-h-[56px] items-center gap-2 rounded-[16px] border-2 border-[#e5ddf0] bg-white px-4 dark:border-[#3a2d4f] dark:bg-[#17121F]">
                     <span aria-hidden="true">🇵🇭</span>
                     <span className="text-[17px] font-bold text-[#3b2f4a] dark:text-[#f5f0ff]">+63</span>
                     <input
                        aria-label="Philippine mobile number"
                        autoComplete="tel-national"
                        className="min-w-0 flex-1 bg-transparent text-[17px] text-[#3b2f4a] outline-none dark:text-[#f5f0ff]"
                        inputMode="tel"
                        onChange={(e) => {
                           setPhone(e.target.value);
                           setError('');
                        }}
                        placeholder="917 123 4567"
                        type="tel"
                        value={phone}
                     />
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-[16px] border-2 border-[#e5ddf0] bg-white px-4 py-3 dark:border-[#3a2d4f] dark:bg-[#17121F]">
                     <input
                        checked={whatsapp}
                        className="size-5 accent-[#25D366]"
                        onChange={(e) => setWhatsapp(e.target.checked)}
                        type="checkbox"
                     />
                     <span className="text-[15px] leading-5 text-[#3b2f4a] dark:text-[#f5f0ff]">
                        Also message me on <b>WhatsApp</b> at this number
                     </span>
                  </label>
               </>
            ) : (
               <input
                  aria-label="Code from the text message"
                  autoComplete="one-time-code"
                  className="min-h-[56px] w-full rounded-[16px] border-2 border-[#e5ddf0] bg-white px-4 text-center text-[22px] font-bold tracking-[0.3em] text-[#3b2f4a] outline-none dark:border-[#3a2d4f] dark:bg-[#17121F] dark:text-[#f5f0ff]"
                  inputMode="numeric"
                  onChange={(e) => {
                     setCode(e.target.value.replace(/\D/g, '').slice(0, SMS_CODE_LENGTH));
                     setError('');
                  }}
                  placeholder={'•'.repeat(SMS_CODE_LENGTH)}
                  type="text"
                  value={code}
               />
            )}
            {error ? <p className="text-center text-sm font-medium leading-5 text-[#B91C1C]">{error}</p> : null}
         </div>

         <div className="mt-auto flex flex-col gap-2 pb-6 pt-6">
            <PrimaryButton disabled={busy} onClick={stage === 'phone' ? sendCode : confirmCode}>
               {busy ? 'Please wait…' : stage === 'phone' ? 'Text me a code' : 'Confirm'}
            </PrimaryButton>
            {stage === 'code' ? (
               <GhostButton
                  onClick={() => {
                     setStage('phone');
                     setCode('');
                     setError('');
                  }}
               >
                  Change number
               </GhostButton>
            ) : (
               <GhostButton onClick={skip}>Not in the Philippines? Skip</GhostButton>
            )}
         </div>
      </div>
   );
}
