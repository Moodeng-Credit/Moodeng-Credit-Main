// Indonesia track: an admin pays a loan by hand from Binance TH to the borrower's Walt address
// (USDC on BNB Smart Chain), and the app confirms it by itself on-chain
// (migration 20261107140000_indonesia_manual_payouts.sql).
//
//   ensurePayout      — the id_manual_payouts row for a loan (one per loan)
//   markSent          — admin tapped "I sent it": remember who, then look right away
//   checkPayout       — search BNB Chain for USDC sent to their Walt address, exact amount, since
//                       the request was posted; resumes from scanned_to_block
//   recordByTxid      — fallback: the admin pastes the BNB Chain TxID
//   runWaltPayoutScan — the 5-minute job: every open Indonesian request + one "not seen" alert
//   releasePayout     — admin "Release" on a stuck/failed automatic payout (after a BNB Chain check)
//
// A match must be: USDC (BSC) Transfer → the borrower's walt_address, received amount between
// (loan − $0.50) and the loan amount (an exact match wins), at least CONFIRMATIONS deep, a tx hash
// never used before, and ONLY after an admin tapped "I sent it" (or pasted the TxID). Exchange hot
// wallets are shared by millions, so a borrower withdrawing $5 into their own Walt must never be
// able to make a loan look funded on its own.
//
// Funding is recorded like any direct lend: loan_status 'Lent', lender = the admin (repayments go to
// their users.wallet_address on Base), funding_method 'walt_manual'. Never throws to callers.

import { sendCashOutGuideOffer } from './idGuides.ts';
import { sendTelegramMessage } from './telegram.ts';
import { postLoanFundedToTeam } from './teamLoanFeed.ts';
import {
   autoPayBlocker,
   balanceOf,
   bangkokDay,
   bangkokDayStart,
   getAutoPayLimits,
   getPayoutWallet,
   loadPayoutCreds,
   MIN_SEND_BUDGET_MS,
   NotSentError,
   paidTodayUsd,
   pollOpenfortTx,
   sendTokenBsc,
   type AutoPayLimits,
   type BscToken,
   type PayoutWallet
} from './idPayoutWallet.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

export const BSC_USDC = '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d';
export const BSC_USDT = '0x55d398326f99059ff775485246999027b3197955';
/** A payout is accepted on chain in either dollar coin (both 18 decimals); id_payout_token picks what we SEND. */
const PAYOUT_TOKENS = [BSC_USDC, BSC_USDT];
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const RPCS = ['https://bsc-rpc.publicnode.com', 'https://bsc.drpc.org'];
const MAX_LOG_SPAN = 49_000; // publicnode allows 50,000 blocks per eth_getLogs
const MAX_SPANS_PER_CHECK = 8; // ≈ 2 days of BNB Chain per check, so one check never runs long
const CONFIRMATIONS = 15n;
const NOT_FOUND_ALERT_MS = 30 * 60_000;
const USDC_DECIMALS = 18n;
const SHORTFALL_ALLOWED = 5n * 10n ** 17n; // $0.50: a fee taken out of the amount
const SCAN_BUDGET_MS = 60_000;

export type PayoutRow = {
   id: string;
   loan_id: string;
   borrower_user_id: string;
   /** Null for a Walt Transfer loan (sent to their Telegram @username, no address needed). */
   walt_address: string | null;
   amount: number | string;
   lender_user_id: string | null;
   marked_sent_at: string | null;
   status: 'waiting' | 'paying' | 'found' | 'not_found' | 'failed';
   method?: 'manual' | 'auto';
   openfort_tx_id?: string | null;
   paid_attempt_at?: string | null;
   error?: string | null;
   chain_checked_at?: string | null;
   chain_scanned_to_block?: number | null;
   log_index?: number | null;
   bsc_tx_hash: string | null;
   from_address: string | null;
   block_number: number | null;
   found_at: string | null;
   found_by: string | null;
   not_found_alerted_at: string | null;
   scanned_to_block: number | null;
   created_at: string;
};

export type Transfer = { txHash: string; from: string; to: string; value: bigint; blockNumber: bigint; logIndex: number };

export type PayoutResult =
   | { ok: true; state: 'found'; payout: PayoutRow; funded: boolean }
   | { ok: true; state: 'waiting'; payout: PayoutRow }
   | { ok: true; state: 'paying'; payout: PayoutRow }
   | { ok: true; state: 'released'; payout: PayoutRow }
   | { ok: false; error: string; payout?: PayoutRow };

// ── amounts ──────────────────────────────────────────────────────────────────────────────────────
/** "5" / 5 / "10.50" → units with 18 decimals, exactly (string math, never floats). */
export const usdcUnits = (amount: number | string): bigint => {
   const s = String(amount).trim();
   if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`bad amount ${s}`);
   const [whole, frac = ''] = s.split('.');
   const fracPadded = (frac + '0'.repeat(Number(USDC_DECIMALS))).slice(0, Number(USDC_DECIMALS));
   return BigInt(whole) * 10n ** USDC_DECIMALS + BigInt(fracPadded || '0');
};

const pad32 = (address: string) => `0x${address.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`;
const fromTopic = (topic: string) => `0x${topic.slice(-40)}`.toLowerCase();
const isAddress = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);
const isTxHash = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v);

/** One Transfer = (tx hash, log index): a single tx can pay several loans, each log only once. */
export const transferKey = (txHash: string, logIndex: number | null | undefined) => `${txHash.toLowerCase()}:${logIndex ?? -1}`;

const usedTransfers = async (svc: Svc): Promise<Set<string>> => {
   const { data } = await svc.from('id_manual_payouts').select('bsc_tx_hash, log_index').not('bsc_tx_hash', 'is', null);
   return new Set(((data ?? []) as Array<{ bsc_tx_hash: string; log_index: number | null }>).map((r) => transferKey(r.bsc_tx_hash, r.log_index)));
};

// ── BNB Chain RPC ────────────────────────────────────────────────────────────────────────────────
const rpc = async <T>(method: string, params: unknown[]): Promise<T> => {
   let lastError: unknown = null;
   for (const url of RPCS) {
      try {
         const res = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
            signal: AbortSignal.timeout(12_000)
         });
         const body = await res.json();
         if (body?.error) throw new Error(`${method}: ${body.error.message ?? JSON.stringify(body.error)}`);
         return body.result as T;
      } catch (err) {
         lastError = err;
      }
   }
   throw lastError instanceof Error ? lastError : new Error(`${method} failed`);
};

export const headBlock = async () => BigInt(await rpc<string>('eth_blockNumber', []));
export const blockTime = async (n: bigint) => {
   const b = await rpc<{ timestamp: string } | null>('eth_getBlockByNumber', [`0x${n.toString(16)}`, false]);
   if (!b) throw new Error(`block ${n} not found`);
   return Number(BigInt(b.timestamp));
};

/** Roughly the first block at or after `iso` (BNB Chain block time from the last 50k blocks). */
export const blockAtOrBefore = async (iso: string, head: bigint): Promise<bigint> => {
   const target = Math.floor(new Date(iso).getTime() / 1000);
   const sample = head > 50_000n ? head - 50_000n : 0n;
   const [tHead, tSample] = await Promise.all([blockTime(head), blockTime(sample)]);
   const secondsPerBlock = Math.max(0.1, (tHead - tSample) / Number(head - sample));
   const back = BigInt(Math.ceil((tHead - target) / secondsPerBlock)) + 2_000n; // margin
   return back >= head ? 0n : head - back;
};

