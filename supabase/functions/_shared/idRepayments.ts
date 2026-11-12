// Indonesia track: repaying with no fees (docs/INDONESIA_TRACK.md "Repaying",
// migration 20261107200000_indonesia_wallet_repay.sql).
//
// MAIN WAY — Walt Transfer (method 'walt_transfer'): the borrower sends the exact amount inside Walt to
// Moodeng's Walt @username (setting id_walt_username). Free. Walt has no API, so: the borrower taps
// "✅ Sudah kirim" (claimSent) → the team gets a card → "✅ Arrived" records it (confirmWaltTransfer).
//
// BACKUP — on chain (method 'bep20', only when no Walt username is set; also catches anyone who sends on
// chain anyway):
//   Walt (USDT or USDC, BEP20) ──withdraw──▶ the payout wallet (the same Openfort wallet loans go out from)
//
// No bridge and no fee taken from anyone's money: what the borrower sends is what arrives.
//
// Walt sends from its own shared wallets, so the sender doesn't say who paid — the AMOUNT does. Each
// request (bot 💰 Bayar, app "Tampilkan jumlah") gets an exact amount: what's owed rounded up to the
// cent, moved a few cents (−4…+30) when another request from the last 7 days (paid ones too) already
// has that amount. No two open requests share an amount (unique index), so a late payment, or a second
// send of the same amount, never lands on someone else's loan. A matched deposit credits the RUPIAH the
// request was priced from (record_id_wallet_repayment), so paying exactly what we asked closes what we
// asked for even if the rate moved; being a few cents under costs at most ~Rp 700 (< the Rp 1.000 the
// peg forgives anyway).
//
//   getOrCreateRepayRequest — the address + exact amount for the borrower's active loan (reuses one)
//   runIdRepayments         — the 5-minute job: reads USDT/USDC transfers INTO the payout wallet on BNB
//                             Chain, matches them by exact amount, records them like the app's Pay button
//                             (record_loan_payment 'repay' + the shared follow-ups), tells the borrower
//                             and the team. Unmatched money → a team card with buttons (record for a loan /
//                             top-up / ignore). Known top-up senders (id_topup_senders) are top-ups.
//   handleWalletDepositCallback — those buttons, plus ↩️ refund-to-their-Walt and the /idsweep confirm (admin chats only)
//   handleSweepCommand      — /idsweep: send payout-wallet money to the ONE address in id_payout_sweep_to
//
// Never twice: a deposit row is claimed (status 'new' → 'recording') by one run only, its request is
// claimed ('open' → 'paid') by one deposit only, and record_loan_payment spends 'bsc:<tx>:<log index>'
// in used_payment_hashes inside its lock. recorded_at is set only after the follow-ups ran; a run that
// died in between is finished by the next one (status 'recording' for > 2 min).
//
// Never throws to the caller.
import { sendRepayStuckOffer } from './idGuides.ts';
import { formatRp, idUsdLeft } from './idLoanMath.ts';
import { blockAtOrBefore, headBlock as bscHead, transfersTo as bscTransfersTo } from './idManualFunding.ts';
import {
   balanceOf,
   BSC_USDC_CHECKSUM,
   BSC_USDT_CHECKSUM,
   type BscToken,
   getPayoutWallet,
   NotSentError,
   pollOpenfortTx,
   sendTokenBsc,
   unitsToUsd,
   usdcBscUnits
} from './idPayoutWallet.ts';
import { idLocaleOf } from './idTrack.ts';
import { runRepaymentFollowUps } from './repaymentFollowUps.ts';
import { callTelegramApi, sendTelegramMessage, type TelegramInlineKeyboard } from './telegram.ts';
import { roundRp, waltP2pPrice } from './waltP2p.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const REQUEST_TTL_MS = 48 * 3_600_000;
const REUSE_MIN_LEFT_MS = 3 * 3_600_000; // don't hand out a request that expires within 3 h
const REUSE_MAX_OVER_USD = 0.3;
const SCAN_BEHIND_ALERT_BLOCKS = 2_400n; // ~30 min of BNB Chain blocks
const SCAN_ALERT_EVERY_MS = 3 * 3_600_000;
const MAX_BUMP_UP_CENTS = 30;
const MAX_BUMP_DOWN_CENTS = 4;
const AMOUNT_MEMORY_MS = 7 * 86_400_000;
const LATE_MATCH_MS = 7 * 86_400_000;
const MAX_USD = 500;
const RESUME_AFTER_MS = 2 * 60_000;
const BUSY_MS = 10 * 60_000;
const OVERPAID_ALERT_MICROS = 500_000;
const DUST_UNITS = 10n ** 16n; // $0.01
const BSC_LOG_SPAN = 49_000n;
const BSC_CONFIRMATIONS = 3n;
const FIRST_SCAN_BACK_MS = 2 * 3_600_000;
const TOKENS: Array<{ token: 'USDT' | 'USDC'; address: string }> = [
   { token: 'USDT', address: BSC_USDT_CHECKSUM.toLowerCase() },
   { token: 'USDC', address: BSC_USDC_CHECKSUM.toLowerCase() }
];

// ── pure helpers (idRepayments.test.ts) ──────────────────────────────────────────────────────────
/** Dollars → whole cents, rounded UP (integer math, no float drift). */
export const ceilCents = (usd: number): number => Math.ceil(Math.round(usd * 1e6) / 1e4);

/**
 * The amount (in cents) nearest `baseCents` that no recent request uses: base, −1, +1, −2, +2 … down to
 * −maxDown (never below 1¢), then on up to +maxUp. null when all are taken.
 */
export const pickFreeCents = (
   baseCents: number,
   taken: Set<number>,
   maxUp = MAX_BUMP_UP_CENTS,
   maxDown = MAX_BUMP_DOWN_CENTS
): number | null => {
   const order: number[] = [0];
   for (let i = 1; i <= Math.max(maxUp, maxDown); i += 1) {
      if (i <= maxDown) order.push(-i);
      if (i <= maxUp) order.push(i);
   }
   for (const bump of order) {
      const c = baseCents + bump;
      if (c >= 1 && !taken.has(c)) return c;
   }
   return null;
};

/** 18-decimal units → whole cents when the amount is an exact number of cents, else null. */
export const unitsToExactCents = (units: bigint): number | null => (units % 10n ** 16n === 0n ? Number(units / 10n ** 16n) : null);

export const centsToText = (cents: number): string => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;

/** 18-decimal units → an exact decimal string ("6.38", "0.123456789"). */
export const unitsToDecimal = (units: bigint): string => {
   const whole = units / 10n ** 18n;
   const frac = (units % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
   return frac ? `${whole}.${frac}` : whole.toString();
};

/** "6.38" → units, exactly. */
const centsToUnits = (cents: number): bigint => usdcBscUnits(centsToText(cents));

// ── settings / team ──────────────────────────────────────────────────────────────────────────────
const getSetting = async (svc: Svc, key: string): Promise<string | null> => {
   const { data } = await svc.from('telegram_bot_settings').select('value').eq('key', key).maybeSingle();
   return (data?.value as string | undefined) ?? null;
};

const setSetting = (svc: Svc, key: string, value: string): Promise<void> =>
   svc
      .from('telegram_bot_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .then(
         () => undefined,
         () => undefined
      );

export const adminChatIds = async (svc: Svc): Promise<string[]> =>
   [
      await getSetting(svc, 'kyc_alert_chat_id'),
      Deno.env.get('TEAM_TELEGRAM_CHAT_ID') ?? null,
      await getSetting(svc, 'team_group_chat_id')
   ].filter((v, i, a): v is string => !!v && a.indexOf(v) === i);

const alertTeam = async (svc: Svc, text: string, keyboard?: TelegramInlineKeyboard) => {
   const [chat] = await adminChatIds(svc);
   if (chat) await sendTelegramMessage(chat, text, keyboard ? { inlineKeyboard: keyboard } : {}).catch(() => undefined);
};

const short = (a: string | null | undefined) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '?');
const usd2 = (n: number) => `$${n.toFixed(2)}`;

const parseSenders = (value: string | null) =>
   new Set(
      String(value ?? '')
         .split(',')
         .map((s) => s.trim().toLowerCase())
         .filter((s) => EVM_ADDRESS.test(s))
   );

