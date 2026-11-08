import { type JSX, useState } from 'react';

import type { IdStepKey } from '@/lib/idTrack';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { type IdLang, pick } from '@/views/indonesia/idFlow';

/**
 * Under steps that need the camera or file uploads: if they don't work in Facebook's / TikTok's
 * browser, the bot sends a signed-in button for this step, which opens in Telegram's own browser
 * (loan-access id_step + continueInTelegram → _shared/idTrack.ts 'continue_in_telegram').
 */

const COPY = {
   id: {
      ask: (what: string) => `${what} tidak jalan di sini?`,
      camera: 'Kamera',
      upload: 'Unggah file',
      cta: 'Lanjut di Telegram',
      sent: '✅ Cek Telegram — Moodeng sudah kirim tombolnya.',
      failed: 'Gagal mengirim. Coba lagi.'
   },
   en: {
      ask: (what: string) => `${what} not working here?`,
      camera: 'Camera',
      upload: 'Uploading',
      cta: 'Continue in Telegram',
      sent: '✅ Check Telegram — Moodeng sent you the button.',
      failed: 'Couldn’t send. Try again.'
   }
};

export default function ContinueInTelegram({ step, lang }: { step: IdStepKey; lang: IdLang }): JSX.Element {
   const t = pick(lang, COPY);
   const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

   const send = async () => {
      if (state === 'sending') return;
      setState('sending');
      const { data, error } = await getSupabaseBrowserClient().functions.invoke('loan-access', {
         body: { action: 'id_step', step, continueInTelegram: true }
      });
      setState(!error && (data as { sent?: boolean } | null)?.sent ? 'sent' : 'failed');
   };

   if (state === 'sent') {
      return <p className="text-center text-[15px] font-semibold text-[#1f7a3d] dark:text-[#7ee2a0]">{t.sent}</p>;
   }
   return (
      <p className="text-center text-[14px] text-[#7a6a4f] dark:text-[#bfb29a]">
         {t.ask(step === 'kyc' ? t.camera : t.upload)}{' '}
         <button
            type="button"
            onClick={() => void send()}
            disabled={state === 'sending'}
            className="font-bold text-[#229ED9] underline disabled:opacity-60"
         >
            {t.cta}
         </button>
         {state === 'failed' ? <span className="block text-[#b42318]">{t.failed}</span> : null}
      </p>
   );
}
