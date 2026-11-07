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
//
// A match must be: USDC (BSC) Transfer → the borrower's walt_address, value == loan amount × 1e18,
// at least CONFIRMATIONS deep, a tx hash never used before, and EITHER the admin tapped "I sent it"
// OR it came from an address Binance TH has already paid us from (id_binance_senders), so a borrower
// depositing $5 into their own Walt can't make a loan look funded.
//
// Funding is recorded like any direct lend: loan_status 'Lent', lender = the admin (repayments go to
// their users.wallet_address on Base), funding_method 'walt_manual'. Never throws to callers.

import { sendTelegramMessage } from './telegram.ts';
import { postLoanFundedToTeam } from './teamLoanFeed.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

export const BSC_USDC = '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const RPCS = ['https://bsc-rpc.publicnode.com', 'https://bsc.drpc.org'];
const MAX_LOG_SPAN = 49_000; // publicnode allows 50,000 blocks per eth_getLogs
const MAX_SPANS_PER_CHECK = 8; // ≈ 2 days of BNB Chain per check, so one check never runs long
const CONFIRMATIONS = 15n;
const NOT_FOUND_ALERT_MS = 30 * 60_000;
const USDC_DECIMALS = 18n;

export type PayoutRow = {
   id: string;
   loan_id: string;
   borrower_user_id: string;
   walt_address: string;
   amount: number | string;
   lender_user_id: string | null;
   marked_sent_at: string | null;
   status: 'waiting' | 'found' | 'not_found';
   bsc_tx_hash: string | null;
   from_address: string | null;
   block_number: number | null;
   found_at: string | null;
   found_by: string | null;
   not_found_alerted_at: string | null;
   scanned_to_block: number | null;
   created_at: string;
};

type Transfer = { txHash: string; from: string; to: string; value: bigint; blockNumber: bigint; logIndex: number };

