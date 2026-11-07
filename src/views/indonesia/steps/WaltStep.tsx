import { useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { idTrackErrorText, isEvmAddress, WALT_BOT_URL } from '@/lib/idTrack';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { hasWalletAddressOnAccount } from '@/lib/walletProvider';
import { CONNECT_HIPPOS } from '@/views/dashboard/components/connectKit';
import { ID_WALLET_SETUP_PATH, inputClass, pick, reportIdStep } from '@/views/indonesia/idFlow';
import type { IdStepProps } from '@/views/indonesia/steps/types';
import { AppIcon, DoneRow, ErrorText, GoldButton, SoftButton, SoftLink, StepHead } from '@/views/indonesia/ui';

// Step 7: their Walt address (Telegram's wallet bot) — USDC on BNB Smart Chain (BEP20). Moodeng sends
// their loans there; in Walt they sell for rupiah on P2P. save_my_walt_address(p_address).
//
// Loans first land in their Moodeng wallet (users.wallet_address), so a borrower without one sets it up
// first (/onboarding/wallet?returnTo=id-onboarding brings them back here).

const COPY = {
   id: {
      walletTitle: 'Buat dompet Moodeng',
      walletSubtitle: 'Pinjaman kamu masuk ke sini dulu. Beberapa detik saja.',
      walletButton: 'Buat dompet',
      title: 'Dompet Walt kamu',
      lines: ['Walt adalah dompet di Telegram.', 'Pinjaman kamu kami kirim ke sana.', 'Jual jadi rupiah di Walt P2P.'],
      open: 'Buka @wallet di Telegram',
      howTitle: 'Cara ambil alamat:',
      how: ['Buka @wallet di Telegram', 'Tekan Deposit', 'Pilih USDC', 'Jaringan “BNB Smart Chain (BEP20)” → Salin alamat'],
      label: 'Tempel alamat Walt (0x…)',
      invalid: 'Alamat harus mulai 0x dan 42 karakter.',
      bep20: 'Saya pilih BNB Smart Chain (BEP20)',
      save: 'Simpan alamat',
      done: 'Alamat Walt tersimpan',
      change: 'Ganti alamat',
      next: 'Lanjut'
   },
   en: {
      walletTitle: 'Create your Moodeng wallet',
      walletSubtitle: 'Your loan lands here first. Takes a few seconds.',
      walletButton: 'Create wallet',
      title: 'Your Walt wallet',
      lines: ['Walt is the wallet inside Telegram.', 'We send your loans there.', 'Sell for rupiah on Walt P2P.'],
      open: 'Open @wallet in Telegram',
      howTitle: 'How to get the address:',
      how: ['Open @wallet in Telegram', 'Tap Deposit', 'Pick USDC', 'Network “BNB Smart Chain (BEP20)” → Copy address'],
      label: 'Paste your Walt address (0x…)',
      invalid: 'The address starts with 0x and is 42 characters.',
      bep20: 'I picked BNB Smart Chain (BEP20)',
      save: 'Save address',
      done: 'Walt address saved',
      change: 'Change address',
      next: 'Continue'
   }
};

const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function WaltStep({ data, user, lang, refresh, onDone }: IdStepProps) {
   const t = pick(lang, COPY);
   const navigate = useNavigate();
   const [address, setAddress] = useState('');
   const [bep20, setBep20] = useState(false);
   const [saving, setSaving] = useState(false);
   const [error, setError] = useState('');
   const [saved, setSaved] = useState<string | null>(null);
   const [editing, setEditing] = useState(false);
   const done = data.steps.walt;
   const hasWallet = hasWalletAddressOnAccount(user);

   useEffect(() => {
      if (!done) return;
      void getSupabaseBrowserClient()
         .from('users')
         .select('walt_address')
         .eq('id', user.id)
         .maybeSingle()
         .then(({ data: row }) => setSaved((row as { walt_address?: string | null } | null)?.walt_address ?? null));
   }, [done, user.id]);

   if (!hasWallet) {
      return (
         <>
            <StepHead image="/hippos/hippo-wallet.png" title={t.walletTitle} subtitle={t.walletSubtitle} />
            <GoldButton onClick={() => navigate(ID_WALLET_SETUP_PATH)}>{t.walletButton}</GoldButton>
         </>
      );
   }

   if (done && !editing) {
      return (
         <>
            <StepHead image={CONNECT_HIPPOS.cashout} title={t.title} />
            <DoneRow>
               {t.done}
               {saved ? <span className="block font-mono text-[13px] font-semibold opacity-80">{shortAddress(saved)}</span> : null}
            </DoneRow>
            <GoldButton onClick={onDone}>{t.next}</GoldButton>
            <SoftButton onClick={() => setEditing(true)}>{t.change}</SoftButton>
         </>
      );
   }

   const valid = isEvmAddress(address);
   const save = async () => {
      if (saving) return;
      if (!valid) {
         setError(t.invalid);
         return;
      }
      setSaving(true);
      setError('');
      const { error: rpcError } = await getSupabaseBrowserClient().rpc('save_my_walt_address', { p_address: address.trim() });
      setSaving(false);
      if (rpcError) {
         setError(idTrackErrorText(rpcError.message, lang));
         return;
      }
      setEditing(false);
      void reportIdStep('walt');
      await refresh();
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
            <p className="text-[16px] font-extrabold">{t.howTitle}</p>
            <ol className="flex flex-col gap-2">
               {t.how.map((line, i) => (
                  <li key={line} className="flex items-start gap-3 text-[15px] font-semibold leading-[20px]">
                     <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#ffd75a] text-[13px] font-extrabold text-[#4a2a00]">
                        {i + 1}
                     </span>
                     <span>{line}</span>
                  </li>
               ))}
            </ol>
            <SoftLink href={WALT_BOT_URL} rel="noopener noreferrer" target="_blank">
               <AppIcon app="telegram" className="text-[20px]" />
               {t.open}
            </SoftLink>
         </div>

         <label className="flex flex-col gap-1.5 text-[15px] font-bold">
            {t.label}
            <input
               autoCapitalize="none"
               autoComplete="off"
               autoCorrect="off"
               className={`${inputClass} font-mono text-[15px]`}
               onChange={(e) => {
                  setAddress(e.target.value.trim());
                  setError('');
               }}
               placeholder="0x…"
               spellCheck={false}
               value={address}
            />
         </label>
         <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[14px] bg-white px-3 text-[16px] font-bold dark:bg-[#1a1524]">
            <input checked={bep20} className="size-6 accent-[#ffbe1a]" onChange={(e) => setBep20(e.target.checked)} type="checkbox" />
            {t.bep20}
         </label>
         <ErrorText>{error}</ErrorText>
         <GoldButton busy={saving} disabled={!address || !bep20} onClick={() => void save()}>
            {t.save}
         </GoldButton>
      </>
   );
}
