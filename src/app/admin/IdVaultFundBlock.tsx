'use client';

import { useCallback, useEffect, useState } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { drawFromVault, readVaultStatus, vaultBorrowerId } from '@/lib/web3/bitrepoVault';

/**
 * Indonesia track: fund a request from the BitRepo vault (USDC on Base). The lending wallet draws a little more
 * than the loan to the payout wallet's Base address; the server bridges it to BNB Chain with LI.FI and the
 * payout wallet then sends the borrower exactly the loan amount (supabase/functions/_shared/idVaultBridge.ts).
 */

type Bridge = {
   id: number;
   status: 'drawn' | 'bridging' | 'bridged' | 'paid' | 'failed' | 'not_sent';
   from_units: string;
   draw_tx: string | null;
   src_tx: string | null;
   dest_tx: string | null;
   error: string | null;
};

type Quote = {
   ok: boolean;
   error?: string;
   recipient?: string;
   amountUnits?: string;
   amountText?: string;
   totalDueUnits?: string;
   dueTs?: number;
   borrowerUserId?: string;
   loanAmount?: number;
   bridgeTool?: string;
   bridgeFeeUsd?: number;
};

const ERRORS: Record<string, string> = {
   no_payout_wallet: 'No payout wallet yet — create it at the top of Requests.',
   no_walt_address: 'This borrower hasn’t saved a Walt address (BEP20) yet. They can paste it in the bot chat.',
   payout_token_not_usdc: 'Payouts are set to USDT. Vault funding needs id_payout_token = USDC.',
   loan_not_open: 'This request isn’t open any more.',
   already_drawn: 'Already drawn from the vault for this loan.',
   bad_amount: 'Loan amount is outside what the vault bridge sends ($500 max).',
   draw_not_found_on_base_yet: 'The draw isn’t on Base yet — wait a few seconds.',
   not_a_vault_draw_to_payout_wallet: 'That transaction isn’t a vault draw to the payout wallet.',
   draw_not_for_this_loan: 'The vault’s record for this loan doesn’t match the draw.',
   vault_unreadable_try_again: 'Couldn’t read the vault on Base. Try again.'
};
const errorText = (code?: string | null) => {
   if (!code) return 'Something went wrong.';
   const key = code.split(':')[0];
   return ERRORS[key] ?? code;
};

const call = async <T,>(body: Record<string, unknown>): Promise<T & { ok?: boolean; error?: string }> => {
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
      return { ok: false, error: (parsed as { error?: string } | null)?.error ?? error.message } as T & { ok: boolean; error: string };
   }
   return data as T & { ok?: boolean; error?: string };
};

const STEP: Record<Bridge['status'], string> = {
   drawn: 'Drawn from the vault — starting the bridge…',
   bridging: 'Bridging Base → BNB Chain with LI.FI… (usually under a minute)',
   bridged: 'Arrived on BNB Chain — paying the borrower’s Walt…',
   paid: '✅ Paid from the vault.',
   failed: 'Bridge failed',
   not_sent: 'Not sent'
};

