// Indonesia track: Moodeng's Openfort payout wallet on BNB Smart Chain (chainId 56)
// (migration 20261107150000_indonesia_payout_wallet.sql).
//
// ONE Openfort backend wallet, topped up by hand with USDC (BSC) from Binance TH. The server sends
// USDC from it to a borrower's Walt address; gas is paid by an Openfort fee sponsorship (the first
// send upgrades the EOA to EIP-7702, so the sponsorship needs an "All functions" rule).
//
//   loadPayoutCreds     — the OPENFORT_PAYOUT vault JSON (openfort_payout_secret()); null = not configured
//   getPayoutWallet     — account id + address saved in telegram_bot_settings
//   createPayoutWallet  — create it once (idempotent), save it
//   payoutWalletBalance — USDC + BNB on BNB Chain (public RPC, no Openfort call)
//   sendUsdcBsc         — create the sponsored transfer; returns the Openfort transaction id
//   pollOpenfortTx      — pending | succeeded (tx hash) | failed
//
// Pure helpers (units, Bangkok day, eligibility) are exported for idPayoutWallet.test.ts.

// The Openfort SDK (and viem, its peer for sendTransaction) load lazily, only when money moves or a
// wallet is created — telegram-webhook and the 5-minute job import this file for status/balances
// and shouldn't pay for the SDK on every cold start.
type OpenfortSdk = typeof import('npm:@openfort/openfort-node@0.12.2');
type OpenfortClient = InstanceType<OpenfortSdk['default']>;
let sdkPromise: Promise<{ Openfort: OpenfortSdk['default']; getAddress: (a: string) => string }> | null = null;
const loadSdk = () =>
   (sdkPromise ??= Promise.all([import('npm:@openfort/openfort-node@0.12.2'), import('npm:viem@2')]).then(([of, viem]) => ({
      Openfort: of.default,
      getAddress: (a: string) => viem.getAddress(a)
   })));

// deno-lint-ignore no-explicit-any
type Svc = any;

export const BSC_CHAIN_ID = 56;
export const BSC_USDC_CHECKSUM = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
// Borrowers repay in USDT (what Walt holds) to this same wallet (_shared/idRepayments.ts); /idsweep can send it on.
export const BSC_USDT_CHECKSUM = '0x55d398326f99059fF775485246999027B3197955';
export type BscToken = 'USDC' | 'USDT';
const TOKEN_ADDRESS: Record<BscToken, string> = { USDC: BSC_USDC_CHECKSUM, USDT: BSC_USDT_CHECKSUM };
const BSC_RPCS = ['https://bsc-rpc.publicnode.com', 'https://bsc.drpc.org'];
const WALLET_IDEMPOTENCY_KEY = 'moodeng-id-payout-wallet-v1';

/** Every Openfort SDK call is bounded: a hung call must not eat the 5-minute job's budget. */
export const OPENFORT_TIMEOUT_MS = 20_000;
/** sendTransaction is never started with less than this much of the caller's budget left. */
export const MIN_SEND_BUDGET_MS = 30_000;

export class OpenfortTimeoutError extends Error {}

/** Rejects with OpenfortTimeoutError after `ms` (the underlying call keeps running; it can't be aborted). */
export const withTimeout = <T>(p: Promise<T>, label: string, ms = OPENFORT_TIMEOUT_MS): Promise<T> => {
   let timer: number | undefined;
   const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new OpenfortTimeoutError(`${label}_timeout_${Math.round(ms / 1000)}s`)), ms);
   });
   return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
};

/**
 * Thrown by sendUsdcBsc for anything that fails BEFORE sendTransaction is called: no money can have
 * left, so the caller may release its claim instead of marking the payout failed.
 */
export class NotSentError extends Error {}

export type PayoutCreds = { secretKey: string; walletSecret: string; feeSponsorshipId: string };
export type PayoutWallet = { accountId: string; address: string };

// ── pure helpers ─────────────────────────────────────────────────────────────────────────────────
/** "5" / 5 / "10.50" → USDC (BSC) units, 18 decimals, exactly (string math, never floats). */
export const usdcBscUnits = (amount: number | string): bigint => {
   const s = String(amount).trim();
   if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`bad amount ${s}`);
   const [whole, frac = ''] = s.split('.');
   if (frac.length > 18) throw new Error(`too many decimals ${s}`);
   return BigInt(whole) * 10n ** 18n + BigInt((frac + '0'.repeat(18)).slice(0, 18));
};

