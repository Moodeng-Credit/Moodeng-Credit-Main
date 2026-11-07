import { useCallback, useEffect, useMemo, useState } from 'react';

import { AlertTriangle, Check, Copy, ExternalLink, Loader2, RotateCcw } from 'lucide-react';

import { WALT_BOT_URL } from '@/lib/idTrack';
import { formatRupiah, type RelayTransfer, relayWalt, RelayWaltError, useUsdIdrRate } from '@/lib/relayWalt';
import { GoldButton, LangToggle, useWaltLang, WaltIcon, type WaltLang } from '@/views/indonesia/walt/waltUi';

// "Bayar dari Walt" — the Indonesia track's way to top up before repaying:
//   1. how much USDT (what's still missing + a small buffer for the bridge fee)
//   2. buy USDT on Walt P2P with Rupiah
//   3. get a one-time Relay address on BNB Chain and withdraw the USDT there from Walt (BEP20)
//   4. Relay turns it into USDC on Base in their Moodeng wallet; the page's balance watch sees it
//      and the normal Pay button takes over (payment itself is unchanged).

const MIN_USDT = 1;
const POLL_MS = 5000;
const REUSE_MS = 30 * 60_000;

const T = {
   title: { id: 'Bayar dari Walt', en: 'Pay from Walt' },
   sub: { id: 'Beli USDT dengan Rupiah di Walt, lalu kirim ke sini.', en: 'Buy USDT with Rupiah in Walt, then send it here.' },
   s1: { id: 'Jumlah yang dikirim', en: 'Amount to send' },
   s1note: { id: 'Sudah termasuk biaya kecil untuk pindah jaringan.', en: 'Includes a small fee to switch networks.' },
   s2: { id: 'Beli USDT di Walt P2P', en: 'Buy USDT on Walt P2P' },
   s2btn: { id: 'Buka Walt', en: 'Open Walt' },
   s3: { id: 'Kirim USDT ke alamat ini', en: 'Send the USDT to this address' },
   s3btn: { id: 'Dapatkan alamat', en: 'Get address' },
   copy: { id: 'Salin', en: 'Copy' },
   copied: { id: 'Tersalin', en: 'Copied' },
   network: { id: 'Pilih jaringan BNB Smart Chain (BEP20) di Walt.', en: 'Pick the BNB Smart Chain (BEP20) network in Walt.' },
   once: { id: 'Alamat ini hanya untuk 1x kirim.', en: 'This address is for one send only.' },
   exact: { id: 'Kirim tepat', en: 'Send exactly' },
   s4: { id: 'Tunggu uang masuk', en: 'Wait for it to arrive' },
   waiting: { id: 'Menunggu USDT kamu…', en: 'Waiting for your USDT…' },
   waitingBody: {
      id: 'Otomatis terdeteksi, biasanya 1–2 menit setelah Walt mengirim.',
      en: 'Detected automatically, usually 1–2 minutes after Walt sends.'
   },
   arriving: { id: 'USDT diterima, sedang diubah ke USDC…', en: 'USDT received, turning it into USDC…' },
   ready: { id: 'Uang masuk! Tap Bayar di bawah.', en: 'Money arrived! Tap Pay below.' },
   refund: {
      id: 'Transfer dikembalikan ke Walt kamu. Coba lagi dengan alamat baru.',
      en: 'The transfer went back to your Walt. Try again with a new address.'
   },
   failed: { id: 'Ada masalah dengan transfer ini. Hubungi kami.', en: 'Something went wrong with this transfer. Contact us.' },
   newAddress: { id: 'Minta alamat baru', en: 'Get a new address' },
   quoteFail: {
      id: 'Tidak bisa dapat alamat sekarang. Coba lagi sebentar.',
      en: 'Couldn’t get an address right now. Try again in a minute.'
   },
   noWalt: { id: 'Simpan alamat Walt kamu dulu (di langkah Walt).', en: 'Save your Walt address first (Walt step).' },
   getsUsdc: { id: 'Masuk ke dompet Moodeng', en: 'Lands in your Moodeng wallet' }
} satisfies Record<string, Record<WaltLang, string>>;

/** Round a dollar amount UP to whole cents (integer math, no float drift). */
const ceilCents = (usd: number) => Math.ceil(Math.round(usd * 1e6) / 1e4) / 100;

/** What's missing + ~1% (at least $0.30) for the bridge, at least $1, rounded up to cents. */
export const waltRepayAmount = (shortfall: number) => {
   const buffer = Math.max(0.3, shortfall * 0.01);
   return Math.max(MIN_USDT, ceilCents(shortfall + buffer));
};

type Props = {
   isPreview: boolean;
   /** USDC still missing in the Moodeng wallet to repay. */
   shortfall: number;
   /** Current Moodeng wallet USDC balance (null while loading). */
   usdcBalance: number | null;
   hasEnough: boolean;
   /** The wallet this page watches for the top-up. The one-time address pays users.wallet_address;
    *  if those differ the money would land where we aren't looking, so we don't show the address. */
   watchedWallet?: string;
};

const toFixed2 = (n: number) => n.toFixed(2);

