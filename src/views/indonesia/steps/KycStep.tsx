import { useEffect, useState } from 'react';

import { useDispatch } from 'react-redux';

import { openMessengerSupport } from '@/config/contactVerification';
import { EXTERNAL_LINKS } from '@/config/externalLinks';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import { CONNECT_HIPPOS } from '@/views/dashboard/components/connectKit';
import { ID_RETURN_TO, markIdKycReturn, pick } from '@/views/indonesia/idFlow';
import type { IdStepProps } from '@/views/indonesia/steps/types';
import { DoneRow, ErrorText, GoldButton, SoftButton, StepHead, WaitRow } from '@/views/indonesia/ui';

// Step 6: ID + liveness with Didit — one combined session (create-didit-session kind 'combined', the
// same as /verify's traditional KYC). Didit returns everyone to /verify, which sends an Indonesia-track
// borrower straight back here (markIdKycReturn). Submitted is enough to carry on; approval is needed
// before the team can ✅ them after the call.

const COPY = {
   id: {
      title: 'Cek KTP + wajah',
      subtitle: 'Sekitar 2 menit.',
      ready: ['🪪 Siapkan KTP asli', '💡 Cahaya terang', '🤳 Kamera depan'],
      start: 'Mulai cek KTP',
      resume: 'Lanjutkan cek KTP',
      opening: 'Membuka…',
      inReview: 'Terkirim. Sedang dicek tim.',
      approved: 'KTP terverifikasi',
      declined: 'Cek KTP ditolak',
      triesLeft: (n: number) => `Sisa ${n}x percobaan.`,
      tryAgain: 'Coba lagi',
      noTries: 'Percobaan habis. Hubungi kami.',
      duplicate: 'KTP ini sudah dipakai akun lain. Hubungi kami.',
      unfinished: 'Belum selesai.',
      contact: 'Hubungi kami',
      locked: 'Selesaikan langkah sebelumnya dulu.',
      next: 'Lanjut',
      error: 'Gagal memulai. Coba lagi sebentar lagi.'
   },
   en: {
      title: 'ID + face check',
      subtitle: 'About 2 minutes.',
      ready: ['🪪 Have your original ID', '💡 Good light', '🤳 Front camera'],
      start: 'Start the ID check',
      resume: 'Continue the ID check',
      opening: 'Opening…',
      inReview: 'Sent. The team is checking it.',
      approved: 'ID verified',
      declined: 'ID check declined',
      triesLeft: (n: number) => `${n} ${n === 1 ? 'try' : 'tries'} left.`,
      tryAgain: 'Try again',
      noTries: 'No tries left. Message us.',
      duplicate: 'This ID is already on another account. Message us.',
      unfinished: 'Not finished yet.',
      contact: 'Message us',
      locked: 'Finish the steps before this first.',
      next: 'Continue',
      error: 'Couldn’t start. Try again in a moment.'
   }
};

const refusalCode = async (error: unknown): Promise<string | null> => {
   const ctx = (error as { context?: Response } | null)?.context;
   if (!ctx || typeof ctx.clone !== 'function') return null;
   const body = (await ctx
      .clone()
      .json()
      .catch(() => null)) as { code?: string } | null;
   return body?.code ?? null;
};

const UNFINISHED = new Set(['abandoned', 'expired', 'not started', 'in progress']);

