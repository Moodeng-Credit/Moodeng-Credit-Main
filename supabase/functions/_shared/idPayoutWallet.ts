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
const BSC_RPCS = ['https://bsc-rpc.publicnode.com', 'https://bsc.drpc.org'];
const WALLET_IDEMPOTENCY_KEY = 'moodeng-id-payout-wallet-v1';

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
      const openfort = await openfortFor(creds);
      const account = await openfort.accounts.evm.backend.create({ idempotencyKey: WALLET_IDEMPOTENCY_KEY });
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

export type WalletBalance = { usdc: number; bnb: number; usdcUnits: bigint };

export const balanceOf = async (address: string): Promise<WalletBalance> => {
   const data = `0x70a08231${address.slice(2).toLowerCase().padStart(64, '0')}`;
   const [usdcHex, bnbHex] = await Promise.all([
      bscRpc<string>('eth_call', [{ to: BSC_USDC_CHECKSUM.toLowerCase(), data }, 'latest']),
      bscRpc<string>('eth_getBalance', [address, 'latest'])
   ]);
   const usdcUnits = BigInt(usdcHex && usdcHex !== '0x' ? usdcHex : '0x0');
   const bnbUnits = BigInt(bnbHex && bnbHex !== '0x' ? bnbHex : '0x0');
   return { usdc: unitsToUsd(usdcUnits), bnb: unitsToUsd(bnbUnits), usdcUnits };
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
 * transaction is created and signed, not when it lands: poll pollOpenfortTx. Throws on any failure
 * BEFORE an id exists (the caller then marks the payout failed and never retries on its own).
 */
export const sendUsdcBsc = async (svc: Svc, to: string, amountUsd: number | string): Promise<string> => {
   const creds = await loadPayoutCreds(svc);
   if (!creds) throw new Error('not_configured');
   const wallet = await getPayoutWallet(svc);
   if (!wallet) throw new Error('no_payout_wallet');
   const units = usdcBscUnits(amountUsd);
   const { getAddress } = await loadSdk();
   const data = encodeTransfer(getAddress(to), units);
   const openfort = await openfortFor(creds);
   const account = await openfort.accounts.evm.backend.get({ id: wallet.accountId });
   if (getAddress(account.address) !== getAddress(wallet.address)) throw new Error('payout_wallet_mismatch');
   const tx = await openfort.accounts.evm.backend.sendTransaction({
      account,
      chainId: BSC_CHAIN_ID,
      interactions: [{ to: BSC_USDC_CHECKSUM, data }],
      policy: creds.feeSponsorshipId,
      rpcUrl: BSC_RPCS[0]
   });
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
   const openfort = await openfortFor(creds);
   // v2 transactions first (status: submitted → succeeded | reverted | failed) …
   try {
      const t = await openfort.transactions.get(id);
      const hash = t.receipt?.transactionHash;
      if (t.status === 'succeeded') return hash ? { state: 'succeeded', txHash: hash } : { state: 'pending' };
      if (t.status === 'reverted' || t.status === 'failed')
         return { state: 'failed', error: `${t.status}: ${errText(t.receipt?.error)}`, txHash: hash };
      return { state: 'pending' };
   } catch (err) {
      // … sendTransaction hands back a transaction intent (tin_); if v2 doesn't know the id, read the intent.
      if (!id.startsWith('tin_')) throw err;
   }
   const intent = await openfort.transactionIntents.get(id);
   const r = intent.response;
   if (r?.status === 1 && r.transactionHash) return { state: 'succeeded', txHash: r.transactionHash };
   if (r?.status === 0) return { state: 'failed', error: `reverted: ${errText(r.error)}`, txHash: r.transactionHash };
   if (r?.error) return { state: 'failed', error: errText(r.error), txHash: r.transactionHash };
   return { state: 'pending' };
};

// ── status (admin panel, /idautopay) ─────────────────────────────────────────────────────────────
export type PayoutWalletStatus = {
   configured: boolean;
   address: string | null;
   usdc: number | null;
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
      bnb: balance ? balance.bnb : null,
      autopay: limits.autopay,
      maxUsd: limits.maxUsd,
      dailyCapUsd: limits.dailyCapUsd,
      paidTodayUsd: paid
   };
};
