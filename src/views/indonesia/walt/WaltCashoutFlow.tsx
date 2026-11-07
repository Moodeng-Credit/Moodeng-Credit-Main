import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AlertTriangle, ArrowDown, CheckCircle2, ExternalLink, Loader2, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { ID_PATHS, WALT_BOT_URL } from '@/lib/idTrack';
import {
   estimateCashout,
   formatRupiah,
   isFinalRelayStatus,
   type RelayTransfer,
   relayWalt,
   RelayWaltError,
   useUsdIdrRate
} from '@/lib/relayWalt';
import { GoldButton, LangToggle, shortAddress, useWaltLang, WaltIcon, type WaltLang } from '@/views/indonesia/walt/waltUi';

// "Kirim ke Walt": cash out from the Moodeng wallet (USDC on Base) to the borrower's Walt address
// (USDC on BNB Chain) through a Relay one-time address. The server picks the recipient from the
// account (users.walt_address) — nothing is pasted here. The send itself is the Withdraw page's
// normal `send()` (face gate, sponsored send, recordWithdrawal), to the quoted deposit address,
// for exactly the quoted amount.

const MIN_USD = 1;
const MAX_USD = 500;
const POLL_MS = 3000;
const SLOW_MS = 3 * 60_000;
const GIVE_UP_MS = 30 * 60_000;
// The server's quote must give back at least this share of what's sent (≈ $0.07 fee on $20 is 0.35%).
const MIN_OUT_RATIO = 0.95;

const T = {
   toWalt: { id: 'Ke Walt kamu', en: 'To your Walt' },
   change: { id: 'Ganti', en: 'Change' },
   noPaste: {
      id: 'Lewat BNB Smart Chain ke alamat Walt yang tersimpan. Tidak perlu tempel apa pun.',
      en: 'Over BNB Smart Chain to your saved Walt address. Nothing to paste.'
   },
   amount: { id: 'Jumlah', en: 'Amount' },
   all: { id: 'Semua', en: 'All' },
   balance: { id: 'Saldo', en: 'Balance' },
   checking: { id: 'Cek saldo…', en: 'Checking balance…' },
   youSend: { id: 'Kamu kirim', en: 'You send' },
   waltGets: { id: 'Walt terima', en: 'Walt gets' },
   becomesUsdt: { id: 'jadi USDT di Walt', en: 'becomes USDT in Walt' },
   fee: { id: 'Biaya', en: 'Fee' },
   time: { id: 'Waktu', en: 'Time' },
   seconds: { id: 'detik', en: 'seconds' },
   button: { id: 'Kirim ke Walt', en: 'Send to Walt' },
   quoting: { id: 'Menyiapkan…', en: 'Getting ready…' },
   sending: { id: 'Mengirim…', en: 'Sending…' },
   tracking: { id: 'Sedang dikirim ke Walt…', en: 'On its way to Walt…' },
   trackingBody: { id: 'Biasanya beberapa detik.', en: 'Usually a few seconds.' },
   slow: { id: 'Agak lama. Uang kamu aman — kami terus cek.', en: 'Taking a little longer. Your money is safe — we keep checking.' },
   doneTitle: { id: 'Sudah sampai di Walt ✅', en: 'Arrived in Walt ✅' },
   doneBody: { id: 'Jual USDT ke Rupiah di P2P.', en: 'Sell USDT for Rupiah on P2P.' },
   openWalt: { id: 'Buka Walt', en: 'Open Walt' },
   finish: { id: 'Selesai', en: 'Done' },
   refundTitle: { id: 'Uang dikembalikan', en: 'Money refunded' },
   refundBody: {
      id: 'Transfer tidak jadi. Uangnya kembali ke dompet Moodeng kamu.',
      en: 'The transfer didn’t go through. The money went back to your Moodeng wallet.'
   },
   failTitle: { id: 'Transfer bermasalah', en: 'Transfer problem' },
   failBody: { id: 'Hubungi kami, kami bantu cek. Simpan halaman ini.', en: 'Contact us and we’ll check it. Keep this page.' },
   notSent: { id: 'Belum terkirim. Uang kamu aman — tidak ada yang hilang.', en: 'Not sent. Your money is safe — nothing was lost.' },
   quoteFail: { id: 'Tidak bisa dapat harga sekarang. Coba lagi sebentar.', en: 'Couldn’t get a price right now. Try again in a minute.' },
   priceMoved: { id: 'Harga berubah. Coba lagi.', en: 'The price changed. Try again.' },
   tryAgain: { id: 'Coba lagi', en: 'Try again' },
   noWalt: { id: 'Simpan alamat Walt kamu dulu.', en: 'Save your Walt address first.' },
   addWalt: { id: 'Tambah alamat Walt', en: 'Add Walt address' },
   min: { id: 'Minimal $1', en: 'Minimum $1' },
   max: { id: 'Maksimal $500 sekali kirim', en: 'Up to $500 per send' },
   over: { id: 'Lebih dari saldo kamu', en: 'More than your balance' },
   loadFail: { id: 'Tidak bisa memuat. Coba lagi.', en: 'Couldn’t load. Try again.' }
} satisfies Record<string, Record<WaltLang, string>>;

