'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchPayoutWalletStatus, type PayoutWalletStatus } from '@/app/admin/IdPayoutWalletPanel';
import IdVaultFundBlock from '@/app/admin/IdVaultFundBlock';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Indonesia track: fund a request to the borrower's Walt (USDC on BNB Smart Chain).
 *   Primary: "Pay now from payout wallet" — the server sends it from Moodeng's Openfort payout wallet
 *   (walt_payout_auto → payNow in supabase/functions/_shared/idManualFunding.ts), at most once.
 *   Fallback: pay by hand from Binance TH. Copy the address + exact amount, send it, tap "I sent it" —
 *   the app finds the transfer on BNB Chain by itself and marks the loan funded. Or paste the TxID.
 */

type Payout = {
   walt_address: string;
   amount: number | string;
   marked_sent_at: string | null;
   status: 'waiting' | 'paying' | 'found' | 'not_found' | 'failed';
   bsc_tx_hash: string | null;
   found_by: string | null;
   method?: 'manual' | 'auto';
   openfort_tx_id?: string | null;
   paid_attempt_at?: string | null;
   chain_checked_at?: string | null;
   error?: string | null;
};

export type WaltPayoutResult = {
   ok: boolean;
   state?: 'found' | 'waiting' | 'paying' | 'released';
   error?: string;
   payout?: Payout | null;
   funded?: boolean;
   loanOpen?: boolean;
};

const ERRORS: Record<string, string> = {
   no_walt_address: 'This borrower hasn’t saved a Walt address yet.',
   loan_not_open: 'This request isn’t open any more (already funded or closed).',
   not_indonesia_loan: 'Not an Indonesia-track request.',
   bad_txid: 'That isn’t a BNB Chain TxID (0x + 64 characters).',
   tx_not_found_on_bnb_chain: 'That TxID isn’t on BNB Chain. Did Binance TH send it on BSC?',
   tx_failed: 'That transaction failed on BNB Chain.',
   tx_too_new_try_again: 'Too new — wait a minute and try again.',
   tx_not_usdc_to_their_walt: 'That transaction isn’t USDC to this borrower’s Walt address.',
   tx_wrong_amount: 'Amount received doesn’t match the loan (must be within $0.50 under it).',
   tx_already_used: 'That transaction already funded another loan.',
   lender_has_no_base_wallet: 'Your account has no Base wallet on file, so repayments would have nowhere to go.',
   no_lender_of_record: 'No lender of record configured.',
   bnb_chain_unreachable: 'Couldn’t reach BNB Chain. Try again in a minute.',
   loan_already_funded: 'Found the payout, but the loan was funded by someone else meanwhile. Check it — money may have gone out twice.',
   auto_payout_in_progress: 'The payout wallet is paying this one right now. Don’t pay by hand.',
   auto_payout_failed: 'The payout wallet’s payment failed. Check the wallet on BscScan before paying by hand.',
   auto_payout_failed_before:
      'An automatic payment already failed for this loan; it won’t be retried. Check the wallet on BscScan, then pay by hand.',
   being_paid_by_hand: 'Someone tapped “I sent it” — this one is being paid by hand.',
   not_configured: 'The payout wallet isn’t set up (Openfort keys missing).',
   no_payout_wallet: 'No payout wallet yet — create it at the top of Requests.',
   over_max: 'Over the automatic payout limit — pay by hand.',
   daily_cap_reached: 'Today’s automatic payout cap is reached — pay by hand or wait for tomorrow.',
   low_balance: 'Not enough money in the payout wallet — top it up or pay by hand.',
   balance_unknown: 'Couldn’t read the payout wallet balance. Try again in a minute.',
   already_claimed: 'This loan was already picked up for payment.',
   payout_not_claimable: 'This payout is already being handled.',
   auto_payout_landing: 'The payout wallet’s transfer is on BNB Chain and confirming — wait a minute, don’t pay by hand.',
   chain_check_too_soon: 'The automatic payment is under 15 minutes old — it could still land. Try again in a few minutes.',
   chain_check_incomplete: 'Still searching BNB Chain for the automatic payment. Try again in a minute.',
   not_releasable: 'Only a stuck or failed automatic payment can be released.',
   payout_not_found: 'No payout record for this loan yet.',
   no_time_left: 'Not enough time left to send safely. Try again.'
};

export const waltPayoutErrorText = (code: string | undefined) => (code && ERRORS[code]) || code || 'Something went wrong.';

