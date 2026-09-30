import { useEffect, useState } from 'react';

import { useSelector } from 'react-redux';
import { useDisconnect } from 'wagmi';

import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { TOAST_TYPES } from '@/components/ToastSystem/types';

import { type LocaleCode, useLocalization } from '@/i18n';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useOpenfort } from '@/lib/web3/openfort/OpenfortContext';
import type { RootState } from '@/store/store';

// Shown to a borrower who already HAS an Instant Wallet (the server issued them one) but whose
// account no longer points at it — they unlinked it, or saving the address failed after it was
// made. Without this they land on a dashboard with no wallet and nothing telling them why, and
// the only way back is to guess that "Connect" will give them the same wallet (it does).
//
// It's a button on purpose, not a silent repair: people should know a wallet is being set up.

type RestoreCopy = { title: string; body: string; button: string; working: string; doneTitle: string; doneBody: string };

const COPY: Record<LocaleCode, RestoreCopy> = {
   en: {
      title: 'Restore your Instant Wallet',
      body: 'Your wallet is safe, but it is not connected to your account right now. Tap to connect it again. It takes a few seconds.',
      button: 'Restore my wallet',
      working: 'Restoring…',
      doneTitle: 'Wallet restored',
      doneBody: 'Your Instant Wallet is connected again.'
   },
   fil: {
      title: 'Ibalik ang Instant Wallet mo',
      body: 'Ligtas ang wallet mo, pero hindi ito nakakonekta sa account mo ngayon. I-tap para ikonekta ulit. Ilang segundo lang.',
      button: 'Ibalik ang wallet ko',
      working: 'Ibinabalik…',
      doneTitle: 'Naibalik na ang wallet',
      doneBody: 'Nakakonekta na ulit ang Instant Wallet mo.'
   },
   id: {
      title: 'Pulihkan Instant Wallet Anda',
      body: 'Dompet Anda aman, tetapi saat ini tidak terhubung ke akun Anda. Ketuk untuk menghubungkannya lagi. Hanya butuh beberapa detik.',
      button: 'Pulihkan dompet saya',
      working: 'Memulihkan…',
      doneTitle: 'Dompet dipulihkan',
      doneBody: 'Instant Wallet Anda terhubung kembali.'
   },
   th: {
      title: 'กู้คืน Instant Wallet ของคุณ',
      body: 'กระเป๋าเงินของคุณปลอดภัย แต่ตอนนี้ยังไม่ได้เชื่อมต่อกับบัญชีของคุณ แตะเพื่อเชื่อมต่ออีกครั้ง ใช้เวลาเพียงไม่กี่วินาที',
      button: 'กู้คืนกระเป๋าเงินของฉัน',
      working: 'กำลังกู้คืน…',
      doneTitle: 'กู้คืนกระเป๋าเงินแล้ว',
      doneBody: 'Instant Wallet ของคุณเชื่อมต่อแล้วอีกครั้ง'
   },
   vi: {
      title: 'Khôi phục Instant Wallet của bạn',
      body: 'Ví của bạn vẫn an toàn nhưng hiện chưa được kết nối với tài khoản. Nhấn để kết nối lại. Chỉ mất vài giây.',
      button: 'Khôi phục ví của tôi',
      working: 'Đang khôi phục…',
      doneTitle: 'Đã khôi phục ví',
      doneBody: 'Instant Wallet của bạn đã được kết nối lại.'
   }
};

export default function RestoreInstantWalletBanner() {
   const { locale } = useLocalization();
   const { showToast } = useToast();
   const openfort = useOpenfort();
   const { disconnectAsync } = useDisconnect();
   const userId = useSelector((state: RootState) => state.auth.user?.id);
   const walletAddress = useSelector((state: RootState) => state.auth.user?.walletAddress);
   const [hasGrant, setHasGrant] = useState(false);
   const [isRestoring, setIsRestoring] = useState(false);

   const needsCheck = Boolean(userId) && !walletAddress && openfort.isConfigured;

   // A grant row means the server already issued this account an Instant Wallet (the owner can read
   // their own row). No grant = they never had one, and the normal wallet-setup prompts apply.
   useEffect(() => {
      if (!needsCheck || !userId) {
         setHasGrant(false);
         return;
      }
      let cancelled = false;
      (async () => {
         const { data } = await getSupabaseBrowserClient().from('embedded_wallet_grants').select('user_id').eq('user_id', userId).maybeSingle();
         if (!cancelled) setHasGrant(Boolean(data));
      })().catch(() => undefined);
      return () => {
         cancelled = true;
      };
   }, [needsCheck, userId]);

   if (!needsCheck || !hasGrant) return null;

   const copy = COPY[locale];

   const restore = async () => {
      setIsRestoring(true);
      try {
         // Same first step as creating one: drop any live wagmi session so useWalletSync can't
         // re-lock the account onto a different wallet while we restore this one.
         await disconnectAsync().catch(() => undefined);
         // connect() recovers the user's existing account, saves the link (with retries), and
         // shows its own error toast on failure.
         const address = await openfort.connect();
         if (address) showToast(TOAST_TYPES.SUCCESS, copy.doneTitle, copy.doneBody);
      } finally {
         setIsRestoring(false);
      }
   };

   return (
      <div className="flex flex-col gap-md-2 rounded-md-lg border border-md-primary-900 bg-md-primary-100 p-md-3">
         <p className="text-md-b1 font-semibold text-md-heading">{copy.title}</p>
         <p className="text-md-b2 font-medium leading-5 text-md-heading">{copy.body}</p>
         <button
            type="button"
            onClick={restore}
            disabled={isRestoring}
            className="min-h-11 w-full rounded-md-lg bg-md-primary-1200 px-md-4 py-md-2 text-md-b1 font-semibold text-md-neutral-100 transition-transform active:scale-[0.99] disabled:opacity-60"
         >
            {isRestoring ? copy.working : copy.button}
         </button>
      </div>
   );
}
