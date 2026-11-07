import { useCallback, useEffect, useRef, useState } from 'react';

import { buildWhatsAppVerifyLink, WHATSAPP_BUSINESS_NUMBER_DISPLAY } from '@/config/contactVerification';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { CONNECT_HIPPOS } from '@/views/dashboard/components/connectKit';
import { formatIdMobile, inputClass, isIdMobile, normalizeIdMobile, pick } from '@/views/indonesia/idFlow';
import type { IdStepProps } from '@/views/indonesia/steps/types';
import { AppIcon, DoneRow, ErrorText, GoldButton, GoldLink, SoftButton, StepHead, WaitRow } from '@/views/indonesia/ui';

// Step 2: a verified Indonesian (+62) WhatsApp number. They type their number (only to check it looks
// right — it's saved nowhere), then send "Verify my Moodeng account: MDNG-…" from WhatsApp itself
// (start_whatsapp_verification + the same wa.me link as WhatsAppRemindersCard). The number that SENT
// the code is the one that counts, and the server only accepts it when it starts with 62.

const COPY = {
   id: {
      title: 'Hubungkan WhatsApp',
      subtitle: 'Nomor Indonesia (+62).',
      label: 'Nomor WhatsApp kamu',
      invalid: 'Nomor tidak valid. Contoh: 812 3456 7890',
      send: 'Kirim kode lewat WhatsApp',
      getting: 'Menyiapkan kode…',
      open: 'Buka WhatsApp, tekan kirim',
      fromNumber: (n: string) => `Kirim dari ${n}.`,
      manual: 'WhatsApp tidak terbuka? Kirim kode ini ke',
      copy: 'Salin',
      copied: 'Tersalin',
      waiting: 'Menunggu pesan kamu…',
      wrongNumber: 'Pakai nomor Indonesia (+62). Kirim lagi dari nomor +62.',
      verifiedWith: (n: string) => `Terverifikasi dengan ${n}`,
      done: (n: string) => `WhatsApp terhubung${n ? `: ${n}` : ''}`,
      change: 'Ganti nomor',
      next: 'Lanjut',
      error: 'Gagal. Coba lagi sebentar lagi.'
   },
   en: {
      title: 'Connect WhatsApp',
      subtitle: 'An Indonesian number (+62).',
      label: 'Your WhatsApp number',
      invalid: 'That number doesn’t look right. Example: 812 3456 7890',
      send: 'Send a code on WhatsApp',
      getting: 'Getting your code…',
      open: 'Open WhatsApp, tap send',
      fromNumber: (n: string) => `Send it from ${n}.`,
      manual: 'WhatsApp didn’t open? Send this code to',
      copy: 'Copy',
      copied: 'Copied',
      waiting: 'Waiting for your message…',
      wrongNumber: 'Use an Indonesian number (+62). Send it again from a +62 number.',
      verifiedWith: (n: string) => `Verified with ${n}`,
      done: (n: string) => `WhatsApp connected${n ? `: ${n}` : ''}`,
      change: 'Use another number',
      next: 'Continue',
      error: 'Couldn’t start. Try again in a moment.'
   }
};

const POLL_MS = 4_000;

type WhatsAppRow = { whatsapp_number: string | null; whatsapp_verified_at: string | null };

const readWhatsApp = async (userId: string): Promise<WhatsAppRow | null> => {
   const { data } = await getSupabaseBrowserClient()
      .from('users')
      .select('whatsapp_number, whatsapp_verified_at')
      .eq('id', userId)
      .maybeSingle();
   return (data as WhatsAppRow | null) ?? null;
};

const isIndonesianNumber = (number: string | null | undefined) => (number ?? '').replace(/\D/g, '').startsWith('62');