type Phase = 'form' | 'quoting' | 'sending' | 'tracking' | 'done' | 'refund' | 'failure';

type Props = {
   isPreview: boolean;
   /** Verified on-chain USDC balance (floored to cents), null while loading. */
   spendable: number | null;
   walletAddress: string;
   send: (
      toAddress: string,
      amount: string,
      exchange: string,
      onSubmitted?: () => void
   ) => Promise<{ hash: string; confirmed: boolean } | null>;
   onDone: () => void;
};

const PREVIEW_WALT = '0x9F8e7D6c5B4a39281706F5e4D3c2B1a098765432';

const errorText = (err: unknown, lang: WaltLang) => {
   if (err instanceof RelayWaltError) {
      if (err.code === 'no_walt') return T.noWalt[lang];
      if (['bad_amount', 'amount_too_low', 'amount_too_high', 'insufficient', 'no_wallet', 'bridge_off'].includes(err.code))
         return err.message;
   }
   return T.quoteFail[lang];
};

export default function WaltCashoutFlow({ isPreview, spendable, walletAddress, send, onDone }: Props) {
   const { lang, toggle } = useWaltLang();
   const navigate = useNavigate();
   const idr = useUsdIdrRate();

   const [walt, setWalt] = useState<string | null>(null);
   const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
   const [amount, setAmount] = useState('');
   const touchedRef = useRef(false);
   const [estimate, setEstimate] = useState<{ amountOut: number; feeUsd: number; seconds: number | null } | null>(null);
   const [estimating, setEstimating] = useState(false);
   const [phase, setPhase] = useState<Phase>('form');
   const [error, setError] = useState<string | null>(null);
   const [transfer, setTransfer] = useState<RelayTransfer | null>(null);
   const [slow, setSlow] = useState(false);

   // Saved Walt address + resume a cash-out that's still on its way.
   const load = useCallback(async () => {
      setLoadState('loading');
      if (isPreview) {
         setWalt(PREVIEW_WALT);
         setLoadState('ready');
         return;
      }
      try {
         const { transfer: last, waltAddress } = await relayWalt.latest('cashout');
         setWalt(waltAddress);
         if (
            last &&
            (last.status === 'sent' || last.status === 'pending') &&
            Date.now() - new Date(last.createdAt).getTime() < 2 * 60 * 60_000
         ) {
            setTransfer(last);
            setPhase('tracking');
         }
         setLoadState('ready');
      } catch {
         setLoadState('error');
      }
   }, [isPreview]);
   useEffect(() => {
      void load();
   }, [load]);

   // Default amount = everything they have (capped at $500), until they type.
   useEffect(() => {
      if (touchedRef.current || spendable == null) return;
      setAmount(spendable >= MIN_USD ? String(Math.min(spendable, MAX_USD)) : '');
   }, [spendable]);

   const amtNum = Number(amount);
   const amountError = useMemo(() => {
      if (!amount) return null;
      if (!/^\d+(\.\d{1,2})?$/.test(amount) || !Number.isFinite(amtNum)) return T.min[lang];
      if (amtNum < MIN_USD) return T.min[lang];
      if (amtNum > MAX_USD) return T.max[lang];
      if (spendable != null && amtNum > spendable) return T.over[lang];
      return null;
   }, [amount, amtNum, spendable, lang]);
   const amountOk = Boolean(amount) && !amountError && spendable != null;

   // Live price preview (Relay, nothing stored), debounced.
   useEffect(() => {
      setEstimate(null);
      if (!amountOk || !walt || phase !== 'form') return;
      if (isPreview) {
         setEstimate({ amountOut: Math.round(amtNum * 0.9966 * 100) / 100, feeUsd: 0.07, seconds: 2 });
         return;
      }
      const ctrl = new AbortController();
      const timer = setTimeout(() => {
         setEstimating(true);
         void estimateCashout({ amountUsdc: amount, wallet: walletAddress, walt, signal: ctrl.signal })
            .then((e) => {
               if (!ctrl.signal.aborted) setEstimate(e);
            })
            .finally(() => {
               if (!ctrl.signal.aborted) setEstimating(false);
            });
      }, 500);
      return () => {
         ctrl.abort();
         clearTimeout(timer);
         setEstimating(false);
      };
   }, [amount, amountOk, amtNum, walt, walletAddress, isPreview, phase]);

   // Follow the transfer until Relay says it arrived (or refunded / failed).
   useEffect(() => {
      if (phase !== 'tracking' || !transfer) return;
      const started = Date.now();
      let alive = true;
      let polls = 0;
      const tick = async () => {
         polls += 1;
         if (Date.now() - started > SLOW_MS) setSlow(true);
         if (Date.now() - started > GIVE_UP_MS) return;
         try {
            const next = isPreview
               ? { ...transfer, status: polls >= 2 ? ('success' as const) : ('pending' as const) }
               : await relayWalt.status(transfer.transferId);
            if (!alive) return;
            setTransfer(next);
            if (next.status === 'success') setPhase('done');
            else if (next.status === 'refund') setPhase('refund');
            else if (next.status === 'failure' || next.status === 'expired') setPhase('failure');
            if (isFinalRelayStatus(next.status)) return;
         } catch {
            // network hiccup: keep polling
         }
         if (alive) timer = setTimeout(tick, POLL_MS);
      };
      let timer = setTimeout(tick, POLL_MS);
      return () => {
         alive = false;
         clearTimeout(timer);
      };
      // Only restart when a new transfer starts tracking.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [phase, transfer?.transferId, isPreview]);

   const submit = async () => {
      if (!amountOk || phase !== 'form') return;
      setError(null);
      setPhase('quoting');
      let quote: RelayTransfer;
      try {
         quote = isPreview
            ? {
                 transferId: 'preview',
                 direction: 'cashout',
                 status: 'quoted',
                 depositAddress: '0x27434a351f0435e8f3d312af9ddce52a8c1e62c3',
                 recipient: PREVIEW_WALT,
                 amountIn: amount,
                 amountInUnits: '0',
                 amountOut: String(Math.round(amtNum * 0.9966 * 1e6) / 1e6),
                 amountOutMin: null,
                 feeUsd: 0.07,
                 timeEstimate: 2,
                 txHash: null,
                 fillTxHash: null,
                 createdAt: new Date().toISOString()
              }
            : await relayWalt.cashoutQuote(amount);
      } catch (err) {
         setError(errorText(err, lang));
         setPhase('form');
         return;
      }
      // Send exactly what was quoted — never a different amount to a strict deposit address.
      if (Number(quote.amountIn) !== amtNum || Number(quote.amountOut ?? 0) < amtNum * MIN_OUT_RATIO) {
         setError(T.priceMoved[lang]);
         setPhase('form');
         return;
      }
      setTransfer(quote);
      setPhase('sending');
      let sent: { hash: string } | null = null;
      try {
         sent = await send(quote.depositAddress, quote.amountIn, 'Walt');
      } catch (err) {
         console.error('[walt] send failed', err);
         sent = null;
      }
      if (!sent) {
         // Rejected, failed, or handed off to the face check (this screen is gone then).
         setError(T.notSent[lang]);
         setPhase('form');
         return;
      }
      if (!isPreview) {
         try {
            setTransfer(await relayWalt.cashoutSent(quote.transferId, sent.hash));
         } catch (err) {
            // Not fatal: Relay still sees the deposit; status polling works without the hash.
            console.warn('[walt] could not record the tx hash', err);
         }
      }
      setSlow(false);
      setPhase('tracking');
   };

   const outAmount = estimate?.amountOut ?? null;
   const rupiah = outAmount != null ? formatRupiah(outAmount, idr) : amountOk ? formatRupiah(amtNum, idr) : null;

   // ── screens ────────────────────────────────────────────────────────────────────────────────
   const header = (
      <div className="mb-[12px] flex justify-end">
         <LangToggle lang={lang} onToggle={toggle} />
      </div>
   );

   if (loadState === 'loading') {
      return (
         <div className="flex items-center justify-center py-[48px] text-[var(--text-muted)]">
            <Loader2 className="h-[22px] w-[22px] animate-spin" aria-hidden="true" />
         </div>
      );
   }
   if (loadState === 'error') {
      return (
         <div className="space-y-[12px] py-[24px] text-center">
            {header}
            <p className="text-[14px] text-[var(--text-muted)]">{T.loadFail[lang]}</p>
            <GoldButton onClick={() => void load()}>{T.tryAgain[lang]}</GoldButton>
         </div>
      );
   }
   if (!walt) {
      return (
         <div className="space-y-[14px] py-[16px]">
            {header}
            <div className="flex flex-col items-center gap-[10px] text-center">
               <WaltIcon size={56} />
               <p className="text-[16px] font-semibold text-[var(--ink)]">{T.noWalt[lang]}</p>
            </div>
            <GoldButton onClick={() => navigate(`${ID_PATHS.onboarding}?step=walt`)}>{T.addWalt[lang]}</GoldButton>
         </div>
      );
   }

   if (phase === 'tracking' || phase === 'done' || phase === 'refund' || phase === 'failure') {
      const sentAmount = transfer?.amountIn ?? amount;
      const got = transfer?.amountOut ? Number(transfer.amountOut) : null;
      return (
         <div className="space-y-[16px] py-[8px]">
            {header}
            <div className="flex flex-col items-center gap-[10px] rounded-[18px] border-2 border-[var(--border-card)] bg-[var(--surface)] px-[18px] py-[24px] text-center">
               {phase === 'tracking' ? (
                  <>
                     <Loader2 className="h-[36px] w-[36px] animate-spin text-[#1e96c8]" aria-hidden="true" />
                     <p className="text-[18px] font-bold text-[var(--ink)]">{T.tracking[lang]}</p>
                     <p className="text-[13px] text-[var(--text-muted)]">{slow ? T.slow[lang] : T.trackingBody[lang]}</p>
                  </>
               ) : phase === 'done' ? (
                  <>
                     <CheckCircle2 className="h-[40px] w-[40px] text-[#16a34a]" aria-hidden="true" />
                     <p className="text-[20px] font-bold text-[var(--ink)]">{T.doneTitle[lang]}</p>
                     <p className="text-[14px] text-[var(--text-muted)]">{T.doneBody[lang]}</p>
                  </>
               ) : phase === 'refund' ? (
                  <>
                     <RotateCcw className="h-[36px] w-[36px] text-[#d97706]" aria-hidden="true" />
                     <p className="text-[18px] font-bold text-[var(--ink)]">{T.refundTitle[lang]}</p>
                     <p className="text-[13px] text-[var(--text-muted)]">{T.refundBody[lang]}</p>
                  </>
               ) : (
                  <>
                     <AlertTriangle className="h-[36px] w-[36px] text-[#dc2626]" aria-hidden="true" />
                     <p className="text-[18px] font-bold text-[var(--ink)]">{T.failTitle[lang]}</p>
                     <p className="text-[13px] text-[var(--text-muted)]">{T.failBody[lang]}</p>
                  </>
               )}
               <p className="text-[13px] text-[var(--text-faint)]">
                  ${sentAmount} USDC → {got != null ? `≈ ${got.toFixed(2)} USDC` : '…'} · Walt {shortAddress(walt)}
               </p>
               {got != null && phase !== 'refund' && formatRupiah(got, idr) && (
                  <p className="text-[13px] font-semibold text-[var(--ink)]">{formatRupiah(got, idr)}</p>
               )}
            </div>
            {phase === 'done' ? (
               <>
                  <GoldButton onClick={() => window.open(WALT_BOT_URL, '_blank', 'noopener,noreferrer')}>
                     {T.openWalt[lang]} <ExternalLink className="h-[16px] w-[16px]" aria-hidden="true" />
                  </GoldButton>
                  <button type="button" onClick={onDone} className="w-full py-[8px] text-[14px] font-semibold text-[var(--primary)]">
                     {T.finish[lang]}
                  </button>
               </>
            ) : phase === 'tracking' ? null : (
               <GoldButton
                  onClick={() => {
                     setTransfer(null);
                     setError(null);
                     setPhase('form');
                  }}
               >
                  {T.tryAgain[lang]}
               </GoldButton>
            )}
         </div>
      );
   }

   const busy = phase === 'quoting' || phase === 'sending';
   return (
      <div className="space-y-[14px] py-[4px]">
         {header}

         {/* Saved Walt address — nothing to paste */}
         <div className="flex items-center gap-[12px] rounded-[18px] border-2 border-[var(--border-card)] bg-[var(--surface)] p-[14px]">
            <WaltIcon />
            <div className="min-w-0 flex-1">
               <p className="text-[12px] text-[var(--text-muted)]">{T.toWalt[lang]}</p>
               <p className="font-mono text-[15px] font-semibold text-[var(--ink)]">{shortAddress(walt)}</p>
            </div>
            <button
               type="button"
               onClick={() => navigate(`${ID_PATHS.onboarding}?step=walt`)}
               className="shrink-0 text-[13px] font-semibold text-[var(--accent,#6c3fe0)] underline-offset-2 hover:underline"
            >
               {T.change[lang]}
            </button>
         </div>
         <p className="px-[2px] text-[12px] leading-[16px] text-[var(--text-muted)]">{T.noPaste[lang]}</p>

         {/* Amount */}
         <div className="rounded-[18px] border-2 border-[var(--border-card)] bg-[var(--surface)] p-[14px]">
            <div className="flex items-center justify-between">
               <label htmlFor="walt-amount" className="text-[13px] font-semibold text-[var(--ink)]">
                  {T.amount[lang]}
               </label>
               <span className="text-[12px] text-[var(--text-muted)]">
                  {spendable == null ? T.checking[lang] : `${T.balance[lang]}: $${spendable}`}
               </span>
            </div>
            <div className="mt-[8px] flex items-center gap-[8px]">
               <span className="text-[28px] font-bold text-[var(--ink)]">$</span>
               <input
                  id="walt-amount"
                  inputMode="decimal"
                  autoComplete="off"
                  value={amount}
                  disabled={busy}
                  onChange={(e) => {
                     touchedRef.current = true;
                     setError(null);
                     setAmount(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''));
                  }}
                  className="min-w-0 flex-1 bg-transparent text-[28px] font-bold text-[var(--ink)] outline-none"
                  placeholder="0"
               />
               {spendable != null && spendable >= MIN_USD && (
                  <button
                     type="button"
                     disabled={busy}
                     onClick={() => {
                        touchedRef.current = true;
                        setAmount(String(Math.min(spendable, MAX_USD)));
                     }}
                     className="shrink-0 rounded-full bg-[var(--surface-2,#f3effe)] px-[12px] py-[6px] text-[12px] font-bold text-[var(--ink)]"
                  >
                     {T.all[lang]}
                  </button>
               )}
            </div>
            {amountError && <p className="mt-[6px] text-[12px] font-semibold text-[#dc2626]">{amountError}</p>}
         </div>

         {/* Price preview */}
         {amountOk && (
            <div className="space-y-[8px] rounded-[18px] bg-[var(--surface-2,#f3effe)] p-[14px] text-[13px]">
               <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">{T.youSend[lang]}</span>
                  <span className="font-semibold text-[var(--ink)]">${amount} USDC</span>
               </div>
               <div className="flex justify-center text-[var(--text-faint)]">
                  <ArrowDown className="h-[14px] w-[14px]" aria-hidden="true" />
               </div>
               <div className="flex items-start justify-between gap-[8px]">
                  <span className="text-[var(--text-muted)]">{T.waltGets[lang]}</span>
                  <span className="text-right">
                     <span className="block font-semibold text-[var(--ink)]">
                        {outAmount != null ? `≈ ${outAmount.toFixed(2)} USDC` : estimating ? '…' : '—'}
                     </span>
                     <span className="block text-[11px] text-[var(--text-muted)]">{T.becomesUsdt[lang]}</span>
                     {rupiah && <span className="block text-[12px] font-semibold text-[var(--ink)]">{rupiah}</span>}
                  </span>
               </div>
               {estimate && (
                  <div className="flex items-center justify-between border-t border-[var(--divider,#ede9f8)] pt-[8px] text-[12px] text-[var(--text-muted)]">
                     <span>
                        {T.fee[lang]} ≈ ${estimate.feeUsd.toFixed(2)}
                     </span>
                     <span>
                        {T.time[lang]} ~{Math.max(estimate.seconds ?? 5, 5)} {T.seconds[lang]}
                     </span>
                  </div>
               )}
            </div>
         )}

         {error && (
            <div
               role="alert"
               className="flex gap-[8px] rounded-[14px] border border-[#fcd34d] bg-[#fffbeb] px-[12px] py-[10px] dark:border-[#78350f] dark:bg-[#2a1d05]"
            >
               <AlertTriangle className="mt-[1px] h-[16px] w-[16px] shrink-0 text-[#d97706]" aria-hidden="true" />
               <p className="text-[13px] text-[#78350f] dark:text-[#fcd34d]">{error}</p>
            </div>
         )}

         <GoldButton onClick={() => void submit()} disabled={!amountOk} busy={busy}>
            {phase === 'quoting' ? T.quoting[lang] : phase === 'sending' ? T.sending[lang] : T.button[lang]}
         </GoldButton>
      </div>
   );
}
