import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AlertTriangle, ArrowDown, CheckCircle2, ClipboardPaste, Loader2, RotateCcw } from 'lucide-react';
import posthog from 'posthog-js';

import GuideCards, { type GuideCard } from '@/components/guide/GuideCards';

import { openMessengerSupport } from '@/config/contactVerification';
import { EXTERNAL_LINKS } from '@/config/externalLinks';
import { estimateToSolana, isFinalRelayStatus, relayMaya, type RelayTransfer, relayWalt, RelayWaltError } from '@/lib/relayWalt';
import { useUsdcRate } from '@/lib/useUsdcRate';
import { CONNECT_HIPPOS } from '@/views/dashboard/components/connectKit';
import { Card as GoldCard, StepHead } from '@/views/indonesia/ui';
import { GoldButton, shortAddress } from '@/views/indonesia/walt/waltUi';

// "Send to Maya": cash out from the Moodeng wallet (USDC on Base) to the borrower's Maya
// (USDC on Solana) through a Relay one-time address on Base. Maya can hold and sell USDC, but only
// on Ethereum or Solana; Solana is the cheap one. The borrower saves their Maya "Receive USDC"
// address (Solana network) once; the server always sends to that saved address. The send itself is
// the Withdraw page's normal `send()` (face gate, sponsored send, recordWithdrawal), to the quoted
// deposit address, for exactly the quoted amount.

const MIN_USD = 1;
const MAX_USD = 500;
const POLL_MS = 3000;
const SLOW_MS = 3 * 60_000;
const GIVE_UP_MS = 30 * 60_000;
const MIN_OUT_RATIO = 0.95;
// Approved in the wallet but no tx hash recorded yet: survives a reload so the same deposit
// address is never paid twice (see WaltCashoutFlow).
const SUBMITTED_KEY = 'moodeng:maya-cashout-submitted';
const readSubmitted = (): string | null => {
   try {
      return window.localStorage.getItem(SUBMITTED_KEY);
   } catch {
      return null;
   }
};
const writeSubmitted = (transferId: string | null) => {
   try {
      if (transferId) window.localStorage.setItem(SUBMITTED_KEY, transferId);
      else window.localStorage.removeItem(SUBMITTED_KEY);
   } catch {
      // storage blocked: the in-memory state still guards this visit
   }
};

type Phase = 'form' | 'quoting' | 'sending' | 'tracking' | 'stuck' | 'done' | 'refund' | 'failure';