/** 18-decimal units → dollars, for display only. */
export const unitsToUsd = (units: bigint): number => Number(units / 10n ** 12n) / 1e6;

/** ERC-20 transfer(address,uint256) calldata. */
export const encodeTransfer = (to: string, units: bigint): string => {
   if (!/^0x[0-9a-fA-F]{40}$/.test(to)) throw new Error('bad address');
   if (units <= 0n) throw new Error('bad amount');
   return `0xa9059cbb${to.slice(2).toLowerCase().padStart(64, '0')}${units.toString(16).padStart(64, '0')}`;
};

/** Start of the Bangkok (UTC+7, no DST) day containing `now`. */
export const bangkokDayStart = (now: number): Date => {
   const offset = 7 * 3_600_000;
   const day = 86_400_000;
   return new Date(Math.floor((now + offset) / day) * day - offset);
};

/** "2026-11-07" — the Bangkok date of `now`. */
export const bangkokDay = (now: number): string => new Date(now + 7 * 3_600_000).toISOString().slice(0, 10);

export type AutoPayLimits = { maxUsd: number; dailyCapUsd: number };

/**
 * Whether a loan may be paid automatically right now (before claiming it in SQL, which re-checks the
 * open state, the max and the cap under a lock). `requireAge` is the cron's 2-minute / 7-day window;
 * an admin's "Pay now" skips it.
 */
export const autoPayBlocker = (input: {
   amountUsd: number;
   createdAt: string;
   now: number;
   paidTodayUsd: number;
   balanceUsd: number | null;
   limits: AutoPayLimits;
   hasWalt: boolean;
   requireAge: boolean;
}): string | null => {
   const { amountUsd, createdAt, now, paidTodayUsd, balanceUsd, limits, hasWalt, requireAge } = input;
   if (!hasWalt) return 'no_walt_address';
   if (!(amountUsd > 0)) return 'bad_amount';
   if (requireAge) {
      const age = now - new Date(createdAt).getTime();
      if (age < 2 * 60_000) return 'too_new';
      if (age > 7 * 86_400_000) return 'too_old';
   }
   if (amountUsd > limits.maxUsd) return 'over_max';
   if (paidTodayUsd + amountUsd > limits.dailyCapUsd + 1e-9) return 'daily_cap_reached';
   if (balanceUsd == null) return 'balance_unknown';
   if (balanceUsd + 1e-9 < amountUsd) return 'low_balance';
   return null;
};

export const parseCreds = (raw: unknown): PayoutCreds | null => {
   if (typeof raw !== 'string' || !raw.trim()) return null;
   try {
      const j = JSON.parse(raw) as Partial<PayoutCreds>;
      const ok =
         typeof j.secretKey === 'string' &&
         j.secretKey.startsWith('sk_') &&
         typeof j.walletSecret === 'string' &&
         j.walletSecret.length > 0 &&
         typeof j.feeSponsorshipId === 'string' &&
         j.feeSponsorshipId.startsWith('pol_');
      return ok ? { secretKey: j.secretKey!, walletSecret: j.walletSecret!, feeSponsorshipId: j.feeSponsorshipId! } : null;
   } catch {
      return null;
   }
};

// ── settings ─────────────────────────────────────────────────────────────────────────────────────
const getSetting = async (svc: Svc, key: string): Promise<string | null> => {
   const { data } = await svc.from('telegram_bot_settings').select('value').eq('key', key).maybeSingle();
   return (data?.value as string | undefined) ?? null;
};

export const getAutoPayLimits = async (svc: Svc): Promise<AutoPayLimits & { autopay: 'on' | 'off' }> => {
   const [autopay, max, cap] = await Promise.all([
      getSetting(svc, 'id_autopay'),
      getSetting(svc, 'id_autopay_max_usd'),
      getSetting(svc, 'id_autopay_daily_cap_usd')
   ]);
   const num = (v: string | null, fallback: number) => (v != null && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback);
   return { autopay: autopay === 'on' ? 'on' : 'off', maxUsd: num(max, 10), dailyCapUsd: num(cap, 100) };
};