export default function KycStep({ data, lang, refresh, onDone }: IdStepProps) {
   const t = pick(lang, COPY);
   const dispatch = useDispatch<AppDispatch>();
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState('');
   const [triesLeft, setTriesLeft] = useState<number | null>(null);
   const state = data.kycState;
   const declined = state === 'declined';
   const duplicate = state === 'duplicate';
   const unfinished = UNFINISHED.has(state);

   // Back from Didit (or a lost webhook): pull the result from Didit itself once, then re-read.
   useEffect(() => {
      if (data.kycApproved || !state) return;
      let cancelled = false;
      void (async () => {
         await getSupabaseBrowserClient()
            .functions.invoke('check-didit-status', { body: { kind: 'id' } })
            .catch(() => undefined);
         if (cancelled) return;
         await dispatch(fetchUser())
            .unwrap()
            .catch(() => undefined);
         await refresh();
      })();
      return () => {
         cancelled = true;
      };
      // Once per visit.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   useEffect(() => {
      if (!declined) return;
      void getSupabaseBrowserClient()
         .rpc('my_kyc_tries_left')
         .then(({ data: left, error: rpcError }) => {
            if (!rpcError && typeof left === 'number') setTriesLeft(left);
         });
   }, [declined]);

   const start = async () => {
      if (busy) return;
      setBusy(true);
      setError('');
      try {
         const { data: res, error: fnError } = await getSupabaseBrowserClient().functions.invoke('create-didit-session', {
            body: { kind: 'combined', returnTo: ID_RETURN_TO }
         });
         const refusal = fnError ? await refusalCode(fnError) : null;
         if (refusal === 'KYC_TRIES_USED') {
            setTriesLeft(0);
            setBusy(false);
            return;
         }
         if (refusal === 'ID_ONBOARDING_INCOMPLETE') {
            // An earlier step isn't done on the server: refresh so the page moves back to it.
            await refresh();
            setBusy(false);
            return;
         }
         if (refusal === 'ID_IN_REVIEW') {
            await refresh();
            setBusy(false);
            return;
         }
         const url = (res as { url?: string } | null)?.url;
         if (fnError || !url) throw fnError ?? new Error('No Didit URL');
         // Didit comes back to /verify; this mark sends them on to this step.
         markIdKycReturn();
         window.location.assign(url);
      } catch (err) {
         console.error('[IdOnboarding] create-didit-session failed', err);
         setError(t.error);
         setBusy(false);
      }
   };

   const contact = <SoftButton onClick={() => openMessengerSupport(EXTERNAL_LINKS.support.messengerKycTries)}>{t.contact}</SoftButton>;

   return (
      <>
         <StepHead image={CONNECT_HIPPOS.call} title={t.title} subtitle={data.steps.kyc || data.kycApproved ? undefined : t.subtitle} />
         {data.kycApproved ? (
            <>
               <DoneRow>{t.approved}</DoneRow>
               <GoldButton onClick={onDone}>{t.next}</GoldButton>
            </>
         ) : data.steps.kyc ? (
            <>
               <WaitRow>{t.inReview}</WaitRow>
               <GoldButton onClick={onDone}>{t.next}</GoldButton>
            </>
         ) : duplicate ? (
            <>
               <p className="rounded-[14px] bg-[#fff1ef] px-4 py-3 text-[16px] font-bold text-[#a3321f] dark:bg-[#3a1a18] dark:text-[#ffb4a6]">
                  {t.duplicate}
               </p>
               {contact}
            </>
         ) : !data.readyForKyc ? (
            <p className="text-[15px] font-semibold text-[#7a6a4f] dark:text-[#bfb29a]">{t.locked}</p>
         ) : declined && triesLeft === 0 ? (
            <>
               <p className="rounded-[14px] bg-[#fff1ef] px-4 py-3 text-[16px] font-bold text-[#a3321f] dark:bg-[#3a1a18] dark:text-[#ffb4a6]">
                  {t.declined}. {t.noTries}
               </p>
               {contact}
            </>
         ) : (
            <>
               {declined ? (
                  <p className="rounded-[14px] bg-[#fff1ef] px-4 py-3 text-[16px] font-bold text-[#a3321f] dark:bg-[#3a1a18] dark:text-[#ffb4a6]">
                     {t.declined}. {triesLeft !== null ? t.triesLeft(triesLeft) : ''}
                  </p>
               ) : unfinished ? (
                  <p className="text-[15px] font-bold text-[#8a5a00] dark:text-[#ffd36b]">{t.unfinished}</p>
               ) : (
                  <ul className="flex flex-col gap-1.5 text-[16px] font-semibold">
                     {t.ready.map((line) => (
                        <li key={line}>{line}</li>
                     ))}
                  </ul>
               )}
               <GoldButton busy={busy} onClick={() => void start()}>
                  {busy ? t.opening : declined ? t.tryAgain : unfinished ? t.resume : t.start}
               </GoldButton>
               <ErrorText>{error}</ErrorText>
            </>
         )}
      </>
   );
}
