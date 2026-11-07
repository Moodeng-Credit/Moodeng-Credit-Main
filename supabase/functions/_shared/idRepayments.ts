// Indonesia track: repaying from Walt straight to the lender (docs/INDONESIA_TRACK.md "Living in
// Telegram"). The bot (idBot.ts, 💰 Bayar) asks Relay for a one-time BNB Chain address whose output is
// USDC on Base paid to loans.lender_wallet — the same wallet the app's Pay button pays — so the
// borrower never needs a Moodeng wallet balance:
//
//   Walt (USDT, BEP20) ──withdraw──▶ Relay one-time address on BNB Chain ──fill──▶ USDC on Base → lender
//
// getOrCreateRepayQuote  — the address for the borrower's active loan (reuses a still-unused one)
// runRelayRepayments     — the 5-minute job: finds the fill, verifies it on Base, records it exactly
//                          like confirm-loan-payment (record_loan_payment 'repay' + the shared
//                          follow-ups in repaymentFollowUps.ts), tells the borrower.
//
// How a repayment is found (relay_transfers rows with direction 'repay' and loan_id set):
//   1. Relay status by request id (/intents/status/v3, no key). 'success' + a fill tx → verified on Base:
//      the receipt succeeded, holds USDC Transfer(s) to lender_wallet, and its block is after the quote.
//      The USDC that reached the lender is what's recorded (never the quoted amount).
//   2. The deposit itself is watched on BNB Chain (USDT Transfer → the one-time address), so we know
//      when, from where and how much was sent even when Relay says nothing.
//   3. Relay treats a deposit of a different amount as a NEW request (new id) that our request id may
//      never show. GET /requests by deposit address needs an API key from v3 on (v2 is retired
//      2026-11-24), so ≥ 10 min after a deposit that Relay hasn't reported, we search Base for the fill
//      ourselves: USDC Transfer → lender_wallet within 3 h after the deposit, between the deposit
//      − max(5%, $0.50) and the deposit + 0.5%, from a known Relay solver address (setting
//      relay_base_solvers, plus every sender seen on a fill verified through step 1), whose tx hash was
//      never used for any loan. Several open rows to the same lender are matched oldest deposit first and
//      one fill is given to one row only. No solver-sent candidate → one team alert, nothing recorded.
//   Never twice: record_loan_payment spends the Base fill tx hash in used_payment_hashes inside its lock;
//   a second run gets 'hash_used' and only marks the row done.
//
// Never throws to the caller.

import { blockAtOrBefore, headBlock as bscHead, blockTime as bscBlockTime, transfersTo as bscTransfersTo } from './idManualFunding.ts';
import { formatRp, idUsdLeft, waltRepayAmount } from './idLoanMath.ts';
import { idLocaleOf } from './idTrack.ts';
import { BASE_USDC, BSC_USDT, RelayError, type RelayStatus, relayQuoteRepay, relayStatus, toUnits } from './relay.ts';
import { runRepaymentFollowUps } from './repaymentFollowUps.ts';
import { sendTelegramMessage, type TelegramInlineKeyboard } from './telegram.ts';
import { RPC_URL, rpcCall, TRANSFER_TOPIC } from './usdcTransfer.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH = /^0x[0-9a-fA-F]{64}$/;
const REUSE_MS = 30 * 60_000;
const BUSY_LOOKBACK_MS = 2 * 3_600_000;
const MAX_USDT = 500;
const OPEN_STATUSES = ['quoted', 'sent', 'pending'];
const ROW_MAX_AGE_MS = 3 * 86_400_000;
const NO_DEPOSIT_EXPIRE_MS = 24 * 3_600_000;
const FALLBACK_AFTER_MS = 10 * 60_000;
const FALLBACK_WINDOW_MS = 3 * 3_600_000;
const FRESHNESS_GRACE_MS = 10 * 60_000;
const OVERPAID_ALERT_MICROS = 500_000; // the buffer (max(1%, $0.30)) is expected on top; more → tell the team
const BSC_LOG_SPAN = 49_000n;
const BSC_CONFIRMATIONS = 3n;
const BASE_LOG_SPAN = 2_000;
const BASE_SECONDS_PER_BLOCK = 2;
const MAX_LEARNED_SOLVERS = 12;

// ── loans ────────────────────────────────────────────────────────────────────────────────────────
export type RepayLoan = {
   id: string;
   tracking_id: string | null;
   borrower_user_id: string;
   loan_status: string;
   repayment_status: string | null;
   funding_method: string | null;
   lender_wallet: string | null;
   onchain_loan_id: string | number | null;
   repay_idr: number | string | null;
   repaid_idr: number | string | null;
   total_repayment_amount: number | string | null;
   repaid_amount: number | string | null;
   loan_amount: number | string | null;
   due_date: string | null;
   funded_at: string | null;
   created_at: string;
   market: string | null;
};