/** Sum of automatic payouts attempted today (Bangkok), failed ones included — same rule as the SQL claim. */
export const paidTodayUsd = async (svc: Svc, now = Date.now()): Promise<number> => {
   const { data } = await svc
      .from('id_manual_payouts')
      .select('amount')
      .eq('method', 'auto')
      .gte('paid_attempt_at', bangkokDayStart(now).toISOString());
   return ((data ?? []) as Array<{ amount: number | string }>).reduce((s, r) => s + Number(r.amount || 0), 0);
};

// ── credentials + client ─────────────────────────────────────────────────────────────────────────
let credsCache: { at: number; creds: PayoutCreds | null } | null = null;

export const loadPayoutCreds = async (svc: Svc): Promise<PayoutCreds | null> => {
   if (credsCache && Date.now() - credsCache.at < 60_000) return credsCache.creds;
   try {
      const { data, error } = await svc.rpc('openfort_payout_secret');
      const creds = error ? null : parseCreds(data);
      credsCache = { at: Date.now(), creds };
      return creds;
   } catch (err) {
      console.error('idPayoutWallet: vault read failed', err);
      return null;
   }
};

let client: { key: string; openfort: OpenfortClient } | null = null;
const openfortFor = async (creds: PayoutCreds): Promise<OpenfortClient> => {
   const key = `${creds.secretKey}|${creds.walletSecret}`;
   if (!client || client.key !== key) {
      const { Openfort } = await loadSdk();
      client = { key, openfort: new Openfort(creds.secretKey, { walletSecret: creds.walletSecret }) };
   }
   return client.openfort;
};

