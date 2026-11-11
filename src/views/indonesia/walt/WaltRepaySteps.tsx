import { useCallback, useEffect, useState } from 'react';

import { AlertTriangle, Check, Copy, ExternalLink, Loader2, RotateCcw } from 'lucide-react';

import { WALT_BOT_URL } from '@/lib/idTrack';
import { formatIdr } from '@/lib/loanMarket';
import { idRepay, type IdRepayRequest, type IdRepayStatus, RelayWaltError } from '@/lib/relayWalt';
import { GoldButton, LangToggle, useWaltLang, WaltIcon, type WaltLang } from '@/views/indonesia/walt/waltUi';

// "Bayar dari Walt" — how Indonesia-track borrowers repay (same as the bot's 💰 Bayar), with no fees:
//   1. (if needed) buy USDT on Walt P2P Express with rupiah
//   2. get the exact amount + Moodeng's Walt @username, send it with Walt → Transfer (free)
//   3. tap "Sudah kirim"; the team checks Walt and confirms, which records it. This card polls and says so.
// Backup when no Walt username is set: withdraw on BNB Chain to the payout wallet, matched automatically.
// (supabase/functions/_shared/idRepayments.ts)

const POLL_MS = 15_000;

const T = {
   title: { id: 'Bayar dari Walt', en: 'Pay from Walt' },
   sub: { id: 'Beli USDT dengan Rupiah di Walt, lalu kirim ke Moodeng.', en: 'Buy USDT with Rupiah in Walt, then send it to Moodeng.' },
   s1: { id: 'Beli USDT di Walt P2P Express', en: 'Buy USDT on Walt P2P Express' },
   s1btn: { id: 'Buka Walt', en: 'Open Walt' },
   s2: { id: 'Kirim jumlah TEPAT ini ke alamat Moodeng', en: 'Send EXACTLY this amount to Moodeng' },
   s2walt: { id: 'Kirim jumlah TEPAT ini lewat Walt → Transfer', en: 'Send EXACTLY this amount with Walt → Transfer' },
   to: { id: 'Ke', en: 'To' },
   copyUser: { id: 'Salin username', en: 'Copy username' },
   transferHow: {
      id: 'Di Walt: Transfer → tempel jumlah → Choose Recipient → PIN dompet → tempel username → kirim.',
      en: 'In Walt: Transfer → paste the amount → Choose Recipient → wallet passcode → paste the username → send.'
   },
   notWithdraw: { id: 'Pakai Transfer (gratis), BUKAN Withdraw (ada biaya).', en: 'Use Transfer (free), NOT Withdraw (it has a fee).' },
   sentBtn: { id: '✅ Sudah kirim', en: '✅ I’ve sent it' },
   waitingTeam: { id: 'Menunggu Moodeng mengonfirmasi…', en: 'Waiting for Moodeng to confirm…' },
   waitingTeamBody: { id: 'Tim kami mengecek Walt, biasanya dalam beberapa jam (08–22 WIB).', en: 'Our team checks Walt, usually within a few hours (08–22 WIB).' },
   s2btn: { id: 'Tampilkan jumlah & alamat', en: 'Show amount & address' },
   copy: { id: 'Salin alamat', en: 'Copy address' },
   copyAmount: { id: 'Salin jumlah', en: 'Copy amount' },
   copied: { id: 'Tersalin', en: 'Copied' },
   network: { id: 'Pilih jaringan BNB Smart Chain (BEP20) di Walt.', en: 'Pick the BNB Smart Chain (BEP20) network in Walt.' },
   exactWhy: {
      id: 'Jumlahnya harus persis — dari angka itu kami tahu ini pembayaranmu. Kalau Walt memotong biaya, pastikan yang DITERIMA tetap jumlah ini.',
      en: 'The amount must be exact — that number is how we know it’s your payment. If Walt takes a fee, make sure the amount RECEIVED is still this.'
   },
   validFor: { id: 'Berlaku 48 jam.', en: 'Good for 48 hours.' },
   s3: { id: 'Tunggu konfirmasi', en: 'Wait for confirmation' },
   waiting: { id: 'Menunggu pembayaranmu…', en: 'Waiting for your payment…' },
   waitingBody: { id: 'Otomatis terdeteksi, biasanya 1–5 menit setelah Walt mengirim.', en: 'Detected automatically, usually 1–5 minutes after Walt sends.' },
   received: { id: 'Uang diterima, sedang dicatat…', en: 'Money received, recording it…' },
   recorded: { id: 'Pembayaran tercatat! Terima kasih.', en: 'Payment recorded! Thank you.' },
   expired: { id: 'Jumlah ini sudah kedaluwarsa. Minta yang baru.', en: 'This amount expired. Get a new one.' },
   replaced: {
      id: 'Ada jumlah yang lebih baru (mungkin dari Telegram). Kalau kamu sudah mengirim yang ini, tunggu saja — tetap tercatat.',
      en: 'There’s a newer amount (maybe from Telegram). If you already sent this one, just wait — it still counts.'
   },
   partial: { id: 'Pembayaran tercatat, tapi masih ada sisa.', en: 'Payment recorded, but there’s still some left.' },
   payRest: { id: 'Bayar sisanya', en: 'Pay the rest' },
   needsTeam: {
      id: 'Uangmu sudah kami terima, tapi tim kami perlu mengeceknya. Kami kabari kamu di Telegram.',
      en: 'We got your money, but our team needs to check it. We’ll tell you in Telegram.'
   },
   again: { id: 'Minta jumlah baru', en: 'Get a new amount' },
   left: { id: 'Sisa yang harus dibayar', en: 'Left to pay' },
   today: { id: 'hari ini', en: 'today' }
} satisfies Record<string, Record<WaltLang, string>>;