/** ERC-20 Transfers to `to` on BNB Chain (USDC unless `token` says otherwise, e.g. USDT for Walt repayments). */
export const transfersTo = async (to: string, fromBlock: bigint, toBlock: bigint, from?: string, token: string | string[] = BSC_USDC): Promise<Transfer[]> => {
   type Log = { transactionHash: string; topics: string[]; data: string; blockNumber: string; logIndex: string; removed?: boolean };
   const logs = await rpc<Log[]>('eth_getLogs', [
      {
         fromBlock: `0x${fromBlock.toString(16)}`,
         toBlock: `0x${toBlock.toString(16)}`,
         address: Array.isArray(token) ? token.map((t) => t.toLowerCase()) : token.toLowerCase(),
         topics: [TRANSFER_TOPIC, from ? pad32(from) : null, pad32(to)]
      }
   ]);
   return (logs ?? [])
      .filter((l) => !l.removed && l.topics?.length === 3)
      .map((l) => ({
         txHash: l.transactionHash.toLowerCase(),
         from: fromTopic(l.topics[1]),
         to: fromTopic(l.topics[2]),
         value: BigInt(l.data),
         blockNumber: BigInt(l.blockNumber),
         logIndex: Number(BigInt(l.logIndex))
      }));
};

// ── settings ─────────────────────────────────────────────────────────────────────────────────────
const getSetting = async (svc: Svc, key: string): Promise<string | null> => {
   const { data } = await svc.from('telegram_bot_settings').select('value').eq('key', key).maybeSingle();
   return (data?.value as string | undefined) ?? null;
};

/** How loans go out: 'walt_transfer' (default — George's Walt → their @username, by hand) or 'chain'. */
/** The coin the payout wallet sends: 'USDT' when id_payout_token says so (what Walt holds), else USDC. */
export const payoutTokenOf = async (svc: Svc): Promise<BscToken> =>
   String((await getSetting(svc, 'id_payout_token')) ?? '').trim().toUpperCase() === 'USDT' ? 'USDT' : 'USDC';

export const payoutModeOf = async (svc: Svc): Promise<'walt_transfer' | 'chain'> =>
   String((await getSetting(svc, 'id_payout_mode')) ?? 'walt_transfer').trim().toLowerCase() === 'chain' ? 'chain' : 'walt_transfer';

const adminChatId = async (svc: Svc): Promise<string | null> =>
   (await getSetting(svc, 'kyc_alert_chat_id')) || Deno.env.get('TEAM_TELEGRAM_CHAT_ID') || (await getSetting(svc, 'team_group_chat_id'));

const short = (a: string | null | undefined) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : 'their Walt');

// ── the payout row ───────────────────────────────────────────────────────────────────────────────
type LoanForPayout = {
   id: string;
   borrower_user_id: string;
   loan_amount: number | string;
   loan_status: string;
   lender_user_id: string | null;
   funded_at: string | null;
   market: string | null;
   created_at: string;
   is_test?: boolean | null;
};

const loadLoan = async (svc: Svc, loanId: string): Promise<LoanForPayout | null> => {
   const { data } = await svc
      .from('loans')
      .select('id, borrower_user_id, loan_amount, loan_status, lender_user_id, funded_at, market, created_at, is_test')
      .eq('id', loanId)
      .maybeSingle();
   return (data as LoanForPayout | null) ?? null;
};

const isOpen = (loan: LoanForPayout) => loan.loan_status === 'Requested' && !loan.lender_user_id && !loan.funded_at;

export const ensurePayout = async (svc: Svc, loanId: string): Promise<{ payout?: PayoutRow; loan?: LoanForPayout; error?: string }> => {
   const loan = await loadLoan(svc, loanId);
   if (!loan) return { error: 'loan_not_found' };
   if (loan.market !== 'ID') return { error: 'not_indonesia_loan', loan };
   const { data: existing } = await svc.from('id_manual_payouts').select('*').eq('loan_id', loanId).maybeSingle();
   if (existing) return { payout: existing as PayoutRow, loan };
   if (!isOpen(loan)) return { error: 'loan_not_open', loan };
   const { data: borrower } = await svc.from('users').select('walt_address').eq('id', loan.borrower_user_id).maybeSingle();
   const walt = borrower?.walt_address as string | null | undefined;
   // Walt Transfer mode pays their Telegram @username: no address needed (the chain ways still refuse).
   if (!isAddress(walt) && (await payoutModeOf(svc)) !== 'walt_transfer') return { error: 'no_walt_address', loan };
   const { data: created, error } = await svc
      .from('id_manual_payouts')
      .upsert(
         { loan_id: loan.id, borrower_user_id: loan.borrower_user_id, walt_address: isAddress(walt) ? walt.toLowerCase() : null, amount: loan.loan_amount },
         { onConflict: 'loan_id', ignoreDuplicates: false }
      )
      .select('*')
      .maybeSingle();
   if (error || !created) return { error: error?.message ?? 'payout_row_failed', loan };
   return { payout: created as PayoutRow, loan };
};

// ── recording the funding ────────────────────────────────────────────────────────────────────────
const recordFunding = async (
   svc: Svc,
   payout: PayoutRow,
   loan: LoanForPayout,
   t: Transfer,
   foundBy: 'scan' | 'txid' | 'auto' | 'walt'
): Promise<PayoutResult> => {
   // Claim the transfer first: (bsc_tx_hash, log_index) is unique, so one transfer can never fund two loans.
   // The lender is read fresh: whoever tapped "I sent it" / pasted the TxID last paid it.
   const { data: fresh } = await svc.from('id_manual_payouts').select('lender_user_id').eq('id', payout.id).maybeSingle();
   const lenderId =
      (fresh?.lender_user_id as string | null | undefined) ?? payout.lender_user_id ?? (await getSetting(svc, 'id_payout_lender_user_id'));
   if (!lenderId) return { ok: false, error: 'no_lender_of_record', payout };
   const { data: lender } = await svc.from('users').select('wallet_address').eq('id', lenderId).maybeSingle();
   const lenderWallet = lender?.wallet_address as string | null | undefined;
   if (!isAddress(lenderWallet)) return { ok: false, error: 'lender_has_no_base_wallet', payout };

   const now = new Date().toISOString();
   // An automatic payout is recorded only from its own row ('paying', or 'failed' when the BNB Chain
   // check finds it went out after all); the manual paths never touch a row the payout wallet is paying
   // (and never a found one).
   let claimQuery = svc
      .from('id_manual_payouts')
      .update({
         status: 'found',
         bsc_tx_hash: t.txHash,
         log_index: t.logIndex,
         from_address: t.from,
         block_number: Number(t.blockNumber),
         found_at: now,
         found_by: foundBy,
         lender_user_id: lenderId,
         error: null,
         updated_at: now
      })
      .eq('id', payout.id);
   claimQuery = foundBy === 'auto' ? claimQuery.in('status', ['paying', 'failed']) : claimQuery.not('status', 'in', '(found,paying)');
   const { data: claimed, error: claimError } = await claimQuery.select('*').maybeSingle();
   if (claimError) {
      const dup = /duplicate|unique/i.test(claimError.message ?? '');
      return { ok: false, error: dup ? 'tx_already_used' : claimError.message, payout };
   }
   if (!claimed) {
      const { data: again } = await svc.from('id_manual_payouts').select('*').eq('id', payout.id).maybeSingle();
      const row = (again ?? payout) as PayoutRow;
      if (row.status === 'paying') return { ok: false, error: 'auto_payout_in_progress', payout: row };
      if (row.status !== 'found') return { ok: false, error: 'payout_not_claimable', payout: row };
      return { ok: true, state: 'found', payout: row, funded: false };
   }

   const { data: borrower } = await svc.from('users').select('wallet_address').eq('id', loan.borrower_user_id).maybeSingle();
   const { data: funded, error: fundError } = await svc
      .from('loans')
      .update({
         loan_status: 'Lent',
         funded_at: now,
         funding_method: 'walt_manual',
         lender_user_id: lenderId,
         lender_wallet: lenderWallet,
         ...(isAddress(borrower?.wallet_address) ? { borrower_wallet: borrower.wallet_address } : {}),
         is_sellable: false,
         // loans.hash: the funding tx first, repayments after (the BitRepo report reads it that way).
         // Here the funding tx is on BNB Chain; funding_method 'walt_manual' says so.
         // A Walt Transfer (inside Telegram's wallet, no chain) is 'walt-transfer-out:<loan id>'.
         hash: [foundBy === 'walt' ? t.txHash : `bsc:${t.txHash}`],
         on_hold_since: null,
         on_hold_reason: null,
         updated_at: now
      })
      .eq('id', loan.id)
      .eq('loan_status', 'Requested')
      .is('lender_user_id', null)
      .select('id')
      .maybeSingle();
   if (fundError || !funded) {
      // Someone else funded it meanwhile (or the update failed): the payout row stays 'found' with the
      // tx, and the team is told — money went out twice and needs a human.
      const chat = await adminChatId(svc);
      if (chat) {
         await sendTelegramMessage(
            chat,
            `⚠️ 🇮🇩 Walt payout ${foundBy === 'walt' ? 'marked sent by Walt Transfer' : `found on BNB Chain (${short(t.txHash)})`} but the loan ${loan.id.slice(0, 8)} could not be marked funded: ${fundError?.message ?? 'it was already funded'}. Check it in admin.`
         ).catch(() => undefined);
      }
      return { ok: false, error: fundError?.message ?? 'loan_already_funded', payout: claimed as PayoutRow };
   }

   await postLoanFundedToTeam(svc, loan.id).catch(() => undefined);
   const { error: notifyError } = await svc.functions.invoke('loan-funded-notification', { body: { loanId: loan.id } });
   if (notifyError) console.error(`idManualFunding: borrower notification failed for ${loan.id}: ${notifyError.message}`);
   // Hand-holding: the money is in their Walt — show them how to turn it into rupiah, step by step.
   await sendCashOutGuideOffer(svc, loan.borrower_user_id, Number(payout.amount)).catch(() => undefined);
   // A Walt Transfer is confirmed on the card it was tapped on (no second line needed).
   const chat = foundBy === 'walt' ? null : await adminChatId(svc);
   if (chat) {
      await sendTelegramMessage(
         chat,
         `🇮🇩 ${foundBy === 'auto' ? 'Auto-payout from the payout wallet' : 'Walt payout'} confirmed on BNB Chain ✅ $${Number(payout.amount)} → ${short(payout.walt_address)} (received ${(Number(t.value) / 1e18).toFixed(2)} USDC, tx ${short(t.txHash)}).`
      ).catch(() => undefined);
   }
   return { ok: true, state: 'found', payout: claimed as PayoutRow, funded: true };
};