export const callWaltPayout = async (body: Record<string, unknown>): Promise<WaltPayoutResult> => {
   const { data, error } = await getSupabaseBrowserClient().functions.invoke('admin-fund-loan', { body });
   if (error) {
      const ctx = (error as { context?: Response }).context;
      const parsed =
         ctx && typeof ctx.clone === 'function'
            ? await ctx
                 .clone()
                 .json()
                 .catch(() => null)
            : null;
      return { ok: false, error: (parsed as { error?: string } | null)?.error ?? error.message };
   }
   return data as WaltPayoutResult;
};

function CopyRow({ label, value, display }: { label: string; value: string; display?: string }) {
   const [copied, setCopied] = useState(false);
   return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
         <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase text-[#7a7a7a]">{label}</p>
            <p className="break-all font-mono text-[14px] font-bold text-[#1b1c1d]">{display ?? value}</p>
         </div>
         <button
            type="button"
            onClick={() => {
               void navigator.clipboard.writeText(value).then(
                  () => {
                     setCopied(true);
                     window.setTimeout(() => setCopied(false), 1500);
                  },
                  () => undefined
               );
            }}
            className="shrink-0 rounded-md bg-[#1b1c1d] px-3 py-1.5 text-[12px] font-bold text-white"
         >
            {copied ? 'Copied ✓' : 'Copy'}
         </button>
      </div>
   );
}

