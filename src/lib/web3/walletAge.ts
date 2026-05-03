// Queries Alchemy's Transfers API for wallet age AND liveness signals
// (first tx, total transfer count, most recent tx) across Ethereum mainnet
// + Base mainnet, giving a true multi-chain picture even if the user has
// never transacted on Base before.
//
// On testnet (Base Sepolia) only that chain is checked.
//
// Usage:
//   const info = await getWalletAgeInfo('0x...');
//   if (info) console.log(info.firstTxDate, info.ageInDays, info.totalTransferCount);
//
// Required env var:
//   VITE_ALCHEMY_API_KEY=your_key_here

import { base } from 'wagmi/chains';

import { ALLOWED_CHAIN_ID } from '@/config/wagmiConfig';

// ---------------------------------------------------------------------------
// Internal config
// ---------------------------------------------------------------------------

const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY ?? '';
const IS_MAINNET = ALLOWED_CHAIN_ID === base.id;

const MAINNET_RPC_URLS = [
   `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
   `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
];

const TESTNET_RPC_URLS = [`https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WalletAgeInfo {
   address: string;
   /** ISO 8601 timestamp of the first on-chain transaction across all checked chains */
   firstTxDate: string;
   /** Unix epoch seconds of the first on-chain transaction */
   firstTxTimestamp: number;
   /** How many days old the wallet is based on its first transaction */
   ageInDays: number;
   /** false when the wallet has no transaction history at all */
   hasHistory: boolean;
   /**
    * Approximate total number of asset transfers summed across all checked
    * chains and directions (from + to).  Capped at 400 — use as a rough
    * activity bucket, not a precise count.
    */
   totalTransferCount: number;
   /** True when at least one chain/direction returned a pageKey (> 100 transfers there) */
   hasMoreThan100Transfers: boolean;
   /** ISO 8601 timestamp of the most recent on-chain transfer */
   lastTxDate: string;
   /** Unix epoch seconds of the most recent on-chain transfer */
   lastTxTimestamp: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Result of a single alchemy_getAssetTransfers call */
interface TransferResult {
   earliestTimestamp: number | null;
   latestTimestamp: number | null;
   count: number;
   hasMore: boolean;
}

/**
 * Fetches transfer data for one direction on one chain.
 * Makes two parallel calls:
 *   - ascending  (maxCount 1):  cheaply finds the earliest tx timestamp
 *   - descending (maxCount 100): finds the latest tx + rough count
 */
async function fetchTransferData(
   rpcUrl: string,
   address: string,
   direction: 'from' | 'to'
): Promise<TransferResult> {
   const param = direction === 'from' ? 'fromAddress' : 'toAddress';
   const baseParams = {
      fromBlock: '0x0',
      toBlock: 'latest',
      [param]: address,
      category: ['external', 'internal', 'erc20'],
      withMetadata: true
   };

   const ascBody = JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'alchemy_getAssetTransfers',
      params: [{ ...baseParams, maxCount: '0x1', order: 'asc' }]
   });

   const descBody = JSON.stringify({
      id: 2,
      jsonrpc: '2.0',
      method: 'alchemy_getAssetTransfers',
      params: [{ ...baseParams, maxCount: '0x64', order: 'desc' }]
   });

   type AlchemyResponse = {
      result?: {
         transfers: Array<{ metadata?: { blockTimestamp?: string } }>;
         pageKey?: string;
      };
   };

   const fetchOne = async (body: string): Promise<AlchemyResponse | null> => {
      try {
         const res = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body
         });
         if (!res.ok) return null;
         return (await res.json()) as AlchemyResponse;
      } catch {
         return null;
      }
   };

   const tsOf = (item: { metadata?: { blockTimestamp?: string } } | undefined): number | null => {
      const raw = item?.metadata?.blockTimestamp;
      if (!raw) return null;
      const ms = new Date(raw).getTime();
      return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
   };

   const [ascJson, descJson] = await Promise.all([fetchOne(ascBody), fetchOne(descBody)]);

   const earliest = tsOf(ascJson?.result?.transfers?.[0]);
   const descTransfers = descJson?.result?.transfers ?? [];
   const latest = tsOf(descTransfers[0]);
   const count = descTransfers.length;
   const hasMore = !!descJson?.result?.pageKey;

   return { earliestTimestamp: earliest, latestTimestamp: latest, count, hasMore };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns age and liveness info for an EVM wallet.
 *
 * Liveness signals (totalTransferCount, lastTxDate) are used by the
 * lender diversity fraud model to distinguish:
 *   - Old active wallet  → low suspicion (real crypto person)
 *   - Old dormant wallet → high suspicion (pre-aged sybil account)
 *   - New active wallet  → moderate suspicion
 *   - New inactive wallet → maximum suspicion
 *
 * Returns null on invalid address or missing VITE_ALCHEMY_API_KEY.
 * Always fails silently — callers fall back to Moodeng account createdAt.
 */
export async function getWalletAgeInfo(address: string): Promise<WalletAgeInfo | null> {
   if (!address || !address.startsWith('0x') || address.length !== 42) return null;
   if (!ALCHEMY_API_KEY) return null;

   const rpcUrls = IS_MAINNET ? MAINNET_RPC_URLS : TESTNET_RPC_URLS;

   // Query all chains × both directions in parallel
   const results = await Promise.all(
      rpcUrls.flatMap((url) => [
         fetchTransferData(url, address, 'from'),
         fetchTransferData(url, address, 'to')
      ])
   );

   // Aggregate across all chains and directions
   const allEarliest = results.map((r) => r.earliestTimestamp).filter((t): t is number => t !== null);
   const allLatest = results.map((r) => r.latestTimestamp).filter((t): t is number => t !== null);
   const totalTransferCount = results.reduce((sum, r) => sum + r.count, 0);
   const hasMoreThan100Transfers = results.some((r) => r.hasMore);

   const nowSec = Math.floor(Date.now() / 1000);

   if (allEarliest.length === 0) {
      // Wallet has no history on any checked chain
      return {
         address,
         firstTxDate: new Date().toISOString(),
         firstTxTimestamp: nowSec,
         ageInDays: 0,
         hasHistory: false,
         totalTransferCount: 0,
         hasMoreThan100Transfers: false,
         lastTxDate: new Date().toISOString(),
         lastTxTimestamp: nowSec
      };
   }

   const firstTxTimestamp = Math.min(...allEarliest);
   const lastTxTimestamp = allLatest.length > 0 ? Math.max(...allLatest) : firstTxTimestamp;

   return {
      address,
      firstTxDate: new Date(firstTxTimestamp * 1000).toISOString(),
      firstTxTimestamp,
      ageInDays: Math.floor((nowSec - firstTxTimestamp) / 86400),
      hasHistory: true,
      totalTransferCount,
      hasMoreThan100Transfers,
      lastTxDate: new Date(lastTxTimestamp * 1000).toISOString(),
      lastTxTimestamp
   };
}

/** Convenience helper — wallet age in days, 0 if no history or on error. */
export async function getWalletAgeDays(address: string): Promise<number> {
   const info = await getWalletAgeInfo(address);
   return info?.ageInDays ?? 0;
}

/**
 * Returns true if the wallet should be considered "new" from a
 * fraud-detection perspective.
 */
export async function isNewWallet(address: string, thresholdDays = 30): Promise<boolean> {
   const ageDays = await getWalletAgeDays(address);
   return ageDays < thresholdDays;
}
