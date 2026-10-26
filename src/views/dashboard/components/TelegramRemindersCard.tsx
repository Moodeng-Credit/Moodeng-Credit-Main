import { useCallback, useEffect, useRef, useState } from 'react';

import posthog from 'posthog-js';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { OptionCard } from '@/views/dashboard/components/connectKit';

// Telegram reminders, for borrowers without WhatsApp (George, 2026-10-19). Same link as Account
// Settings → Connect Telegram: create-telegram-connect-link makes a one-time t.me/<bot>?start=connect_…
// link; tapping Start in Telegram makes the bot (telegram-webhook) save users.chat_id, and due-date
// reminders already go to every linked chat (borrower_notifications_enabled). The card polls chat_id.
const track = (event: string, properties: Record<string, unknown>) => {
   try {
      posthog.capture(event, properties);
   } catch {
      // Analytics unavailable: the flow carries on.
   }
};

const TELEGRAM_BLUE = '#229ED9';
const POLL_MS = 3_000;

const telegramIcon = <i aria-hidden="true" className="fab fa-telegram text-[38px] leading-none" style={{ color: TELEGRAM_BLUE }} />;

export default function TelegramRemindersCard({
   userId,
   source,
   verified,
   onVerified
}: {
   userId: string;
   source: string;
   verified: boolean;
   onVerified: () => void;
}) {
   const [link, setLink] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState('');
   const pollRef = useRef<number | null>(null);

   const stopPolling = () => {
      if (pollRef.current !== null) {
         window.clearInterval(pollRef.current);
         pollRef.current = null;
      }
   };
   useEffect(() => stopPolling, []);

   const check = useCallback(async () => {
      const { data } = await getSupabaseBrowserClient().from('users').select('chat_id').eq('id', userId).maybeSingle();
      if (data?.chat_id) {
         stopPolling();
         track('contact_telegram_reminders_on', { source });
         onVerified();
      }
   }, [userId, source, onVerified]);

   // Back from Telegram: browsers freeze timers in the background, so check the moment they return.
   useEffect(() => {
      if (!link || verified) return;
      const onVisible = () => {
         if (document.visibilityState === 'visible') void check();
      };
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', onVisible);
      return () => {
         document.removeEventListener('visibilitychange', onVisible);
         window.removeEventListener('focus', onVisible);
      };
   }, [link, verified, check]);

   if (verified) {
      return <OptionCard done doneLabel="On" icon={telegramIcon} title="Telegram reminders" />;
   }

   const start = async () => {
      if (busy) return;
      setBusy(true);
      setError('');
      track('contact_telegram_reminders_tapped', { source });
      try {
         const { data, error: fnError } = await getSupabaseBrowserClient().functions.invoke('create-telegram-connect-link', { body: {} });
         if (fnError || !data?.url) throw fnError ?? new Error('No link');
         setLink(String(data.url));
         stopPolling();
         pollRef.current = window.setInterval(() => void check(), POLL_MS);
      } catch (err) {
         console.error('Telegram connect link failed', err);
         setError('Couldn’t start. Try again in a moment.');
      } finally {
         setBusy(false);
      }
   };

   if (!link) {
      return (
         <>
            <OptionCard
               badge="Recommended"
               disabled={busy}
               icon={telegramIcon}
               onClick={() => void start()}
               subtitle={busy ? 'Getting your link…' : 'We’ll remind you on Telegram before your due date.'}
               title="Telegram reminders"
            />
            {error ? <p className="text-center text-md-b3 font-normal text-md-red-500">{error}</p> : null}
         </>
      );
   }

   return (
      <div aria-live="polite" className="flex w-full flex-col gap-3 rounded-[18px] border-2 border-[#b9e2f5] bg-[#eef8fd] px-4 py-4 text-left">
         <span className="flex items-center gap-2 text-[18px] font-bold leading-[22px] text-[#1b6f99]">
            <i aria-hidden="true" className="fab fa-telegram text-[22px] leading-none" style={{ color: TELEGRAM_BLUE }} />
            Telegram reminders
         </span>
         {/* A real link they tap: opened from script, in-app browsers often show the t.me web page instead. */}
         <a
            className="flex min-h-[52px] items-center justify-center rounded-full px-4 text-[16px] font-bold text-white"
            href={link}
            onClick={() => track('contact_telegram_reminders_open_tapped', { source })}
            rel="noopener noreferrer"
            style={{ backgroundColor: TELEGRAM_BLUE }}
            target="_blank"
         >
            Open Telegram and tap Start
         </a>
         <p className="text-[13px] leading-[17px] text-[#4f6b7a]">Keep this screen open. It turns green as soon as you tap Start.</p>
      </div>
   );
}