const LOAN_FIELDS =
   'id, tracking_id, borrower_user_id, loan_status, repayment_status, funding_method, lender_wallet, onchain_loan_id, repay_idr, repaid_idr, total_repayment_amount, repaid_amount, loan_amount, due_date, funded_at, created_at, market';

/** The borrower's funded, not fully repaid loan (newest), or null. */
export const loadActiveLoan = async (svc: Svc, userId: string): Promise<RepayLoan | null> => {
   const { data } = await svc
      .from('loans')
      .select(LOAN_FIELDS)
      .eq('borrower_user_id', userId)
      .eq('loan_status', 'Lent')
      .neq('repayment_status', 'Paid')
      .is('refunded_at', null)
      .order('funded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
   return (data as RepayLoan | null) ?? null;
};

/** Why this loan can't be repaid straight to the lender from Walt, or null when it can. */
export const repayBlocker = (loan: Pick<RepayLoan, 'funding_method' | 'lender_wallet' | 'onchain_loan_id'>): 'on_contract' | 'no_lender_wallet' | null => {
   // Smart-contract / credit-line loans are repaid through the contract or the app, never to a wallet.
   if (loan.onchain_loan_id != null || (loan.funding_method && !['walt_manual', 'direct'].includes(loan.funding_method))) return 'on_contract';
   if (!loan.lender_wallet || !EVM_ADDRESS.test(loan.lender_wallet)) return 'no_lender_wallet';
   return null;
};

const currentRate = async (svc: Svc): Promise<number | null> => {
   try {
      const { data } = await svc.rpc('current_usd_idr');
      const n = Number(data);
      return Number.isFinite(n) && n > 0 ? n : null;
   } catch {
      return null;
   }
};

const getSetting = async (svc: Svc, key: string): Promise<string | null> => {
   const { data } = await svc.from('telegram_bot_settings').select('value').eq('key', key).maybeSingle();
   return (data?.value as string | undefined) ?? null;
};

const adminChatId = async (svc: Svc): Promise<string | null> =>
   (await getSetting(svc, 'kyc_alert_chat_id')) || Deno.env.get('TEAM_TELEGRAM_CHAT_ID') || (await getSetting(svc, 'team_group_chat_id'));

const alertTeam = async (svc: Svc, text: string) => {
   const chat = await adminChatId(svc);
   if (chat) await sendTelegramMessage(chat, text).catch(() => undefined);
};

const short = (a: string | null | undefined) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '?');

// ── relay_transfers rows ─────────────────────────────────────────────────────────────────────────
type Deposit = { txHash: string; value: string; blockNumber: string; at: string; from: string };
type RowQuote = {
   amountIn?: string;
   amountInUnits?: string;
   feeUsd?: number | null;
   source?: string;
   rupiahLeft?: number | null;
   rate?: number | null;
   usdLeft?: number;
   deposit?: Deposit;
   depositScanTo?: string;
   depositSeenToldAt?: string;
   fallbackAlertedAt?: string;
   recorded?: Record<string, unknown>;
   [key: string]: unknown;
};
export type RepayRow = {
   id: string;
   user_id: string;
   loan_id: string | null;
   status: string;
   amount_in: string | number;
   deposit_address: string;
   recipient: string;
   refund_to: string | null;
   request_id: string | null;
   tx_hash: string | null;
   fill_tx_hash: string | null;
   quote: RowQuote | null;
   created_at: string;
};
const ROW_FIELDS = 'id, user_id, loan_id, status, amount_in, deposit_address, recipient, refund_to, request_id, tx_hash, fill_tx_hash, quote, created_at';

/** Exact USDT units (18 dp) of a row: the string in `quote` wins (numeric loses precision in JSON). */
const rowUnits = (row: RepayRow): bigint => {
   const stored = row.quote?.amountInUnits;
   if (stored && /^[0-9]+$/.test(stored)) return BigInt(stored);
   const raw = typeof row.amount_in === 'number' ? row.amount_in.toLocaleString('en-US', { useGrouping: false }) : String(row.amount_in);
   return BigInt(raw.split('.')[0] || '0');
};

const patchRow = async (svc: Svc, row: RepayRow, patch: Record<string, unknown>, quotePatch?: Partial<RowQuote>) => {
   const next: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
   if (quotePatch) {
      row.quote = { ...(row.quote ?? {}), ...quotePatch };
      next.quote = row.quote;
   }
   Object.assign(row, patch);
   await svc.from('relay_transfers').update(next).eq('id', row.id);
};

// ── the quote (💰 Bayar) ─────────────────────────────────────────────────────────────────────────
export type RepayQuoteResult =
   | {
        ok: true;
        reused: boolean;
        depositAddress: string;
        /** Human USDT to send, e.g. "6.42". */
        amountUsdt: string;
        /** ≈ rupiah that USDT costs today (rounded to Rp 1.000), null without a rate. */
        approxIdr: number | null;
        /** Rupiah still owed on the loan (pegged loans). */
        rupiahLeft: number | null;
        loan: RepayLoan;
     }
   | { ok: false; error: 'no_loan' | 'on_contract' | 'no_lender_wallet' | 'no_walt' | 'bridge_off' | 'nothing_left' | 'busy' | 'too_large' | 'relay' };