// ── the wallet ───────────────────────────────────────────────────────────────────────────────────
export const getPayoutWallet = async (svc: Svc): Promise<PayoutWallet | null> => {
   const [accountId, address] = await Promise.all([
      getSetting(svc, 'id_payout_wallet_account_id'),
      getSetting(svc, 'id_payout_wallet_address')
   ]);
   if (!accountId || !address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return null;
   return { accountId, address };
};

export type CreateWalletResult = { ok: true; wallet: PayoutWallet; created: boolean } | { ok: false; error: string };

/** Creates the one payout wallet if none is saved yet; otherwise returns the saved one. */
export const createPayoutWallet = async (svc: Svc): Promise<CreateWalletResult> => {
   const existing = await getPayoutWallet(svc);
   if (existing) return { ok: true, wallet: existing, created: false };
   const creds = await loadPayoutCreds(svc);
   if (!creds) return { ok: false, error: 'not_configured' };
   try {
      // A fixed idempotency key: two taps at once (or a retry) get the same wallet back.
      const openfort = await withTimeout(openfortFor(creds), 'openfort_load');
      const account = await withTimeout(
         openfort.accounts.evm.backend.create({ idempotencyKey: WALLET_IDEMPOTENCY_KEY }),
         'openfort_create_account'
      );
      const address = (await loadSdk()).getAddress(account.address);
      // Save only over the empty defaults, so a wallet already saved is never replaced.
      const now = new Date().toISOString();
      await svc
         .from('telegram_bot_settings')
         .update({ value: account.id, updated_at: now })
         .eq('key', 'id_payout_wallet_account_id')
         .eq('value', '');
      await svc
         .from('telegram_bot_settings')
         .update({ value: address, updated_at: now })
         .eq('key', 'id_payout_wallet_address')
         .eq('value', '');
      const saved = await getPayoutWallet(svc);
      if (!saved) return { ok: false, error: 'wallet_not_saved' };
      return { ok: true, wallet: saved, created: saved.accountId === account.id };
   } catch (err) {
      console.error('idPayoutWallet.createPayoutWallet failed', err);
      return { ok: false, error: `openfort_error: ${err instanceof Error ? err.message : String(err)}`.slice(0, 300) };
   }
};

// ── balances (BNB Chain public RPC) ──────────────────────────────────────────────────────────────
const bscRpc = async <T>(method: string, params: unknown[]): Promise<T> => {
   let lastError: unknown = null;
   for (const url of BSC_RPCS) {
      try {
         const res = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
            signal: AbortSignal.timeout(10_000)
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

export type WalletBalance = { usdc: number; usdt: number; bnb: number; usdcUnits: bigint; usdtUnits: bigint };

export const balanceOf = async (address: string): Promise<WalletBalance> => {
   const data = `0x70a08231${address.slice(2).toLowerCase().padStart(64, '0')}`;
   const [usdcHex, usdtHex, bnbHex] = await Promise.all([
      bscRpc<string>('eth_call', [{ to: BSC_USDC_CHECKSUM.toLowerCase(), data }, 'latest']),
      bscRpc<string>('eth_call', [{ to: BSC_USDT_CHECKSUM.toLowerCase(), data }, 'latest']),
      bscRpc<string>('eth_getBalance', [address, 'latest'])
   ]);
   const units = (hex: string) => BigInt(hex && hex !== '0x' ? hex : '0x0');
   const usdcUnits = units(usdcHex);
   const usdtUnits = units(usdtHex);
   return { usdc: unitsToUsd(usdcUnits), usdt: unitsToUsd(usdtUnits), bnb: unitsToUsd(units(bnbHex)), usdcUnits, usdtUnits };
};

/** The payout wallet's balance, or null when there's no wallet or BNB Chain is unreachable. */
export const payoutWalletBalance = async (svc: Svc): Promise<(WalletBalance & { address: string }) | null> => {
   const wallet = await getPayoutWallet(svc);
   if (!wallet) return null;
   try {
      return { ...(await balanceOf(wallet.address)), address: wallet.address };
   } catch (err) {
      console.error('idPayoutWallet: balance read failed', err);
      return null;
   }
};

// ── sending ──────────────────────────────────────────────────────────────────────────────────────
/**
 * Creates the sponsored USDC (BSC) transfer and returns Openfort's transaction id. Resolves once the
 * transaction is created and signed, not when it lands: poll pollOpenfortTx. Anything that fails before
 * sendTransaction is called throws NotSentError (nothing left the wallet). sendTransaction itself is
 * never started with less than MIN_SEND_BUDGET_MS left before `deadline`; if IT throws or times out the
 * money may still have gone out — the caller marks the payout failed and the BNB Chain check decides.
 */
export const sendUsdcBsc = (svc: Svc, to: string, amountUsd: number | string, deadline = Date.now() + 60_000): Promise<string> =>
   sendTokenBsc(svc, 'USDC', to, amountUsd, deadline);

/** Same as sendUsdcBsc for either stablecoin (both 18 decimals on BNB Chain). */
export const sendTokenBsc = async (svc: Svc, token: BscToken, to: string, amountUsd: number | string, deadline = Date.now() + 60_000): Promise<string> => {
   let prepared: {
      openfort: OpenfortClient;
      account: Awaited<ReturnType<OpenfortClient['accounts']['evm']['backend']['get']>>;
      data: string;
      feeSponsorshipId: string;
   };
   try {
      const creds = await loadPayoutCreds(svc);
      if (!creds) throw new Error('not_configured');
      const wallet = await getPayoutWallet(svc);
      if (!wallet) throw new Error('no_payout_wallet');
      const units = usdcBscUnits(amountUsd);
      const { getAddress } = await withTimeout(loadSdk(), 'openfort_load');
      const data = encodeTransfer(getAddress(to), units);
      const openfort = await openfortFor(creds);
      const account = await withTimeout(openfort.accounts.evm.backend.get({ id: wallet.accountId }), 'openfort_get_account');
      if (getAddress(account.address) !== getAddress(wallet.address)) throw new Error('payout_wallet_mismatch');
      if (deadline - Date.now() < MIN_SEND_BUDGET_MS) throw new Error('no_time_left');
      prepared = { openfort, account, data, feeSponsorshipId: creds.feeSponsorshipId };
   } catch (err) {
      throw err instanceof NotSentError ? err : new NotSentError(err instanceof Error ? err.message : String(err));
   }
   const { openfort, account, data, feeSponsorshipId } = prepared;
   const tx = await withTimeout(
      openfort.accounts.evm.backend.sendTransaction({
         account,
         chainId: BSC_CHAIN_ID,
         interactions: [{ to: TOKEN_ADDRESS[token], data }],
         policy: feeSponsorshipId,
         rpcUrl: BSC_RPCS[0]
      }),
      'openfort_send'
   );
   if (!tx?.id) throw new Error('openfort_returned_no_id');
   return tx.id;
};

export type OpenfortTxState =
   | { state: 'pending' }
   | { state: 'succeeded'; txHash: string }
   | { state: 'failed'; error: string; txHash?: string };

const errText = (e: unknown) => {
   if (!e) return 'unknown error';
   if (typeof e === 'string') return e;
   const o = e as { reason?: string; name?: string; message?: string };
   return [o.name, o.reason ?? o.message].filter(Boolean).join(': ') || JSON.stringify(e).slice(0, 200);
};

/** Where an Openfort transaction stands. Throws only when Openfort can't be reached at all. */
export const pollOpenfortTx = async (svc: Svc, id: string): Promise<OpenfortTxState> => {
   const creds = await loadPayoutCreds(svc);
   if (!creds) throw new Error('not_configured');
   const openfort = await withTimeout(openfortFor(creds), 'openfort_load');
   // v2 transactions first (status: submitted → succeeded | reverted | failed; 'expired' = never landed) …
   try {
      const t = await withTimeout(openfort.transactions.get(id), 'openfort_tx_get');
      const hash = t.receipt?.transactionHash;
      const status = String(t.status);
      if (status === 'succeeded') return hash ? { state: 'succeeded', txHash: hash } : { state: 'pending' };
      if (status === 'reverted' || status === 'failed' || status === 'expired')
         return { state: 'failed', error: `${status}: ${errText(t.receipt?.error)}`, txHash: hash };
      // The user-operation monitor can say "expired" in the timeline while the status hasn't moved.
      if ((t.timeline ?? []).some((e) => String(e.event) === 'expired'))
         return { state: 'failed', error: 'expired', txHash: hash };
      return { state: 'pending' };
   } catch (err) {
      // … sendTransaction hands back a transaction intent (tin_); if v2 doesn't know the id, read the intent.
      // A timeout is a network problem, not an unknown id: don't spend another 20 s on the intent.
      if (err instanceof OpenfortTimeoutError || !id.startsWith('tin_')) throw err;
   }
   const intent = await withTimeout(openfort.transactionIntents.get(id), 'openfort_intent_get');
   const r = intent.response;
   if (r?.status === 1 && r.transactionHash) return { state: 'succeeded', txHash: r.transactionHash };
   if (r?.status === 0) return { state: 'failed', error: `reverted: ${errText(r.error)}`, txHash: r.transactionHash };
   if (r?.error) return { state: 'failed', error: errText(r.error), txHash: r.transactionHash };
   if (String((intent as { status?: unknown }).status ?? '') === 'expired') return { state: 'failed', error: 'expired', txHash: r?.transactionHash };
   return { state: 'pending' };
};

// ── status (admin panel, /idautopay) ─────────────────────────────────────────────────────────────
export type PayoutWalletStatus = {
   configured: boolean;
   address: string | null;
   usdc: number | null;
   usdt: number | null;
   bnb: number | null;
   autopay: 'on' | 'off';
   maxUsd: number;
   dailyCapUsd: number;
   paidTodayUsd: number;
};

export const payoutWalletStatus = async (svc: Svc, now = Date.now()): Promise<PayoutWalletStatus> => {
   const [creds, wallet, limits, paid] = await Promise.all([
      loadPayoutCreds(svc),
      getPayoutWallet(svc),
      getAutoPayLimits(svc),
      paidTodayUsd(svc, now)
   ]);
   let balance: WalletBalance | null = null;
   if (wallet) {
      try {
         balance = await balanceOf(wallet.address);
      } catch (err) {
         console.error('idPayoutWallet: balance read failed', err);
      }
   }
   return {
      configured: Boolean(creds),
      address: wallet?.address ?? null,
      usdc: balance ? balance.usdc : null,
      usdt: balance ? balance.usdt : null,
      bnb: balance ? balance.bnb : null,
      autopay: limits.autopay,
      maxUsd: limits.maxUsd,
      dailyCapUsd: limits.dailyCapUsd,
      paidTodayUsd: paid
   };
};