// ── searching BNB Chain ──────────────────────────────────────────────────────────────────────────
/** Exact amount first; otherwise the closest one at most $0.50 under (a fee taken out of it). */
const pickMatch = (transfers: Transfer[], want: bigint, used: Set<string>): Transfer | undefined => {
   const fresh = transfers.filter((t) => !used.has(transferKey(t.txHash, t.logIndex)) && t.value <= want && t.value >= want - SHORTFALL_ALLOWED);
   return fresh.find((t) => t.value === want) ?? fresh.sort((a, b) => (a.value > b.value ? -1 : 1))[0];
};

export const checkPayout = async (
   svc: Svc,
   payout: PayoutRow,
   loan: LoanForPayout,
   deadline = Date.now() + SCAN_BUDGET_MS
): Promise<PayoutResult> => {
   if (payout.status === 'found') return { ok: true, state: 'found', payout, funded: false };
   // The payout wallet is paying this one: only its own Openfort transaction can fund it.
   if (payout.status === 'paying') return { ok: true, state: 'paying', payout };
   if (!isOpen(loan)) return { ok: false, error: 'loan_not_open', payout };
   // Nothing is accepted until an admin says they sent it.
   if (!payout.marked_sent_at) return { ok: true, state: 'waiting', payout };
   if (!payout.walt_address) return { ok: false, error: 'no_walt_address', payout };
   const waltAddress = payout.walt_address;

   let want: bigint;
   try {
      want = usdcUnits(payout.amount);
   } catch {
      return { ok: false, error: 'bad_amount', payout };
   }
   const head = await headBlock();
   const safeHead = head - CONFIRMATIONS;
   let from = payout.scanned_to_block != null ? BigInt(payout.scanned_to_block) + 1n : await blockAtOrBefore(loan.created_at, head);
   const used = await usedTransfers(svc);

   let spans = 0;
   while (from <= safeHead && spans < MAX_SPANS_PER_CHECK && Date.now() < deadline) {
      const to = from + BigInt(MAX_LOG_SPAN) > safeHead ? safeHead : from + BigInt(MAX_LOG_SPAN);
      const transfers = await transfersTo(waltAddress, from, to, undefined, PAYOUT_TOKENS);
      const match = pickMatch(transfers, want, used);
      if (match) return await recordFunding(svc, payout, loan, match, 'scan');
      await svc.from('id_manual_payouts').update({ scanned_to_block: Number(to), updated_at: new Date().toISOString() }).eq('id', payout.id);
      payout = { ...payout, scanned_to_block: Number(to) };
      from = to + 1n;
      spans += 1;
   }
   return { ok: true, state: 'waiting', payout };
};

/**
 * A BNB Chain tx's receipt holds a USDC (BSC) Transfer to `to` of the right amount (exact, or up to
 * `shortfall` under), at least CONFIRMATIONS deep — and, when `from` is given, sent from that address.
 */
const verifyTransferTx = async (
   txHash: string,
   to: string,
   want: bigint,
   opts: { shortfall?: bigint; from?: string } = {}
): Promise<{ ok: true; transfer: Transfer } | { ok: false; error: string }> => {
   type Receipt = { status: string; blockNumber: string; logs: Array<{ address: string; topics: string[]; data: string; logIndex: string; transactionHash: string }> } | null;
   const receipt = await rpc<Receipt>('eth_getTransactionReceipt', [txHash]);
   if (!receipt) return { ok: false, error: 'tx_not_found_on_bnb_chain' };
   if (receipt.status !== '0x1') return { ok: false, error: 'tx_failed' };
   const head = await headBlock();
   if (BigInt(receipt.blockNumber) > head - CONFIRMATIONS) return { ok: false, error: 'tx_too_new_try_again' };
   const shortfall = opts.shortfall ?? 0n;
   const log = receipt.logs.find(
      (l) =>
         PAYOUT_TOKENS.includes(l.address.toLowerCase()) &&
         l.topics?.[0] === TRANSFER_TOPIC &&
         l.topics.length === 3 &&
         fromTopic(l.topics[2]) === to.toLowerCase() &&
         (!opts.from || fromTopic(l.topics[1]) === opts.from.toLowerCase())
   );
   if (!log) return { ok: false, error: 'tx_not_usdc_to_their_walt' };
   const value = BigInt(log.data);
   if (value > want || value < want - shortfall) return { ok: false, error: 'tx_wrong_amount' };
   return {
      ok: true,
      transfer: {
         txHash: txHash.toLowerCase(),
         from: fromTopic(log.topics[1]),
         to: fromTopic(log.topics[2]),
         value,
         blockNumber: BigInt(receipt.blockNumber),
         logIndex: Number(BigInt(log.logIndex))
      }
   };
};