const ERRORS: Record<string, Record<WaltLang, string>> = {
   no_loan: { id: 'Tidak ada pinjaman yang perlu dibayar.', en: 'No loan to pay.' },
   nothing_left: { id: 'Pinjamanmu sudah lunas.', en: 'Your loan is already paid.' },
   on_contract: { id: 'Pinjaman ini dibayar lewat "Cara lain" di bawah.', en: 'This loan is paid through "Other ways" below.' },
   busy: { id: 'Pembayaranmu sedang dicatat. Tunggu sebentar.', en: 'Your payment is being recorded. One moment.' },
   paused: { id: 'Pembayaran dari Walt sedang dijeda. Hubungi kami.', en: 'Paying from Walt is paused. Contact us.' },
   no_payout_wallet: { id: 'Pembayaran dari Walt belum tersedia. Hubungi kami.', en: 'Paying from Walt isn’t available yet. Contact us.' },
   error: { id: 'Tidak bisa menyiapkan pembayaran sekarang. Coba lagi sebentar.', en: 'Couldn’t set up the payment right now. Try again in a minute.' }
};

type Props = {
   isPreview: boolean;
   /** Rupiah peg: rupiah still owed on the loan, null when not pegged. */
   rupiahLeft?: number | null;
   /** USD that rupiah is worth today (what's left of total_repayment_amount). */
   usdLeft?: number;
   /** Called once the payment is recorded on the loan (refresh the loans). */
   onRecorded?: () => void;
};

const PREVIEW: IdRepayRequest = {
   requestId: 0,
   method: 'walt_transfer',
   waltUsername: 'jimmymoodengcredit',
   address: '0x37184ee77827c102ea3cbd98e7f2e535a41a40aa',
   amountUsdt: '6.08',
   approxIdr: 110000,
   rupiahLeft: 110000,
   expiresAt: new Date(Date.now() + 48 * 3_600_000).toISOString()
};