export default function WaltRepaySteps({ isPreview, shortfall, usdcBalance, hasEnough, watchedWallet }: Props) {
   const { lang, toggle } = useWaltLang();
   const idr = useUsdIdrRate();
   const amountUsdt = useMemo(() => waltRepayAmount(Math.max(0, shortfall)), [shortfall]);
   const [transfer, setTransfer] = useState<RelayTransfer | null>(null);
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [copied, setCopied] = useState(false);
   const [boughtTapped, setBoughtTapped] = useState(false);

   // Resume a recent, still-open address (e.g. they went to Walt and came back).
   useEffect(() => {
      if (isPreview) return;
      let alive = true;
      void relayWalt
         .latest('repay')
         .then(({ transfer: last }) => {
            if (!alive || !last) return;
            const fresh = Date.now() - new Date(last.createdAt).getTime() < REUSE_MS;
            if (fresh && (last.status === 'quoted' || last.status === 'pending')) setTransfer(last);
         })
         .catch(() => undefined);
      return () => {
         alive = false;
      };
   }, [isPreview]);

   // Follow the Relay request so a refund / in-flight state can be shown. Arrival itself is
   // detected by the page's balance watch (hasEnough).
   useEffect(() => {
      if (!transfer || isPreview || hasEnough) return;
      if (transfer.status === 'success' || transfer.status === 'refund' || transfer.status === 'failure') return;
      const timer = setInterval(() => {
         void relayWalt
            .status(transfer.transferId)
            .then(setTransfer)
            .catch(() => undefined);
      }, POLL_MS);
      return () => clearInterval(timer);
   }, [transfer, isPreview, hasEnough]);

   const getAddress = useCallback(async () => {
      setBusy(true);
      setError(null);
      try {
         const amount = toFixed2(amountUsdt);
         const next: RelayTransfer = isPreview
            ? {
                 transferId: 'preview',
                 direction: 'repay',
                 status: 'quoted',
                 depositAddress: '0x37184ee77827c102ea3cbd98e7f2e535a41a40aa',
                 recipient: '0x1234aBCd5678Ef901234abcd5678ef901234ABcd',
                 amountIn: amount,
                 amountInUnits: '0',
                 amountOut: toFixed2(amountUsdt * 0.993),
                 amountOutMin: null,
                 feeUsd: 0.1,
                 timeEstimate: 2,
                 txHash: null,
                 fillTxHash: null,
                 createdAt: new Date().toISOString()
              }
            : await relayWalt.repayQuote(amount);
         setTransfer(next);
      } catch (err) {
         setError(err instanceof RelayWaltError && err.code === 'no_walt' ? T.noWalt[lang] : T.quoteFail[lang]);
      } finally {
         setBusy(false);
      }
   }, [amountUsdt, isPreview, lang]);

   const copy = async () => {
      if (!transfer) return;
      try {
         await navigator.clipboard.writeText(transfer.depositAddress);
         setCopied(true);
         setTimeout(() => setCopied(false), 2000);
      } catch {
         // Clipboard blocked (in-app browsers): the address is selectable on screen.
      }
   };

   // An old address for a different amount: show the amount it was made for (that's what Relay expects).
   const sendAmount = transfer ? transfer.amountIn : toFixed2(amountUsdt);
   const walletMismatch = Boolean(
      transfer && !isPreview && watchedWallet && transfer.recipient.toLowerCase() !== watchedWallet.toLowerCase()
   );
   const rupiah = formatRupiah(Number(sendAmount), idr);
   const stale = transfer && (transfer.status === 'refund' || transfer.status === 'failure' || transfer.status === 'expired');

   const stepDot = (n: number, done: boolean) => (
      <span
         className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${done ? 'bg-[#16a34a] text-white' : 'bg-[#6c3fe0] text-white'}`}
      >
         {done ? <Check className="h-[13px] w-[13px]" aria-hidden="true" /> : n}
      </span>
   );

   return (
      <div className="space-y-4">
         <div className="flex items-start gap-3">
            <WaltIcon size={40} />
            <div className="min-w-0 flex-1">
               <p className="text-[16px] font-bold text-[#1a1240] dark:text-white">{T.title[lang]}</p>
               <p className="text-[12px] leading-[16px] text-[#6b6090] dark:text-[#a095c8]">{T.sub[lang]}</p>
            </div>
            <LangToggle lang={lang} onToggle={toggle} />
         </div>

         {/* 1. how much */}
         <div className="flex gap-3">
            {stepDot(1, false)}
            <div className="min-w-0 flex-1">
               <p className="text-[13px] font-semibold text-[#1a1240] dark:text-white">{T.s1[lang]}</p>
               <p className="mt-1 text-[24px] font-bold leading-none text-[#1a1240] dark:text-white">{sendAmount} USDT</p>
               {rupiah && <p className="mt-1 text-[13px] font-semibold text-[#6b6090] dark:text-[#a095c8]">{rupiah}</p>}
               <p className="mt-1 text-[11px] text-[#6b6090] dark:text-[#a095c8]">{T.s1note[lang]}</p>
            </div>
         </div>

         {/* 2. buy on Walt P2P */}
         <div className="flex gap-3">
            {stepDot(2, boughtTapped || Boolean(transfer))}
            <div className="min-w-0 flex-1">
               <p className="mb-2 text-[13px] font-semibold text-[#1a1240] dark:text-white">{T.s2[lang]}</p>
               <button
                  type="button"
                  onClick={() => {
                     setBoughtTapped(true);
                     window.open(WALT_BOT_URL, '_blank', 'noopener,noreferrer');
                  }}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-[36px] border-2 border-[#37aee2] text-[14px] font-bold text-[#1e96c8]"
               >
                  {T.s2btn[lang]} <ExternalLink className="h-4 w-4" aria-hidden="true" />
               </button>
            </div>
         </div>

         {/* 3. one-time address */}
         <div className="flex gap-3">
            {stepDot(3, Boolean(transfer) && !stale)}
            <div className="min-w-0 flex-1">
               <p className="mb-2 text-[13px] font-semibold text-[#1a1240] dark:text-white">{T.s3[lang]}</p>
               {walletMismatch ? (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-[14px] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                     {lang === 'id'
                        ? 'Dompet Moodeng kamu berbeda dari akunmu. Jangan kirim dulu — hubungi kami.'
                        : 'Your Moodeng wallet doesn’t match your account. Don’t send yet — contact us.'}
                  </p>
               ) : !transfer || stale ? (
                  <>
                     {stale && (
                        <p className="mb-2 flex gap-1.5 text-[12px] text-[#b45309]">
                           <RotateCcw className="mt-[1px] h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                           {transfer?.status === 'refund' ? T.refund[lang] : T.failed[lang]}
                        </p>
                     )}
                     <GoldButton onClick={() => void getAddress()} busy={busy}>
                        {stale ? T.newAddress[lang] : T.s3btn[lang]}
                     </GoldButton>
                  </>
               ) : (
                  <div className="space-y-2">
                     <div className="rounded-xl border border-[#e0d9f8] bg-[#f8f7fb] p-3 dark:border-[#2a1f4f] dark:bg-[#1e1535]">
                        <p className="select-all break-all font-mono text-[13px] font-semibold text-[#1a1240] dark:text-white">
                           {transfer.depositAddress}
                        </p>
                        <button
                           type="button"
                           onClick={() => void copy()}
                           className="mt-2 inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-[36px] bg-[linear-gradient(85deg,#ffe27a_0%,#ffbe1a_98%)] text-[14px] font-bold text-[#4a2a00]"
                        >
                           {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                           {copied ? T.copied[lang] : T.copy[lang]}
                        </button>
                     </div>
                     <p className="text-[13px] text-[#1a1240] dark:text-white">
                        {T.exact[lang]} <span className="font-bold">{transfer.amountIn} USDT</span>
                        {transfer.amountOut ? (
                           <span className="text-[#6b6090] dark:text-[#a095c8]">
                              {' '}
                              → ≈ {Number(transfer.amountOut).toFixed(2)} USDC · {T.getsUsdc[lang]}
                           </span>
                        ) : null}
                     </p>
                     <div className="flex gap-2 rounded-xl border border-[#fcd34d] bg-[#fffbeb] px-3 py-2.5 dark:border-[#78350f] dark:bg-[#2a1d05]">
                        <AlertTriangle className="mt-[1px] h-4 w-4 shrink-0 text-[#d97706]" aria-hidden="true" />
                        <div className="text-[12px] leading-[17px] text-[#78350f] dark:text-[#fcd34d]">
                           <p className="font-bold">{T.network[lang]}</p>
                           <p>{T.once[lang]}</p>
                        </div>
                     </div>
                  </div>
               )}
               {error && <p className="mt-2 text-[12px] font-semibold text-[#dc2626]">{error}</p>}
            </div>
         </div>

         {/* 4. waiting */}
         {transfer && !stale && (
            <div className="flex gap-3">
               {stepDot(4, hasEnough)}
               <div className="min-w-0 flex-1">
                  <p className="mb-2 text-[13px] font-semibold text-[#1a1240] dark:text-white">{T.s4[lang]}</p>
                  {hasEnough ? (
                     <p className="rounded-xl bg-[#dcfce7] px-3 py-2.5 text-[13px] font-semibold text-[#14532d] dark:bg-[#052e16] dark:text-[#86efac]">
                        {T.ready[lang]}
                     </p>
                  ) : (
                     <div className="flex items-center gap-3 rounded-xl bg-[#f3effe] px-3 py-2.5 dark:bg-[#1e1535]">
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#6c3fe0]" aria-hidden="true" />
                        <div>
                           <p className="text-[13px] font-semibold text-[#3d1a8a] dark:text-[#c4b5fd]">
                              {transfer.status === 'pending' ? T.arriving[lang] : T.waiting[lang]}
                           </p>
                           <p className="text-[11px] text-[#6b6090] dark:text-[#a095c8]">
                              {T.waitingBody[lang]}
                              {usdcBalance != null ? ` · $${usdcBalance.toFixed(2)} USDC` : ''}
                           </p>
                        </div>
                     </div>
                  )}
               </div>
            </div>
         )}
      </div>
   );
}