/** "@JimmyMoodengCredit " → "jimmymoodengcredit"; null unless it's a valid Telegram username. */
export const waltUsernameOf = (value: string | null | undefined): string | null => {
   const u = String(value ?? '')
      .trim()
      .replace(/^@/, '');
   return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(u) ? u : null;
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

// ── loans ────────────────────────────────────────────────────────────────────────────────────────
export type RepayLoan = {
   id: string;
   tracking_id: string | null;
   borrower_user_id: string;
   loan_status: string;
   repayment_status: string | null;
   funding_method: string | null;
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
   'id, tracking_id, borrower_user_id, loan_status, repayment_status, funding_method, onchain_loan_id, repay_idr, repaid_idr, total_repayment_amount, repaid_amount, loan_amount, due_date, funded_at, created_at, market';

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

/**
 * Only Indonesia loans Moodeng paid out to Walt (funding_method 'walt_manual': payout wallet or Binance TH)
 * are repaid to the payout wallet. Anything else — e.g. an older Indonesian loan a lender funded on Base —
 * is owed to that lender and goes through the app.
 */
export const repayBlocker = (loan: Pick<RepayLoan, 'market' | 'funding_method' | 'onchain_loan_id'>): 'on_contract' | null =>
   loan.market === 'ID' && loan.funding_method === 'walt_manual' && loan.onchain_loan_id == null ? null : 'on_contract';

// ── the request (💰 Bayar / app) ─────────────────────────────────────────────────────────────────
type RequestRow = {
   id: number;
   loan_id: string;
   user_id: string;
   to_address: string;
   amount_units: string | number;
   amount_usd: string | number;
   owed_usd: string | number;
   rupiah_left: string | number | null;
   method: 'walt_transfer' | 'bep20';
   sent_claimed_at: string | null;
   status: string;
   deposit_id: number | null;
   created_at: string;
   expires_at: string;
};
// numeric(78,0) comes back as a JSON number (float) unless cast: always read the units as text.
const REQUEST_FIELDS =
   'id, loan_id, user_id, to_address, amount_units::text, amount_usd, owed_usd, rupiah_left, method, sent_claimed_at, status, deposit_id, created_at, expires_at';

const unitsOf = (v: string | number): bigint =>
   BigInt(typeof v === 'number' ? v.toLocaleString('en-US', { useGrouping: false }) : String(v).split('.')[0]);

export type RepayRequestResult =
   | {
        ok: true;
        reused: boolean;
        requestId: number;
        /** 'walt_transfer' = Walt → Transfer → waltUsername (free); 'bep20' = withdraw to `address`. */
        method: 'walt_transfer' | 'bep20';
        /** Moodeng's Walt @username (without @) for walt_transfer. */
        waltUsername: string | null;
        /** The payout wallet (BNB Chain), for bep20. */
        address: string;
        /** Exact amount to send, e.g. "6.38". */
        amountUsdt: string;
        /** ≈ rupiah that costs today (rounded to Rp 1.000), null without a rate. */
        approxIdr: number | null;
        /** Rupiah still owed on the loan (pegged loans). */
        rupiahLeft: number | null;
        expiresAt: string;
        loan: RepayLoan;
     }
   | { ok: false; error: 'no_loan' | 'on_contract' | 'no_payout_wallet' | 'paused' | 'nothing_left' | 'too_large' | 'busy' | 'error' };

export const getOrCreateRepayRequest = async (
   svc: Svc,
   user: { id: string },
   source: 'telegram' | 'app' = 'telegram'
): Promise<RepayRequestResult> => {
   try {
      const loan = await loadActiveLoan(svc, user.id);
      if (!loan) return { ok: false, error: 'no_loan' };
      if (repayBlocker(loan)) return { ok: false, error: 'on_contract' };
      if (
         String((await getSetting(svc, 'id_repay')) ?? 'on')
            .trim()
            .toLowerCase() === 'off'
      )
         return { ok: false, error: 'paused' };
      const waltUsername = waltUsernameOf(await getSetting(svc, 'id_walt_username'));
      // George's rule: no withdrawals (Walt charges 1.5 USDT). No Walt username set → paused, not BEP20.
      if (!waltUsername) return { ok: false, error: 'paused' };
      const method = 'walt_transfer' as const;
      // Where the money goes: Moodeng's Walt username.
      const wallet = { address: `walt:@${waltUsername}` };

      // A payment for this loan that's being recorded right now: don't ask for another one.
      const { data: inFlight } = await svc
         .from('id_wallet_deposits')
         .select('id')
         .eq('loan_id', loan.id)
         .eq('status', 'recording')
         .gte('updated_at', new Date(Date.now() - BUSY_MS).toISOString())
         .limit(1);
      if ((inFlight ?? []).length) return { ok: false, error: 'busy' };

      const rate = await currentRate(svc);
      const left = idUsdLeft(loan, rate);
      if (left.usd <= 0 || (left.idr != null && left.idr < 1000)) return { ok: false, error: 'nothing_left' };
      const baseCents = Math.max(1, ceilCents(left.usd));
      if (baseCents > MAX_USD * 100) return { ok: false, error: 'too_large' };
      // What buying that much USDT on Walt P2P costs right now; the official rate (rounded) when unknown.
      const p2pBuy = await waltP2pPrice(svc, 'buy', rate ? (baseCents / 100) * rate : 100_000);
      const approx = (cents: number) =>
         p2pBuy ? roundRp((cents / 100) * p2pBuy) : rate ? Math.round(((cents / 100) * rate) / 1000) * 1000 : null;

      // Reuse this loan's open request when it still covers what's owed and isn't much more.
      const { data: open } = await svc
         .from('id_repay_requests')
         .select(REQUEST_FIELDS)
         .eq('loan_id', loan.id)
         .eq('status', 'open')
         .order('created_at', { ascending: false })
         .limit(5);
      for (const r of (open ?? []) as RequestRow[]) {
         const cents = unitsToExactCents(unitsOf(r.amount_units));
         const fresh = new Date(r.expires_at).getTime() - Date.now() > REUSE_MIN_LEFT_MS;
         if (
            cents != null &&
            fresh &&
            r.to_address.toLowerCase() === wallet.address.toLowerCase() &&
            cents >= baseCents &&
            cents - baseCents <= REUSE_MAX_OVER_USD * 100
         ) {
            return {
               ok: true,
               reused: true,
               requestId: r.id,
               method,
               waltUsername,
               address: wallet.address,
               amountUsdt: centsToText(cents),
               approxIdr: approx(cents),
               rupiahLeft: left.idr,
               expiresAt: r.expires_at,
               loan
            };
         }
      }
      // Anything else open for this loan is out of date (a late payment to it still matches: see below).
      if ((open ?? []).length) {
         await svc
            .from('id_repay_requests')
            .update({ status: 'replaced', updated_at: new Date().toISOString() })
            .eq('loan_id', loan.id)
            .eq('status', 'open');
      }

      // Amounts used in the last 7 days — paid ones too (a second send of a paid amount must not land on
      // someone else's loan) — and amounts that arrived in the wallet lately are skipped.
      const lo = centsToUnits(Math.max(1, baseCents - MAX_BUMP_DOWN_CENTS)).toString();
      const hi = centsToUnits(baseCents + MAX_BUMP_UP_CENTS).toString();
      const since = new Date(Date.now() - AMOUNT_MEMORY_MS).toISOString();
      const [{ data: recent }, { data: arrived }] = await Promise.all([
         svc
            .from('id_repay_requests')
            .select('amount_units::text')
            .gte('created_at', since)
            .gte('amount_units', lo)
            .lte('amount_units', hi),
         svc.from('id_wallet_deposits').select('amount_units:units::text').gte('created_at', since).gte('units', lo).lte('units', hi)
      ]);
      const taken = new Set<number>();
      for (const r of [...(recent ?? []), ...(arrived ?? [])] as Array<{ amount_units: string | number }>) {
         const c = unitsToExactCents(unitsOf(r.amount_units));
         if (c != null) taken.add(c);
      }
      for (let attempt = 0; attempt < 5; attempt += 1) {
         const cents = pickFreeCents(baseCents, taken);
         if (cents == null) return { ok: false, error: 'busy' };
         const expiresAt = new Date(Date.now() + REQUEST_TTL_MS).toISOString();
         const { data: row, error } = await svc
            .from('id_repay_requests')
            .insert({
               loan_id: loan.id,
               user_id: user.id,
               to_address: wallet.address.toLowerCase(),
               amount_units: centsToUnits(cents).toString(),
               amount_usd: cents / 100,
               owed_usd: left.usd,
               rupiah_left: left.idr,
               rate,
               source,
               method,
               expires_at: expiresAt
            })
            .select('id')
            .single();
         if (!error && row) {
            return {
               ok: true,
               reused: false,
               requestId: row.id,
               method,
               waltUsername,
               address: wallet.address,
               amountUsdt: centsToText(cents),
               approxIdr: approx(cents),
               rupiahLeft: left.idr,
               expiresAt,
               loan
            };
         }
         if (error?.code !== '23505') {
            console.error('[idRepayments] store request failed', error?.message);
            return { ok: false, error: 'error' };
         }
         taken.add(cents); // someone took that amount a moment ago: next one
      }
      return { ok: false, error: 'busy' };
   } catch (err) {
      console.error('[idRepayments] request failed', err instanceof Error ? err.message : err);
      return { ok: false, error: 'error' };
   }
};

/** For the app: where the borrower's newest request stands ('open' | 'paid' + recorded | 'expired' | 'replaced'). */
export const repayRequestStatus = async (svc: Svc, userId: string, requestId: number) => {
   const { data: r } = await svc.from('id_repay_requests').select(REQUEST_FIELDS).eq('id', requestId).eq('user_id', userId).maybeSingle();
   if (!r) return null;
   const row = r as RequestRow;
   let deposit: { status: string; units: string | number; token: string } | null = null;
   if (row.deposit_id) {
      const { data: d } = await svc.from('id_wallet_deposits').select('status, units::text, token').eq('id', row.deposit_id).maybeSingle();
      deposit = d ?? null;
   }
   const cents = unitsToExactCents(unitsOf(row.amount_units));
   const { data: loan } = await svc.from('loans').select('repayment_status').eq('id', row.loan_id).maybeSingle();
   return {
      loanPaid: loan?.repayment_status === 'Paid',
      method: row.method,
      sentClaimed: Boolean(row.sent_claimed_at),
      requestId: row.id,
      status: row.status,
      address: row.to_address,
      amountUsdt: cents != null ? centsToText(cents) : String(row.amount_usd),
      expiresAt: row.expires_at,
      received: deposit ? { status: deposit.status, token: deposit.token, amount: unitsToUsd(unitsOf(deposit.units)) } : null,
      recorded: deposit?.status === 'recorded'
   };
};

// ── messages ─────────────────────────────────────────────────────────────────────────────────────
type UserRow = {
   id: string;
   chat_id: string | number | null;
   preferred_locale: string | null;
   walt_address: string | null;
   telegram_username?: string | null;
};

const loadUser = async (svc: Svc, userId: string): Promise<UserRow | null> => {
   const { data } = await svc
      .from('users')
      .select('id, chat_id, preferred_locale, walt_address, telegram_username')
      .eq('id', userId)
      .maybeSingle();
   return (data as UserRow | null) ?? null;
};

/** Where a Walt Transfer refund goes: their Telegram @username. */
const waltBack = (user: UserRow | null) =>
   user?.telegram_username ? `@${String(user.telegram_username).replace(/^@/, '')}` : 'them (no Telegram username saved — ask in chat)';

const tell = async (user: UserRow | null, text: string, keyboard?: TelegramInlineKeyboard) => {
   if (!user?.chat_id) return;
   await sendTelegramMessage(user.chat_id, text, keyboard ? { inlineKeyboard: keyboard } : {}).catch((err: unknown) =>
      console.error('[idRepayments] telegram failed', err instanceof Error ? err.message : err)
   );
};

const say = (user: UserRow | null, id: string, en: string) => (idLocaleOf(user?.preferred_locale) === 'en' ? en : id);
const payRestRow = (user: UserRow | null): TelegramInlineKeyboard => [
   [
      { text: say(user, '💰 Bayar sisanya', '💰 Pay the rest'), callback_data: 'idm:repay' },
      { text: '☰ Menu', callback_data: 'idm:menu' }
   ]
];

/** "✅ Pembayaran Rp X diterima. Sisa Rp Y (≈ $Z)." — partial payments (Paid ones get the 'repaid' message). */
export const partialReceivedText = (
   locale: 'id' | 'en',
   paidIdr: number | null,
   paidUsd: number,
   leftIdr: number | null,
   leftUsd: number
) => {
   const paid = paidIdr != null ? formatRp(paidIdr) : `$${paidUsd.toFixed(2)}`;
   const left = leftIdr != null ? `${formatRp(leftIdr)} (≈ $${leftUsd.toFixed(2)})` : `$${leftUsd.toFixed(2)}`;
   return locale === 'en' ? `✅ Payment of ${paid} received. ${left} left to pay.` : `✅ Pembayaran ${paid} diterima. Sisa ${left}.`;
};

// ── deposits ─────────────────────────────────────────────────────────────────────────────────────
type DepositRow = {
   id: number;
   tx_hash: string;
   log_index: number;
   token: 'USDT' | 'USDC';
   from_address: string;
   to_address: string;
   units: string | number;
   block_number: number;
   status: string;
   request_id: number | null;
   loan_id: string | null;
   matched_by: string | null;
   note: Record<string, unknown> | null;
   recording_at: string | null;
   recorded_at: string | null;
   alerted_at: string | null;
   refund_started_at: string | null;
   refund_tx: string | null;
   refund_units: string | null;
   refund_confirmed_at: string | null;
   created_at: string;
   updated_at: string;
};
const DEPOSIT_FIELDS =
   'id, tx_hash, log_index, token, from_address, to_address, units::text, block_number, status, request_id, loan_id, matched_by, note, recording_at, recorded_at, alerted_at, refund_started_at, refund_tx, refund_units::text, refund_confirmed_at, created_at, updated_at';

const WALT_TX = 'walt-transfer:';
const isWaltDeposit = (d: Pick<DepositRow, 'tx_hash'>) => d.tx_hash.startsWith(WALT_TX);
/** The hash spent in used_payment_hashes: 'bsc:<tx>:<log>' on chain, 'walt-transfer:<request id>' for a confirmed Walt transfer. */
const depositKey = (d: Pick<DepositRow, 'tx_hash' | 'log_index'>) =>
   isWaltDeposit(d) ? d.tx_hash : `bsc:${d.tx_hash.toLowerCase()}:${d.log_index}`;
const depositUsd = (d: Pick<DepositRow, 'units'>) => unitsToUsd(unitsOf(d.units));
const depositText = (d: DepositRow) => `${depositUsd(d).toFixed(2)} ${d.token}`;

const patchDeposit = async (svc: Svc, d: DepositRow, patch: Record<string, unknown>) => {
   const { error } = await svc
      .from('id_wallet_deposits')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', d.id);
   if (error) throw new Error(`deposit ${d.id}: ${error.message}`);
   Object.assign(d, patch);
};

/** Atomically move a deposit from one status to 'recording' (only one run / tap wins). */
const claimDeposit = async (svc: Svc, d: DepositRow, from: string[], extra: Record<string, unknown> = {}): Promise<boolean> => {
   const now = new Date().toISOString();
   const { data } = await svc
      .from('id_wallet_deposits')
      .update({ status: 'recording', recording_at: now, updated_at: now, ...extra })
      .eq('id', d.id)
      .in('status', from)
      .select('id');
   if (!(data ?? []).length) return false;
   Object.assign(d, { status: 'recording', recording_at: now, ...extra });
   return true;
};

/** The run that died mid-way: claim a 'recording' deposit untouched for > 2 min. */
const claimStuck = async (svc: Svc, d: DepositRow): Promise<boolean> => {
   const now = new Date().toISOString();
   const { data } = await svc
      .from('id_wallet_deposits')
      .update({ recording_at: now, updated_at: now })
      .eq('id', d.id)
      .eq('status', 'recording')
      .lt('updated_at', new Date(Date.now() - RESUME_AFTER_MS).toISOString())
      .select('id');
   return (data ?? []).length > 0;
};

const spentBy = async (svc: Svc, hash: string): Promise<{ loan_id: string | null } | null> => {
   const { data } = await svc.from('used_payment_hashes').select('loan_id').eq('hash', hash).maybeSingle();
   return (data as { loan_id: string | null } | null) ?? null;
};

type Outcome = 'recorded' | 'refund_needed' | 'retry';

/** Messages + follow-ups once a deposit is on the loan; then recorded_at (so a crash before it is retried). */
const afterRecorded = async (svc: Svc, d: DepositRow, loan: Record<string, unknown>, paidUsd: number, paidIdr: number | null) => {
   await runRepaymentFollowUps(svc, {
      loanId: String(d.loan_id),
      updatedLoan: loan,
      paidNow: paidUsd,
      browser: { label: 'Telegram · Walt → payout wallet', isInApp: false },
      userAgent: null
   });
   const borrowerId = String(loan.borrower_user_id ?? '');
   const user = borrowerId ? await loadUser(svc, borrowerId) : null;
   const repayIdr = Number(loan.repay_idr ?? NaN);
   const pegged = Number.isFinite(repayIdr) && repayIdr > 0;
   const leftIdr = pegged ? Math.max(0, Math.round(repayIdr - Number(loan.repaid_idr ?? 0))) : null;
   const leftUsd = Math.max(0, Number(loan.total_repayment_amount ?? 0) - Number(loan.repaid_amount ?? 0));
   const paid = loan.repayment_status === 'Paid';
   // Paid → loan-repayment-received-notification sends the Bahasa 'repaid' message itself.
   if (!paid)
      await tell(
         user,
         partialReceivedText(idLocaleOf(user?.preferred_locale), pegged ? paidIdr : null, paidUsd, leftIdr, leftUsd),
         payRestRow(user)
      );
   await alertTeam(
      svc,
      `💰 🇮🇩 ${loan.tracking_id ?? d.loan_id}: ${depositText(d)} ${isWaltDeposit(d) ? 'received in Walt' : 'arrived in the payout wallet'}${paidIdr != null ? ` (Rp ${paidIdr.toLocaleString('id-ID')})` : ''} — ${
         paid ? 'loan PAID ✅' : `partial, ${leftIdr != null ? `Rp ${leftIdr.toLocaleString('id-ID')}` : usd2(leftUsd)} left`
      }.${d.matched_by === 'team' ? ' (matched by hand)' : d.matched_by === 'late_amount' ? ' (paid to an older request)' : ''}`
   );
   await patchDeposit(svc, d, { status: 'recorded', recorded_at: new Date().toISOString() });
};

/**
 * Records a claimed ('recording') deposit on d.loan_id. Safe to call again for the same deposit: when the
 * hash is already spent on this loan, only the follow-ups run (a run died after record_loan_payment).
 */
const recordDeposit = async (svc: Svc, d: DepositRow): Promise<Outcome> => {
   if (!d.loan_id) return 'retry';
   const key = depositKey(d);
   const micros = Number(unitsOf(d.units) / 10n ** 12n);
   const paidUsd = micros / 1e6;
   const { data: loanBefore } = await svc
      .from('loans')
      .select('id, borrower_user_id, tracking_id, repaid_idr')
      .eq('id', d.loan_id)
      .maybeSingle();
   if (!loanBefore) return 'retry';

   const spent = await spentBy(svc, key);
   if (spent && spent.loan_id === d.loan_id) {
      const { data: loan } = await svc.from('loans').select('*').eq('id', d.loan_id).maybeSingle();
      if (!loan) return 'retry';
      console.warn(`[idRepayments] finishing follow-ups for deposit ${d.id}`);
      await afterRecorded(svc, d, loan, paidUsd, (d.note?.paidIdr as number | null | undefined) ?? null);
      return 'recorded';
   }
   if (spent) {
      await patchDeposit(svc, d, {
         status: 'refund_needed',
         note: { ...(d.note ?? {}), error: 'hash_used_by_other_loan', other: spent.loan_id }
      });
      await alertTeam(
         svc,
         `⚠️ 🇮🇩 ${depositText(d)} (tx ${d.tx_hash}) is already recorded on another loan (${spent.loan_id}). Not recorded again — check it.`
      );
      return 'refund_needed';
   }

   // Matched to a request by its exact amount → credit the rupiah that request was priced from.
   let creditIdr: number | null = null;
   if (d.request_id && (d.matched_by === 'amount' || d.matched_by === 'late_amount' || d.matched_by === 'walt_confirmed')) {
      const { data: req } = await svc.from('id_repay_requests').select('rupiah_left').eq('id', d.request_id).maybeSingle();
      const r = Number(req?.rupiah_left ?? NaN);
      if (Number.isFinite(r) && r > 0) creditIdr = r;
   }
   const { data: recorded, error } = await svc.rpc('record_id_wallet_repayment', {
      p_loan_id: d.loan_id,
      p_caller: loanBefore.borrower_user_id,
      p_hash: key,
      p_amount_micros: micros,
      p_from: d.from_address,
      p_credit_idr: creditIdr
   });
   if (error) {
      console.error('[idRepayments] record_loan_payment failed', error.message);
      return 'retry'; // stays 'recording'; the next run picks it up after 2 min
   }
   const code = (recorded as { error?: string } | null)?.error;
   if (code === 'hash_used') return recordDeposit(svc, d); // another path spent it a moment ago: whose loan?
   if (code) {
      // The loan can't take it (already repaid, refunded, …) but the money is in the payout wallet.
      const user = await loadUser(svc, loanBefore.borrower_user_id);
      await patchDeposit(svc, d, { status: 'refund_needed', note: { ...(d.note ?? {}), error: code } });
      await alertTeam(
         svc,
         isWaltDeposit(d)
            ? `⚠️ 🇮🇩 ${loanBefore.tracking_id ?? d.loan_id}: ${depositText(d)} came to your Walt by Transfer but was NOT recorded (${code}). Send it back by Walt Transfer to ${waltBack(user)}.`
            : `⚠️ 🇮🇩 ${loanBefore.tracking_id ?? d.loan_id}: ${depositText(d)} arrived in the payout wallet (tx ${d.tx_hash}) but was NOT recorded (${code}). Their Walt: ${user?.walt_address ?? '? (none saved)'}.`,
         !isWaltDeposit(d) && user?.walt_address
            ? [[{ text: `↩️ Refund ${depositText(d)} to their Walt`, callback_data: `${CB}f:${d.id}` }]]
            : undefined
      );
      return 'refund_needed';
   }
   const loan = (recorded as { loan?: Record<string, unknown> } | null)?.loan;
   const overpaid = Number((recorded as { overpaid_micros?: number } | null)?.overpaid_micros ?? 0);
   const repayIdr = Number(loan?.repay_idr ?? NaN);
   const paidIdr =
      loan && Number.isFinite(repayIdr) && repayIdr > 0
         ? Math.max(0, Math.round(Number(loan.repaid_idr ?? 0) - Number(loanBefore.repaid_idr ?? 0)))
         : null;
   await patchDeposit(svc, d, { note: { ...(d.note ?? {}), paidIdr, overpaidMicros: overpaid } });
   if (!loan) {
      await patchDeposit(svc, d, { status: 'recorded', recorded_at: new Date().toISOString() });
      return 'recorded';
   }
   if (overpaid > OVERPAID_ALERT_MICROS) {
      const user = await loadUser(svc, loanBefore.borrower_user_id);
      await alertTeam(
         svc,
         isWaltDeposit(d)
            ? `⚠️ 🇮🇩 ${loan.tracking_id}: they paid ${(overpaid / 1e6).toFixed(2)} ${d.token} more than was left (by Walt Transfer). The loan is closed. Send the extra back by Walt Transfer to ${waltBack(user)}.`
            : `⚠️ 🇮🇩 ${loan.tracking_id}: they paid ${(overpaid / 1e6).toFixed(2)} ${d.token} more than was left (tx ${d.tx_hash}). The loan is closed. Their Walt: ${user?.walt_address ?? '? (none saved)'}.`,
         !isWaltDeposit(d) && user?.walt_address
            ? [[{ text: `↩️ Refund the extra ${(overpaid / 1e6).toFixed(2)} ${d.token} to their Walt`, callback_data: `${CB}o:${d.id}` }]]
            : undefined
      );
   }
   await afterRecorded(svc, d, loan, paidUsd, paidIdr);
   return 'recorded';
};

/** An open request with exactly this amount, else a recent expired/replaced one whose loan is still owed. */
const matchRequest = async (svc: Svc, units: bigint): Promise<{ req: RequestRow; late: boolean } | null> => {
   const { data: open } = await svc
      .from('id_repay_requests')
      .select(REQUEST_FIELDS)
      .eq('status', 'open')
      .eq('amount_units', units.toString())
      .limit(1)
      .maybeSingle();
   if (open) return { req: open as RequestRow, late: false };
   const { data: older } = await svc
      .from('id_repay_requests')
      .select(REQUEST_FIELDS)
      .in('status', ['expired', 'replaced'])
      .eq('amount_units', units.toString())
      .gte('created_at', new Date(Date.now() - LATE_MATCH_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(2);
   const rows = (older ?? []) as RequestRow[];
   if (rows.length !== 1) return null; // none, or two loans used that amount: let the team decide
   const { data: loan } = await svc.from('loans').select('loan_status, repayment_status').eq('id', rows[0].loan_id).maybeSingle();
   if (!loan || loan.loan_status !== 'Lent' || loan.repayment_status === 'Paid') return null;
   return { req: rows[0], late: true };
};

/** Claim the request for this deposit ('open'/'expired'/'replaced' → 'paid'); false when someone else did. */
const claimRequest = async (svc: Svc, req: RequestRow, depositId: number): Promise<boolean> => {
   const { data } = await svc
      .from('id_repay_requests')
      .update({ status: 'paid', deposit_id: depositId, updated_at: new Date().toISOString() })
      .eq('id', req.id)
      .in('status', ['open', 'expired', 'replaced'])
      .select('id');
   return (data ?? []).length > 0;
};

// ── team card for money that matched nothing ─────────────────────────────────────────────────────
const CB = 'idw:';
export const isWalletDepositCallback = (data: string | undefined) => !!data && data.startsWith(CB);

const unmatchedCard = async (svc: Svc, d: DepositRow): Promise<{ text: string; keyboard: TelegramInlineKeyboard }> => {
   // Candidates: the newest request per unpaid loan from the last 7 days, closest amount first.
   const { data: recent } = await svc
      .from('id_repay_requests')
      .select(`${REQUEST_FIELDS}, loans!inner(tracking_id, loan_status, repayment_status)`)
      .neq('status', 'paid')
      .gte('created_at', new Date(Date.now() - LATE_MATCH_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(40);
   const got = depositUsd(d);
   const perLoan = new Map<
      string,
      RequestRow & { loans: { tracking_id: string | null; loan_status: string; repayment_status: string | null } }
   >();
   for (const r of (recent ?? []) as Array<
      RequestRow & { loans: { tracking_id: string | null; loan_status: string; repayment_status: string | null } }
   >) {
      if (r.loans?.loan_status !== 'Lent' || r.loans?.repayment_status === 'Paid' || perLoan.has(r.loan_id)) continue;
      perLoan.set(r.loan_id, r);
   }
   const options = [...perLoan.values()]
      .sort((a, b) => Math.abs(Number(a.amount_usd) - got) - Math.abs(Number(b.amount_usd) - got))
      .slice(0, 4);
   const keyboard: TelegramInlineKeyboard = options.map((r) => [
      {
         text: `✅ Record for ${r.loans.tracking_id ?? r.loan_id.slice(0, 8)} (asked ${Number(r.amount_usd).toFixed(2)})`,
         callback_data: `${CB}r:${d.id}:${r.id}`
      }
   ]);
   keyboard.push([
      { text: '⬆️ It’s a top-up (remember sender)', callback_data: `${CB}t:${d.id}` },
      { text: '🙈 Ignore', callback_data: `${CB}i:${d.id}` }
   ]);
   const text = [
      `❓ 🇮🇩 ${depositText(d)} arrived in the payout wallet but matches no repayment request.`,
      `From ${d.from_address} · tx ${d.tx_hash}`,
      options.length ? 'Whose is it?' : 'No unpaid loan has a recent request — record it in admin by hand, or mark it below.'
   ].join('\n');
   return { text, keyboard };
};

/** Admin-chat buttons on that card. True when handled. */
export const handleWalletDepositCallback = async (
   svc: Svc,
   query: {
      id: string;
      data?: string;
      from?: { username?: string; first_name?: string };
      message?: { chat: { id: number | string }; message_id: number; text?: string };
   }
): Promise<boolean> => {
   if (!isWalletDepositCallback(query.data)) return false;
   const answer = (text: string) =>
      callTelegramApi('answerCallbackQuery', { callback_query_id: query.id, text: text.slice(0, 190) }).catch(() => undefined);
   const chatId = query.message?.chat.id;
   if (chatId == null || !(await adminChatIds(svc)).includes(String(chatId))) {
      await answer('Not allowed here.');
      return true;
   }
   const [, kind, depId, reqId] = String(query.data).split(':');
   const by = query.from?.username ? `@${query.from.username}` : (query.from?.first_name ?? 'admin');
   const finish = async (line: string) => {
      await answer(line);
      if (query.message) {
         await callTelegramApi('editMessageText', {
            chat_id: chatId,
            message_id: query.message.message_id,
            text: `${query.message.text ?? ''}\n\n${line} — ${by}`.slice(0, 4000),
            reply_markup: { inline_keyboard: [] }
         }).catch(() => undefined);
      }
   };
   if (kind === 'a' || kind === 'x') {
      await waltTransferTap(svc, Number(depId), kind === 'a', by, answer, finish);
      return true;
   }
   if (kind === 's') {
      await sweepTap(svc, depId as BscToken, Number(reqId), `${chatId}:${query.message?.message_id}`, by, answer, finish);
      return true;
   }
   const { data: dep } = await svc.from('id_wallet_deposits').select(DEPOSIT_FIELDS).eq('id', Number(depId)).maybeSingle();
   const d = dep as DepositRow | null;
   if (!d) {
      await answer('Not found.');
      return true;
   }
   if (kind === 'f' || kind === 'o') {
      await refundTap(svc, d, kind === 'o' ? 'extra' : 'all', answer, finish);
      return true;
   }
   if (d.status !== 'unmatched') {
      await answer(`Already handled (${d.status}).`);
      return true;
   }

   if (kind === 't') {
      const senders = parseSenders(await getSetting(svc, 'id_topup_senders'));
      senders.add(d.from_address.toLowerCase());
      await setSetting(svc, 'id_topup_senders', [...senders].join(','));
      await patchDeposit(svc, d, { status: 'topup', note: { ...(d.note ?? {}), by } });
      await finish('⬆️ Top-up — future transfers from this sender count as top-ups');
      return true;
   }
   if (kind === 'i') {
      await patchDeposit(svc, d, { status: 'ignored', note: { ...(d.note ?? {}), by } });
      await finish('🙈 Ignored');
      return true;
   }
   if (kind === 'r') {
      const { data: r } = await svc.from('id_repay_requests').select(REQUEST_FIELDS).eq('id', Number(reqId)).maybeSingle();
      const req = r as RequestRow | null;
      if (!req) {
         await answer('Request not found.');
         return true;
      }
      if (
         !(await claimDeposit(svc, d, ['unmatched'], {
            loan_id: req.loan_id,
            request_id: req.id,
            matched_by: 'team',
            note: { ...(d.note ?? {}), by }
         }))
      ) {
         await answer('Someone else just handled it.');
         return true;
      }
      await claimRequest(svc, req, d.id); // fine if it was already used: the loan is what matters
      const outcome = await recordDeposit(svc, d);
      await finish(
         outcome === 'recorded'
            ? '✅ Recorded on that loan'
            : outcome === 'refund_needed'
              ? '⚠️ Loan couldn’t take it — see the alert'
              : '⏳ Saving failed — it retries in a few minutes'
      );
      return true;
   }
   await answer('Unknown action.');
   return true;
};

// ── Walt Transfer: "✅ Sudah kirim" → team card → "✅ Arrived" ──────────────────────────────────
export type ClaimSentResult = { ok: true; already: boolean } | { ok: false; error: 'not_found' | 'paid' | 'not_walt' | 'error' };

/** The borrower says they sent it: tell the team (once per 10 min) with ✅ Arrived / ❌ Not yet buttons. */
export const claimSent = async (svc: Svc, userId: string, requestId: number): Promise<ClaimSentResult> => {
   try {
      const { data: r } = await svc
         .from('id_repay_requests')
         .select(REQUEST_FIELDS)
         .eq('id', requestId)
         .eq('user_id', userId)
         .maybeSingle();
      const req = r as RequestRow | null;
      if (!req) return { ok: false, error: 'not_found' };
      if (req.status === 'paid') return { ok: false, error: 'paid' };
      if (req.method !== 'walt_transfer') return { ok: false, error: 'not_walt' };
      const now = new Date().toISOString();
      // One card per 10 minutes, however often they tap.
      const { data: claimed } = await svc
         .from('id_repay_requests')
         .update({ sent_claimed_at: now, updated_at: now })
         .eq('id', req.id)
         .or(`sent_claimed_at.is.null,sent_claimed_at.lt.${new Date(Date.now() - BUSY_MS).toISOString()}`)
         .select('id');
      if (!(claimed ?? []).length) return { ok: true, already: true };
      const [{ data: loan }, { data: who }] = await Promise.all([
         svc.from('loans').select('tracking_id').eq('id', req.loan_id).maybeSingle(),
         svc.from('users').select('username, display_name, telegram_username').eq('id', req.user_id).maybeSingle()
      ]);
      const cents = unitsToExactCents(unitsOf(req.amount_units));
      const amount = cents != null ? centsToText(cents) : String(req.amount_usd);
      const name =
         [who?.display_name, who?.telegram_username ? `@${who.telegram_username}` : who?.username ? `(${who.username})` : null]
            .filter(Boolean)
            .join(' ') || req.user_id.slice(0, 8);
      const rp = Number(req.rupiah_left ?? NaN);
      await alertTeam(
         svc,
         [
            `💸 🇮🇩 ${loan?.tracking_id ?? req.loan_id}: ${name} says they sent ${amount} USDT${Number.isFinite(rp) ? ` (Rp ${rp.toLocaleString('id-ID')})` : ''} by Walt Transfer to ${req.to_address.replace(/^walt:/, '')}.`,
            'Check your Walt (Transfers / history), then tap:'
         ].join('\n'),
         [
            [{ text: `✅ Arrived — record ${amount} USDT`, callback_data: `${CB}a:${req.id}` }],
            [{ text: '❌ Not there', callback_data: `${CB}x:${req.id}` }]
         ]
      );
      return { ok: true, already: false };
   } catch (err) {
      console.error('[idRepayments] claimSent failed', err instanceof Error ? err.message : err);
      return { ok: false, error: 'error' };
   }
};

/** ✅ Arrived → record it on the loan (exactly once); ❌ Not there → tell the borrower. */
const waltTransferTap = async (svc: Svc, requestId: number, arrived: boolean, by: string, answer: Say, finish: Say) => {
   const { data: r } = await svc.from('id_repay_requests').select(REQUEST_FIELDS).eq('id', requestId).maybeSingle();
   const req = r as RequestRow | null;
   if (!req) return void (await answer('Request not found.'));
   const user = await loadUser(svc, req.user_id);
   if (!arrived) {
      if (req.status === 'paid') return void (await answer('Already recorded as paid.'));
      await svc.from('id_repay_requests').update({ sent_claimed_at: null, updated_at: new Date().toISOString() }).eq('id', req.id);
      await tell(
         user,
         say(
            user,
            `❗ Kami belum menerima ${centsToText(unitsToExactCents(unitsOf(req.amount_units)) ?? 0)} USDT darimu di Walt. Pastikan kamu mengirim lewat Walt → Transfer ke ${req.to_address.replace(/^walt:/, '')}, lalu tekan "✅ Sudah kirim" lagi. Butuh bantuan? Hubungi kami.`,
            `❗ We haven't received ${centsToText(unitsToExactCents(unitsOf(req.amount_units)) ?? 0)} USDT from you in Walt yet. Make sure you sent it with Walt → Transfer to ${req.to_address.replace(/^walt:/, '')}, then tap "✅ I've sent it" again. Need help? Contact us.`
         ),
         payRestRow(user)
      );
      return void (await finish('❌ Not there — borrower told to check and tap again'));
   }
   // One deposit row per request (tx_hash 'walt-transfer:<id>' is unique): a second tap finds it.
   const now = new Date().toISOString();
   const { data: ins, error: insError } = await svc
      .from('id_wallet_deposits')
      .insert({
         tx_hash: `${WALT_TX}${req.id}`,
         log_index: 0,
         token: 'USDT',
         from_address: 'walt',
         to_address: req.to_address,
         units: String(req.amount_units),
         block_number: 0,
         status: 'recording',
         recording_at: now,
         request_id: req.id,
         loan_id: req.loan_id,
         matched_by: 'walt_confirmed',
         note: { by }
      })
      .select(DEPOSIT_FIELDS)
      .single();
   if (insError || !ins) {
      return void (await answer(
         insError?.code === '23505' ? 'Already recorded (or being recorded).' : `Couldn’t save: ${insError?.message ?? '?'}`
      ));
   }
   const d = ins as DepositRow;
   await claimRequest(svc, req, d.id);
   const outcome = await recordDeposit(svc, d);
   await finish(
      outcome === 'recorded'
         ? '✅ Recorded on the loan'
         : outcome === 'refund_needed'
           ? '⚠️ The loan couldn’t take it — see the alert'
           : '⏳ Saving failed — it retries in a few minutes'
   );
};

// ── refunds and sweeps (money leaving the payout wallet) ─────────────────────────────────────────
type Say = (text: string) => Promise<unknown>;

/** ↩️ Send a deposit (or just its overpaid part) back to the borrower's saved Walt address. One tap only. */
const refundTap = async (svc: Svc, d: DepositRow, what: 'all' | 'extra', answer: Say, finish: Say) => {
   if (d.refund_tx || d.refund_started_at) return void (await answer('A refund was already started for this one.'));
   if (what === 'all' && d.status !== 'refund_needed') return void (await answer(`Nothing to refund (${d.status}).`));
   const overpaidMicros = Number(d.note?.overpaidMicros ?? 0);
   if (what === 'extra' && !(overpaidMicros > 0)) return void (await answer('Nothing extra to refund.'));
   const units = what === 'all' ? unitsOf(d.units) : BigInt(Math.round(overpaidMicros)) * 10n ** 12n;
   const { data: loan } = d.loan_id ? await svc.from('loans').select('borrower_user_id').eq('id', d.loan_id).maybeSingle() : { data: null };
   const user = loan ? await loadUser(svc, loan.borrower_user_id) : null;
   const walt = String(user?.walt_address ?? '');
   if (!EVM_ADDRESS.test(walt)) return void (await answer('No Walt address saved for them.'));
   const now = new Date().toISOString();
   const { data: claimed } = await svc
      .from('id_wallet_deposits')
      .update({ refund_started_at: now, updated_at: now })
      .eq('id', d.id)
      .is('refund_started_at', null)
      .select('id');
   if (!(claimed ?? []).length) return void (await answer('A refund was already started for this one.'));
   const amount = unitsToDecimal(units);
   try {
      const txId = await sendTokenBsc(svc, d.token, walt, amount, Date.now() + 55_000);
      await patchDeposit(svc, d, { refund_tx: txId, refund_units: units.toString(), ...(what === 'all' ? { status: 'refunded' } : {}) });
      await finish(
         `↩️ Refund of ${amount} ${d.token} to ${short(walt)} sent (Openfort ${txId}). I'll confirm here once it lands on BNB Chain.`
      );
   } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (err instanceof NotSentError) {
         await svc.from('id_wallet_deposits').update({ refund_started_at: null }).eq('id', d.id);
         await answer(`Not sent: ${msg}`);
      } else {
         // It may have gone out: keep the claim so nobody sends it twice; check the wallet on BscScan.
         await finish(`⚠️ Refund send failed (${msg}) — it MAY have gone out. Check the payout wallet before trying again.`);
      }
   }
};

const sweepTap = async (svc: Svc, token: BscToken, cents: number, cardKey: string, by: string, answer: Say, finish: Say) => {
   if ((token !== 'USDT' && token !== 'USDC') || !Number.isInteger(cents) || cents <= 0) return void (await answer('Bad sweep.'));
   const to = String((await getSetting(svc, 'id_payout_sweep_to')) ?? '').trim();
   if (!EVM_ADDRESS.test(to)) return void (await answer('No sweep address set (id_payout_sweep_to).'));
   // One send per card, even on double taps or taps on older cards (card_key is the primary key).
   const { error: claimError } = await svc
      .from('id_sweeps')
      .insert({ card_key: cardKey, token, cents, to_address: to.toLowerCase(), by_admin: by });
   if (claimError)
      return void (await answer(claimError.code === '23505' ? 'Already sent from this card.' : `Couldn’t start: ${claimError.message}`));
   const amount = centsToText(cents);
   try {
      const txId = await sendTokenBsc(svc, token, to, amount, Date.now() + 55_000);
      await svc
         .from('id_sweeps')
         .update({ openfort_tx: txId, status: 'sent', updated_at: new Date().toISOString() })
         .eq('card_key', cardKey);
      await finish(`✅ Sending ${amount} ${token} to ${to} (Openfort ${txId}). I'll confirm here once it lands.`);
   } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (err instanceof NotSentError) {
         await svc.from('id_sweeps').update({ status: 'not_sent', updated_at: new Date().toISOString() }).eq('card_key', cardKey);
         await finish(`Not sent: ${msg}. Send /idsweep again to retry.`);
      } else {
         await svc.from('id_sweeps').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('card_key', cardKey);
         await finish(`⚠️ Send failed (${msg}) — it MAY have gone out. Check the payout wallet before trying again.`);
      }
   }
};

/**
 * /idsweep                 balances + where a sweep goes
 * /idsweep USDT 25 | all   a confirm card; the money only ever goes to id_payout_sweep_to (set by SQL)
 */
export const handleSweepCommand = async (svc: Svc, message: { chat: { id: number | string }; text?: string }): Promise<boolean> => {
   const m = (message.text ?? '').trim().match(/^\/idsweep(?:@\w+)?(?:\s+(\S+))?(?:\s+(\S+))?/i);
   if (!m) return false;
   const chatId = message.chat.id;
   const wallet = await getPayoutWallet(svc);
   if (!wallet) {
      await sendTelegramMessage(chatId, 'No payout wallet yet.');
      return true;
   }
   const to = String((await getSetting(svc, 'id_payout_sweep_to')) ?? '').trim();
   let bal: Awaited<ReturnType<typeof balanceOf>> | null = null;
   try {
      bal = await balanceOf(wallet.address);
   } catch {
      bal = null;
   }
   const token = (m[1] ?? '').toUpperCase();
   if (!token) {
      await sendTelegramMessage(
         chatId,
         [
            `🇮🇩 Payout wallet ${wallet.address}`,
            bal
               ? `${bal.usdt.toFixed(2)} USDT · ${bal.usdc.toFixed(2)} USDC · ${bal.bnb.toFixed(4)} BNB`
               : 'Balance: BNB Chain unreachable',
            EVM_ADDRESS.test(to) ? `Sweeps go to: ${to}` : '⚠️ No sweep address set (telegram_bot_settings.id_payout_sweep_to).',
            'Usage: /idsweep USDT 25 · /idsweep USDC all'
         ].join('\n')
      );
      return true;
   }
   if (token !== 'USDT' && token !== 'USDC') {
      await sendTelegramMessage(chatId, 'Usage: /idsweep USDT 25 · /idsweep USDC all');
      return true;
   }
   if (!EVM_ADDRESS.test(to)) {
      await sendTelegramMessage(chatId, '⚠️ No sweep address set (telegram_bot_settings.id_payout_sweep_to). Ask the dev team to set it.');
      return true;
   }
   if (!bal) {
      await sendTelegramMessage(chatId, '⚠️ Can’t read the balance right now. Try again in a minute.');
      return true;
   }
   const haveCents = Number((token === 'USDT' ? bal.usdtUnits : bal.usdcUnits) / 10n ** 16n);
   const raw = (m[2] ?? '').toLowerCase();
   const cents = raw === 'all' ? haveCents : /^\d+(\.\d{1,2})?$/.test(raw) ? Math.round(Number(raw) * 100) : NaN;
   if (!Number.isFinite(cents) || cents <= 0) {
      await sendTelegramMessage(chatId, 'Usage: /idsweep USDT 25 · /idsweep USDC all');
      return true;
   }
   if (cents > haveCents) {
      await sendTelegramMessage(chatId, `Only ${centsToText(haveCents)} ${token} in the payout wallet.`);
      return true;
   }
   await sendTelegramMessage(chatId, `Send ${centsToText(cents)} ${token} from the payout wallet to\n${to}?`, {
      inlineKeyboard: [[{ text: `✅ Send ${centsToText(cents)} ${token}`, callback_data: `${CB}s:${token}:${cents}` }]]
   });
   return true;
};

// ── the 5-minute job ─────────────────────────────────────────────────────────────────────────────
/** Reads USDT/USDC transfers into the payout wallet since the last look, saving each as a deposit row. */
const scanWallet = async (svc: Svc, wallet: string, deadline: number): Promise<number> => {
   const head = (await bscHead()) - BSC_CONFIRMATIONS;
   // Read the cursor strictly: a failed read must not restart the scan 2 h back and skip blocks.
   const { data: cursorRow, error: cursorError } = await svc
      .from('telegram_bot_settings')
      .select('value')
      .eq('key', 'id_repay_scan_block')
      .maybeSingle();
   if (cursorError) throw new Error(`read scan cursor: ${cursorError.message}`);
   const saved = (cursorRow?.value as string | undefined) ?? null;
   let from =
      saved && /^\d+$/.test(saved)
         ? BigInt(saved) + 1n
         : await blockAtOrBefore(new Date(Date.now() - FIRST_SCAN_BACK_MS).toISOString(), head);
   let seen = 0;
   const me = wallet.toLowerCase();
   while (from <= head && Date.now() < deadline) {
      const to = from + BSC_LOG_SPAN > head ? head : from + BSC_LOG_SPAN;
      const rows: Record<string, unknown>[] = [];
      for (const t of TOKENS) {
         for (const tr of await bscTransfersTo(me, from, to, undefined, t.address)) {
            if (tr.from.toLowerCase() === me) continue;
            rows.push({
               tx_hash: tr.txHash.toLowerCase(),
               log_index: tr.logIndex,
               token: t.token,
               from_address: tr.from.toLowerCase(),
               to_address: me,
               units: tr.value.toString(),
               block_number: Number(tr.blockNumber)
            });
         }
      }
      if (rows.length) {
         const { error } = await svc.from('id_wallet_deposits').upsert(rows, { onConflict: 'tx_hash,log_index', ignoreDuplicates: true });
         if (error) throw new Error(`save deposits: ${error.message}`); // don't move the cursor past unsaved money
         seen += rows.length;
      }
      const { error: saveError } = await svc
         .from('telegram_bot_settings')
         .upsert({ key: 'id_repay_scan_block', value: to.toString(), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (saveError) throw new Error(`save scan cursor: ${saveError.message}`);
      from = to + 1n;
   }
   // Behind by more than ~30 min (RPC trouble, or out of time): tell the team, at most every 3 h.
   if (head - from > SCAN_BEHIND_ALERT_BLOCKS) {
      const last = Date.parse(String((await getSetting(svc, 'id_repay_scan_alerted_at')) ?? ''));
      if (!Number.isFinite(last) || Date.now() - last > SCAN_ALERT_EVERY_MS) {
         await setSetting(svc, 'id_repay_scan_alerted_at', new Date().toISOString());
         await alertTeam(
            svc,
            `⚠️ 🇮🇩 The payout-wallet repayment scan is ${(head - from).toString()} blocks (~${Math.round((Number(head - from) * 0.75) / 60)} min) behind BNB Chain. Repayments will be recorded late until it catches up.`
         );
      }
   }
   return seen;
};

const sendUnmatchedCard = async (svc: Svc, d: DepositRow) => {
   const card = await unmatchedCard(svc, d);
   await alertTeam(svc, card.text, card.keyboard);
   await patchDeposit(svc, d, { alerted_at: new Date().toISOString() });
};

const processNew = async (
   svc: Svc,
   d: DepositRow,
   topupSenders: Set<string>
): Promise<'recorded' | 'topup' | 'unmatched' | 'ignored' | 'other'> => {
   const units = unitsOf(d.units);
   if (units < DUST_UNITS) {
      if (!(await claimDeposit(svc, d, ['new']))) return 'other';
      await patchDeposit(svc, d, { status: 'ignored', note: { reason: 'dust' } });
      return 'ignored';
   }
   // An exact-amount match wins even from a "top-up" sender: exchanges and Walt send from shared wallets.
   const match = await matchRequest(svc, units);
   if (match) {
      if (
         !(await claimDeposit(svc, d, ['new'], {
            loan_id: match.req.loan_id,
            request_id: match.req.id,
            matched_by: match.late ? 'late_amount' : 'amount'
         }))
      )
         return 'other';
      if (await claimRequest(svc, match.req, d.id)) {
         return (await recordDeposit(svc, d)) === 'recorded' ? 'recorded' : 'other';
      }
      // Another deposit took that request a moment ago (two sends of the same amount): the team decides.
      await patchDeposit(svc, d, { status: 'unmatched', loan_id: null, request_id: null, matched_by: null });
      await sendUnmatchedCard(svc, d);
      return 'unmatched';
   }
   if (!(await claimDeposit(svc, d, ['new']))) return 'other';
   if (topupSenders.has(d.from_address.toLowerCase())) {
      await patchDeposit(svc, d, { status: 'topup' });
      await alertTeam(svc, `⬆️ 🇮🇩 Top-up: ${depositText(d)} into the payout wallet from ${short(d.from_address)}.`);
      return 'topup';
   }
   await patchDeposit(svc, d, { status: 'unmatched' });
   await sendUnmatchedCard(svc, d);
   return 'unmatched';
};

/** Refunds and sweeps sent from the payout wallet: confirm them on chain (or say they failed). */
const confirmOutgoing = async (svc: Svc, deadline: number) => {
   const { data: refunds } = await svc
      .from('id_wallet_deposits')
      .select(DEPOSIT_FIELDS)
      .not('refund_tx', 'is', null)
      .is('refund_confirmed_at', null)
      .order('id', { ascending: true })
      .limit(10);
   for (const d of (refunds ?? []) as DepositRow[]) {
      if (Date.now() > deadline) return;
      try {
         const state = await pollOpenfortTx(svc, String(d.refund_tx));
         if (state.state === 'pending') continue;
         const amount = unitsToDecimal(unitsOf(d.refund_units ?? d.units));
         if (state.state === 'succeeded') {
            await patchDeposit(svc, d, { refund_tx_hash: state.txHash, refund_confirmed_at: new Date().toISOString() });
            const { data: loan } = d.loan_id
               ? await svc.from('loans').select('borrower_user_id').eq('id', d.loan_id).maybeSingle()
               : { data: null };
            const user = loan ? await loadUser(svc, loan.borrower_user_id) : null;
            await tell(
               user,
               say(user, `↩️ Kami mengembalikan ${amount} ${d.token} ke Walt kamu.`, `↩️ We sent ${amount} ${d.token} back to your Walt.`)
            );
            await alertTeam(svc, `✅ 🇮🇩 Refund of ${amount} ${d.token} landed (tx ${state.txHash}).`);
         } else {
            const wasAll = d.status === 'refunded';
            await patchDeposit(svc, d, {
               refund_tx: null,
               refund_started_at: null,
               refund_units: null,
               ...(wasAll ? { status: 'refund_needed' } : {})
            });
            await alertTeam(
               svc,
               `⚠️ 🇮🇩 Refund of ${amount} ${d.token} FAILED (${state.error}). Nothing left the wallet — tap to try again.`,
               [[{ text: `↩️ Retry refund`, callback_data: `${CB}${wasAll ? 'f' : 'o'}:${d.id}` }]]
            );
         }
      } catch (err) {
         console.error(`[idRepayments] refund check ${d.id} failed`, err instanceof Error ? err.message : err);
      }
   }
   const { data: sweeps } = await svc
      .from('id_sweeps')
      .select('card_key, token, cents, to_address, openfort_tx')
      .eq('status', 'sent')
      .limit(10);
   for (const sw of (sweeps ?? []) as Array<{ card_key: string; token: string; cents: number; to_address: string; openfort_tx: string }>) {
      if (Date.now() > deadline) return;
      try {
         const state = await pollOpenfortTx(svc, sw.openfort_tx);
         if (state.state === 'pending') continue;
         const ok = state.state === 'succeeded';
         await svc
            .from('id_sweeps')
            .update({ status: ok ? 'confirmed' : 'failed', tx_hash: state.txHash ?? null, updated_at: new Date().toISOString() })
            .eq('card_key', sw.card_key);
         await alertTeam(
            svc,
            ok
               ? `✅ 🇮🇩 Sweep of ${centsToText(Number(sw.cents))} ${sw.token} to ${short(sw.to_address)} landed (tx ${state.txHash}).`
               : `⚠️ 🇮🇩 Sweep of ${centsToText(Number(sw.cents))} ${sw.token} FAILED (${state.state === 'failed' ? state.error : '?'}). Nothing left the wallet — send /idsweep again.`
         );
      } catch (err) {
         console.error(`[idRepayments] sweep check ${sw.card_key} failed`, err instanceof Error ? err.message : err);
      }
   }
};

export type IdRepayTally = { seen: number; recorded: number; topups: number; unmatched: number; resumed: number; expired: number };

/** The 5-minute job (video-call-reminders). Stops at `deadline`. Never throws. */
const NUDGE_AFTER_MS = 6 * 3_600_000;

/**
 * Hand-holding: a borrower opened 💰 Bayar 6+ hours ago and never tapped "✅ Sudah kirim" (and the loan
 * is still owed) → one "need a hand?" message with the buy-USDT and pay guides. Once per request.
 */
export const runIdRepayNudges = async (svc: Svc, now = Date.now()): Promise<number> => {
   let sent = 0;
   try {
      const { data } = await svc
         .from('id_repay_requests')
         .select('id, loan_id, user_id')
         .eq('status', 'open')
         .eq('method', 'walt_transfer')
         .is('sent_claimed_at', null)
         .is('nudged_at', null)
         .lte('created_at', new Date(now - NUDGE_AFTER_MS).toISOString())
         .gte('expires_at', new Date(now).toISOString())
         .limit(20);
      for (const r of (data ?? []) as Array<{ id: number; loan_id: string; user_id: string }>) {
         const stamp = new Date().toISOString();
         const { data: claimed } = await svc
            .from('id_repay_requests')
            .update({ nudged_at: stamp })
            .eq('id', r.id)
            .is('nudged_at', null)
            .select('id');
         if (!(claimed ?? []).length) continue;
         const [{ data: loan }, user] = await Promise.all([
            svc.from('loans').select('repayment_status').eq('id', r.loan_id).maybeSingle(),
            loadUser(svc, r.user_id)
         ]);
         if (!user?.chat_id || loan?.repayment_status === 'Paid') continue;
         await sendRepayStuckOffer(user.chat_id, idLocaleOf(user.preferred_locale));
         sent += 1;
      }
   } catch (err) {
      console.error('[idRepayments] nudges failed', err instanceof Error ? err.message : err);
   }
   return sent;
};

export const runIdRepayments = async (svc: Svc, deadline = Date.now() + 45_000): Promise<IdRepayTally> => {
   const tally: IdRepayTally = { seen: 0, recorded: 0, topups: 0, unmatched: 0, resumed: 0, expired: 0 };
   try {
      const { data: expired } = await svc
         .from('id_repay_requests')
         .update({ status: 'expired', updated_at: new Date().toISOString() })
         .eq('status', 'open')
         .lt('expires_at', new Date().toISOString())
         .select('id');
      tally.expired = (expired ?? []).length;

      const wallet = await getPayoutWallet(svc);
      if (!wallet) return tally;

      // 1. Finish deposits whose run died mid-way.
      const { data: stuck } = await svc
         .from('id_wallet_deposits')
         .select(DEPOSIT_FIELDS)
         .eq('status', 'recording')
         .lt('updated_at', new Date(Date.now() - RESUME_AFTER_MS).toISOString())
         .order('id', { ascending: true })
         .limit(10);
      for (const d of (stuck ?? []) as DepositRow[]) {
         if (Date.now() > deadline - 10_000) break;
         try {
            if (!(await claimStuck(svc, d))) continue;
            // No loan to put it on (the run died before 'unmatched', or the loan was deleted): ask the team.
            const { data: hasLoan } = d.loan_id ? await svc.from('loans').select('id').eq('id', d.loan_id).maybeSingle() : { data: null };
            if (!hasLoan) {
               await patchDeposit(svc, d, { status: 'unmatched', loan_id: null, request_id: null, matched_by: null });
               await sendUnmatchedCard(svc, d);
               tally.unmatched += 1;
               continue;
            }
            if ((await recordDeposit(svc, d)) === 'recorded') tally.resumed += 1;
         } catch (err) {
            console.error(`[idRepayments] resume ${d.id} failed`, err instanceof Error ? err.message : err);
         }
      }

      // 2. Refunds / sweeps sent earlier: did they land?
      try {
         await confirmOutgoing(svc, deadline - 25_000);
      } catch (err) {
         console.error('[idRepayments] outgoing check failed', err instanceof Error ? err.message : err);
      }

      // 3. New money on BNB Chain.
      try {
         tally.seen = await scanWallet(svc, wallet.address, deadline - 15_000);
      } catch (err) {
         console.error('[idRepayments] scan failed', err instanceof Error ? err.message : err);
      }

      // 4. Match and record.
      const { data: fresh } = await svc
         .from('id_wallet_deposits')
         .select(DEPOSIT_FIELDS)
         .eq('status', 'new')
         .order('id', { ascending: true })
         .limit(25);
      const topupSenders = parseSenders(await getSetting(svc, 'id_topup_senders'));
      for (const d of (fresh ?? []) as DepositRow[]) {
         if (Date.now() > deadline - 5_000) break;
         try {
            const r = await processNew(svc, d, topupSenders);
            if (r === 'recorded') tally.recorded += 1;
            else if (r === 'topup') tally.topups += 1;
            else if (r === 'unmatched') tally.unmatched += 1;
         } catch (err) {
            console.error(`[idRepayments] deposit ${d.id} failed`, err instanceof Error ? err.message : err);
         }
      }
   } catch (err) {
      console.error('[idRepayments] run failed', err instanceof Error ? err.message : err);
   }
   return tally;
};