export default function WaltRepaySteps({ isPreview, rupiahLeft = null, usdLeft, onRecorded }: Props) {
   const { lang, toggle } = useWaltLang();
   const [req, setReq] = useState<IdRepayRequest | null>(null);
   const [status, setStatus] = useState<IdRepayStatus | null>(null);
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [copied, setCopied] = useState<'address' | 'amount' | null>(null);
   const [boughtTapped, setBoughtTapped] = useState(false);
   const [sentTapped, setSentTapped] = useState(false);
   const say = (t: Record<WaltLang, string>) => t[lang];

   const load = useCallback(async () => {
      setBusy(true);
      setError(null);
      try {
         const next = isPreview ? PREVIEW : await idRepay.request();
         setReq(next);
         setStatus(null);
         setSentTapped(false);
      } catch (err) {
         const code = err instanceof RelayWaltError ? err.code : 'error';
         setError((ERRORS[code] ?? ERRORS.error)[lang]);
      } finally {
         setBusy(false);
      }
   }, [isPreview, lang]);

   // Follow the request until it's recorded, needs the team, or is out of date.
   const recorded = status?.recorded === true;
   const stale = status?.status === 'expired' || status?.status === 'replaced';
   const needsTeam = Boolean(status?.received && ['refund_needed', 'refunded', 'unmatched', 'ignored', 'topup'].includes(status.received.status));
   useEffect(() => {
      if (!req || isPreview || recorded || stale || needsTeam) return;
      const timer = setInterval(() => {
         void idRepay
            .status(req.requestId)
            .then(setStatus)
            .catch(() => undefined);
      }, POLL_MS);
      return () => clearInterval(timer);
   }, [req, isPreview, recorded, stale, needsTeam]);

   useEffect(() => {
      if (recorded) onRecorded?.();
   }, [recorded, onRecorded]);

   const isWalt = req?.method === 'walt_transfer' && Boolean(req.waltUsername);
   const recipient = isWalt ? `@${req?.waltUsername}` : (req?.address ?? '');
   const sent = sentTapped || status?.sentClaimed === true;

   const markSent = async () => {
      if (!req) return;
      setBusy(true);
      setError(null);
      try {
         if (!isPreview) await idRepay.sent(req.requestId);
         setSentTapped(true);
      } catch {
         setError(ERRORS.error[lang]);
      } finally {
         setBusy(false);
      }
   };

   const copy = async (what: 'address' | 'amount') => {
      if (!req) return;
      try {
         await navigator.clipboard.writeText(what === 'address' ? recipient : req.amountUsdt);
         setCopied(what);
         setTimeout(() => setCopied(null), 2000);
      } catch {
         // Clipboard blocked (in-app browsers): the text is selectable on screen.
      }
   };

   const left = req?.rupiahLeft ?? rupiahLeft;

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
               <p className="text-[16px] font-bold text-[#1a1240] dark:text-white">{say(T.title)}</p>
               <p className="text-[12px] leading-[16px] text-[#6b6090] dark:text-[#a095c8]">{say(T.sub)}</p>
            </div>
            <LangToggle lang={lang} onToggle={toggle} />
         </div>

         {left != null ? (
            <div className="rounded-xl bg-[#f7f4ff] px-3 py-2.5 dark:bg-[#1e1535]">
               <p className="text-[12px] font-medium text-[#6b6090] dark:text-[#a095c8]">{say(T.left)}</p>
               <p className="text-[22px] font-bold leading-tight text-[#1a1240] dark:text-white">{formatIdr(left)}</p>
               {usdLeft != null ? (
                  <p className="text-[12px] text-[#6b6090] dark:text-[#a095c8]">
                     ≈ {usdLeft.toFixed(2)} USDT {say(T.today)}
                  </p>
               ) : null}
            </div>
         ) : null}

         {/* 1. buy on Walt P2P */}
         <div className="flex gap-3">
            {stepDot(1, boughtTapped || Boolean(req))}
            <div className="min-w-0 flex-1">
               <p className="mb-2 text-[13px] font-semibold text-[#1a1240] dark:text-white">{say(T.s1)}</p>
               <button
                  type="button"
                  onClick={() => {
                     setBoughtTapped(true);
                     window.open(WALT_BOT_URL, '_blank', 'noopener,noreferrer');
                  }}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-[36px] border-2 border-[#37aee2] text-[14px] font-bold text-[#1e96c8]"
               >
                  {say(T.s1btn)} <ExternalLink className="h-4 w-4" aria-hidden="true" />
               </button>
            </div>
         </div>

         {/* 2. exact amount + address */}
         <div className="flex gap-3">
            {stepDot(2, Boolean(req) && !stale)}
            <div className="min-w-0 flex-1">
               <p className="mb-2 text-[13px] font-semibold text-[#1a1240] dark:text-white">{isWalt ? say(T.s2walt) : say(T.s2)}</p>
               {!req || stale ? (
                  <>
                     {stale ? (
                        <p className="mb-2 flex gap-1.5 text-[12px] text-[#b45309]">
                           <RotateCcw className="mt-[1px] h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                           {status?.status === 'replaced' ? say(T.replaced) : say(T.expired)}
                        </p>
                     ) : null}
                     <GoldButton onClick={() => void load()} busy={busy}>
                        {stale ? say(T.again) : say(T.s2btn)}
                     </GoldButton>
                  </>
               ) : (
                  <div className="space-y-2">
                     <div className="rounded-xl border border-[#e0d9f8] bg-[#f8f7fb] p-3 dark:border-[#2a1f4f] dark:bg-[#1e1535]">
                        <p className="text-[24px] font-bold leading-none text-[#1a1240] dark:text-white">
                           <span className="select-all">{req.amountUsdt}</span> USDT
                        </p>
                        {req.approxIdr ? (
                           <p className="mt-1 text-[13px] font-semibold text-[#6b6090] dark:text-[#a095c8]">≈ {formatIdr(req.approxIdr)}</p>
                        ) : null}
                        {isWalt ? (
                           <p className="mt-3 text-[15px] font-semibold text-[#1a1240] dark:text-white">
                              {say(T.to)} <span className="select-all font-mono">{recipient}</span>
                           </p>
                        ) : (
                           <p className="mt-3 select-all break-all font-mono text-[13px] font-semibold text-[#1a1240] dark:text-white">{req.address}</p>
                        )}
                        <div className="mt-2 flex gap-2">
                           <button
                              type="button"
                              onClick={() => void copy('amount')}
                              className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-[36px] border-2 border-[#ffbe1a] text-[13px] font-bold text-[#4a2a00] dark:text-[#ffd75a]"
                           >
                              {copied === 'amount' ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                              {copied === 'amount' ? say(T.copied) : say(T.copyAmount)}
                           </button>
                           <button
                              type="button"
                              onClick={() => void copy('address')}
                              className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-[36px] bg-[linear-gradient(85deg,#ffe27a_0%,#ffbe1a_98%)] text-[13px] font-bold text-[#4a2a00]"
                           >
                              {copied === 'address' ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                              {copied === 'address' ? say(T.copied) : isWalt ? say(T.copyUser) : say(T.copy)}
                           </button>
                        </div>
                     </div>
                     <div className="flex gap-2 rounded-xl border border-[#fcd34d] bg-[#fffbeb] px-3 py-2.5 dark:border-[#78350f] dark:bg-[#2a1d05]">
                        <AlertTriangle className="mt-[1px] h-4 w-4 shrink-0 text-[#d97706]" aria-hidden="true" />
                        <div className="text-[12px] leading-[17px] text-[#78350f] dark:text-[#fcd34d]">
                           {isWalt ? (
                              <>
                                 <p className="font-bold">{say(T.notWithdraw)}</p>
                                 <p>{say(T.transferHow)}</p>
                              </>
                           ) : (
                              <>
                                 <p className="font-bold">{say(T.network)}</p>
                                 <p>{say(T.exactWhy)}</p>
                              </>
                           )}
                           <p>{say(T.validFor)}</p>
                        </div>
                     </div>
                     {isWalt && !sent ? (
                        <GoldButton onClick={() => void markSent()} busy={busy}>
                           {say(T.sentBtn)}
                        </GoldButton>
                     ) : null}
                  </div>
               )}
               {error ? <p className="mt-2 text-[12px] font-semibold text-[#dc2626]">{error}</p> : null}
            </div>
         </div>

         {/* 3. waiting */}
         {req && !stale && (!isWalt || sent || recorded) ? (
            <div className="flex gap-3">
               {stepDot(3, recorded)}
               <div className="min-w-0 flex-1">
                  <p className="mb-2 text-[13px] font-semibold text-[#1a1240] dark:text-white">{say(T.s3)}</p>
                  {recorded && status?.loanPaid ? (
                     <p className="rounded-xl bg-[#dcfce7] px-3 py-2.5 text-[13px] font-semibold text-[#14532d] dark:bg-[#052e16] dark:text-[#86efac]">
                        {say(T.recorded)}
                     </p>
                  ) : recorded ? (
                     <div className="space-y-2">
                        <p className="rounded-xl bg-[#dcfce7] px-3 py-2.5 text-[13px] font-semibold text-[#14532d] dark:bg-[#052e16] dark:text-[#86efac]">
                           {say(T.partial)}
                        </p>
                        <GoldButton onClick={() => void load()} busy={busy}>
                           {say(T.payRest)}
                        </GoldButton>
                     </div>
                  ) : needsTeam ? (
                     <p className="rounded-xl bg-[#fffbeb] px-3 py-2.5 text-[13px] font-semibold text-[#78350f] dark:bg-[#2a1d05] dark:text-[#fcd34d]">
                        {say(T.needsTeam)}
                     </p>
                  ) : (
                     <div className="flex items-center gap-3 rounded-xl bg-[#f3effe] px-3 py-2.5 dark:bg-[#1e1535]">
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#6c3fe0]" aria-hidden="true" />
                        <div>
                           <p className="text-[13px] font-semibold text-[#3d1a8a] dark:text-[#c4b5fd]">
                              {status?.received ? say(T.received) : isWalt ? say(T.waitingTeam) : say(T.waiting)}
                           </p>
                           <p className="text-[11px] text-[#6b6090] dark:text-[#a095c8]">{isWalt ? say(T.waitingTeamBody) : say(T.waitingBody)}</p>
                        </div>
                     </div>
                  )}
               </div>
            </div>
         ) : null}
      </div>
   );
}