export default function WaltPayoutCard({ loanId, onFunded }: { loanId: string; onFunded?: () => void }) {
   const [payout, setPayout] = useState<Payout | null>(null);
   const [loading, setLoading] = useState(true);
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState('');
   const [txid, setTxid] = useState('');
   const [funded, setFunded] = useState(false);
   const [loanOpen, setLoanOpen] = useState(true);
   const [wallet, setWallet] = useState<PayoutWalletStatus | null>(null);

   const apply = useCallback(
      (res: WaltPayoutResult) => {
         if (res.payout) setPayout(res.payout);
         if (typeof res.loanOpen === 'boolean') setLoanOpen(res.loanOpen);
         if (!res.ok) setError(waltPayoutErrorText(res.error));
         else setError('');
         if (res.ok && (res.state === 'found' || res.payout?.status === 'found')) {
            setFunded(true);
            onFunded?.();
         }
      },
      [onFunded]
   );

   useEffect(() => {
      let cancelled = false;
      setLoading(true);
      void callWaltPayout({ action: 'walt_payout_status', loanId }).then((res) => {
         if (cancelled) return;
         apply(res);
         setLoading(false);
      });
      void fetchPayoutWalletStatus().then((res) => {
         if (!cancelled && res.data) setWallet(res.data);
      });
      return () => {
         cancelled = true;
      };
   }, [loanId, apply]);

   // The payout wallet is sending: check every 8 s until it lands (the server job also checks every 5 min).
   const paying = payout?.status === 'paying' && !funded;
   useEffect(() => {
      if (!paying) return undefined;
      const id = window.setInterval(() => {
         void callWaltPayout({ action: 'walt_payout_check', loanId }).then(apply);
      }, 8_000);
      return () => window.clearInterval(id);
   }, [paying, loanId, apply]);

   // After "I sent it", keep looking every 20 s while the card is open (the server job also checks every 5 min).
   const waitingAfterTap = Boolean(payout?.marked_sent_at) && payout?.status !== 'found' && payout?.status !== 'paying' && !funded;
   useEffect(() => {
      if (!waitingAfterTap) return undefined;
      const id = window.setInterval(() => {
         void callWaltPayout({ action: 'walt_payout_check', loanId }).then(apply);
      }, 20_000);
      return () => window.clearInterval(id);
   }, [waitingAfterTap, loanId, apply]);

   const run = async (body: Record<string, unknown>) => {
      if (busy) return;
      setBusy(true);
      apply(await callWaltPayout({ ...body, loanId }));
      if (body.action === 'walt_payout_auto') {
         const res = await fetchPayoutWalletStatus();
         if (res.data) setWallet(res.data);
      }
      setBusy(false);
   };

   if (loading) return <div className="rounded-lg bg-[#fff8f8] px-3 py-2 text-[13px] text-[#7a7a7a]">Loading Walt payout…</div>;

   const amount = payout ? Number(payout.amount) : null;
   const done = funded || payout?.status === 'found';
   const autoFailed = payout?.status === 'failed' && payout.method === 'auto';
   // A failed automatic payment may still have gone out: hand payment opens only after BNB Chain was checked.
   const chainUnchecked = autoFailed && !payout?.chain_checked_at;
   const canRelease = payout?.method === 'auto' && (payout.status === 'paying' || chainUnchecked);
   const release = () => {
      if (
         !window.confirm(
            'Release this automatic payment?\n\nThe app first looks on BNB Chain for USDC from the payout wallet to this Walt. If it went out, the loan is marked paid. If nothing is there, you can pay by hand. Only do this if Openfort / BscScan shows it never went out.'
         )
      )
         return;
      void run({ action: 'walt_payout_release' });
   };

   // Why "Pay now" can't be used right now (null = it can).
   const payNowBlocker = (() => {
      if (!payout || amount == null) return 'Loading…';
      if (!loanOpen) return 'This request isn’t open any more.';
      if (payout.marked_sent_at) return 'Already being paid by hand.';
      if (payout.status !== 'waiting') return autoFailed ? 'An automatic payment already failed for this loan.' : 'Already being handled.';
      if (!wallet) return 'Checking the payout wallet…';
      if (!wallet.configured) return 'Payout wallet not set up (Openfort keys missing).';
      if (!wallet.address) return 'No payout wallet yet — create it at the top of Requests.';
      if (amount > wallet.maxUsd) return `Over the $${wallet.maxUsd} automatic limit.`;
      if (wallet.paidTodayUsd + amount > wallet.dailyCapUsd) return `Today’s $${wallet.dailyCapUsd} cap is reached.`;
      if (wallet.usdc == null) return 'Couldn’t read the wallet balance.';
      if (wallet.usdc < amount) return `Wallet has only ${wallet.usdc.toFixed(2)} USDC — top it up.`;
      return null;
   })();
   const showManual = Boolean(payout?.marked_sent_at) || (autoFailed && !chainUnchecked) || payout?.status === 'not_found';

   return (
      <div className="flex flex-col gap-2 rounded-lg border border-[#ce1126]/25 border-t-[3px] border-t-[#ce1126] bg-[#fff8f8] p-3 text-[13px] text-[#37352f]">
         <p className="text-[15px] font-black text-[#1b1c1d]">🇮🇩 Pay to Walt (USDC on BNB Chain)</p>

         {done ? (
            <div className="rounded-lg bg-[#e7f6ec] px-3 py-2 font-semibold text-[#1f7a3d]">
               {payout?.found_by === 'auto' ? '✅ Paid from the payout wallet' : '✅ Seen on BNB Chain'} — loan marked funded. The borrower
               got a Telegram message.
               {payout?.bsc_tx_hash ? (
                  <a href={`https://bscscan.com/tx/${payout.bsc_tx_hash}`} target="_blank" rel="noreferrer" className="ml-1 underline">
                     View on BscScan
                  </a>
               ) : null}
            </div>
         ) : payout?.status === 'paying' ? (
            <div className="flex flex-col gap-2 rounded-lg bg-[#fff6db] px-3 py-2 font-semibold text-[#8a6100]">
               <span>
                  Sending {amount} USDC from the payout wallet… usually under a minute. It will not be sent twice — don’t pay by hand.
               </span>
               {canRelease ? (
                  <button
                     type="button"
                     disabled={busy}
                     onClick={release}
                     className="self-start rounded-md border border-[#8a6100]/40 bg-white px-3 py-1 text-[12px] font-bold text-[#8a6100] disabled:opacity-50"
                  >
                     {busy ? 'Checking BNB Chain…' : 'Release (stuck?)'}
                  </button>
               ) : null}
            </div>
         ) : payout ? (
            <>
               {autoFailed ? (
                  <div className="rounded-lg bg-[#fde8e8] px-3 py-2 font-semibold text-[#b42318]">
                     Automatic payment failed{payout.error ? `: ${payout.error}` : ''}. It won’t retry. Check the payout wallet on BscScan
                     {wallet?.address ? (
                        <a
                           href={`https://bscscan.com/address/${wallet.address}#tokentxns`}
                           target="_blank"
                           rel="noreferrer"
                           className="ml-1 underline"
                        >
                           (open)
                        </a>
                     ) : null}{' '}
                     {chainUnchecked
                        ? 'before paying by hand. The app checks BNB Chain 15 min after the attempt; paying by hand opens only if nothing went out.'
                        : 'before paying by hand.'}
                     {canRelease ? (
                        <button
                           type="button"
                           disabled={busy}
                           onClick={release}
                           className="mt-2 block rounded-md border border-[#b42318]/40 bg-white px-3 py-1 text-[12px] font-bold text-[#b42318] disabled:opacity-50"
                        >
                           {busy ? 'Checking BNB Chain…' : 'Release (check BNB Chain now)'}
                        </button>
                     ) : null}
                  </div>
               ) : null}

               {!payout.marked_sent_at && !autoFailed && loanOpen ? (
                  <IdVaultFundBlock loanId={loanId} onPaid={() => void callWaltPayout({ action: 'walt_payout_status', loanId }).then(apply)} />
               ) : null}

               {!payout.marked_sent_at && !autoFailed ? (
                  <div className="flex flex-col gap-1">
                     <button
                        type="button"
                        disabled={busy || Boolean(payNowBlocker)}
                        onClick={() => void run({ action: 'walt_payout_auto' })}
                        className="rounded-lg px-4 py-2.5 text-[15px] font-black text-[#4a2a00] disabled:opacity-50"
                        style={{ background: 'linear-gradient(180deg, #ffe27a 0%, #ffbe1a 100%)' }}
                     >
                        {busy ? 'Paying…' : `Pay now from payout wallet ($${amount})`}
                     </button>
                     <p className="text-[12px] text-[#7a7a7a]">
                        {payNowBlocker ??
                           `Wallet: ${wallet?.usdc != null ? `${wallet.usdc.toFixed(2)} USDC` : '—'} · paid today $${(wallet?.paidTodayUsd ?? 0).toFixed(2)} of $${wallet?.dailyCapUsd ?? '—'}`}
                     </p>
                  </div>
               ) : null}

               {chainUnchecked ? null : (
                  <details open={showManual} className="rounded-lg border border-[#ce1126]/15 bg-white/60 p-2">
                     <summary className="cursor-pointer text-[13px] font-bold text-[#1b1c1d]">Pay by hand instead (Binance TH)</summary>
                     <div className="mt-2 flex flex-col gap-2">
                        <ol className="ml-4 list-decimal text-[13px] leading-5">
                           <li>
                              Binance TH → Withdraw → <b>USDC</b> → network <b>BSC (BNB Smart Chain)</b>
                           </li>
                           <li>Paste the address and the amount below</li>
                           <li>
                              Tap <b>I sent it</b> — the app finds it on BNB Chain by itself
                           </li>
                        </ol>
                        <p className="text-[12px] leading-4 text-[#7a7a7a]">
                           The borrower must receive the loan amount. Binance TH’s BSC fee for USDC is $0 — if it shows a fee, enter the
                           amount + fee.
                        </p>
                        <CopyRow label="Walt address (BEP20)" value={payout.walt_address} />
                        {amount != null ? <CopyRow label="Amount (USDC)" value={String(amount)} display={`${amount} USDC`} /> : null}

                        {payout.marked_sent_at ? (
                           <div className="rounded-lg bg-[#fff6db] px-3 py-2 font-semibold text-[#8a6100]">
                              {payout.status === 'not_found'
                                 ? 'Not seen after 30 min. Check it was USDC on BSC and the borrower received the loan amount — or paste the TxID below.'
                                 : 'Looking for it on BNB Chain… (usually under a minute after Binance sends it)'}
                           </div>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                           <button
                              type="button"
                              disabled={busy}
                              onClick={() => void run({ action: payout.marked_sent_at ? 'walt_payout_check' : 'walt_payout_sent' })}
                              className="rounded-lg bg-[#1b1c1d] px-4 py-2 text-[14px] font-black text-white disabled:opacity-60"
                           >
                              {busy ? 'Checking…' : payout.marked_sent_at ? 'Check again' : 'I sent it'}
                           </button>
                        </div>

                        <details className="text-[12px]">
                           <summary className="cursor-pointer font-semibold text-[#7a7a7a]">Paste the TxID instead</summary>
                           <div className="mt-2 flex gap-2">
                              <input
                                 value={txid}
                                 onChange={(e) => setTxid(e.target.value)}
                                 placeholder="0x… (Binance TH → Withdrawal history → TxID)"
                                 className="min-w-0 flex-1 rounded-md border border-[#d6d3cf] bg-white px-2 py-1.5 font-mono text-[12px]"
                              />
                              <button
                                 type="button"
                                 disabled={busy || !txid.trim()}
                                 onClick={() => void run({ action: 'walt_payout_txid', txHash: txid.trim() })}
                                 className="rounded-md bg-[#1b1c1d] px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
                              >
                                 Use TxID
                              </button>
                           </div>
                        </details>
                     </div>
                  </details>
               )}
            </>
         ) : null}

         {error ? <p className="rounded-lg bg-[#fde8e8] px-3 py-2 font-semibold text-[#b42318]">{error}</p> : null}
      </div>
   );
}
