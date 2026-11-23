// Self-paid gas for Instant Wallets.
//
// Openfort's gas credit kept vanishing (2026-11-22/23), so Instant Wallet sends could stop asking
// Openfort's paymaster to pay. The borrower's smart account then pays its own gas in ETH. Right
// before a send, the client calls openfort-shield-session with {action:"gas_prep"} and we drip a few
// cents of ETH from a Moodeng hot wallet (vault OPENFORT_GAS_WALLET) into the caller's OWN stored
// Instant Wallet when it's low. The client sends without the paymaster only when we answer
// mode "self".
//
// It's a faucet, so: only the caller's own wallet_address with wallet_provider 'openfort', only
// below a threshold, per-user and global daily caps, every drip logged in gas_drips.
//
// Switch + knobs: telegram_bot_settings.openfort_self_gas (see 20261123100000_openfort_self_gas.sql).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendTelegramMessage } from './telegram.ts';

const BASE_RPC = 'https://mainnet.base.org';
const SETTING_KEY = 'openfort_self_gas';
const ALERTED_AT_KEY = 'openfort_self_gas_alerted_at';
const ALERT_DEBOUNCE_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Defaults, all overridable from the setting. Base gas is ~0.006 gwei and a sponsored send listed at
// $0.002–0.006, so 0.00003 ETH (~$0.05) covers several sends; the threshold leaves room for the
// ERC-4337 prefund (gas limits × max fee), which is more than the gas actually used.
const DEFAULT_MIN_WEI = 10_000_000_000_000n; // 0.00001 ETH
const DEFAULT_DRIP_WEI = 30_000_000_000_000n; // 0.00003 ETH
const DEFAULT_PER_USER_DAILY = 3;
const DEFAULT_GLOBAL_DAILY = 60;
// Alert the team when the hot wallet can cover fewer than ~15 more drips.
const LOW_WALLET_DRIPS = 15n;

export type SelfGasConfig = {
   mode: 'off' | 'test' | 'all';
   userIds: string[];
   minWei: bigint;
   dripWei: bigint;
   perUserDaily: number;
   globalDaily: number;
};

export type GasPrepResult = {
   mode: 'self' | 'sponsored';
   topped_up?: boolean;
   tx_hash?: string;
   reason?: string;
   balance_wei?: string;
};

const toBigInt = (value: unknown, fallback: bigint): bigint => {
   try {
      if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return BigInt(Math.floor(value));
   } catch {
      // fall through
   }
   return fallback;
};

const toCount = (value: unknown, fallback: number): number =>
   typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;

export const parseSelfGasConfig = (raw: string | null | undefined): SelfGasConfig => {
   let j: Record<string, unknown> = {};
   try {
      const parsed = JSON.parse(raw ?? '');
      if (parsed && typeof parsed === 'object') j = parsed as Record<string, unknown>;
   } catch {
      // Missing or broken setting → off (Openfort keeps paying, i.e. today's behaviour).
   }
   const mode = j.mode === 'all' || j.mode === 'test' ? j.mode : 'off';
   return {
      mode,
      userIds: Array.isArray(j.user_ids) ? j.user_ids.filter((id): id is string => typeof id === 'string') : [],
      minWei: toBigInt(j.min_wei, DEFAULT_MIN_WEI),
      dripWei: toBigInt(j.drip_wei, DEFAULT_DRIP_WEI),
      perUserDaily: toCount(j.per_user_daily, DEFAULT_PER_USER_DAILY),
      globalDaily: toCount(j.global_daily, DEFAULT_GLOBAL_DAILY)
   };
};

export const userSelfPays = (cfg: SelfGasConfig, userId: string): boolean =>
   cfg.mode === 'all' || (cfg.mode === 'test' && cfg.userIds.includes(userId));

const getSetting = async (svc: SupabaseClient, key: string): Promise<string> => {
   const { data } = await svc.from('telegram_bot_settings').select('value').eq('key', key).maybeSingle();
   return ((data as { value?: string } | null)?.value ?? '').trim();
};

const loadViem = async () => {
   const viem = await import('npm:viem@2');
   const accounts = await import('npm:viem@2/accounts');
   const chains = await import('npm:viem@2/chains');
   return { viem, accounts, chains };
};

/** The hot wallet's account. Creates and stores the key on first use, so it never leaves the server. */
const getGasAccount = async (svc: SupabaseClient) => {
   const { accounts } = await loadViem();
   const read = async () => {
      const { data, error } = await svc.rpc('gas_wallet_key');
      if (error) throw new Error(`gas_wallet_key: ${error.message}`);
      return typeof data === 'string' && /^0x[0-9a-fA-F]{64}$/.test(data.trim()) ? (data.trim() as `0x${string}`) : null;
   };
   let key = await read();
   if (!key) {
      const { error } = await svc.rpc('set_gas_wallet_key', { p_key: accounts.generatePrivateKey() });
      if (error) throw new Error(`set_gas_wallet_key: ${error.message}`);
      // Re-read rather than trusting our own key: a racing call may have stored its key first.
      key = await read();
      if (!key) throw new Error('gas wallet key missing after create');
   }
   return accounts.privateKeyToAccount(key);
};

const clients = async () => {
   const { viem, chains } = await loadViem();
   const transport = viem.http(BASE_RPC);
   return { viem, chain: chains.base, publicClient: viem.createPublicClient({ chain: chains.base, transport }), transport };
};