const bridgeOff = async (svc: Svc) => String((await getSetting(svc, 'walt_bridge')) ?? 'on').trim().toLowerCase() === 'off';

/**
 * The one-time address for this borrower's active loan. Reuses an unused one for the same loan made in
 * the last 30 minutes when it still covers what's owed (and isn't more than $0.50 over); says 'busy'
 * when a deposit to an earlier address is already on its way.
 */
export const getOrCreateRepayQuote = async (svc: Svc, user: { id: string; walt_address: string | null }): Promise<RepayQuoteResult> => {
   const loan = await loadActiveLoan(svc, user.id);
   if (!loan) return { ok: false, error: 'no_loan' };
   const blocker = repayBlocker(loan);
   if (blocker) return { ok: false, error: blocker };
   const walt = String(user.walt_address ?? '').trim();
   if (!EVM_ADDRESS.test(walt)) return { ok: false, error: 'no_walt' };
   if (await bridgeOff(svc)) return { ok: false, error: 'bridge_off' };

   const rate = await currentRate(svc);
   const left = idUsdLeft(loan, rate);
   if (left.usd <= 0 || (left.idr != null && left.idr < 1000)) return { ok: false, error: 'nothing_left' };
   const usdt = waltRepayAmount(left.usd);
   if (usdt > MAX_USDT) return { ok: false, error: 'too_large' };
   const amountUsdt = usdt.toFixed(2);
   const needUnits = toUnits(amountUsdt, 18);
   const approxIdr = rate ? Math.round((usdt * rate) / 1000) * 1000 : null;
   const lender = String(loan.lender_wallet);

   // Earlier addresses for this loan: reuse one, or say a payment is already on its way.
   const { data: recent } = await svc
      .from('relay_transfers')
      .select(ROW_FIELDS)
      .eq('loan_id', loan.id)
      .eq('direction', 'repay')
      .in('status', OPEN_STATUSES)
      .gte('created_at', new Date(Date.now() - BUSY_LOOKBACK_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(5);
   for (const row of (recent ?? []) as RepayRow[]) {
      if (row.status !== 'quoted' || row.quote?.deposit) return { ok: false, error: 'busy' };
      let status: RelayStatus | null = null;
      try {
         status = row.request_id ? await relayStatus(row.request_id) : null;
      } catch {
         status = null;
      }
      if (status && status.status !== 'waiting' && status.status !== 'unknown') return { ok: false, error: 'busy' };
      const units = rowUnits(row);
      const fresh = Date.now() - new Date(row.created_at).getTime() < REUSE_MS;
      const sameRoute = row.recipient.toLowerCase() === lender.toLowerCase() && (row.refund_to ?? '').toLowerCase() === walt.toLowerCase();
      if (status?.status === 'waiting' && fresh && sameRoute && units >= needUnits && units <= needUnits + toUnits('0.5', 18)) {
         const human = (Number(units / 10n ** 14n) / 10_000).toFixed(2);
         return {
            ok: true,
            reused: true,
            depositAddress: row.deposit_address,
            amountUsdt: human,
            approxIdr: rate ? Math.round((Number(human) * rate) / 1000) * 1000 : approxIdr,
            rupiahLeft: left.idr,
            loan
         };
      }
   }

   try {
      const q = await relayQuoteRepay({ amountUsdt, recipient: lender, refundTo: walt });
      const { error } = await svc.from('relay_transfers').insert({
         user_id: user.id,
         loan_id: loan.id,
         direction: 'repay',
         origin_chain_id: q.originChainId,
         destination_chain_id: q.destinationChainId,
         origin_token: q.originToken,
         destination_token: q.destinationToken,
         amount_in: q.amountInUnits,
         amount_out_quoted: q.amountOut,
         deposit_address: q.depositAddress,
         recipient: lender,
         refund_to: walt,
         request_id: q.requestId,
         status: 'quoted',
         quote: {
            source: 'telegram',
            feeUsd: q.feeUsd,
            timeEstimate: q.timeEstimate,
            amountOutMin: q.amountOutMin,
            amountIn: q.amountIn,
            amountInUnits: q.amountInUnits,
            rupiahLeft: left.idr,
            rate,
            usdLeft: left.usd,
            relay: q.raw
         }
      });
      if (error) {
         console.error('[idRepayments] store quote failed', error.message);
         return { ok: false, error: 'relay' };
      }
      return { ok: true, reused: false, depositAddress: q.depositAddress, amountUsdt, approxIdr, rupiahLeft: left.idr, loan };
   } catch (err) {
      console.warn('[idRepayments] quote failed', err instanceof RelayError ? `${err.code} ${err.message}` : err);
      return { ok: false, error: 'relay' };
   }
};

// ── Base: verifying a fill ───────────────────────────────────────────────────────────────────────
type BaseLog = { address: string; topics: string[]; data: string; logIndex: string; transactionHash: string; blockNumber: string; removed?: boolean };
type Fill = { txHash: string; micros: bigint; from: string; txFrom: string | null; blockNumber: bigint; blockTimeMs: number | null };

const pad32 = (address: string) => `0x${address.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`;
const topicAddr = (topic: string) => `0x${topic.slice(-40)}`.toLowerCase();

const baseBlockTimeMs = async (blockHex: string): Promise<number | null> => {
   try {
      const b = await rpcCall(RPC_URL, 'eth_getBlockByNumber', [blockHex, false]);
      return b?.timestamp ? Number(BigInt(b.timestamp)) * 1000 : null;
   } catch {
      return null;
   }
};

const baseTxFrom = async (txHash: string): Promise<string | null> => {
   try {
      const tx = await rpcCall(RPC_URL, 'eth_getTransactionByHash', [txHash]);
      return typeof tx?.from === 'string' ? tx.from.toLowerCase() : null;
   } catch {
      return null;
   }
};

/** USDC that `txHash` paid to `lender` on Base. 'pending' while the receipt isn't there yet. */
export const verifyBaseFill = async (txHash: string, lender: string): Promise<{ ok: true; fill: Fill } | { ok: false; error: 'pending' | 'reverted' | 'no_transfer_to_lender' | 'rpc' }> => {
   if (!HASH.test(txHash)) return { ok: false, error: 'no_transfer_to_lender' };
   let receipt: { status?: string; blockNumber?: string; logs?: BaseLog[] } | null;
   try {
      receipt = await rpcCall(RPC_URL, 'eth_getTransactionReceipt', [txHash]);
   } catch {
      return { ok: false, error: 'rpc' };
   }
   if (!receipt?.blockNumber) return { ok: false, error: 'pending' };
   if (receipt.status !== '0x1') return { ok: false, error: 'reverted' };
   const usdc = BASE_USDC.toLowerCase();
   const toLender = (receipt.logs ?? []).filter(
      (l) =>
         (l.address ?? '').toLowerCase() === usdc &&
         (l.topics ?? [])[0]?.toLowerCase() === TRANSFER_TOPIC &&
         (l.topics ?? []).length === 3 &&
         topicAddr(l.topics[2]) === lender.toLowerCase()
   );
   if (!toLender.length) return { ok: false, error: 'no_transfer_to_lender' };
   const micros = toLender.reduce((sum, l) => sum + BigInt(l.data && l.data !== '0x' ? l.data : '0x0'), 0n);
   if (micros <= 0n) return { ok: false, error: 'no_transfer_to_lender' };
   const [blockTimeMs, txFrom] = await Promise.all([baseBlockTimeMs(receipt.blockNumber), baseTxFrom(txHash)]);
   return {
      ok: true,
      fill: { txHash: txHash.toLowerCase(), micros, from: topicAddr(toLender[0].topics[1]), txFrom, blockNumber: BigInt(receipt.blockNumber), blockTimeMs }
   };
};

/** USDC Transfers to `lender` on Base between two times (Base makes a block every 2 s). */
const baseTransfersTo = async (lender: string, fromMs: number, toMs: number, deadline: number) => {
   const headHex: string = await rpcCall(RPC_URL, 'eth_blockNumber', []);
   const head = Number(BigInt(headHex));
   const headTime = await baseBlockTimeMs(headHex);
   if (headTime == null) return [];
   const at = (ms: number) => Math.max(0, Math.min(head, head - Math.ceil((headTime - ms) / 1000 / BASE_SECONDS_PER_BLOCK)));
   const start = at(fromMs) - 30;
   const end = at(toMs);
   const out: BaseLog[] = [];
   for (let from = Math.max(0, start); from <= end; from += BASE_LOG_SPAN) {
      if (Date.now() > deadline) break;
      const to = Math.min(end, from + BASE_LOG_SPAN - 1);
      const logs: BaseLog[] = await rpcCall(RPC_URL, 'eth_getLogs', [
         { fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}`, address: BASE_USDC, topics: [TRANSFER_TOPIC, null, pad32(lender)] }
      ]);
      out.push(...(logs ?? []).filter((l) => !l.removed));
   }
   return out;
};

// ── recording ────────────────────────────────────────────────────────────────────────────────────
type UserRow = { id: string; chat_id: string | number | null; preferred_locale: string | null; market: string | null };

const loadUser = async (svc: Svc, userId: string): Promise<UserRow | null> => {
   const { data } = await svc.from('users').select('id, chat_id, preferred_locale, market').eq('id', userId).maybeSingle();
   return (data as UserRow | null) ?? null;
};

const tell = async (user: UserRow | null, text: string, keyboard?: TelegramInlineKeyboard) => {
   if (!user?.chat_id) return;
   await sendTelegramMessage(user.chat_id, text, keyboard ? { inlineKeyboard: keyboard } : {}).catch((err: unknown) =>
      console.error('[idRepayments] telegram failed', err instanceof Error ? err.message : err)
   );
};

const say = (user: UserRow | null, id: string, en: string) => (idLocaleOf(user?.preferred_locale) === 'en' ? en : id);
const menuRow = (user: UserRow | null): TelegramInlineKeyboard => [
   [
      { text: say(user, '💰 Bayar sisanya', '💰 Pay the rest'), callback_data: 'idm:repay' },
      { text: say(user, '☰ Menu', '☰ Menu'), callback_data: 'idm:menu' }
   ]
];

/** "✅ Pembayaran Rp X diterima. Sisa Rp Y (≈ $Z)." — partial payments (Paid ones get the 'repaid' message). */
export const partialReceivedText = (locale: 'id' | 'en', paidIdr: number | null, paidUsd: number, leftIdr: number | null, leftUsd: number) => {
   const paid = paidIdr != null ? formatRp(paidIdr) : `$${paidUsd.toFixed(2)}`;
   const left = leftIdr != null ? `${formatRp(leftIdr)} (≈ $${leftUsd.toFixed(2)})` : `$${leftUsd.toFixed(2)}`;
   return locale === 'en' ? `✅ Payment of ${paid} received. ${left} left to pay.` : `✅ Pembayaran ${paid} diterima. Sisa ${left}.`;
};

type RecordOutcome = 'recorded' | 'already' | 'unrecorded' | 'retry';

const recordFill = async (svc: Svc, row: RepayRow, fill: Fill, via: 'relay_status' | 'fallback_scan'): Promise<RecordOutcome> => {
   if (!row.loan_id) return 'unrecorded';
   // Freshness: the fill must come after the quote (an old transfer to the lender can't count).
   if (fill.blockTimeMs != null && fill.blockTimeMs < new Date(row.created_at).getTime() - FRESHNESS_GRACE_MS) {
      await patchRow(svc, row, { status: 'unmatched', fill_tx_hash: fill.txHash }, { recorded: { error: 'fill_predates_quote', via } });
      await alertTeam(svc, `⚠️ 🇮🇩 Walt repay ${short(row.deposit_address)}: Relay's fill ${fill.txHash} is older than the quote — NOT recorded. Check it.`);
      return 'unrecorded';
   }
   const { data: spent } = await svc.from('used_payment_hashes').select('loan_id').eq('hash', fill.txHash).maybeSingle();
   if (spent) {
      if (spent.loan_id === row.loan_id) {
         await patchRow(svc, row, { status: 'success', fill_tx_hash: fill.txHash });
         return 'already';
      }
      await patchRow(svc, row, { status: 'unmatched', fill_tx_hash: fill.txHash }, { recorded: { error: 'fill_used_by_other_loan', via } });
      await alertTeam(svc, `⚠️ 🇮🇩 Walt repay ${short(row.deposit_address)}: fill ${fill.txHash} was already used for another loan. Check loan ${row.loan_id}.`);
      return 'unrecorded';
   }

   const { data: before } = await svc.from('loans').select('repaid_idr, repay_idr, tracking_id').eq('id', row.loan_id).maybeSingle();
   const { data: recorded, error } = await svc.rpc('record_loan_payment', {
      p_loan_id: row.loan_id,
      p_action: 'repay',
      p_caller: row.user_id,
      p_spend_hashes: [fill.txHash],
      p_record_hash: fill.txHash,
      p_amount_micros: Number(fill.micros),
      p_from: fill.from
   });
   if (error) {
      console.error('[idRepayments] record_loan_payment failed', error.message);
      return 'retry';
   }
   const code = (recorded as { error?: string } | null)?.error;
   const paidUsd = Number(fill.micros) / 1e6;
   if (code === 'hash_used') {
      await patchRow(svc, row, { status: 'success', fill_tx_hash: fill.txHash });
      return 'already';
   }
   if (code) {
      // The loan can't take it (already repaid another way, refunded, …) but the USDC reached the lender:
      // spend the hash so it alerts once, and tell the team to refund.
      await svc.from('used_payment_hashes').insert({ hash: fill.txHash, loan_id: row.loan_id }).then(() => undefined, () => undefined);
      await patchRow(svc, row, { status: 'unmatched', fill_tx_hash: fill.txHash }, { recorded: { error: code, via } });
      await alertTeam(
         svc,
         `⚠️ 🇮🇩 ${before?.tracking_id ?? row.loan_id}: a ${paidUsd.toFixed(2)} USDC Walt repayment reached the lender (${fill.txHash}) but was NOT recorded (${code}). It needs refunding to their Walt ${short(row.refund_to)}.`
      );
      return 'unrecorded';
   }

   const updatedLoan = (recorded as { loan?: Record<string, unknown> } | null)?.loan;
   const overpaid = Number((recorded as { overpaid_micros?: number } | null)?.overpaid_micros ?? 0);
   await patchRow(
      svc,
      row,
      { status: 'success', fill_tx_hash: fill.txHash },
      { recorded: { via, micros: fill.micros.toString(), from: fill.from, txFrom: fill.txFrom, at: new Date().toISOString(), overpaidMicros: overpaid } }
   );
   if (!updatedLoan) return 'recorded';

   if (overpaid > OVERPAID_ALERT_MICROS) {
      await alertTeam(
         svc,
         `⚠️ 🇮🇩 ${updatedLoan.tracking_id}: the Walt repayment was ${(overpaid / 1e6).toFixed(2)} USDC more than was left (${fill.txHash}). The loan is closed; send the extra back to their Walt ${short(row.refund_to)} (USDC, BNB Chain).`
      );
   }
   if (via === 'fallback_scan') {
      await alertTeam(svc, `🇮🇩 ${updatedLoan.tracking_id}: Walt repayment matched on Base by amount + Relay solver (Relay's status didn't follow the deposit). Fill ${fill.txHash}, ${paidUsd.toFixed(2)} USDC. Recorded — glance at it.`);
   }

   await runRepaymentFollowUps(svc, {
      loanId: row.loan_id,
      updatedLoan,
      paidNow: paidUsd,
      browser: { label: 'Telegram · Walt → Relay', isInApp: false },
      userAgent: null
   });

   if (updatedLoan.repayment_status !== 'Paid') {
      // Paid → loan-repayment-received-notification sends the Bahasa 'repaid' message itself.
      const user = await loadUser(svc, row.user_id);
      const repayIdr = Number(updatedLoan.repay_idr ?? NaN);
      const pegged = Number.isFinite(repayIdr) && repayIdr > 0;
      const paidIdr = pegged ? Math.max(0, Math.round(Number(updatedLoan.repaid_idr ?? 0) - Number(before?.repaid_idr ?? 0))) : null;
      const leftIdr = pegged ? Math.max(0, Math.round(repayIdr - Number(updatedLoan.repaid_idr ?? 0))) : null;
      const leftUsd = Math.max(0, Number(updatedLoan.total_repayment_amount ?? 0) - Number(updatedLoan.repaid_amount ?? 0));
      await tell(user, partialReceivedText(idLocaleOf(user?.preferred_locale), paidIdr, paidUsd, leftIdr, leftUsd), menuRow(user));
   }
   return 'recorded';
};

// ── the 5-minute job ─────────────────────────────────────────────────────────────────────────────
const parseSolvers = (value: string | null) =>
   new Set(
      String(value ?? '')
         .split(',')
         .map((s) => s.trim().toLowerCase())
         .filter((s) => EVM_ADDRESS.test(s))
   );

/** Remember the Base addresses a verified Relay fill came from (setting relay_base_solvers). */
const learnSolvers = async (svc: Svc, solvers: Set<string>, fill: Fill) => {
   const add = [fill.from, fill.txFrom].filter((a): a is string => !!a && EVM_ADDRESS.test(a) && !solvers.has(a));
   if (!add.length || solvers.size >= MAX_LEARNED_SOLVERS) return;
   for (const a of add) solvers.add(a);
   await svc
      .from('telegram_bot_settings')
      .upsert({ key: 'relay_base_solvers', value: [...solvers].slice(0, MAX_LEARNED_SOLVERS).join(','), updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .then(() => undefined, () => undefined);
};

/** BNB Chain: the USDT that reached the one-time address (first transfer), resuming where the last look stopped. */
const findDeposit = async (svc: Svc, row: RepayRow, deadline: number): Promise<Deposit | null> => {
   const head = (await bscHead()) - BSC_CONFIRMATIONS;
   let from = row.quote?.depositScanTo ? BigInt(row.quote.depositScanTo) + 1n : await blockAtOrBefore(row.created_at, head);
   while (from <= head && Date.now() < deadline) {
      const to = from + BSC_LOG_SPAN > head ? head : from + BSC_LOG_SPAN;
      const transfers = await bscTransfersTo(row.deposit_address, from, to, undefined, BSC_USDT);
      if (transfers.length) {
         const t = transfers.sort((a, b) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1))[0];
         const at = new Date((await bscBlockTime(t.blockNumber)) * 1000).toISOString();
         const deposit: Deposit = { txHash: t.txHash, value: t.value.toString(), blockNumber: t.blockNumber.toString(), at, from: t.from };
         await patchRow(svc, row, { tx_hash: t.txHash, status: row.status === 'quoted' ? 'sent' : row.status }, { deposit, depositScanTo: to.toString() });
         return deposit;
      }
      await patchRow(svc, row, {}, { depositScanTo: to.toString() });
      from = to + 1n;
   }
   return null;
};

/** Step 3: the fill found on Base by amount + solver (see the header). */
const fallbackMatch = async (
   svc: Svc,
   row: RepayRow,
   deposit: Deposit,
   solvers: Set<string>,
   claimed: Set<string>,
   deadline: number
): Promise<Fill | null | 'unknown_sender'> => {
   const d6 = BigInt(deposit.value) / 10n ** 12n; // USDT 18 dp → USDC 6 dp
   const lo = d6 - (d6 / 20n > 500_000n ? d6 / 20n : 500_000n);
   const hi = d6 + d6 / 200n;
   const depositMs = new Date(deposit.at).getTime();
   const logs = await baseTransfersTo(row.recipient, depositMs - 2 * 60_000, Math.min(Date.now(), depositMs + FALLBACK_WINDOW_MS), deadline);
   const candidates = logs
      .map((l) => ({ txHash: l.transactionHash.toLowerCase(), value: BigInt(l.data && l.data !== '0x' ? l.data : '0x0'), from: topicAddr(l.topics[1]), block: BigInt(l.blockNumber) }))
      .filter((c) => c.value >= lo && c.value <= hi && !claimed.has(c.txHash))
      .sort((a, b) => (a.block < b.block ? -1 : a.block > b.block ? 1 : 0));
   if (!candidates.length) return null;
   const hashes = candidates.map((c) => c.txHash);
   const [{ data: used }, { data: taken }] = await Promise.all([
      svc.from('used_payment_hashes').select('hash').in('hash', hashes),
      svc.from('relay_transfers').select('fill_tx_hash').in('fill_tx_hash', hashes)
   ]);
   const blocked = new Set([...(used ?? []).map((r: { hash: string }) => r.hash), ...(taken ?? []).map((r: { fill_tx_hash: string }) => r.fill_tx_hash)]);
   let sawOther = false;
   for (const c of candidates) {
      if (blocked.has(c.txHash)) continue;
      const txFrom = await baseTxFrom(c.txHash);
      if (!solvers.has(c.from) && !(txFrom && solvers.has(txFrom))) {
         sawOther = true;
         continue;
      }
      const verified = await verifyBaseFill(c.txHash, row.recipient);
      if (verified.ok) return verified.fill;
   }
   return sawOther ? 'unknown_sender' : null;
};

export type RelayRepayTally = { checked: number; recorded: number; deposits: number; refunded: number; alerted: number };

/**
 * The 5-minute job (video-call-reminders): every open Telegram repay address of the last 3 days. Pass 1
 * asks Relay and records the fills it reports; pass 2 (only for deposits Relay hasn't reported ≥ 10 min)
 * searches Base. Stops at `deadline`. Never throws.
 */
export const runRelayRepayments = async (svc: Svc, deadline = Date.now() + 45_000): Promise<RelayRepayTally> => {
   const tally: RelayRepayTally = { checked: 0, recorded: 0, deposits: 0, refunded: 0, alerted: 0 };
   try {
      const { data } = await svc
         .from('relay_transfers')
         .select(ROW_FIELDS)
         .eq('direction', 'repay')
         .not('loan_id', 'is', null)
         .in('status', OPEN_STATUSES)
         .gte('created_at', new Date(Date.now() - ROW_MAX_AGE_MS).toISOString())
         .order('created_at', { ascending: true })
         .limit(40);
      const rows = (data ?? []) as RepayRow[];
      if (!rows.length) return tally;
      const solvers = parseSolvers(await getSetting(svc, 'relay_base_solvers'));
      const claimed = new Set<string>();
      const needFallback: Array<{ row: RepayRow; deposit: Deposit }> = [];

      // Pass 1: Relay's status, the deposit on BNB Chain.
      for (const row of rows) {
         if (Date.now() > deadline - 5_000) break;
         tally.checked += 1;
         try {
            let status: RelayStatus | null = null;
            try {
               status = row.request_id ? await relayStatus(row.request_id) : null;
            } catch {
               status = null;
            }
            const user = status && ['refund', 'failure'].includes(status.status) ? await loadUser(svc, row.user_id) : null;
            if (status?.status === 'success' && status.fillTxHash) {
               const verified = await verifyBaseFill(status.fillTxHash, row.recipient);
               if (verified.ok) {
                  claimed.add(verified.fill.txHash);
                  await learnSolvers(svc, solvers, verified.fill);
                  const outcome = await recordFill(svc, row, verified.fill, 'relay_status');
                  if (outcome === 'recorded') tally.recorded += 1;
               } else if (verified.error === 'no_transfer_to_lender' || verified.error === 'reverted') {
                  await patchRow(svc, row, { status: 'unmatched', fill_tx_hash: status.fillTxHash }, { recorded: { error: verified.error } });
                  await alertTeam(svc, `⚠️ 🇮🇩 Walt repay ${short(row.deposit_address)}: Relay says done (${status.fillTxHash}) but no USDC reached the lender ${short(row.recipient)} on Base (${verified.error}). Check it.`);
                  tally.alerted += 1;
               }
               continue;
            }
            if (status?.status === 'refund') {
               await patchRow(svc, row, { status: 'refund', ...(status.fillTxHash ? { fill_tx_hash: status.fillTxHash } : {}) });
               await tell(
                  user,
                  say(
                     user,
                     '↩️ USDT kamu dikembalikan ke Walt (jumlah/jaringan tidak cocok). Tekan 💰 Bayar untuk alamat baru.',
                     '↩️ Your USDT went back to your Walt (wrong amount or network). Tap 💰 Pay for a new address.'
                  ),
                  menuRow(user)
               );
               tally.refunded += 1;
               continue;
            }
            if (status?.status === 'failure') {
               await patchRow(svc, row, { status: 'failure' });
               await tell(user, say(user, '⚠️ Ada masalah dengan pembayaranmu. Tim kami sedang mengecek, kamu akan dikabari di sini.', '⚠️ Something went wrong with your payment. Our team is checking and will tell you here.'));
               await alertTeam(svc, `⚠️ 🇮🇩 Walt repay FAILED at Relay: ${short(row.deposit_address)} (request ${row.request_id}, loan ${row.loan_id}). Check where the USDT is.`);
               tally.alerted += 1;
               continue;
            }
            if (status && ['pending', 'submitted', 'delayed'].includes(status.status) && row.status !== 'pending') {
               await patchRow(svc, row, { status: 'pending', ...(!row.tx_hash && status.inTxHashes[0] ? { tx_hash: status.inTxHashes[0] } : {}) });
            }

            // Waiting (or pending): look for the deposit on BNB Chain.
            let deposit = row.quote?.deposit ?? null;
            if (!deposit && Date.now() - new Date(row.created_at).getTime() > 60_000) {
               deposit = await findDeposit(svc, row, deadline - 10_000);
               if (deposit) {
                  tally.deposits += 1;
                  if (!row.quote?.depositSeenToldAt) {
                     const u = await loadUser(svc, row.user_id);
                     await tell(u, say(u, '⏳ USDT kamu sudah masuk. Sedang diteruskan, biasanya 1–5 menit.', '⏳ Your USDT arrived. Passing it on, usually 1–5 minutes.'));
                     await patchRow(svc, row, {}, { depositSeenToldAt: new Date().toISOString() });
                  }
               }
            }
            if (!deposit) {
               if (Date.now() - new Date(row.created_at).getTime() > NO_DEPOSIT_EXPIRE_MS) await patchRow(svc, row, { status: 'expired' });
               continue;
            }
            const sinceDeposit = Date.now() - new Date(deposit.at).getTime();
            if (sinceDeposit > FALLBACK_AFTER_MS && (!status || status.status === 'waiting' || status.status === 'unknown' || sinceDeposit > FALLBACK_WINDOW_MS)) {
               needFallback.push({ row, deposit });
            }
         } catch (err) {
            console.error(`[idRepayments] row ${row.id} failed`, err instanceof Error ? err.message : err);
         }
      }

      // Pass 2: deposits Relay didn't report — oldest deposit first, one fill per row.
      needFallback.sort((a, b) => new Date(a.deposit.at).getTime() - new Date(b.deposit.at).getTime());
      for (const { row, deposit } of needFallback) {
         if (Date.now() > deadline - 5_000) break;
         try {
            const found = await fallbackMatch(svc, row, deposit, solvers, claimed, deadline - 5_000);
            if (found && found !== 'unknown_sender') {
               claimed.add(found.txHash);
               const outcome = await recordFill(svc, row, found, 'fallback_scan');
               if (outcome === 'recorded') tally.recorded += 1;
               continue;
            }
            const sinceDeposit = Date.now() - new Date(deposit.at).getTime();
            if ((found === 'unknown_sender' || sinceDeposit > FALLBACK_WINDOW_MS) && !row.quote?.fallbackAlertedAt) {
               await patchRow(svc, row, sinceDeposit > FALLBACK_WINDOW_MS ? { status: 'unmatched' } : {}, { fallbackAlertedAt: new Date().toISOString() });
               await alertTeam(
                  svc,
                  `⚠️ 🇮🇩 Walt repay not matched: ${(Number(BigInt(deposit.value) / 10n ** 12n) / 1e6).toFixed(2)} USDT reached Relay address ${row.deposit_address} (BNB tx ${deposit.txHash}, ${Math.round(sinceDeposit / 60_000)} min ago) for loan ${row.loan_id}, but no Relay fill to the lender ${row.recipient} on Base could be matched${found === 'unknown_sender' ? ' (a transfer of about that amount came from an address that is not a known Relay solver)' : ''}. If it arrived, record it in admin with the Base tx hash.`
               );
               tally.alerted += 1;
            }
         } catch (err) {
            console.error(`[idRepayments] fallback for ${row.id} failed`, err instanceof Error ? err.message : err);
         }
      }
   } catch (err) {
      console.error('[idRepayments] run failed', err instanceof Error ? err.message : err);
   }
   return tally;
};