/** Admin tapped "I sent it": they are the lender of record; look right away. */
export const markSent = async (svc: Svc, loanId: string, adminUserId: string): Promise<PayoutResult> => {
   const { payout, loan, error } = await ensurePayout(svc, loanId);
   if (!payout || !loan) return { ok: false, error: error ?? 'payout_unavailable' };
   if (payout.status === 'found') return { ok: true, state: 'found', payout, funded: false };
   if (payout.status === 'paying') return { ok: false, error: 'auto_payout_in_progress', payout };
   // A failed automatic payout may still have gone out: look on BNB Chain first.
   const gate = await chainGateForManual(svc, payout);
   if (gate) return gate;
   const now = new Date().toISOString();
   const { data: updated } = await svc
      .from('id_manual_payouts')
      // scanned_to_block reset: the job may already have walked past this transfer while it only
      // accepted known Binance TH senders; with a tap any sender counts, so search from the start.
      .update({
         marked_sent_at: payout.marked_sent_at ?? now,
         lender_user_id: adminUserId,
         not_found_alerted_at: null,
         scanned_to_block: null,
         updated_at: now
      })
      .eq('id', payout.id)
      // One statement with the claim's condition flipped: if the payout wallet claimed it a moment
      // ago this matches nothing, and if this lands first the claim sees marked_sent_at and backs off.
      .not('status', 'in', '(found,paying)')
      // …and never a failed automatic payout BNB Chain hasn't been checked for.
      .or('method.eq.manual,status.neq.failed,chain_checked_at.not.is.null')
      .select('*')
      .maybeSingle();
   if (!updated) {
      const { data: again } = await svc.from('id_manual_payouts').select('*').eq('id', payout.id).maybeSingle();
      const row = (again ?? payout) as PayoutRow;
      if (row.status === 'found') return { ok: true, state: 'found', payout: row, funded: false };
      return { ok: false, error: row.status === 'paying' ? 'auto_payout_in_progress' : 'payout_row_failed', payout: row };
   }
   try {
      return await checkPayout(svc, updated as PayoutRow, loan);
   } catch (err) {
      // BNB Chain unreachable: the 5-minute job keeps looking.
      console.error('idManualFunding.markSent check failed', err);
      return { ok: true, state: 'waiting', payout: (updated ?? payout) as PayoutRow };
   }
};

/** Fallback: the admin pastes the TxID from Binance TH's withdrawal history. */
export const recordByTxid = async (svc: Svc, loanId: string, txHash: string, adminUserId: string): Promise<PayoutResult> => {
   if (!isTxHash(txHash)) return { ok: false, error: 'bad_txid' };
   const { payout, loan, error } = await ensurePayout(svc, loanId);
   if (!payout || !loan) return { ok: false, error: error ?? 'payout_unavailable' };
   if (payout.status === 'found') return { ok: true, state: 'found', payout, funded: false };
   if (payout.status === 'paying') return { ok: false, error: 'auto_payout_in_progress', payout };
   const gate = await chainGateForManual(svc, payout);
   if (gate) return gate;
   if (!isOpen(loan)) return { ok: false, error: 'loan_not_open', payout };
   if (!payout.walt_address) return { ok: false, error: 'no_walt_address', payout };
   const verified = await verifyTransferTx(txHash, payout.walt_address, usdcUnits(payout.amount), { shortfall: SHORTFALL_ALLOWED });
   if (!verified.ok) return { ok: false, error: verified.error, payout };
   const { data: dup } = await svc
      .from('id_manual_payouts')
      .select('id')
      .eq('bsc_tx_hash', txHash.toLowerCase())
      .eq('log_index', verified.transfer.logIndex)
      .maybeSingle();
   if (dup) return { ok: false, error: 'tx_already_used', payout };
   const withLender = { ...payout, lender_user_id: adminUserId };
   await svc.from('id_manual_payouts').update({ lender_user_id: adminUserId, updated_at: new Date().toISOString() }).eq('id', payout.id);
   return await recordFunding(svc, withLender, loan, verified.transfer, 'txid');
};

/**
 * Paid by Walt Transfer (George's Walt → the borrower's Telegram @username, free, no chain): the team
 * tapped "✅ Sent" on the payout card (idWaltPayouts.ts). Walt has no API, so the tap IS the record.
 * Same claim as the other manual paths: never a row the payout wallet is paying, never a found one,
 * never a failed automatic payout BNB Chain hasn't been checked for. The hash 'walt-transfer-out:<loan>'
 * is unique (id_manual_payouts.bsc_tx_hash), so two taps can't fund twice.
 */
export const recordWaltTransferPayout = async (svc: Svc, loanId: string): Promise<PayoutResult> => {
   const { payout, loan, error } = await ensurePayout(svc, loanId);
   if (!payout || !loan) return { ok: false, error: error ?? 'payout_unavailable' };
   if (payout.status === 'found') return { ok: true, state: 'found', payout, funded: false };
   if (payout.status === 'paying') return { ok: false, error: 'auto_payout_in_progress', payout };
   const gate = await chainGateForManual(svc, payout);
   if (gate) return gate;
   if (!isOpen(loan)) return { ok: false, error: 'loan_not_open', payout };
   const t: Transfer = {
      txHash: `walt-transfer-out:${loan.id}`,
      from: 'walt',
      to: payout.walt_address ?? 'walt',
      value: usdcUnits(payout.amount),
      blockNumber: 0n,
      logIndex: 0
   };
   return await recordFunding(svc, payout, loan, t, 'walt');
};

/** "Check again" from the admin card: resume the search without resetting anything. */
export const checkNow = async (svc: Svc, loanId: string): Promise<PayoutResult> => {
   const { payout, loan, error } = await ensurePayout(svc, loanId);
   if (!payout || !loan) return { ok: false, error: error ?? 'payout_unavailable' };
   try {
      if (payout.status === 'paying') return await settleAutoPayout(svc, payout);
      if (needsChainCheck(payout)) {
         const r = await runChainCheck(svc, payout, Date.now(), Date.now() + SCAN_BUDGET_MS);
         if (r.result) return r.result;
         const { data: fresh } = await svc.from('id_manual_payouts').select('*').eq('id', payout.id).maybeSingle();
         return r.outcome === 'nothing'
            ? { ok: true, state: 'waiting', payout: (fresh ?? payout) as PayoutRow }
            : { ok: false, error: chainOutcomeError(r.outcome), payout: (fresh ?? payout) as PayoutRow };
      }
      return await checkPayout(svc, payout, loan);
   } catch (err) {
      console.error('idManualFunding.checkNow failed', err);
      return { ok: false, error: 'bnb_chain_unreachable', payout };
   }
};

/** Status for the admin card (creates the row if the request is open). */
export const payoutStatus = async (svc: Svc, loanId: string) => {
   const { payout, loan, error } = await ensurePayout(svc, loanId);
   return { ok: Boolean(payout), error: payout ? undefined : error, payout: payout ?? null, loanOpen: loan ? isOpen(loan) : false };
};

// ── the 5-minute job ─────────────────────────────────────────────────────────────────────────────
export const runWaltPayoutScan = async (
   svc: Svc,
   now = Date.now(),
   deadline = Date.now() + SCAN_BUDGET_MS
): Promise<{ checked: number; found: number; alerted: number }> => {
   const tally = { checked: 0, found: 0, alerted: 0 };
   try {
      // Only payouts an admin said they sent (nothing is matched without that).
      const { data: rows } = await svc
         .from('id_manual_payouts')
         .select('*')
         .not('status', 'in', '(found,paying)')
         .not('marked_sent_at', 'is', null)
         .gte('marked_sent_at', new Date(now - 7 * 86_400_000).toISOString())
         .order('marked_sent_at', { ascending: true })
         .limit(50);
      for (const payout of (rows ?? []) as PayoutRow[]) {
         if (Date.now() > deadline) break;
         const loan = await loadLoan(svc, payout.loan_id);
         if (!loan || !isOpen(loan)) continue;
         tally.checked += 1;
         try {
            const result = await checkPayout(svc, payout, loan, deadline);
            if (result.ok && result.state === 'found') tally.found += 1;
            const latest = result.payout ?? payout;
            if (
               result.ok &&
               result.state === 'waiting' &&
               latest.marked_sent_at &&
               !latest.not_found_alerted_at &&
               now - new Date(latest.marked_sent_at).getTime() > NOT_FOUND_ALERT_MS
            ) {
               const chat = await adminChatId(svc);
               if (chat) {
                  await sendTelegramMessage(
                     chat,
                     `🇮🇩 Walt payout not seen yet: $${Number(latest.amount)} → ${short(latest.walt_address)} (tapped "I sent it" ${Math.round((now - new Date(latest.marked_sent_at).getTime()) / 60_000)} min ago). Check it was USDC on BSC and the full amount arrived, or paste the TxID in admin.`
                  ).catch(() => undefined);
               }
               await svc
                  .from('id_manual_payouts')
                  .update({ status: 'not_found', not_found_alerted_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() })
                  .eq('id', latest.id)
                  .not('status', 'in', '(found,paying)');
               tally.alerted += 1;
            }
         } catch (err) {
            console.error(`idManualFunding: check failed for ${payout.loan_id}`, err);
         }
      }
   } catch (err) {
      console.error('idManualFunding: scan failed', err);
   }
   return tally;
};