export default function WhatsAppStep({ data, user, lang, refresh, onDone }: IdStepProps) {
   const t = pick(lang, COPY);
   const done = data.steps.whatsapp;
   const [typed, setTyped] = useState('');
   const [typedError, setTypedError] = useState('');
   const [code, setCode] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState('');
   const [copied, setCopied] = useState(false);
   const [row, setRow] = useState<WhatsAppRow | null>(null);
   // A verification stamped before this code doesn't count (e.g. an old non-+62 one).
   const verifiedBeforeRef = useRef<string | null>(null);

   const check = useCallback(async () => {
      const next = await readWhatsApp(user.id);
      setRow(next);
      if (next?.whatsapp_verified_at && next.whatsapp_verified_at !== verifiedBeforeRef.current) void refresh();
   }, [user.id, refresh]);

   // Show who it's connected with (done), or that an earlier code came from a non-+62 number.
   useEffect(() => {
      void readWhatsApp(user.id).then(setRow);
   }, [user.id, done]);

   // Waiting for their message: watch for the stamp (and re-check the moment they're back from WhatsApp).
   useEffect(() => {
      if (!code || done) return undefined;
      const timer = window.setInterval(() => void check(), POLL_MS);
      const onVisible = () => {
         if (document.visibilityState === 'visible') void check();
      };
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', onVisible);
      return () => {
         window.clearInterval(timer);
         document.removeEventListener('visibilitychange', onVisible);
         window.removeEventListener('focus', onVisible);
      };
   }, [code, done, check]);

   const digits = normalizeIdMobile(typed);
   const freshVerification = Boolean(row?.whatsapp_verified_at) && row?.whatsapp_verified_at !== verifiedBeforeRef.current;
   // Verified, but from a number that isn't Indonesian: the step stays open.
   const wrongNumber =
      !done && Boolean(row?.whatsapp_verified_at) && !isIndonesianNumber(row?.whatsapp_number) && (freshVerification || !code);

   const start = async () => {
      if (busy) return;
      if (!isIdMobile(digits)) {
         setTypedError(t.invalid);
         return;
      }
      setTypedError('');
      setError('');
      setBusy(true);
      try {
         const current = await readWhatsApp(user.id);
         verifiedBeforeRef.current = current?.whatsapp_verified_at ?? null;
         const { data: newCode, error: rpcError } = await getSupabaseBrowserClient().rpc('start_whatsapp_verification');
         if (rpcError || !newCode) throw rpcError ?? new Error('No code returned');
         // No automatic open: the link below is a real tap, which in-app browsers hand to WhatsApp.
         setCode(String(newCode));
      } catch (err) {
         console.error('[IdOnboarding] start_whatsapp_verification failed', err);
         setError(t.error);
      } finally {
         setBusy(false);
      }
   };

   const copyCode = async () => {
      if (!code) return;
      try {
         await navigator.clipboard.writeText(code);
         setCopied(true);
         window.setTimeout(() => setCopied(false), 2000);
      } catch {
         // Clipboard blocked: the code is on screen to type.
      }
   };

   if (done) {
      return (
         <>
            <StepHead image={CONNECT_HIPPOS.whatsapp} title={t.title} />
            <DoneRow>{t.done(row?.whatsapp_number ? formatIdMobile(row.whatsapp_number) : '')}</DoneRow>
            <GoldButton onClick={onDone}>{t.next}</GoldButton>
         </>
      );
   }

   return (
      <>
         <StepHead image={CONNECT_HIPPOS.whatsapp} title={t.title} subtitle={t.subtitle} />

         {wrongNumber ? (
            <p className="rounded-[14px] bg-[#fff1ef] px-4 py-3 text-[15px] font-bold text-[#a3321f] dark:bg-[#3a1a18] dark:text-[#ffb4a6]">
               ⚠️ {t.wrongNumber}
               {row?.whatsapp_number ? (
                  <span className="mt-1 block text-[13px] font-semibold opacity-80">
                     {t.verifiedWith(`+${row.whatsapp_number.replace(/\D/g, '')}`)}
                  </span>
               ) : null}
            </p>
         ) : null}

         {code ? (
            <>
               <GoldLink href={buildWhatsAppVerifyLink(code)} rel="noopener noreferrer" target="_blank">
                  <AppIcon app="whatsapp" className="text-[24px]" />
                  {t.open}
               </GoldLink>
               <p className="text-center text-[15px] font-semibold text-[#5a4a2f] dark:text-[#d8cbb0]">
                  {t.fromNumber(formatIdMobile(digits))}
               </p>
               {wrongNumber ? null : <WaitRow>{t.waiting}</WaitRow>}
               <div className="flex flex-col gap-2 rounded-[16px] bg-[#eefbf2] px-4 py-3 dark:bg-[#12301e]">
                  <p className="text-[14px] leading-[19px] text-[#3f5a47] dark:text-[#a8d8b5]">
                     {t.manual} <b className="whitespace-nowrap">{WHATSAPP_BUSINESS_NUMBER_DISPLAY}</b>
                  </p>
                  <div className="flex items-center gap-2">
                     <code className="flex-1 rounded-lg bg-white px-3 py-2 text-center text-[20px] font-bold tracking-wide text-[#2b2116] dark:bg-[#0c1f13] dark:text-white">
                        {code}
                     </code>
                     <button
                        className="rounded-lg border border-[#9fe3b4] bg-white px-3 py-2 text-[14px] font-bold text-[#1f7a3d] dark:bg-transparent dark:text-[#8fe3a8]"
                        onClick={() => void copyCode()}
                        type="button"
                     >
                        {copied ? t.copied : t.copy}
                     </button>
                  </div>
               </div>
               <SoftButton onClick={() => setCode(null)}>{t.change}</SoftButton>
            </>
         ) : (
            <>
               <label className="flex flex-col gap-1.5 text-[15px] font-bold">
                  {t.label}
                  <div className="flex items-stretch gap-2">
                     <span className="flex min-h-[52px] items-center rounded-[14px] border-2 border-[#ecdfb8] bg-[#fff6dc] px-3 text-[18px] font-bold dark:border-[#3a3048] dark:bg-[#2a220f]">
                        🇮🇩 +62
                     </span>
                     <input
                        autoComplete="tel-national"
                        className={inputClass}
                        inputMode="numeric"
                        maxLength={18}
                        onChange={(e) => {
                           setTyped(e.target.value);
                           setTypedError('');
                        }}
                        placeholder="812 3456 7890"
                        type="tel"
                        value={typed}
                     />
                  </div>
               </label>
               <ErrorText>{typedError}</ErrorText>
               <GoldButton busy={busy} onClick={() => void start()}>
                  <AppIcon app="whatsapp" className="text-[22px]" />
                  {busy ? t.getting : t.send}
               </GoldButton>
               <ErrorText>{error}</ErrorText>
            </>
         )}
      </>
   );
}