type Props = {
   isPreview: boolean;
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

const PREVIEW_MAYA = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

export function MayaIcon({ size = 46 }: { size?: number }) {
   return (
      <img
         src="/bank-logos/maya.webp"
         alt=""
         aria-hidden="true"
         className="shrink-0 rounded-[12px] object-contain"
         style={{ width: size, height: size }}
      />
   );
}

const errorText = (err: unknown) => {
   if (err instanceof RelayWaltError && err.code !== 'error' && err.code !== 'bad_response') return err.message;
   return 'Couldn’t get a price right now. Try again in a minute.';
};

/** Whether Send to Maya is open for this account (server switch telegram_bot_settings.maya_bridge). */
export function useMayaEnabled(isPreview: boolean): boolean {
   const [enabled, setEnabled] = useState(isPreview);
   useEffect(() => {
      if (isPreview) return;
      let alive = true;
      relayMaya
         .latest()
         .then((r) => {
            if (alive) setEnabled(r.enabled);
         })
         .catch(() => {
            // not signed in / offline: just don't show the row
         });
      return () => {
         alive = false;
      };
   }, [isPreview]);
   return enabled;
}

const peso = (usd: number, rate: number) => `≈ ₱${Math.round(usd * rate).toLocaleString('en-PH')}`;

// PostHog only initialises in production (see main.tsx).
const track = (event: string, props?: Record<string, unknown>) => {
   if (import.meta.env.PROD) posthog.capture(event, props);
};

// Real Maya screenshots (address + QR blurred), same picture cards as the PDAX / GCrypto cash-out.
const MAYA_IMG = '/cashout-guides/maya';
const MAYA_CARDS: GuideCard[] = [
   { key: 'crypto', title: 'Open Maya → Crypto', img: `${MAYA_IMG}/step1-crypto.webp`, open: true },
   { key: 'more', title: 'Tap ⋯ next to Sell', img: `${MAYA_IMG}/step2-more.webp` },
   { key: 'receive', title: 'Tap Receive', img: `${MAYA_IMG}/step3-receive.webp` },
   { key: 'usdc', title: 'Search usdc → USD Coin', img: `${MAYA_IMG}/step4-usdc.webp` },
   { key: 'solana', title: 'Pick Solana', img: `${MAYA_IMG}/step5-solana.webp`, danger: 'Solana, not Ethereum' },
   { key: 'copy', title: 'Copy your address', text: 'Tap the copy icon.', img: `${MAYA_IMG}/step6-copy.webp` }
];

/** Saving the Maya Solana address: picture steps, then the paste box. */
function MayaAddressSetup({ initial, onSaved, onCancel }: { initial: string; onSaved: (a: string) => void; onCancel?: () => void }) {
   const [value, setValue] = useState(initial);
   const [saving, setSaving] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const looksEth = /^0x/i.test(value.trim());

   const save = async () => {
      setSaving(true);
      setError(null);
      try {
         onSaved(await relayMaya.save(value));
      } catch (err) {
         setError(err instanceof RelayWaltError ? err.message : 'Couldn’t save it. Try again.');
      } finally {
         setSaving(false);
      }
   };

   const paste = async () => {
      try {
         const text = await navigator.clipboard.readText();
         if (text) setValue(text.trim());
      } catch {
         // clipboard blocked: they can long-press and paste
      }
   };

   const pasteCard = (
      <GoldCard>
         <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#ffd75a] text-[17px] font-extrabold text-[#4a2a00]">
               {MAYA_CARDS.length + 1}
            </span>
            <h3 className="min-w-0 flex-1 text-[20px] font-extrabold leading-[24px] tracking-[-0.01em]">Paste it here</h3>
         </div>
         <div
            className={`flex min-h-[56px] items-center gap-2 rounded-[14px] border-2 bg-white px-3 dark:bg-[#1a1524] ${
               looksEth || error ? 'border-[#e5484d]' : 'border-[#ecdfb8] dark:border-[#4a3d1c]'
            }`}
         >
            <input
               aria-label="Maya Solana address"
               autoComplete="off"
               autoCapitalize="off"
               spellCheck={false}
               value={value}
               onChange={(e) => {
                  setError(null);
                  setValue(e.target.value.trim());
               }}
               placeholder="Paste your Maya address"
               className="min-w-0 flex-1 bg-transparent font-mono text-[15px] font-semibold outline-none placeholder:font-sans placeholder:font-medium placeholder:text-[#a8987a]"
            />
            <button
               type="button"
               onClick={() => void paste()}
               className="flex shrink-0 items-center gap-1 rounded-full bg-[#fff1c2] px-3 py-1.5 text-[14px] font-extrabold text-[#6b4a00] dark:bg-[#3a2e10] dark:text-[#ffe27a]"
            >
               <ClipboardPaste className="size-4" aria-hidden="true" /> Paste
            </button>
         </div>
         {looksEth || error ? (
            <p role="alert" className="text-[14px] font-bold text-[#c0392b]">
               {looksEth ? 'That’s the Ethereum address. Pick Solana in Maya, then copy again.' : error}
            </p>
         ) : (
            <p className="text-center text-[15px] font-extrabold text-[#b91c1c] dark:text-[#fca5a5]">⚠️ Solana network only</p>
         )}
         <GoldButton onClick={() => void save()} disabled={!value || looksEth} busy={saving}>
            Save Maya address
         </GoldButton>
      </GoldCard>
   );

   return (
      <div className="flex flex-col gap-4 pb-2 text-[#2b2116] dark:text-[#f5efe3]">
         <StepHead image={CONNECT_HIPPOS.codeCopied} title="Your Maya address" subtitle="Once only." />
         <GuideCards
            appName="Maya"
            cards={MAYA_CARDS}
            onOpenApp={() => window.open('https://www.maya.ph', '_blank', 'noopener,noreferrer')}
            finalStep={pasteCard}
            memoryKey="moodeng-cashout-guide:Maya:address"
            onStep={(index, key) => track('withdraw_guide_step', { exchange: 'Maya', part: 'address', step: key, index })}
         />
         {onCancel ? (
            <button type="button" onClick={onCancel} className="w-full py-[8px] text-[14px] font-semibold text-[var(--primary)]">
               Cancel
            </button>
         ) : null}
      </div>
   );
}

export default function MayaCashoutFlow({ isPreview, spendable, walletAddress, send, onDone }: Props) {
   const { value: phpRate } = useUsdcRate('php');

   const [maya, setMaya] = useState<string | null>(null);
   const [editing, setEditing] = useState(false);
   const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error' | 'closed'>('loading');
   const [amount, setAmount] = useState('');
   const touchedRef = useRef(false);
   const [estimate, setEstimate] = useState<{ amountOut: number; feeUsd: number; seconds: number | null } | null>(null);
   const [estimating, setEstimating] = useState(false);
   const [phase, setPhase] = useState<Phase>('form');
   const [error, setError] = useState<string | null>(null);
   const [transfer, setTransfer] = useState<RelayTransfer | null>(null);
   const [slow, setSlow] = useState(false);
   const submittedRef = useRef(false);
   const [unconfirmed, setUnconfirmed] = useState(false);

   const load = useCallback(async () => {
      setLoadState('loading');
      if (isPreview) {
         setMaya(PREVIEW_MAYA);
         setLoadState('ready');
         return;
      }
      try {
         const { transfer: last, mayaAddress, enabled } = await relayMaya.latest();
         if (!enabled) {
            setLoadState('closed');
            return;
         }
         setMaya(mayaAddress);
         const submittedId = readSubmitted();
         const submittedNoHash = Boolean(last && submittedId === last.transferId && last.status === 'quoted');
         if (last && isFinalRelayStatus(last.status) && submittedId === last.transferId) writeSubmitted(null);
         if (submittedNoHash && last) {
            submittedRef.current = true;
            setUnconfirmed(true);
            setTransfer(last);
            setPhase('tracking');
         } else if (
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

   useEffect(() => {
      if (touchedRef.current || spendable == null) return;
      setAmount(spendable >= MIN_USD ? String(Math.min(spendable, MAX_USD)) : '');
   }, [spendable]);

   const amtNum = Number(amount);
   const amountError = useMemo(() => {
      if (!amount) return null;
      if (!/^\d+(\.\d{1,2})?$/.test(amount) || !Number.isFinite(amtNum) || amtNum < MIN_USD) return 'Minimum $1';
      if (amtNum > MAX_USD) return 'Up to $500 per send';
      if (spendable != null && amtNum > spendable) return 'More than your balance';
      return null;
   }, [amount, amtNum, spendable]);
   const amountOk = Boolean(amount) && !amountError && spendable != null;

   useEffect(() => {
      setEstimate(null);
      if (!amountOk || !maya || phase !== 'form') return;
      if (isPreview) {
         setEstimate({ amountOut: Math.round(amtNum * 0.9985 * 100) / 100, feeUsd: 0.03, seconds: 2 });
         return;
      }
      const ctrl = new AbortController();
      const timer = setTimeout(() => {
         setEstimating(true);
         void estimateToSolana({ amountUsdc: amount, wallet: walletAddress, recipient: maya, signal: ctrl.signal })
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
   }, [amount, amountOk, amtNum, maya, walletAddress, isPreview, phase]);

   useEffect(() => {
      if (phase !== 'tracking' || !transfer) return;
      const started = Date.now();
      let alive = true;
      let polls = 0;
      const tick = async () => {
         polls += 1;
         if (Date.now() - started > SLOW_MS) setSlow(true);
         if (Date.now() - started > GIVE_UP_MS) {
            if (alive) setPhase('stuck');
            return;
         }
         try {
            const next = isPreview
               ? { ...transfer, status: polls >= 2 ? ('success' as const) : ('pending' as const) }
               : await relayWalt.status(transfer.transferId);
            if (!alive) return;
            setTransfer(next);
            if (isFinalRelayStatus(next.status)) writeSubmitted(null);
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
      if (!amountOk || phase !== 'form' || !maya) return;
      setError(null);
      setPhase('quoting');
      let quote: RelayTransfer;
      try {
         quote = isPreview
            ? {
                 transferId: 'preview',
                 direction: 'maya',
                 status: 'quoted',
                 depositAddress: '0x27434a351f0435e8f3d312af9ddce52a8c1e62c3',
                 recipient: PREVIEW_MAYA,
                 amountIn: amount,
                 amountInUnits: '0',
                 amountOut: String(Math.round(amtNum * 0.9985 * 1e6) / 1e6),
                 amountOutMin: null,
                 feeUsd: 0.03,
                 timeEstimate: 2,
                 txHash: null,
                 fillTxHash: null,
                 createdAt: new Date().toISOString()
              }
            : await relayMaya.quote(amount);
      } catch (err) {
         setError(errorText(err));
         setPhase('form');
         return;
      }
      // Solana addresses are case-sensitive: must be exactly the address this screen shows.
      if (quote.recipient !== maya) {
         setError('The Maya address didn’t match. Nothing was sent. Reload the page.');
         setPhase('form');
         return;
      }
      if (Number(quote.amountIn) !== amtNum || Number(quote.amountOut ?? 0) < amtNum * MIN_OUT_RATIO) {
         setError('The price changed. Try again.');
         setPhase('form');
         return;
      }
      setTransfer(quote);
      setPhase('sending');
      submittedRef.current = false;
      setUnconfirmed(false);
      let sent: { hash: string } | null = null;
      try {
         sent = await send(quote.depositAddress, quote.amountIn, 'Maya', () => {
            submittedRef.current = true;
            if (!isPreview) writeSubmitted(quote.transferId);
         });
      } catch (err) {
         console.error('[maya] send failed', err);
         sent = null;
      }
      if (!sent) {
         if (submittedRef.current) {
            setUnconfirmed(true);
            setSlow(false);
            setPhase('tracking');
            return;
         }
         setError('Not sent. Your money is safe — nothing was lost.');
         setPhase('form');
         return;
      }
      if (!isPreview) {
         writeSubmitted(null);
         try {
            setTransfer(await relayWalt.cashoutSent(quote.transferId, sent.hash));
         } catch (err) {
            console.warn('[maya] could not record the tx hash', err);
         }
      }
      setSlow(false);
      setPhase('tracking');
   };

   if (loadState === 'loading') {
      return (
         <div className="flex items-center justify-center py-[48px] text-[var(--text-muted)]">
            <Loader2 className="h-[22px] w-[22px] animate-spin" aria-hidden="true" />
         </div>
      );
   }
   if (loadState === 'error' || loadState === 'closed') {
      return (
         <div className="space-y-[12px] py-[24px] text-center">
            <p className="text-[14px] text-[var(--text-muted)]">
               {loadState === 'closed' ? 'Send to Maya isn’t open yet.' : 'Couldn’t load. Try again.'}
            </p>
            {loadState === 'error' && <GoldButton onClick={() => void load()}>Try again</GoldButton>}
         </div>
      );
   }
   if (!maya || editing) {
      return (
         <MayaAddressSetup
            initial=""
            onSaved={(a) => {
               setMaya(a);
               setEditing(false);
            }}
            onCancel={maya ? () => setEditing(false) : undefined}
         />
      );
   }

   if (phase === 'tracking' || phase === 'stuck' || phase === 'done' || phase === 'refund' || phase === 'failure') {
      const sentAmount = transfer?.amountIn ?? amount;
      const got = transfer?.amountOut ? Number(transfer.amountOut) : null;
      return (
         <div className="space-y-[16px] py-[8px]">
            <div className="flex flex-col items-center gap-[10px] rounded-[18px] border-2 border-[var(--border-card)] bg-[var(--surface)] px-[18px] py-[24px] text-center">
               {phase === 'tracking' ? (
                  <>
                     <Loader2 className="h-[36px] w-[36px] animate-spin text-[#00a651]" aria-hidden="true" />
                     <p className="text-[18px] font-bold text-[var(--ink)]">
                        {unconfirmed ? 'Confirming — don’t send again' : 'On its way to Maya…'}
                     </p>
                     <p className="text-[13px] text-[var(--text-muted)]">
                        {slow
                           ? 'Taking a little longer. Your money is safe — we keep checking.'
                           : unconfirmed
                             ? 'Your payment was approved. Wait here and don’t send it again.'
                             : 'Usually a few seconds.'}
                     </p>
                  </>
               ) : phase === 'stuck' ? (
                  <>
                     <AlertTriangle className="h-[36px] w-[36px] text-[#d97706]" aria-hidden="true" />
                     <p className="text-[18px] font-bold text-[var(--ink)]">No update yet</p>
                     <p className="text-[13px] text-[var(--text-muted)]">
                        This transfer hasn’t finished yet. Don’t send again. Check again later, or contact us.
                     </p>
                  </>
               ) : phase === 'done' ? (
                  <>
                     <CheckCircle2 className="h-[40px] w-[40px] text-[#16a34a]" aria-hidden="true" />
                     <p className="text-[20px] font-bold text-[var(--ink)]">Arrived in Maya ✅</p>
                     <p className="text-[14px] text-[var(--text-muted)]">
                        In Maya: Crypto → USDC → <b>Sell</b> to get pesos.
                     </p>
                  </>
               ) : phase === 'refund' ? (
                  <>
                     <RotateCcw className="h-[36px] w-[36px] text-[#d97706]" aria-hidden="true" />
                     <p className="text-[18px] font-bold text-[var(--ink)]">Money refunded</p>
                     <p className="text-[13px] text-[var(--text-muted)]">
                        The transfer didn’t go through. The money went back to your Moodeng wallet.
                     </p>
                  </>
               ) : (
                  <>
                     <AlertTriangle className="h-[36px] w-[36px] text-[#dc2626]" aria-hidden="true" />
                     <p className="text-[18px] font-bold text-[var(--ink)]">Transfer problem</p>
                     <p className="text-[13px] text-[var(--text-muted)]">Contact us and we’ll check it. Keep this page.</p>
                  </>
               )}
               <p className="text-[13px] text-[var(--text-faint)]">
                  ${sentAmount} USDC → {got != null ? `≈ ${got.toFixed(2)} USDC` : '…'} · Maya {shortAddress(maya)}
               </p>
               {got != null && phase !== 'refund' && <p className="text-[13px] font-semibold text-[var(--ink)]">{peso(got, phpRate)}</p>}
            </div>
            {phase === 'done' ? (
               <GoldButton onClick={onDone}>Done</GoldButton>
            ) : phase === 'tracking' ? null : phase === 'stuck' ? (
               <>
                  <GoldButton
                     onClick={() => {
                        setSlow(true);
                        setPhase('tracking');
                     }}
                  >
                     Check again
                  </GoldButton>
                  <button
                     type="button"
                     onClick={() => openMessengerSupport(EXTERNAL_LINKS.support.messenger)}
                     className="w-full py-[8px] text-[14px] font-semibold text-[var(--primary)]"
                  >
                     Contact us
                  </button>
               </>
            ) : (
               <>
                  <GoldButton
                     onClick={() => {
                        setTransfer(null);
                        setError(null);
                        setUnconfirmed(false);
                        submittedRef.current = false;
                        setPhase('form');
                     }}
                  >
                     Try again
                  </GoldButton>
                  {phase === 'failure' && (
                     <button
                        type="button"
                        onClick={() => openMessengerSupport(EXTERNAL_LINKS.support.messenger)}
                        className="w-full py-[8px] text-[14px] font-semibold text-[var(--primary)]"
                     >
                        Contact us
                     </button>
                  )}
               </>
            )}
         </div>
      );
   }

   const busy = phase === 'quoting' || phase === 'sending';
   const outAmount = estimate?.amountOut ?? null;
   return (
      <div className="space-y-[14px] py-[4px]">
         <div className="flex items-center gap-[12px] rounded-[18px] border-2 border-[var(--border-card)] bg-[var(--surface)] p-[14px]">
            <MayaIcon />
            <div className="min-w-0 flex-1">
               <p className="text-[12px] text-[var(--text-muted)]">To your Maya (Solana)</p>
               <p className="font-mono text-[15px] font-semibold text-[var(--ink)]">{shortAddress(maya)}</p>
            </div>
            <button
               type="button"
               disabled={busy}
               onClick={() => setEditing(true)}
               className="shrink-0 text-[13px] font-semibold text-[var(--accent,#6c3fe0)] underline-offset-2 hover:underline"
            >
               Change
            </button>
         </div>

         <div className="rounded-[18px] border-2 border-[var(--border-card)] bg-[var(--surface)] p-[14px]">
            <div className="flex items-center justify-between">
               <label htmlFor="maya-amount" className="text-[13px] font-semibold text-[var(--ink)]">
                  Amount
               </label>
               <span className="text-[12px] text-[var(--text-muted)]">
                  {spendable == null ? 'Checking balance…' : `Balance: $${spendable}`}
               </span>
            </div>
            <div className="mt-[8px] flex items-center gap-[8px]">
               <span className="text-[28px] font-bold text-[var(--ink)]">$</span>
               <input
                  id="maya-amount"
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
                     All
                  </button>
               )}
            </div>
            {amountError && <p className="mt-[6px] text-[12px] font-semibold text-[#dc2626]">{amountError}</p>}
         </div>

         {amountOk && (
            <div className="space-y-[8px] rounded-[18px] bg-[var(--surface-2,#f3effe)] p-[14px] text-[13px]">
               <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">You send</span>
                  <span className="font-semibold text-[var(--ink)]">${amount} USDC</span>
               </div>
               <div className="flex justify-center text-[var(--text-faint)]">
                  <ArrowDown className="h-[14px] w-[14px]" aria-hidden="true" />
               </div>
               <div className="flex items-start justify-between gap-[8px]">
                  <span className="text-[var(--text-muted)]">Maya gets</span>
                  <span className="text-right">
                     <span className="block font-semibold text-[var(--ink)]">
                        {outAmount != null ? `≈ ${outAmount.toFixed(2)} USDC` : estimating ? '…' : '—'}
                     </span>
                     <span className="block text-[12px] font-semibold text-[var(--ink)]">{peso(outAmount ?? amtNum, phpRate)}</span>
                  </span>
               </div>
               {estimate && (
                  <div className="flex items-center justify-between border-t border-[var(--divider,#ede9f8)] pt-[8px] text-[12px] text-[var(--text-muted)]">
                     <span>Fee ≈ ${estimate.feeUsd.toFixed(2)}</span>
                     <span>~{Math.max(estimate.seconds ?? 5, 5)} seconds</span>
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
            {phase === 'quoting' ? 'Getting ready…' : phase === 'sending' ? 'Sending…' : 'Send to Maya'}
         </GoldButton>
      </div>
   );
}