export type PayoutResult =
   | { ok: true; state: 'found'; payout: PayoutRow; funded: boolean }
   | { ok: true; state: 'waiting'; payout: PayoutRow }
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
const blockTime = async (n: bigint) => {
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

export const transfersTo = async (to: string, fromBlock: bigint, toBlock: bigint): Promise<Transfer[]> => {
   type Log = { transactionHash: string; topics: string[]; data: string; blockNumber: string; logIndex: string; removed?: boolean };
   const logs = await rpc<Log[]>('eth_getLogs', [
      {
         fromBlock: `0x${fromBlock.toString(16)}`,
         toBlock: `0x${toBlock.toString(16)}`,
         address: BSC_USDC,
         topics: [TRANSFER_TOPIC, null, pad32(to)]
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

const knownSenders = async (svc: Svc): Promise<Set<string>> =>
   new Set(
      String((await getSetting(svc, 'id_binance_senders')) ?? '')
         .split(',')
         .map((s) => s.trim().toLowerCase())
         .filter(isAddress)
   );

const learnSender = async (svc: Svc, address: string) => {
   const senders = await knownSenders(svc);
   const a = address.toLowerCase();
   if (senders.has(a)) return;
   senders.add(a);
   await svc
      .from('telegram_bot_settings')
      .upsert({ key: 'id_binance_senders', value: [...senders].join(','), updated_at: new Date().toISOString() }, { onConflict: 'key' });
};

const adminChatId = async (svc: Svc): Promise<string | null> =>
   (await getSetting(svc, 'kyc_alert_chat_id')) || Deno.env.get('TEAM_TELEGRAM_CHAT_ID') || (await getSetting(svc, 'team_group_chat_id'));

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

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
   if (!isAddress(walt)) return { error: 'no_walt_address', loan };
   const { data: created, error } = await svc
      .from('id_manual_payouts')
      .upsert(
         { loan_id: loan.id, borrower_user_id: loan.borrower_user_id, walt_address: walt.toLowerCase(), amount: loan.loan_amount },
         { onConflict: 'loan_id', ignoreDuplicates: false }
      )
      .select('*')
      .maybeSingle();
   if (error || !created) return { error: error?.message ?? 'payout_row_failed', loan };
   return { payout: created as PayoutRow, loan };
};

// ── recording the funding ────────────────────────────────────────────────────────────────────────
const recordFunding = async (svc: Svc, payout: PayoutRow, loan: LoanForPayout, t: Transfer, foundBy: 'scan' | 'txid'): Promise<PayoutResult> => {
   // Claim the tx first: bsc_tx_hash is unique, so one transfer can never fund two loans.
   const lenderId = payout.lender_user_id ?? (await getSetting(svc, 'id_payout_lender_user_id'));
   if (!lenderId) return { ok: false, error: 'no_lender_of_record', payout };
   const { data: lender } = await svc.from('users').select('wallet_address').eq('id', lenderId).maybeSingle();
   const lenderWallet = lender?.wallet_address as string | null | undefined;
   if (!isAddress(lenderWallet)) return { ok: false, error: 'lender_has_no_base_wallet', payout };

   const now = new Date().toISOString();
   const { data: claimed, error: claimError } = await svc
      .from('id_manual_payouts')
      .update({
         status: 'found',
         bsc_tx_hash: t.txHash,
         from_address: t.from,
         block_number: Number(t.blockNumber),
         found_at: now,
         found_by: foundBy,
         lender_user_id: lenderId,
         updated_at: now
      })
      .eq('id', payout.id)
      .neq('status', 'found')
      .select('*')
      .maybeSingle();
   if (claimError) {
      const dup = /duplicate|unique/i.test(claimError.message ?? '');
      return { ok: false, error: dup ? 'tx_already_used' : claimError.message, payout };
   }
   if (!claimed) {
      const { data: again } = await svc.from('id_manual_payouts').select('*').eq('id', payout.id).maybeSingle();
      return { ok: true, state: 'found', payout: (again ?? payout) as PayoutRow, funded: false };
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
            `⚠️ 🇮🇩 Walt payout found on BNB Chain (${short(t.txHash)}) but the loan ${loan.id.slice(0, 8)} could not be marked funded: ${fundError?.message ?? 'it was already funded'}. Check it in admin.`
         ).catch(() => undefined);
      }
      return { ok: false, error: fundError?.message ?? 'loan_already_funded', payout: claimed as PayoutRow };
   }

   // A transfer the admin vouched for teaches us Binance TH's sending address.
   if (payout.marked_sent_at || foundBy === 'txid') await learnSender(svc, t.from).catch(() => undefined);

   await postLoanFundedToTeam(svc, loan.id).catch(() => undefined);
   const { error: notifyError } = await svc.functions.invoke('loan-funded-notification', { body: { loanId: loan.id } });
   if (notifyError) console.error(`idManualFunding: borrower notification failed for ${loan.id}: ${notifyError.message}`);
   const chat = await adminChatId(svc);
   if (chat) {
      await sendTelegramMessage(
         chat,
         `🇮🇩 Walt payout confirmed on BNB Chain ✅ $${Number(payout.amount)} → ${short(payout.walt_address)} (tx ${short(t.txHash)}${foundBy === 'scan' && !payout.marked_sent_at ? ', found without a tap' : ''}).`
      ).catch(() => undefined);
   }
   return { ok: true, state: 'found', payout: claimed as PayoutRow, funded: true };
};

// ── searching BNB Chain ──────────────────────────────────────────────────────────────────────────
export const checkPayout = async (svc: Svc, payout: PayoutRow, loan: LoanForPayout, senders?: Set<string>): Promise<PayoutResult> => {
   if (payout.status === 'found') return { ok: true, state: 'found', payout, funded: false };
   if (!isOpen(loan)) return { ok: false, error: 'loan_not_open', payout };
   const known = senders ?? (await knownSenders(svc));
   // Nothing to look for yet: nobody tapped "I sent it" and we've never learned Binance TH's address.
   if (!payout.marked_sent_at && known.size === 0) return { ok: true, state: 'waiting', payout };

   let want: bigint;
   try {
      want = usdcUnits(payout.amount);
   } catch {
      return { ok: false, error: 'bad_amount', payout };
   }
   const head = await headBlock();
   const safeHead = head - CONFIRMATIONS;
   let from = payout.scanned_to_block != null ? BigInt(payout.scanned_to_block) + 1n : await blockAtOrBefore(loan.created_at, head);
   const { data: usedRows } = await svc.from('id_manual_payouts').select('bsc_tx_hash').not('bsc_tx_hash', 'is', null);
   const used = new Set(((usedRows ?? []) as Array<{ bsc_tx_hash: string }>).map((r) => r.bsc_tx_hash.toLowerCase()));

   let spans = 0;
   while (from <= safeHead && spans < MAX_SPANS_PER_CHECK) {
      const to = from + BigInt(MAX_LOG_SPAN) > safeHead ? safeHead : from + BigInt(MAX_LOG_SPAN);
      const transfers = await transfersTo(payout.walt_address, from, to);
      const match = transfers.find(
         (t) => t.value === want && !used.has(t.txHash) && (Boolean(payout.marked_sent_at) || known.has(t.from))
      );
      if (match) return await recordFunding(svc, payout, loan, match, 'scan');
      await svc.from('id_manual_payouts').update({ scanned_to_block: Number(to), updated_at: new Date().toISOString() }).eq('id', payout.id);
      payout = { ...payout, scanned_to_block: Number(to) };
      from = to + 1n;
      spans += 1;
   }
   return { ok: true, state: 'waiting', payout };
};

/** Admin tapped "I sent it": they are the lender of record; look right away. */
export const markSent = async (svc: Svc, loanId: string, adminUserId: string): Promise<PayoutResult> => {
   const { payout, loan, error } = await ensurePayout(svc, loanId);
   if (!payout || !loan) return { ok: false, error: error ?? 'payout_unavailable' };
   if (payout.status === 'found') return { ok: true, state: 'found', payout, funded: false };
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
      .select('*')
      .maybeSingle();
   try {
      return await checkPayout(svc, (updated ?? payout) as PayoutRow, loan);
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
   if (!isOpen(loan)) return { ok: false, error: 'loan_not_open', payout };
   type Receipt = { status: string; blockNumber: string; logs: Array<{ address: string; topics: string[]; data: string; logIndex: string; transactionHash: string }> } | null;
   const receipt = await rpc<Receipt>('eth_getTransactionReceipt', [txHash]);
   if (!receipt) return { ok: false, error: 'tx_not_found_on_bnb_chain', payout };
   if (receipt.status !== '0x1') return { ok: false, error: 'tx_failed', payout };
   const head = await headBlock();
   if (BigInt(receipt.blockNumber) > head - CONFIRMATIONS) return { ok: false, error: 'tx_too_new_try_again', payout };
   const want = usdcUnits(payout.amount);
   const log = receipt.logs.find(
      (l) =>
         l.address.toLowerCase() === BSC_USDC &&
         l.topics?.[0] === TRANSFER_TOPIC &&
         l.topics.length === 3 &&
         fromTopic(l.topics[2]) === payout.walt_address.toLowerCase()
   );
   if (!log) return { ok: false, error: 'tx_not_usdc_to_their_walt', payout };
   const value = BigInt(log.data);
   if (value !== want) return { ok: false, error: 'tx_wrong_amount', payout };
   const { data: dup } = await svc.from('id_manual_payouts').select('id').eq('bsc_tx_hash', txHash.toLowerCase()).maybeSingle();
   if (dup) return { ok: false, error: 'tx_already_used', payout };
   const withLender = { ...payout, lender_user_id: adminUserId };
   await svc.from('id_manual_payouts').update({ lender_user_id: adminUserId, updated_at: new Date().toISOString() }).eq('id', payout.id);
   return await recordFunding(
      svc,
      withLender,
      loan,
      {
         txHash: txHash.toLowerCase(),
         from: fromTopic(log.topics[1]),
         to: fromTopic(log.topics[2]),
         value,
         blockNumber: BigInt(receipt.blockNumber),
         logIndex: Number(BigInt(log.logIndex))
      },
      'txid'
   );
};

/** "Check again" from the admin card: resume the search without resetting anything. */
export const checkNow = async (svc: Svc, loanId: string): Promise<PayoutResult> => {
   const { payout, loan, error } = await ensurePayout(svc, loanId);
   if (!payout || !loan) return { ok: false, error: error ?? 'payout_unavailable' };
   try {
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
export const runWaltPayoutScan = async (svc: Svc, now = Date.now()): Promise<{ checked: number; found: number; alerted: number }> => {
   const tally = { checked: 0, found: 0, alerted: 0 };
   try {
      const senders = await knownSenders(svc);
      // Open Indonesian requests from the last 7 days (requests expire after 7).
      const { data: loans } = await svc
         .from('loans')
         .select('id, borrower_user_id, loan_amount, loan_status, lender_user_id, funded_at, market, created_at, is_test')
         .eq('market', 'ID')
         .eq('loan_status', 'Requested')
         .is('lender_user_id', null)
         .is('funded_at', null)
         .gte('created_at', new Date(now - 7 * 86_400_000).toISOString())
         .limit(50);
      for (const loan of (loans ?? []) as LoanForPayout[]) {
         const { data: existing } = await svc.from('id_manual_payouts').select('*').eq('loan_id', loan.id).maybeSingle();
         // Without a tap and without a known Binance TH address there is nothing we could accept.
         if (!existing && senders.size === 0) continue;
         const { payout } = existing ? { payout: existing as PayoutRow } : await ensurePayout(svc, loan.id);
         if (!payout || payout.status === 'found') continue;
         if (!payout.marked_sent_at && senders.size === 0) continue;
         tally.checked += 1;
         try {
            const result = await checkPayout(svc, payout, loan, senders);
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
                     `🇮🇩 Walt payout not seen yet: $${Number(latest.amount)} → ${short(latest.walt_address)} (tapped "I sent it" ${Math.round((now - new Date(latest.marked_sent_at).getTime()) / 60_000)} min ago). Check it was USDC on BSC and exactly $${Number(latest.amount)}, or paste the TxID in admin.`
                  ).catch(() => undefined);
               }
               await svc
                  .from('id_manual_payouts')
                  .update({ status: 'not_found', not_found_alerted_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() })
                  .eq('id', latest.id)
                  .neq('status', 'found');
               tally.alerted += 1;
            }
         } catch (err) {
            console.error(`idManualFunding: check failed for ${loan.id}`, err);
         }
      }
   } catch (err) {
      console.error('idManualFunding: scan failed', err);
   }
   return tally;
};