/** Address + ETH balance of the hot wallet (creates the key if there isn't one yet). */
export const gasWalletStatus = async (svc: SupabaseClient) => {
   const account = await getGasAccount(svc);
   const { publicClient, viem } = await clients();
   const balance = await publicClient.getBalance({ address: account.address });
   const cfg = parseSelfGasConfig(await getSetting(svc, SETTING_KEY));
   return {
      address: account.address,
      balance_wei: balance.toString(),
      balance_eth: viem.formatEther(balance),
      drips_left: cfg.dripWei > 0n ? (balance / cfg.dripWei).toString() : null,
      config: { ...cfg, minWei: cfg.minWei.toString(), dripWei: cfg.dripWei.toString() }
   };
};

const maybeAlertLowWallet = async (svc: SupabaseClient, address: string, balance: bigint, cfg: SelfGasConfig, ethText: string) => {
   if (balance >= cfg.dripWei * LOW_WALLET_DRIPS) return;
   const last = Number.parseInt(await getSetting(svc, ALERTED_AT_KEY), 10);
   if (Number.isFinite(last) && Date.now() - last < ALERT_DEBOUNCE_MS) return;
   const chatId = await getSetting(svc, 'kyc_alert_chat_id');
   if (!chatId) return;
   await sendTelegramMessage(
      chatId,
      `⛽ <b>Moodeng gas wallet is low</b>: ${ethText} ETH left.\n` +
         `Instant Wallet repays and cash-outs pay gas from it. Send a few dollars of ETH on <b>Base</b> to:\n<code>${address}</code>`
   ).catch((err) => console.error('[selfGas] low-wallet alert failed', err));
   await svc.from('telegram_bot_settings').upsert({ key: ALERTED_AT_KEY, value: String(Date.now()) }, { onConflict: 'key' });
};

/**
 * Decide how the caller's next Instant Wallet send pays gas, topping their wallet up first when
 * they self-pay. Never throws for a drip problem: the answer is still "self" (Openfort's credit is
 * the thing that's broken), and the send itself reports any shortfall.
 */
export const prepareGas = async (svc: SupabaseClient, userId: string): Promise<GasPrepResult> => {
   const cfg = parseSelfGasConfig(await getSetting(svc, SETTING_KEY));
   if (!userSelfPays(cfg, userId)) return { mode: 'sponsored' };

   const { data: profile } = await svc.from('users').select('wallet_address, wallet_provider').eq('id', userId).maybeSingle();
   const wallet = (profile as { wallet_address?: string | null; wallet_provider?: string | null } | null) ?? null;
   if (!wallet?.wallet_address || wallet.wallet_provider !== 'openfort' || !/^0x[0-9a-fA-F]{40}$/.test(wallet.wallet_address)) {
      return { mode: 'self', topped_up: false, reason: 'no_instant_wallet' };
   }
   const to = wallet.wallet_address as `0x${string}`;

   try {
      const { viem, chain, publicClient, transport } = await clients();
      const balance = await publicClient.getBalance({ address: to });
      if (balance >= cfg.minWei) return { mode: 'self', topped_up: false, balance_wei: balance.toString() };

      const since = new Date(Date.now() - DAY_MS).toISOString();
      const { count: userCount } = await svc
         .from('gas_drips')
         .select('id', { count: 'exact', head: true })
         .eq('user_id', userId)
         .gte('created_at', since);
      if ((userCount ?? 0) >= cfg.perUserDaily) return { mode: 'self', topped_up: false, reason: 'user_daily_cap', balance_wei: balance.toString() };
      const { count: globalCount } = await svc.from('gas_drips').select('id', { count: 'exact', head: true }).gte('created_at', since);
      if ((globalCount ?? 0) >= cfg.globalDaily) {
         console.error('[selfGas] global daily drip cap reached');
         return { mode: 'self', topped_up: false, reason: 'global_daily_cap', balance_wei: balance.toString() };
      }

      const account = await getGasAccount(svc);
      // Claim the slot before sending so the caps hold even if the send then fails.
      const { data: row } = await svc
         .from('gas_drips')
         .insert({ user_id: userId, wallet_address: to, amount_wei: cfg.dripWei.toString() })
         .select('id')
         .single();

      const walletClient = viem.createWalletClient({ account, chain, transport });
      const hash = await walletClient.sendTransaction({ to, value: cfg.dripWei });
      if (row?.id) await svc.from('gas_drips').update({ tx_hash: hash }).eq('id', row.id);
      // Wait for it to land: Openfort estimates the send against on-chain balance.
      await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });

      const left = await publicClient.getBalance({ address: account.address });
      await maybeAlertLowWallet(svc, account.address, left, cfg, viem.formatEther(left));
      console.log(JSON.stringify({ evt: 'gas_drip', userId, to, wei: cfg.dripWei.toString(), hash }));
      return { mode: 'self', topped_up: true, tx_hash: hash };
   } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[selfGas] drip failed', message);
      if (/insufficient funds|exceeds the balance/i.test(message)) {
         const account = await getGasAccount(svc).catch(() => null);
         if (account) await maybeAlertLowWallet(svc, account.address, 0n, cfg, '0');
      }
      return { mode: 'self', topped_up: false, reason: 'drip_failed' };
   }
};