// ── the payout wallet: automatic payouts ─────────────────────────────────────────────────────────
// (migration 20261107150000_indonesia_payout_wallet.sql, _shared/idPayoutWallet.ts)
//
// Never pay twice:
//   1. claim_id_auto_payout() (SQL, one transaction under an advisory lock) re-checks the loan is
//      open, the max and the daily cap, and moves the loan's payout row 'waiting' → 'paying'. Only a
//      row nobody touched can be claimed: no "I sent it" tap, no tx, no earlier attempt.
//   2. The loan is re-read right before sending; if it was funded meanwhile the claim is released.
//   3. Openfort is called once (never with < 30 s of budget left; every SDK call times out at 20 s).
//      Its id is saved at once. If it throws (or times out) before giving an id, the row goes 'failed'
//      and the team is told — it is never retried on its own (the money may have left). A failure
//      before sendTransaction was even started (NotSentError) releases the claim instead.
//   3b. A 'failed' automatic payout (or a 'paying' one with no Openfort id) is looked for on BNB Chain
//      — USDC from the payout wallet to their Walt, exact amount, since paid_attempt_at — before
//      anything else: found → recorded as paid; nothing (and ≥ 15 min old) → chain_checked_at is set
//      and only then can it be paid by hand ("I sent it" / TxID refuse until then).
//   4. A 'paying' row is never sent again: later runs only poll its Openfort id. Succeeded → the
//      receipt is checked on BNB Chain (USDC from the payout wallet → their Walt, exact amount) and
//      recordFunding(…, 'auto') funds the loan. Reverted/failed → 'failed' + alert.
//   5. The manual paths ("I sent it", the TxID, the scan) skip 'paying' rows, and recordFunding only
//      records an automatic payout from its own 'paying' row.

const LOW_BALANCE_USD = 20;
const LOW_ALERT_EVERY_MS = 6 * 3_600_000;
const NO_TX_ID_FAIL_MS = 15 * 60_000;
// A payout attempt younger than this may still land (Openfort retries / mempool): "nothing on chain"
// isn't conclusive before it.
const CHAIN_CHECK_MIN_AGE_MS = 15 * 60_000;
const STUCK_ALERT_MS = 30 * 60_000;
const AUTO_BUDGET_MS = 60_000;

const alertTeam = async (svc: Svc, text: string) => {
   const chat = await adminChatId(svc);
   if (chat) await sendTelegramMessage(chat, text).catch(() => undefined);
};

