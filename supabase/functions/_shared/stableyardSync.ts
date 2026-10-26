// Mirrors Stableyard accounts, deposit addresses and deposits into our tables.
// Shared by stableyard-deposit-address (user asks for addresses / refreshes) and stableyard-webhook
// (Stableyard tells us a deposit changed). Stableyard is the source of truth: an event is only a
// prompt to re-read GET /v2/accounts/{id}/deposits, so both paths go through syncDeposits().
import { postDiscord } from './discord.ts';
import { stableyard, type StableyardDeposit, type StableyardDepositAddress, type StableyardDepositNetwork } from './stableyard.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export const BASE_CHAIN_ID = 8453;

// Chains we offer by default, in display order: the networks PH/ID exchanges most often withdraw on.
// Base itself is left out — on Base the user sends straight to their own wallet, no conversion needed.
// Override with STABLEYARD_DEPOSIT_CHAIN_IDS="728126428,56,…".
export const DEFAULT_DEPOSIT_CHAIN_IDS = [
   728126428 /* Tron */, 56 /* BNB */, 10103 /* Solana */, 42161 /* Arbitrum */, 137 /* Polygon */, 1 /* Ethereum */
];

const STABLE_SYMBOLS = new Set(['USDC', 'USDT']);

export const configuredDepositChainIds = (): number[] => {
   const raw = Deno.env.get('STABLEYARD_DEPOSIT_CHAIN_IDS')?.trim();
   if (!raw) return DEFAULT_DEPOSIT_CHAIN_IDS;
   const ids = raw
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((id) => Number.isSafeInteger(id) && id > 0);
   return ids.length ? ids : DEFAULT_DEPOSIT_CHAIN_IDS;
};

export type AddressAsset = { symbol: string; tokenAddress: string; decimals: number; minimum: string | null };

const minimumOf = (asset: { minimumDeposit?: { amount: string } | string | null }) =>
   typeof asset.minimumDeposit === 'string' ? asset.minimumDeposit : (asset.minimumDeposit?.amount ?? null);

/** Live networks from the catalog that we want, in our order, each with its stablecoin assets. */
export const pickDepositNetworks = (networks: StableyardDepositNetwork[], wanted: number[]) =>
   wanted
      .map((chainId) => networks.find((network) => network.chainId === chainId))
      .filter((network): network is StableyardDepositNetwork => Boolean(network && network.live))
      .map((network) => ({
         chainId: network.chainId,
         code: network.code,
         chainFamily: network.chainFamily,
         assets: (network.supportedAssets ?? [])
            .filter((asset) => STABLE_SYMBOLS.has(asset.symbol))
            .map<AddressAsset>((asset) => ({
               symbol: asset.symbol,
               tokenAddress: asset.tokenAddress,
               decimals: asset.decimals,
               minimum: minimumOf(asset)
            }))
      }))
      .filter((network) => network.assets.length > 0);

/** Row for stableyard_deposit_addresses. Minimums come from the catalog (the address payload has none). */
export const depositAddressRow = (userId: string, address: StableyardDepositAddress, catalog: ReturnType<typeof pickDepositNetworks>) => {
   const network = catalog.find((entry) => entry.chainId === address.chainId);
   const assets: AddressAsset[] = (address.supportedAssets ?? [])
      .filter((asset) => STABLE_SYMBOLS.has(asset.symbol))
      .map((asset) => ({
         symbol: asset.symbol,
         tokenAddress: asset.tokenAddress,
         decimals: asset.decimals,
         minimum: network?.assets.find((entry) => entry.symbol === asset.symbol)?.minimum ?? null
      }));
   return {
      id: address.id,
      user_id: userId,
      account_id: address.accountId,
      chain_id: address.chainId,
      network_code: address.metadata?.networkCode ?? network?.code ?? null,
      chain_family: address.metadata?.chainFamily ?? network?.chainFamily ?? null,
      address: address.address,
      assets,
      status: address.status,
      updated_at: new Date().toISOString()
   };
};

