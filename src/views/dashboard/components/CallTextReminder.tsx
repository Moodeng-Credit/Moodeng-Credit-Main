import { useEffect, useState } from 'react';

import { clarityEvent } from '@/lib/analytics/clarity';
import { checkPhPhone } from '@/lib/phoneAuth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { GoldButton } from '@/views/indonesia/ui';

// "Get a text reminder" on the You're-booked screen: the call texted to their phone when it's booked
// and again 1 hour before (UniSMS, Philippine numbers; supabase/migrations/20261111220000_call_sms_reminders.sql).
// Phone sign-ups already have a number, so they just see where the text goes. Everyone else who books
// in Manila time can type one. Hidden when the switch is off or we couldn't text them anyway.

type Status = { enabled?: boolean; eligible?: boolean; number?: string | null };
type SaveResult = { ok?: boolean; error?: string; number?: string; texted?: boolean };

const ERRORS: Record<string, string> = {
   bad_phone: 'Enter a mobile number, like 0917 123 4567.',
   non_ph: 'Philippine numbers only for now.',
   network: 'Our texts don’t reach Smart, TNT or Sun yet. We’ll remind you on Messenger.',
   too_many: 'You changed your number too many times. We kept the last one.'
};
const TRY_AGAIN = 'That didn’t work. Try again.';

// Dev preview: /onboarding/connect-preview?view=pending&sms=ask|saved shows the card without an account.
const previewState = (): 'ask' | 'saved' | null => {
   if (!import.meta.env.DEV) return null;
   const v = new URLSearchParams(window.location.search).get('sms');
   return v === 'ask' || v === 'saved' ? v : null;
};

export default function CallTextReminder() {
   const preview = previewState();
   const [number, setNumber] = useState<string | null>(preview === 'saved' ? '0917 ••• 4567' : null);
   const [show, setShow] = useState(Boolean(preview));
   const [justSaved, setJustSaved] = useState(false);
   const [editing, setEditing] = useState(false);
   const [phone, setPhone] = useState('');
   const [error, setError] = useState('');
   const [busy, setBusy] = useState(false);

   useEffect(() => {
      if (preview) return;
      let cancelled = false;
      (async () => {
         const { data, error: failed } = await getSupabaseBrowserClient().rpc('call_sms_status');
         if (cancelled || failed) return;
         const s = (data ?? {}) as Status;
         setNumber(s.number ?? null);
         setShow(s.enabled === true && s.eligible === true);
      })();
      return () => {
         cancelled = true;
      };
   }, [preview]);

   const save = async () => {
      setError('');
      const check = checkPhPhone(phone);
      if (check.kind !== 'ok') {
         setError(check.kind === 'non_ph' ? ERRORS.non_ph : ERRORS.bad_phone);
         return;
      }
      if (preview) {
         setNumber('0917 ••• 4567');
         setJustSaved(true);
         setEditing(false);
         return;
      }
      setBusy(true);
      const { data, error: failed } = await getSupabaseBrowserClient().rpc('call_sms_save', { p_phone: check.e164 });
      setBusy(false);
      const r = (data ?? {}) as SaveResult;
      if (failed || !r.ok) {
         setError(ERRORS[r.error ?? ''] ?? TRY_AGAIN);
         return;
      }
      clarityEvent('call_text_reminder_saved');
      setNumber(r.number ?? null);
      setJustSaved(r.texted === true);
      setEditing(false);
      setPhone('');
   };

   if (!show) return null;

   if (number && !editing) {
      return (
         <div className="flex flex-col items-center gap-1 rounded-[18px] border-2 border-[#bfe5c8] bg-[#f1fbf3] px-4 py-3 text-center dark:border-[#2f5a3a] dark:bg-[#14241a]">
            <span className="text-[16px] font-bold text-[#2f7a3a] dark:text-[#8fe0a2]">{justSaved ? `✅ We just texted ${number}` : `📱 We’ll text ${number}`}</span>
            <span className="text-[14px] text-[#5d7a64] dark:text-[#a9cdb2]">{justSaved ? 'Next text: 1 hour before your call.' : '1 hour before your call.'}</span>
            <button className="text-[13px] font-semibold text-[#7b6b8c] underline dark:text-[#a99cbb]" onClick={() => setEditing(true)} type="button">
               Change number
            </button>
         </div>
      );
   }

   return (
      <div className="flex flex-col gap-3 rounded-[18px] border-2 border-[#ffd66b] bg-[#fff8e1] px-4 py-4 text-left dark:border-[#6b5416] dark:bg-[#241d0c]">
         <div className="flex flex-col">
            <span className="text-[18px] font-extrabold text-[#3b2f4a] dark:text-[#f5f0ff]">📱 Get a text reminder</span>
            <span className="text-[14px] text-[#7b6b8c] dark:text-[#b9adc9]">We text you 1 hour before your call.</span>
         </div>
         <label className="flex min-h-[52px] items-center gap-2 rounded-[16px] border-2 border-[#e5ddf0] bg-white px-4 dark:border-[#3a2d4f] dark:bg-[#17121F]">
            <span aria-hidden="true">🇵🇭</span>
            <input
               aria-label="Your mobile number"
               autoComplete="tel-national"
               className="min-w-0 flex-1 bg-transparent text-[17px] text-[#3b2f4a] outline-none dark:text-[#f5f0ff]"
               inputMode="tel"
               onChange={(e) => {
                  setPhone(e.target.value);
                  setError('');
               }}
               onKeyDown={(e) => {
                  if (e.key === 'Enter') void save();
               }}
               placeholder="0917 123 4567"
               type="tel"
               value={phone}
            />
         </label>
         {error ? (
            <p className="text-[14px] font-semibold text-[#c0392b] dark:text-[#ff9a8a]" role="alert">
               {error}
            </p>
         ) : null}
         <GoldButton busy={busy} disabled={phone.trim().length === 0} onClick={() => void save()}>
            Text me
         </GoldButton>
      </div>
   );
}
