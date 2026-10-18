import { useState } from 'react';

import posthog from 'posthog-js';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { OptionCard } from '@/views/dashboard/components/connectKit';

// Viber reminders, for borrowers without WhatsApp (George, 2026-10-19). They type their Viber number and
// that's it: no code to confirm, since codes would depend on the relay on George's Mac being on. The team
// hears about it on Telegram, and reminders go out from Moodeng's Viber (relay, or the team by hand).
// See supabase/migrations/20261019100000_viber_simple_optin.sql.
const track = (event: string, properties: Record<string, unknown>) => {
   try {
      posthog.capture(event, properties);
   } catch {
      // Analytics unavailable: the flow carries on.
   }
};

const VIBER_PURPLE = '#7360F2';

const viberIcon = <i aria-hidden="true" className="fab fa-viber text-[38px] leading-none" style={{ color: VIBER_PURPLE }} />;

const SAVE_ERRORS: Record<string, string> = {
   invalid_number: 'That number doesn’t look right. Use the one your Viber is on, like 0917 123 4567.',
   too_many: 'Too many number changes today. Try again tomorrow, or message us on Messenger.'
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
   const [step, setStep] = useState<'idle' | 'number'>('idle');
   const [phone, setPhone] = useState('');
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

   const save = async () => {
      if (busy) return;
      setBusy(true);
      setError('');
      try {
         const { data, error: rpcError } = await getSupabaseBrowserClient().rpc('set_my_viber_number', { p_phone: phone });
         if (rpcError) throw rpcError;
         if (data !== 'ok') {
            setError(SAVE_ERRORS[String(data)] ?? 'Couldn’t save your number. Try again in a moment.');
            return;
         }
         track('contact_viber_reminders_on', { source });
         onVerified();
      } catch (err) {
         console.error('save Viber number failed', err);
         setError('Couldn’t save your number. Try again in a moment.');
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

         <label className="text-[14px] leading-[19px] text-[#4f4566]" htmlFor="viber-number">
            Your Viber number. We’ll send your payment reminders there.
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
            onClick={() => void save()}
            style={{ backgroundColor: VIBER_PURPLE }}
            type="button"
         >
            {busy ? 'Saving…' : 'Turn on Viber reminders'}
         </button>
         {error ? <p className="text-[14px] leading-[19px] text-md-red-500">{error}</p> : null}
      </div>
   );
}