/** Row for stableyard_deposits. */
export const depositRow = (userId: string, deposit: StableyardDeposit) => ({
   id: deposit.id,
   user_id: userId,
   account_id: deposit.accountId,
   deposit_address_id: deposit.depositAddressId ?? null,
   status: deposit.status,
   source_chain_id: deposit.amount?.asset?.chainId ?? null,
   asset_symbol: deposit.amount?.asset?.symbol ?? null,
   asset_decimals: deposit.amount?.asset?.decimals ?? null,
   amount_atomic: deposit.amount?.amount ?? null,
   net_amount_atomic: deposit.netSettlementAmount?.amount ?? null,
   net_asset_symbol: deposit.netSettlementAmount?.asset?.symbol ?? null,
   net_asset_decimals: deposit.netSettlementAmount?.asset?.decimals ?? null,
   source_tx_hash: deposit.sourceTransfer?.txHash ?? deposit.txHash ?? null,
   settlement_tx_hash: deposit.settlement?.txHash ?? null,
   settlement_status: deposit.settlement?.status ?? null,
   settlement_reason: deposit.settlement?.reasonCode ?? null,
   observed_at: deposit.observedAt ?? null,
   settled_at: deposit.settledAt ?? deposit.settlement?.settledAt ?? null,
   raw: deposit,
   updated_at: new Date().toISOString()
});

/** "12.5 USDT" from atomic units, without floating point. */
export const formatAtomic = (atomic: string | null | undefined, decimals: number | null | undefined, symbol?: string | null) => {
   if (!atomic || decimals === null || decimals === undefined || !/^\d+$/.test(atomic)) return symbol ? `? ${symbol}` : '?';
   const padded = atomic.padStart(decimals + 1, '0');
   const whole = padded.slice(0, padded.length - decimals);
   const fraction = decimals ? padded.slice(-decimals).replace(/0+$/, '') : '';
   return `${whole}${fraction ? `.${fraction}` : ''}${symbol ? ` ${symbol}` : ''}`;
};

/**
 * Re-read the account's deposits from Stableyard and upsert them. Posts one team alert per deposit
 * the first time it settles or needs a person. Returns the deposits as stored.
 */
export const syncDeposits = async (admin: SupabaseClient, userId: string, accountId: string) => {
   const result = await stableyard.listDeposits(accountId);
   if (!result.ok) {
      console.error('[stableyard] listDeposits failed', result.status, result.code ?? '', result.error);
      return { ok: false as const, error: result.error };
   }
   const deposits = result.data.deposits ?? [];
   if (!deposits.length) return { ok: true as const, deposits: [] };

   const { data: before } = await admin
      .from('stableyard_deposits')
      .select('id, status, notified_at')
      .in(
         'id',
         deposits.map((deposit) => deposit.id)
      );
   const previous = new Map<string, { status: string; notified_at: string | null }>(
      (before ?? []).map((row: { id: string; status: string; notified_at: string | null }) => [row.id, row])
   );

   const rows = deposits.map((deposit) => depositRow(userId, deposit));
   const { error } = await admin.from('stableyard_deposits').upsert(rows, { onConflict: 'id' });
   if (error) {
      console.error('[stableyard] upsert deposits failed', error.message);
      return { ok: false as const, error: error.message };
   }

   for (const row of rows) {
      const prior = previous.get(row.id);
      if (prior?.status === row.status) continue;
      if (row.status === 'settled' && !prior?.notified_at) {
         await postDiscord(
            {
               content: `💱 Stableyard deposit settled: ${formatAtomic(row.amount_atomic, row.asset_decimals, row.asset_symbol)} on chain ${row.source_chain_id} → ${formatAtomic(row.net_amount_atomic, row.net_asset_decimals, row.net_asset_symbol)} to user ${userId}'s wallet`
            },
            { prefer: ['DISCORD_REPAY_WEBHOOK_URL'] }
         );
         await admin.from('stableyard_deposits').update({ notified_at: new Date().toISOString() }).eq('id', row.id);
      } else if (row.status === 'requires_intervention' || row.status === 'failed' || row.status === 'reversed') {
         await postDiscord(
            {
               content: `⚠️ Stableyard deposit ${row.id} is ${row.status}${row.settlement_reason ? ` (${row.settlement_reason})` : ''}: ${formatAtomic(row.amount_atomic, row.asset_decimals, row.asset_symbol)} for user ${userId}. Check the Stableyard Partner Dashboard.`
            },
            { prefer: ['DISCORD_REPAY_WEBHOOK_URL'] }
         );
      }
   }
   return { ok: true as const, deposits: rows };
};