const setSetting = async (svc: Svc, key: string, value: string) => {
   await svc.from('telegram_bot_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
};

const walletLink = (address: string) => `https://bscscan.com/address/${address}#tokentxns`;

const maybeAlertLowBalance = async (svc: Svc, wallet: PayoutWallet, usdc: number, now: number, token: BscToken = 'USDC') => {
   if (usdc >= LOW_BALANCE_USD) return;
   const last = await getSetting(svc, 'id_payout_low_alerted_at');
   if (last && now - new Date(last).getTime() < LOW_ALERT_EVERY_MS) return;
   await setSetting(svc, 'id_payout_low_alerted_at', new Date(now).toISOString());
   await alertTeam(
      svc,
      `🇮🇩 Payout wallet is low: ${usdc.toFixed(2)} ${token} left. Top it up: Binance TH → Withdraw ${token} → network BSC → ${wallet.address}`
   );
};

const maybeAlertCap = async (svc: Svc, limits: AutoPayLimits, paidToday: number, now: number) => {
   const today = bangkokDay(now);
   if ((await getSetting(svc, 'id_payout_cap_alerted_day')) === today) return;
   await setSetting(svc, 'id_payout_cap_alerted_day', today);
   await alertTeam(
      svc,
      `🇮🇩 Payout wallet hit today's cap: $${paidToday.toFixed(2)} of $${limits.dailyCapUsd} paid automatically. The rest wait for tomorrow (Bangkok) or a hand payout.`
   );
};

const failAutoPayout = async (svc: Svc, payout: PayoutRow, error: string, alert: string, extra: Record<string, unknown> = {}) => {
   const now = new Date().toISOString();
   const { data } = await svc
      .from('id_manual_payouts')
      .update({ status: 'failed', error: error.slice(0, 500), updated_at: now, ...extra })
      .eq('id', payout.id)
      .eq('status', 'paying')
      .select('*')
      .maybeSingle();
   await alertTeam(svc, alert);
   return { ok: false as const, error: 'auto_payout_failed', payout: (data ?? { ...payout, status: 'failed', error }) as PayoutRow };
};

// ── 3b. the BNB Chain check for automatic payouts that may have gone out ─────────────────────────
/** A failed automatic payout (or a 'paying' one Openfort never gave an id for) not yet checked on BNB Chain. */
export const needsChainCheck = (p: Pick<PayoutRow, 'method' | 'status' | 'openfort_tx_id' | 'chain_checked_at'>): boolean =>
   p.method === 'auto' && !p.chain_checked_at && (p.status === 'failed' || (p.status === 'paying' && !p.openfort_tx_id));

export type ChainCheck =
   | { state: 'found'; transfer: Transfer }
   | { state: 'landing' } // a matching transfer is there but not CONFIRMATIONS deep yet
   | { state: 'too_soon' } // nothing (yet), but the attempt is too recent to be sure
   | { state: 'incomplete' } // ran out of time before reaching the chain head
   | { state: 'nothing' };

/**
 * USDC (BSC) Transfer FROM the payout wallet TO the borrower's Walt of exactly the payout amount, since
 * paid_attempt_at (eth_getLogs topics [Transfer, payout wallet, Walt]), not already used by another
 * payout. Resumes from chain_scanned_to_block (saved only up to the confirmed part of the chain).
 */
export const findAutoPayoutOnChain = async (svc: Svc, payout: PayoutRow, now: number, deadline: number): Promise<ChainCheck> => {
   const wallet = await getPayoutWallet(svc);
   if (!wallet) throw new Error('no_payout_wallet');
   const want = usdcUnits(payout.amount);
   const startedIso = payout.paid_attempt_at ?? payout.created_at;
   const used = await usedTransfers(svc);
   // Refunds of repayments also go payout wallet → their Walt (_shared/idRepayments.ts): never take one
   // for the loan's payout. While a refund's hash isn't known yet, wait.
   const { data: refunds } = await svc.from('id_wallet_deposits').select('refund_tx_hash').not('refund_tx', 'is', null);
   if ((refunds ?? []).some((r: { refund_tx_hash: string | null }) => !r.refund_tx_hash)) return { state: 'incomplete' };
   const refundHashes = new Set((refunds ?? []).map((r: { refund_tx_hash: string }) => String(r.refund_tx_hash).toLowerCase()));
   const head = await headBlock();
   const safeHead = head - CONFIRMATIONS;
   let from = payout.chain_scanned_to_block != null ? BigInt(payout.chain_scanned_to_block) + 1n : await blockAtOrBefore(startedIso, head);
   while (from <= head) {
      if (Date.now() > deadline) return { state: 'incomplete' };
      const to = from + BigInt(MAX_LOG_SPAN) > head ? head : from + BigInt(MAX_LOG_SPAN);
      const transfers = await transfersTo(payout.walt_address ?? '', from, to, wallet.address, PAYOUT_TOKENS);
      const match = transfers.find((t) => t.value === want && !used.has(transferKey(t.txHash, t.logIndex)) && !refundHashes.has(t.txHash.toLowerCase()));
      if (match) return match.blockNumber <= safeHead ? { state: 'found', transfer: match } : { state: 'landing' };
      const saved = to <= safeHead ? to : safeHead;
      if (saved >= from) {
         await svc
            .from('id_manual_payouts')
            .update({ chain_scanned_to_block: Number(saved), updated_at: new Date().toISOString() })
            .eq('id', payout.id);
         payout = { ...payout, chain_scanned_to_block: Number(saved) };
      }
      from = to + 1n;
   }
   if (now - new Date(startedIso).getTime() < CHAIN_CHECK_MIN_AGE_MS) return { state: 'too_soon' };
   return { state: 'nothing' };
};

/**
 * Runs the check and acts on it: found → recordFunding(…, 'auto'); nothing → chain_checked_at set (for a
 * 'failed' row; a 'paying' row is left to the caller). Never sends.
 */
const runChainCheck = async (
   svc: Svc,
   payout: PayoutRow,
   now: number,
   deadline: number
): Promise<{ outcome: ChainCheck['state'] | 'error'; result?: PayoutResult; error?: string }> => {
   let check: ChainCheck;
   try {
      check = await findAutoPayoutOnChain(svc, payout, now, deadline);
   } catch (err) {
      console.error(`idManualFunding: chain check failed for ${payout.loan_id}`, err);
      return { outcome: 'error', error: err instanceof Error ? err.message : String(err) };
   }
   if (check.state === 'found') {
      const loan = await loadLoan(svc, payout.loan_id);
      if (!loan) return { outcome: 'found', result: { ok: false, error: 'loan_not_found', payout } };
      const result = await recordFunding(svc, payout, loan, check.transfer, 'auto');
      if (result.ok)
         await alertTeam(
            svc,
            `🇮🇩 The auto-payout for loan ${payout.loan_id.slice(0, 8)} that looked failed DID go out (tx ${short(check.transfer.txHash)}) — recorded as paid. Don't pay it by hand.`
         );
      return { outcome: 'found', result };
   }
   if (check.state === 'nothing' && payout.status === 'failed') {
      await svc
         .from('id_manual_payouts')
         .update({ chain_checked_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() })
         .eq('id', payout.id)
         .eq('status', 'failed');
   }
   return { outcome: check.state };
};

const chainOutcomeError = (outcome: string) =>
   outcome === 'landing'
      ? 'auto_payout_landing'
      : outcome === 'too_soon'
        ? 'chain_check_too_soon'
        : outcome === 'incomplete'
          ? 'chain_check_incomplete'
          : 'bnb_chain_unreachable';

/** For "I sent it" / the TxID: a failed automatic payout is first looked for on BNB Chain. null = go ahead. */
const chainGateForManual = async (svc: Svc, payout: PayoutRow): Promise<PayoutResult | null> => {
   if (!needsChainCheck(payout)) return null;
   const r = await runChainCheck(svc, payout, Date.now(), Date.now() + SCAN_BUDGET_MS);
   if (r.result) return r.result;
   if (r.outcome === 'nothing') return null;
   return { ok: false, error: chainOutcomeError(r.outcome), payout };
};

/**
 * Admin "Release" on an automatic payout stuck in 'paying' or 'failed': BNB Chain first. Money found →
 * recorded as paid. Nothing (and the attempt ≥ 15 min old) → 'failed' with error 'released_by_admin' and
 * chain_checked_at set, so "I sent it" / the TxID open. Never sends.
 */
export const releasePayout = async (svc: Svc, loanId: string, adminUserId: string): Promise<PayoutResult> => {
   const { data } = await svc.from('id_manual_payouts').select('*').eq('loan_id', loanId).maybeSingle();
   const payout = data as PayoutRow | null;
   if (!payout) return { ok: false, error: 'payout_not_found' };
   if (payout.status === 'found') return { ok: true, state: 'found', payout, funded: false };
   if (payout.method !== 'auto' || (payout.status !== 'paying' && payout.status !== 'failed')) {
      return { ok: false, error: 'not_releasable', payout };
   }
   const now = Date.now();
   const r = await runChainCheck(svc, payout, now, now + SCAN_BUDGET_MS);
   if (r.result) return r.result;
   if (r.outcome !== 'nothing') return { ok: false, error: chainOutcomeError(r.outcome), payout };
   const stamp = new Date().toISOString();
   const { data: released } = await svc
      .from('id_manual_payouts')
      .update({ status: 'failed', error: 'released_by_admin', chain_checked_at: stamp, updated_at: stamp })
      .eq('id', payout.id)
      .in('status', ['paying', 'failed'])
      .select('*')
      .maybeSingle();
   if (!released) {
      const { data: again } = await svc.from('id_manual_payouts').select('*').eq('id', payout.id).maybeSingle();
      return { ok: false, error: 'payout_not_claimable', payout: (again ?? payout) as PayoutRow };
   }
   console.log(`idManualFunding: auto-payout for ${loanId} released by ${adminUserId} (nothing on BNB Chain)`);
   await alertTeam(
      svc,
      `🇮🇩 Auto-payout for loan ${loanId.slice(0, 8)} released by an admin: nothing from the payout wallet on BNB Chain. It can be paid by hand now.`
   );
   return { ok: true, state: 'released', payout: released as PayoutRow };
};

/** Moves a 'paying' row on: poll Openfort, verify on BNB Chain, record the funding. Never sends. */
export const settleAutoPayout = async (
   svc: Svc,
   payout: PayoutRow,
   now = Date.now(),
   deadline = Date.now() + SCAN_BUDGET_MS
): Promise<PayoutResult> => {
   if (payout.status !== 'paying') return { ok: true, state: payout.status === 'found' ? 'found' : 'waiting', payout } as PayoutResult;
   const loanTag = payout.loan_id.slice(0, 8);
   const wallet = await getPayoutWallet(svc);
   const startedAt = payout.paid_attempt_at ? new Date(payout.paid_attempt_at).getTime() : now;

   if (!payout.openfort_tx_id) {
      // Claimed but no Openfort id saved (the run died mid-send?). After 15 min, BNB Chain decides.
      if (now - startedAt < NO_TX_ID_FAIL_MS) return { ok: true, state: 'paying', payout };
      const r = await runChainCheck(svc, payout, now, deadline);
      if (r.result) return r.result;
      if (r.outcome !== 'nothing') return { ok: true, state: 'paying', payout };
      return await failAutoPayout(
         svc,
         payout,
         'no_openfort_tx_id',
         `⚠️ 🇮🇩 Auto-payout for loan ${loanTag} ($${Number(payout.amount)} → ${short(payout.walt_address)}) has no Openfort transaction saved, and nothing from the payout wallet reached their Walt on BNB Chain${wallet ? ` (${walletLink(wallet.address)})` : ''}. It can be paid by hand.`,
         { chain_checked_at: new Date(now).toISOString() }
      );
   }

   let st: Awaited<ReturnType<typeof pollOpenfortTx>>;
   try {
      st = await pollOpenfortTx(svc, payout.openfort_tx_id);
   } catch (err) {
      console.error(`idManualFunding: Openfort poll failed for ${payout.loan_id}`, err);
      st = { state: 'pending' };
   }

   if (st.state === 'failed') {
      return await failAutoPayout(
         svc,
         payout,
         st.error,
         `⚠️ 🇮🇩 Auto-payout FAILED for loan ${loanTag}: $${Number(payout.amount)} → ${short(payout.walt_address)} (${st.error.slice(0, 200)}). Openfort ${payout.openfort_tx_id}${st.txHash ? `, tx ${st.txHash}` : ''}. Nothing will retry by itself. BNB Chain is checked ${Math.round(CHAIN_CHECK_MIN_AGE_MS / 60_000)} min after the attempt; paying by hand unlocks only if nothing went out.`
      );
   }

   if (st.state === 'pending') {
      if (now - startedAt > STUCK_ALERT_MS && !payout.not_found_alerted_at) {
         await svc
            .from('id_manual_payouts')
            .update({ not_found_alerted_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() })
            .eq('id', payout.id)
            .eq('status', 'paying');
         await alertTeam(
            svc,
            `🇮🇩 Auto-payout for loan ${loanTag} still not confirmed after ${Math.round((now - startedAt) / 60_000)} min (Openfort ${payout.openfort_tx_id}). It won't be sent again; check Openfort / the payout wallet.`
         );
      }
      return { ok: true, state: 'paying', payout };
   }

   // Openfort says it landed: check it ourselves on BNB Chain, from our wallet, the exact amount.
   let want: bigint;
   try {
      want = usdcUnits(payout.amount);
   } catch {
      return { ok: false, error: 'bad_amount', payout };
   }
   let verified: Awaited<ReturnType<typeof verifyTransferTx>>;
   try {
      verified = await verifyTransferTx(st.txHash, payout.walt_address ?? '', want, { from: wallet?.address });
   } catch (err) {
      console.error(`idManualFunding: receipt check failed for ${payout.loan_id}`, err);
      return { ok: true, state: 'paying', payout };
   }
   if (!verified.ok) {
      if (verified.error === 'tx_not_found_on_bnb_chain' || verified.error === 'tx_too_new_try_again') return { ok: true, state: 'paying', payout };
      return await failAutoPayout(
         svc,
         payout,
         `onchain_check: ${verified.error} (${st.txHash})`,
         `⚠️ 🇮🇩 Auto-payout for loan ${loanTag}: Openfort says it succeeded, but BNB Chain doesn't show $${Number(payout.amount)} USDC → ${short(payout.walt_address)} (${verified.error}). Tx https://bscscan.com/tx/${st.txHash} — check it before doing anything else.`
      );
   }

   const loan = await loadLoan(svc, payout.loan_id);
   if (!loan) return { ok: false, error: 'loan_not_found', payout };
   const result = await recordFunding(svc, payout, loan, verified.transfer, 'auto');
   if (!result.ok && result.error !== 'auto_payout_in_progress') {
      // Money went out but the loan couldn't be recorded (e.g. funded by someone else meanwhile —
      // recordFunding already alerted for that). Keep the reason on the row; alert once for the rest.
      const { data: row } = await svc.from('id_manual_payouts').select('*').eq('id', payout.id).maybeSingle();
      if (row?.status === 'paying') {
         await svc
            .from('id_manual_payouts')
            .update({ error: result.error, not_found_alerted_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() })
            .eq('id', payout.id)
            .eq('status', 'paying');
         if (!row.not_found_alerted_at) {
            await alertTeam(
               svc,
               `⚠️ 🇮🇩 Auto-payout for loan ${loanTag} landed on BNB Chain (https://bscscan.com/tx/${st.txHash}) but the loan couldn't be recorded: ${result.error}. It will keep trying to record it; it will NOT send again.`
            );
         }
      }
   }
   return result;
};

type AutoCtx = {
   wallet: PayoutWallet;
   limits: AutoPayLimits & { autopay: 'on' | 'off' };
   paidToday: number;
   balanceUsd: number | null;
   lenderId: string;
   /** What this wallet sends (id_payout_token). */
   token: BscToken;
};

const loadAutoCtx = async (svc: Svc, now: number): Promise<{ ctx?: AutoCtx; error?: string }> => {
   if (!(await loadPayoutCreds(svc))) return { error: 'not_configured' };
   const wallet = await getPayoutWallet(svc);
   if (!wallet) return { error: 'no_payout_wallet' };
   const lenderId = await getSetting(svc, 'id_payout_lender_user_id');
   if (!lenderId) return { error: 'no_lender_of_record' };
   const { data: lender } = await svc.from('users').select('wallet_address').eq('id', lenderId).maybeSingle();
   // Checked before sending: otherwise money would go out and the loan couldn't be recorded.
   if (!isAddress(lender?.wallet_address)) return { error: 'lender_has_no_base_wallet' };
   const [limits, paidToday, token] = await Promise.all([getAutoPayLimits(svc), paidTodayUsd(svc, now), payoutTokenOf(svc)]);
   let balanceUsd: number | null = null;
   try {
      const bal = await balanceOf(wallet.address);
      balanceUsd = token === 'USDT' ? bal.usdt : bal.usdc;
   } catch (err) {
      console.error('idManualFunding: payout wallet balance failed', err);
   }
   return { ctx: { wallet, limits, paidToday, balanceUsd, lenderId, token } };
};

/** One automatic payout attempt for one loan. Claims first; sends at most once. */
const attemptAutoPay = async (
   svc: Svc,
   loan: LoanForPayout,
   ctx: AutoCtx,
   now: number,
   requireAge: boolean,
   by: string,
   deadline: number
): Promise<PayoutResult> => {
   // Never claim (and so never send) without time to finish the send.
   if (deadline - Date.now() < MIN_SEND_BUDGET_MS + 5_000) return { ok: false, error: 'no_time_left' };
   const { data: borrower } = await svc.from('users').select('walt_address').eq('id', loan.borrower_user_id).maybeSingle();
   const walt = borrower?.walt_address as string | null | undefined;
   const amountUsd = Number(loan.loan_amount);
   const blocker = autoPayBlocker({
      amountUsd,
      createdAt: loan.created_at,
      now,
      paidTodayUsd: ctx.paidToday,
      balanceUsd: ctx.balanceUsd,
      limits: ctx.limits,
      hasWalt: isAddress(walt),
      requireAge
   });
   if (blocker === 'low_balance' && ctx.balanceUsd != null) await maybeAlertLowBalance(svc, ctx.wallet, ctx.balanceUsd, now, ctx.token);
   if (blocker === 'daily_cap_reached') await maybeAlertCap(svc, ctx.limits, ctx.paidToday, now);
   if (blocker) return { ok: false, error: blocker };

   const { data: claim, error: claimError } = await svc.rpc('claim_id_auto_payout', {
      p_loan_id: loan.id,
      p_lender_user_id: ctx.lenderId,
      p_max_usd: ctx.limits.maxUsd,
      p_cap_usd: ctx.limits.dailyCapUsd,
      p_day_start: bangkokDayStart(now).toISOString()
   });
   if (claimError) return { ok: false, error: `claim_failed: ${claimError.message}` };
   const c = claim as { ok: boolean; error?: string; payout?: PayoutRow; paid_today?: number };
   if (!c?.ok || !c.payout) {
      if (c?.error === 'daily_cap_reached') await maybeAlertCap(svc, ctx.limits, Number(c.paid_today ?? ctx.paidToday), now);
      return { ok: false, error: c?.error ?? 'claim_failed' };
   }
   let payout = c.payout;

   // Right before sending: still open? (someone may have funded it since the claim)
   const releaseClaim = () =>
      svc
         .from('id_manual_payouts')
         .update({ status: 'waiting', method: 'manual', paid_attempt_at: null, lender_user_id: null, updated_at: new Date().toISOString() })
         .eq('id', payout.id)
         .eq('status', 'paying')
         .is('openfort_tx_id', null);
   const fresh = await loadLoan(svc, loan.id);
   if (!fresh || !isOpen(fresh)) {
      await releaseClaim();
      return { ok: false, error: 'loan_not_open' };
   }

   // claim_id_auto_payout copies their address in; never send without one.
   if (!isAddress(payout.walt_address)) {
      await releaseClaim();
      return { ok: false, error: 'no_walt_address' };
   }
   let txId: string;
   try {
      txId = await sendTokenBsc(svc, ctx.token, payout.walt_address, payout.amount, deadline);
   } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (err instanceof NotSentError) {
         // Failed before sendTransaction was started: nothing left the wallet, so the claim is released.
         await releaseClaim();
         console.error(`idManualFunding: auto-payout not sent for ${loan.id}: ${msg}`);
         return { ok: false, error: msg === 'no_time_left' ? 'no_time_left' : `not_sent: ${msg}` };
      }
      return await failAutoPayout(
         svc,
         payout,
         `send: ${msg}`,
         `⚠️ 🇮🇩 Auto-payout FAILED for loan ${loan.id.slice(0, 8)}: $${Number(payout.amount)} → ${short(payout.walt_address)} (${msg.slice(0, 200)}). Nothing will retry by itself. It may still have gone out: BNB Chain is checked ${Math.round(CHAIN_CHECK_MIN_AGE_MS / 60_000)} min after the attempt, and paying by hand unlocks only if nothing did (${walletLink(ctx.wallet.address)}).`
      );
   }
   ctx.paidToday += amountUsd;
   if (ctx.balanceUsd != null) ctx.balanceUsd -= amountUsd;

   const saveTxId = () =>
      svc
         .from('id_manual_payouts')
         .update({ openfort_tx_id: txId, updated_at: new Date().toISOString() })
         .eq('id', payout.id)
         .eq('status', 'paying')
         .select('*')
         .maybeSingle();
   let saved = await saveTxId();
   if (saved.error) saved = await saveTxId();
   if (saved.error || !saved.data) {
      await alertTeam(
         svc,
         `⚠️ 🇮🇩 Auto-payout for loan ${loan.id.slice(0, 8)} was SENT (Openfort ${txId}) but the id couldn't be saved: ${saved.error?.message ?? 'row changed'}. It will not send again; check it in Openfort.`
      );
   } else {
      payout = saved.data as PayoutRow;
   }
   console.log(`idManualFunding: auto-payout sent for ${loan.id} by ${by}: ${txId}`);
   return { ok: true, state: 'paying', payout };
};

