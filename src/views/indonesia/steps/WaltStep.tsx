import { useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { WALT_BOT_URL } from '@/lib/idTrack';
import { markIdWaltReady, RelayWaltError } from '@/lib/relayWalt';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { hasWalletAddressOnAccount } from '@/lib/walletProvider';
import { CONNECT_HIPPOS } from '@/views/dashboard/components/connectKit';
import { ID_WALLET_SETUP_PATH, pick, reportIdStep } from '@/views/indonesia/idFlow';
import type { IdStepProps } from '@/views/indonesia/steps/types';
import { AppIcon, DoneRow, ErrorText, GoldButton, SoftButton, SoftLink, StepHead } from '@/views/indonesia/ui';

// Step 7: Walt (Telegram's wallet). Loans go out by Walt Transfer to their Telegram @username
// (supabase/functions/_shared/idWaltPayouts.ts), so there's no address to find or paste: they open Walt
// once (so it can receive) and have a Telegram username. "Check & continue" asks the server, which reads
// the @username from Telegram itself (stableyard-deposit-address action id_walt_ready) and marks Walt
// ready. Old accounts with a saved BEP20 address count as done too.
//
// Loans first need their Moodeng wallet (users.wallet_address) for the records, so a borrower without one
// sets it up first (/onboarding/wallet?returnTo=id-onboarding brings them back here).

const COPY = {
   id: {
      walletTitle: 'Buat dompet Moodeng',
      walletSubtitle: 'Untuk catatan pinjamanmu. Beberapa detik saja.',
      walletButton: 'Buat dompet',
      title: 'Dompet Walt kamu',
      lines: ['Walt adalah dompet di dalam Telegram.', 'Uang pinjamanmu masuk ke sana.'],
      twoThings: '2 hal cepat:',
      one: 'Buka Walt dan tekan "Mulai" (Start).',
      open: 'Buka Walt',
      two: 'Punya username Telegram (contoh: @budi_88).',
      howUsername: 'Belum punya? Telegram → ☰ / Pengaturan → Username → tulis nama → ✓',
      opened: 'Saya sudah buka Walt dan tekan Mulai',
      check: 'Cek & lanjut',
      done: 'Walt siap',
      sendTo: (u: string) => `Pinjaman dikirim ke @${u}`,
      next: 'Lanjut',
      again: 'Cek lagi',
      errors: {
         no_username: 'Kamu belum punya username Telegram. Buat dulu (Telegram → ☰ / Pengaturan → Username), lalu tekan "Cek lagi".',
         no_telegram: 'Hubungkan Telegram dulu (langkah 1).',
         username_taken: 'Username ini sudah dipakai akun lain. Hubungi kami.',
         not_id_track: 'Akun ini bukan untuk Indonesia.',
         error: 'Tidak bisa cek sekarang. Coba lagi sebentar.'
      } as Record<string, string>
   },
   en: {
      walletTitle: 'Create your Moodeng wallet',
      walletSubtitle: 'For your loan records. Takes a few seconds.',
      walletButton: 'Create wallet',
      title: 'Your Walt wallet',
      lines: ['Walt is the wallet inside Telegram.', 'Your loan money arrives there.'],
      twoThings: '2 quick things:',
      one: 'Open Walt and tap "Start".',
      open: 'Open Walt',
      two: 'Have a Telegram username (like @budi_88).',
      howUsername: 'No username? Telegram → ☰ / Settings → Username → type a name → ✓',
      opened: 'I opened Walt and tapped Start',
      check: 'Check & continue',
      done: 'Walt is ready',
      sendTo: (u: string) => `Loans are sent to @${u}`,
      next: 'Continue',
      again: 'Check again',
      errors: {
         no_username: 'You don’t have a Telegram username yet. Make one (Telegram → ☰ / Settings → Username), then tap "Check again".',
         no_telegram: 'Connect Telegram first (step 1).',
         username_taken: 'This username is used by another account. Contact us.',
         not_id_track: 'This account isn’t on the Indonesia track.',
         error: 'Couldn’t check right now. Try again in a moment.'
      } as Record<string, string>
   }
};

export default function WaltStep({ data, user, lang, refresh, onDone }: IdStepProps) {
   const t = pick(lang, COPY);
   const navigate = useNavigate();
   const [opened, setOpened] = useState(false);
   const [checking, setChecking] = useState(false);
   const [error, setError] = useState('');
   const [username, setUsername] = useState<string | null>(null);
   const done = data.steps.walt;
   const hasWallet = hasWalletAddressOnAccount(user);

   useEffect(() => {
      if (!done) return;
      void getSupabaseBrowserClient()
         .from('users')
         .select('telegram_username')
         .eq('id', user.id)
         .maybeSingle()
         .then(({ data: row }) => setUsername((row as { telegram_username?: string | null } | null)?.telegram_username ?? null));
   }, [done, user.id]);

   if (!hasWallet) {
      return (
         <>
            <StepHead image="/hippos/hippo-wallet.png" title={t.walletTitle} subtitle={t.walletSubtitle} />
            <GoldButton onClick={() => navigate(ID_WALLET_SETUP_PATH)}>{t.walletButton}</GoldButton>
         </>
      );
   }

   if (done) {
      return (
         <>
            <StepHead image={CONNECT_HIPPOS.cashout} title={t.title} />
            <DoneRow>
               {t.done}
               {username ? <span className="block text-[14px] font-semibold opacity-80">{t.sendTo(username)}</span> : null}
            </DoneRow>
            <GoldButton onClick={onDone}>{t.next}</GoldButton>
         </>
      );
   }

   const check = async () => {
      if (checking) return;
      setChecking(true);
      setError('');
      try {
         const r = await markIdWaltReady();
         setUsername(r.telegramUsername);
         void reportIdStep('walt');
         await refresh();
      } catch (err) {
         const code = err instanceof RelayWaltError ? err.code : 'error';
         setError(t.errors[code] ?? t.errors.error);
      } finally {
         setChecking(false);
      }
   };

   return (
      <>
         <StepHead image={CONNECT_HIPPOS.cashout} title={t.title} />
         <ul className="flex flex-col gap-1 text-[16px] font-semibold leading-[21px]">
            {t.lines.map((line) => (
               <li key={line}>{line}</li>
            ))}
         </ul>

         <div className="flex flex-col gap-3 rounded-[20px] border border-[#f0e6c8] bg-white p-4 dark:border-[#2e2638] dark:bg-[#1a1524]">
            <p className="text-[16px] font-extrabold">{t.twoThings}</p>
            <div className="flex items-start gap-3 text-[15px] font-semibold leading-[20px]">
               <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#ffd75a] text-[13px] font-extrabold text-[#4a2a00]">1</span>
               <span>{t.one}</span>
            </div>
            <SoftLink href={WALT_BOT_URL} rel="noopener noreferrer" target="_blank">
               <AppIcon app="telegram" className="text-[20px]" />
               {t.open}
            </SoftLink>
            <div className="flex items-start gap-3 text-[15px] font-semibold leading-[20px]">
               <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#ffd75a] text-[13px] font-extrabold text-[#4a2a00]">2</span>
               <span>
                  {t.two}
                  <span className="mt-1 block text-[13px] font-medium opacity-75">{t.howUsername}</span>
               </span>
            </div>
         </div>

         <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[14px] bg-white px-3 text-[16px] font-bold dark:bg-[#1a1524]">
            <input checked={opened} className="size-6 accent-[#ffbe1a]" onChange={(e) => setOpened(e.target.checked)} type="checkbox" />
            {t.opened}
         </label>
         <ErrorText>{error}</ErrorText>
         {error ? (
            <SoftButton onClick={() => void check()}>{t.again}</SoftButton>
         ) : (
            <GoldButton busy={checking} disabled={!opened} onClick={() => void check()}>
               {t.check}
            </GoldButton>
         )}
      </>
   );
}
