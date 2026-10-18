import { useState } from 'react';

import posthog from 'posthog-js';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { OptionCard } from '@/views/dashboard/components/connectKit';

// Viber reminders, for borrowers without WhatsApp (George, 2026-10-19). They type their Viber number,
// we send a 6-digit code to it over Viber (from Moodeng's own Viber account, through the relay on
// George's Mac), and they type the code back here. See supabase/migrations/20261019090000_viber_reminders.sql.
const track = (event: string, properties: Record<string, unknown>) => {
   try {
      posthog.capture(event, properties);
   } catch {
      // Analytics unavailable: the flow carries on.
   }
};

const VIBER_PURPLE = '#7360F2';

const viberIcon = <i aria-hidden="true" className="fab fa-viber text-[38px] leading-none" style={{ color: VIBER_PURPLE }} />;

const START_ERRORS: Record<string, string> = {
   invalid_number: 'That number doesn’t look right. Use the one your Viber is on, like 0917 123 4567.',
   too_many: 'Too many codes for now. Try again in an hour.'
};

const CONFIRM_ERRORS: Record<string, string> = {
   wrong_code: 'That code isn’t right. Check the Viber message and try again.',
   expired: 'That code expired. Tap “Send a new code”.',
   no_code: 'Tap “Send a new code” first.'
};

export default function ViberRemindersCard({
   source,
   verified,
   onVerified
}: {
   source: string;
   verified: boolean;
   onVerified: () => void;
}) {
   const [step, setStep] = useState<'idle' | 'number' | 'code'>('idle');
   const [phone, setPhone] = useState('');
   const [code, setCode] = useState('');
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState('');

   if (verified) {
      return <OptionCard done doneLabel="On" icon={viberIcon} title="Viber reminders" />;
   }

   if (step === 'idle') {
      return (
         <OptionCard
            badge="Recommended"
            icon={viberIcon}
            onClick={() => {
               track('contact_viber_reminders_tapped', { source });
               setStep('number');
            }}
            subtitle="No WhatsApp? We’ll remind you on Viber before your due date."
            title="Get reminders on Viber"
         />
      );
   }

   const sendCode = async () => {
      if (busy) return;
      setBusy(true);
      setError('');
      try {
         const { data, error: rpcError } = await getSupabaseBrowserClient().rpc('start_viber_verification', { p_phone: phone });
         if (rpcError) throw rpcError;
         if (data !== 'ok') {
            setError(START_ERRORS[String(data)] ?? 'Couldn’t send the code. Try again in a moment.');
            return;
         }
         track('contact_viber_code_requested', { source });
         setCode('');
         setStep('code');
      } catch (err) {
         console.error('start Viber reminders failed', err);
         setError('Couldn’t send the code. Try again in a moment.');
      } finally {
         setBusy(false);
      }
   };

   const confirm = async () => {
      if (busy) return;
      setBusy(true);
      setError('');
      try {
         const { data, error: rpcError } = await getSupabaseBrowserClient().rpc('confirm_viber_verification', { p_code: code });
         if (rpcError) throw rpcError;
         if (data !== 'ok') {
            setError(CONFIRM_ERRORS[String(data)] ?? 'Couldn’t check the code. Try again.');
            return;
         }
         track('contact_viber_reminders_on', { source });
         onVerified();
      } catch (err) {
         console.error('confirm Viber reminders failed', err);
         setError('Couldn’t check the code. Try again.');
      } finally {
         setBusy(false);
      }
   };

   const input =
      'w-full rounded-xl border-2 border-[#d9d0ee] bg-white px-3 py-3 text-[18px] text-md-heading outline-none focus:border-[#7360F2]';
   const button = 'flex min-h-[52px] w-full items-center justify-center rounded-full px-4 text-[16px] font-bold text-white disabled:opacity-60';

   return (
      <div aria-live="polite" className="flex w-full flex-col gap-3 rounded-[18px] border-2 border-[#cfc6fb] bg-[#f4f1ff] px-4 py-4 text-left">
         <span className="flex items-center gap-2 text-[18px] font-bold leading-[22px] text-[#4b3bb5]">
            <i aria-hidden="true" className="fab fa-viber text-[22px] leading-none" style={{ color: VIBER_PURPLE }} />
            Viber reminders
         </span>

         {step === 'number' ? (
            <>
               <label className="text-[14px] leading-[19px] text-[#4f4566]" htmlFor="viber-number">
                  Your Viber number
               </label>
               <input
                  autoComplete="tel"
                  className={input}
                  id="viber-number"
                  inputMode="tel"
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0917 123 4567"
                  type="tel"
                  value={phone}
               />
               <button
                  className={button}
                  disabled={busy || phone.replace(/\D/g, '').length < 8}
                  onClick={() => void sendCode()}
                  style={{ backgroundColor: VIBER_PURPLE }}
                  type="button"
               >
                  {busy ? 'Sending…' : 'Send my code on Viber'}
               </button>
            </>
         ) : (
            <>
               <p className="text-[14px] leading-[19px] text-[#4f4566]">
                  We sent a code to <b className="whitespace-nowrap">{phone}</b> on Viber, from <b>Moodeng Credit</b>. It can take a minute.
               </p>
               <input
                  autoComplete="one-time-code"
                  className={`${input} text-center tracking-[0.3em]`}
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  value={code}
               />
               <button
                  className={button}
                  disabled={busy || code.length !== 6}
                  onClick={() => void confirm()}
                  style={{ backgroundColor: VIBER_PURPLE }}
                  type="button"
               >
                  {busy ? 'Checking…' : 'Turn on Viber reminders'}
               </button>
               <div className="flex justify-between text-[13px] font-semibold text-[#6b5fa8]">
                  <button className="underline" disabled={busy} onClick={() => void sendCode()} type="button">
                     Send a new code
                  </button>
                  <button
                     className="underline"
                     onClick={() => {
                        setError('');
                        setStep('number');
                     }}
                     type="button"
                  >
                     Change number
                  </button>
               </div>
            </>
         )}
         {error ? <p className="text-[14px] leading-[19px] text-md-red-500">{error}</p> : null}
      </div>
   );
}