/** The 5-minute job: settle payouts in flight, then (when /idautopay is on) pay open requests. */
export const runAutoPayouts = async (
   svc: Svc,
   now = Date.now(),
   deadline = Date.now() + AUTO_BUDGET_MS
): Promise<{ settled: number; funded: number; sent: number; failed: number; chainChecked: number; skipped?: string }> => {
   const tally = { settled: 0, funded: 0, sent: 0, failed: 0, chainChecked: 0 } as {
      settled: number;
      funded: number;
      sent: number;
      failed: number;
      chainChecked: number;
      skipped?: string;
   };
   try {
      // 0. Failed automatic payouts (last 7 days) not yet looked for on BNB Chain: did the money go out?
      const { data: failedRows } = await svc
         .from('id_manual_payouts')
         .select('*')
         .eq('method', 'auto')
         .eq('status', 'failed')
         .is('chain_checked_at', null)
         .gte('paid_attempt_at', new Date(now - 7 * 86_400_000).toISOString())
         .lte('paid_attempt_at', new Date(now - CHAIN_CHECK_MIN_AGE_MS).toISOString())
         .order('paid_attempt_at')
         .limit(10);
      for (const row of (failedRows ?? []) as PayoutRow[]) {
         if (Date.now() > deadline) break;
         tally.chainChecked += 1;
         const r = await runChainCheck(svc, row, now, deadline);
         if (r.result?.ok && r.result.state === 'found') tally.funded += 1;
      }

      // 1. In flight: poll only, never send.
      const { data: paying } = await svc.from('id_manual_payouts').select('*').eq('status', 'paying').order('paid_attempt_at').limit(20);
      for (const row of (paying ?? []) as PayoutRow[]) {
         if (Date.now() > deadline) break;
         tally.settled += 1;
         try {
            const r = await settleAutoPayout(svc, row, now, deadline);
            if (r.ok && r.state === 'found') tally.funded += 1;
            if (!r.ok && r.error === 'auto_payout_failed') tally.failed += 1;
         } catch (err) {
            console.error(`idManualFunding: settle failed for ${row.loan_id}`, err);
         }
      }

      // 2. New payouts, only when switched on.
      const { autopay } = await getAutoPayLimits(svc);
      if (autopay !== 'on') return { ...tally, skipped: 'autopay_off' };
      // Loans go out by Walt Transfer (setting id_payout_mode, idWaltPayouts.ts): never also from the wallet.
      if ((await payoutModeOf(svc)) === 'walt_transfer') return { ...tally, skipped: 'walt_transfer_mode' };
      const { ctx, error } = await loadAutoCtx(svc, now);
      if (!ctx) return { ...tally, skipped: error };
      if (ctx.balanceUsd != null) await maybeAlertLowBalance(svc, ctx.wallet, ctx.balanceUsd, now);

      const { data: loans } = await svc
         .from('loans')
         .select('id, borrower_user_id, loan_amount, loan_status, lender_user_id, funded_at, market, created_at, is_test')
         .eq('market', 'ID')
         .eq('loan_status', 'Requested')
         .is('lender_user_id', null)
         .is('funded_at', null)
         .lte('created_at', new Date(now - 2 * 60_000).toISOString())
         .gte('created_at', new Date(now - 7 * 86_400_000).toISOString())
         .lte('loan_amount', ctx.limits.maxUsd)
         .order('created_at', { ascending: true })
         .limit(20);
      const list = (loans ?? []) as LoanForPayout[];
      if (!list.length) return tally;
      // Skip loans an admin is already paying by hand, or that had an attempt.
      const { data: rows } = await svc
         .from('id_manual_payouts')
         .select('loan_id, status, marked_sent_at')
         .in('loan_id', list.map((l) => l.id));
      const touched = new Set(
         ((rows ?? []) as Array<{ loan_id: string; status: string; marked_sent_at: string | null }>)
            .filter((r) => r.status !== 'waiting' || r.marked_sent_at)
            .map((r) => r.loan_id)
      );
      for (const loan of list) {
         if (deadline - Date.now() < MIN_SEND_BUDGET_MS + 5_000) break;
         if (touched.has(loan.id)) continue;
         const r = await attemptAutoPay(svc, loan, ctx, now, true, 'cron', deadline);
         if (r.ok) tally.sent += 1;
         else if (r.error === 'auto_payout_failed') tally.failed += 1;
         else if (r.error === 'low_balance' || r.error === 'daily_cap_reached' || r.error === 'balance_unknown' || r.error === 'no_time_left') break;
      }
   } catch (err) {
      console.error('idManualFunding: auto payouts failed', err);
   }
   return tally;
};

