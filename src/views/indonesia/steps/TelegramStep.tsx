import { useEffect, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { CONNECT_HIPPOS } from '@/views/dashboard/components/connectKit';
import { pick } from '@/views/indonesia/idFlow';
import type { IdStepProps } from '@/views/indonesia/steps/types';
import { AppIcon, DoneRow, ErrorText, GoldButton, GoldLink, StepHead, WaitRow } from '@/views/indonesia/ui';

// Step 1: our Telegram bot can message them (users.chat_id). Telegram login with request_access=write
// usually sets it already; if they said no there, a one-time t.me/<bot>?start=connect_… link does it
// (create-telegram-connect-link, the same link as Account Settings → Connect Telegram).

const COPY = {
   id: {
      title: 'Izinkan bot Moodeng',
      subtitle: 'Supaya kami bisa kirim pesan ke kamu di Telegram.',
      start: 'Hubungkan Telegram',
      getting: 'Menyiapkan link…',
      open: 'Buka Telegram, tekan Start',
      waiting: 'Menunggu kamu tekan Start…',
      done: 'Bot Moodeng bisa kirim pesan ke kamu',
      next: 'Lanjut',
      error: 'Gagal. Coba lagi sebentar lagi.'
   },
   en: {
      title: 'Allow the Moodeng bot',
      subtitle: 'So we can message you on Telegram.',
      start: 'Connect Telegram',
      getting: 'Getting your link…',
      open: 'Open Telegram, tap Start',
      waiting: 'Waiting for you to tap Start…',
      done: 'The Moodeng bot can message you',
      next: 'Continue',
      error: 'Couldn’t start. Try again in a moment.'
   }
};

export default function TelegramStep({ data, lang, refresh, onDone }: IdStepProps) {
   const t = pick(lang, COPY);
   const [link, setLink] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState('');
   const done = data.steps.telegram;

   // Back from Telegram: timers sleep in the background, so check the moment they return.
   useEffect(() => {
      if (!link || done) return undefined;
      const onVisible = () => {
         if (document.visibilityState === 'visible') void refresh();
      };
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', onVisible);
      return () => {
         document.removeEventListener('visibilitychange', onVisible);
         window.removeEventListener('focus', onVisible);
      };
   }, [link, done, refresh]);

   const start = async () => {
      if (busy) return;
      setBusy(true);
      setError('');
      try {
         const { data: res, error: fnError } = await getSupabaseBrowserClient().functions.invoke('create-telegram-connect-link', {
            body: {}
         });
         if (fnError || !res?.url) throw fnError ?? new Error('No link');
         setLink(String(res.url));
      } catch (err) {
         console.error('[IdOnboarding] Telegram connect link failed', err);
         setError(t.error);
      } finally {
         setBusy(false);
      }
   };

   return (
      <>
         <StepHead image={CONNECT_HIPPOS.hello} title={t.title} subtitle={done ? undefined : t.subtitle} />
         {done ? (
            <>
               <DoneRow>{t.done}</DoneRow>
               <GoldButton onClick={onDone}>{t.next}</GoldButton>
            </>
         ) : link ? (
            <>
               {/* A real link they tap: opened from script, in-app browsers often show the t.me web page. */}
               <GoldLink href={link} rel="noopener noreferrer" target="_blank">
                  <AppIcon app="telegram" className="text-[24px]" />
                  {t.open}
               </GoldLink>
               <WaitRow>{t.waiting}</WaitRow>
            </>
         ) : (
            <>
               <GoldButton busy={busy} onClick={() => void start()}>
                  {busy ? t.getting : t.start}
               </GoldButton>
               <ErrorText>{error}</ErrorText>
            </>
         )}
      </>
   );
}