export default function IdVaultFundBlock({
   loanId,
   onPaid,
   boardLabel
}: {
   loanId: string;
   onPaid?: () => void;
   /** Request board: a full-width gold button with this text instead of the admin one. */
   boardLabel?: string;
}) {
   const { address } = useAccount();
   const { openConnectModal } = useConnectModal();
   const [bridge, setBridge] = useState<Bridge | null>(null);
   const [quote, setQuote] = useState<Quote | null>(null);
   const [busy, setBusy] = useState<string | null>(null);
   const [error, setError] = useState('');

   const refresh = useCallback(async () => {
      const res = await call<{ bridge: Bridge | null }>({ action: 'id_vault_status', loanId });
      if (res.ok === false) return;
      setBridge(res.bridge ?? null);
      if (res.bridge?.status === 'paid') onPaid?.();
   }, [loanId, onPaid]);

   useEffect(() => {
      void refresh();
   }, [refresh]);

   const moving = bridge && (bridge.status === 'drawn' || bridge.status === 'bridging' || bridge.status === 'bridged');
   useEffect(() => {
      if (!moving) return undefined;
      const id = window.setInterval(() => void refresh(), 8_000);
      return () => window.clearInterval(id);
   }, [moving, refresh]);

   const getQuote = async () => {
      setBusy('quote');
      setError('');
      const q = await call<Quote>({ action: 'id_vault_quote', loanId });
      setBusy(null);
      if (!q.ok) return setError(errorText(q.error));
      setQuote(q);
   };

   const draw = async () => {
      if (!quote?.ok || !quote.amountUnits || !quote.recipient || !quote.totalDueUnits || !quote.dueTs || !quote.borrowerUserId) return;
      if (!address) {
         openConnectModal?.();
         return;
      }
      setBusy('draw');
      setError('');
      try {
         const amount = BigInt(quote.amountUnits);
         const vault = await readVaultStatus(address);
         if (vault.paused) throw new Error('BitRepo has paused draws on the vault.');
         if (!vault.canDraw) throw new Error('This wallet can’t draw from the vault. Connect Moodeng’s lending wallet.');
         if (vault.availableToDraw < amount)
            throw new Error(`The vault can lend ${(Number(vault.availableToDraw) / 1e6).toFixed(2)} USDC right now.`);
         if (quote.dueTs > Math.floor(Date.now() / 1000) + vault.termLimitSeconds)
            throw new Error('The due date is past the vault’s term limit.');
         const txHash = await drawFromVault({
            loanId,
            recipient: quote.recipient,
            amount,
            dueDate: quote.dueTs,
            totalDue: BigInt(quote.totalDueUnits),
            borrowerId: vaultBorrowerId(quote.borrowerUserId)
         });
         setBusy('record');
         // The draw is mined; recording it starts the bridge. Retry briefly if our RPC is a block behind.
         let res = await call<{ bridge?: Bridge }>({ action: 'id_vault_draw', loanId, txHash });
         for (
            let i = 0;
            i < 4 && !res.ok && (res.error === 'draw_not_found_on_base_yet' || res.error === 'vault_unreadable_try_again');
            i += 1
         ) {
            await new Promise((r) => setTimeout(r, 3_000));
            res = await call<{ bridge?: Bridge }>({ action: 'id_vault_draw', loanId, txHash });
         }
         if (!res.ok) {
            setError(`Drawn from the vault (${txHash}) but not recorded: ${errorText(res.error)}. Don’t draw again — tell the dev team.`);
         } else {
            setBridge(res.bridge ?? null);
            setQuote(null);
         }
      } catch (err) {
         setError((err as Error).message || 'The vault draw didn’t go through. Nothing was sent.');
      } finally {
         setBusy(null);
      }
   };

   if (bridge) {
      const tone =
         bridge.status === 'paid'
            ? 'bg-[#e7f6ec] text-[#1f7a3d]'
            : bridge.status === 'failed'
              ? 'bg-[#fde8e8] text-[#b42318]'
              : 'bg-[#fff6db] text-[#8a6100]';
      return (
         <div className={`flex flex-col gap-1 rounded-lg px-3 py-2 font-semibold ${tone}`}>
            <span>
               🏦 {STEP[bridge.status]}
               {bridge.status === 'failed' && bridge.error ? `: ${bridge.error}` : ''}
            </span>
            {bridge.status === 'bridged' && bridge.error ? (
               <span className="text-[12px]">Payout waiting: {errorText(bridge.error)}</span>
            ) : null}
            {bridge.status === 'drawn' && bridge.error ? <span className="text-[12px]">Retrying: {bridge.error}</span> : null}
            <span className="text-[12px] font-normal">
               Drew {(Number(bridge.from_units) / 1e6).toFixed(2)} USDC
               {bridge.draw_tx ? (
                  <a className="ml-1 underline" href={`https://basescan.org/tx/${bridge.draw_tx}`} target="_blank" rel="noreferrer">
                     draw
                  </a>
               ) : null}
               {bridge.src_tx ? (
                  <a className="ml-2 underline" href={`https://scan.li.fi/tx/${bridge.src_tx}`} target="_blank" rel="noreferrer">
                     bridge
                  </a>
               ) : null}
            </span>
         </div>
      );
   }

   return (
      <div className="flex flex-col gap-1">
         {quote?.ok ? (
            <div className="flex flex-col gap-2 rounded-lg border border-[#ce1126]/15 bg-white/70 p-2">
               <p className="text-[13px]">
                  Draw <b>{quote.amountText} USDC</b> from the vault → <b>${quote.loanAmount?.toFixed(2)}</b> lands in their Walt. Bridge
                  fee ≈ ${quote.bridgeFeeUsd?.toFixed(2)} ({quote.bridgeTool}); a few cents left over stay in the payout wallet.
               </p>
               <div className="flex gap-2">
                  <button
                     type="button"
                     disabled={busy !== null}
                     onClick={() => void draw()}
                     className="rounded-lg px-4 py-2 text-[14px] font-black text-[#4a2a00] disabled:opacity-50"
                     style={{ background: 'linear-gradient(180deg, #ffe27a 0%, #ffbe1a 100%)' }}
                  >
                     {busy === 'draw'
                        ? 'Confirm in wallet…'
                        : busy === 'record'
                          ? 'Starting bridge…'
                          : address
                            ? `Draw ${quote.amountText}`
                            : 'Connect lending wallet'}
                  </button>
                  <button
                     type="button"
                     disabled={busy !== null}
                     onClick={() => setQuote(null)}
                     className="rounded-lg border border-[#d6d3cf] bg-white px-3 py-2 text-[13px] font-bold"
                  >
                     Cancel
                  </button>
               </div>
            </div>
         ) : (
            <button
               type="button"
               disabled={busy !== null}
               onClick={() => void getQuote()}
               className={
                  boardLabel
                     ? 'w-full rounded-md-lg bg-[#ffd75a] py-md-3 text-md-b1 font-semibold text-[#4a2a00] disabled:opacity-60'
                     : 'rounded-lg bg-[#1b1c1d] px-4 py-2.5 text-[14px] font-black text-white disabled:opacity-50'
               }
            >
               {busy === 'quote' ? 'Pricing the bridge…' : (boardLabel ?? '🏦 Fund from BitRepo vault (Base → LI.FI)')}
            </button>
         )}
         {error ? <p className="rounded-lg bg-[#fde8e8] px-3 py-2 font-semibold text-[#b42318]">{error}</p> : null}
      </div>
   );
}