/** Admin "Pay now from payout wallet": works with /idautopay off, still enforces max, cap and balance. */
export const payNow = async (svc: Svc, loanId: string, adminUserId: string): Promise<PayoutResult> => {
   const now = Date.now();
   const loan = await loadLoan(svc, loanId);
   if (!loan) return { ok: false, error: 'loan_not_found' };
   if (loan.market !== 'ID') return { ok: false, error: 'not_indonesia_loan' };
   const { data: existing } = await svc.from('id_manual_payouts').select('*').eq('loan_id', loanId).maybeSingle();
   const row = existing as PayoutRow | null;
   if (row?.status === 'found') return { ok: true, state: 'found', payout: row, funded: false };
   if (row?.status === 'paying') return await settleAutoPayout(svc, row, now);
   // A failed automatic payout is never re-sent from the wallet (release it and pay by hand).
   if (row && (row.status !== 'waiting' || row.marked_sent_at)) {
      return { ok: false, error: row.status === 'failed' ? 'auto_payout_failed_before' : 'being_paid_by_hand', payout: row };
   }
   if (!isOpen(loan)) return { ok: false, error: 'loan_not_open' };
   const { ctx, error } = await loadAutoCtx(svc, now);
   if (!ctx) return { ok: false, error: error ?? 'not_configured' };
   const sent = await attemptAutoPay(svc, loan, ctx, now, false, adminUserId, now + AUTO_BUDGET_MS);
   if (!sent.ok || sent.state !== 'paying') return sent;
   // Usually lands in seconds: wait a little so the admin sees it funded; otherwise the card keeps checking.
   let latest: PayoutResult = sent;
   for (let i = 0; i < 6; i += 1) {
      await new Promise((r) => setTimeout(r, 4_000));
      const { data: fresh } = await svc.from('id_manual_payouts').select('*').eq('id', sent.payout.id).maybeSingle();
      if (!fresh) break;
      latest = await settleAutoPayout(svc, fresh as PayoutRow);
      if (!(latest.ok && latest.state === 'paying')) break;
   }
   return latest;
};
