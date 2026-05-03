// Queries Basescan for the first on-chain transaction of an EVM wallet address.
// Works on Base mainnet and Base Sepolia testnet.
// Free-tier Basescan: 5 req/s, 100 k req/day — more than sufficient for this app.
//
// Usage:
//   const age = await getWalletAgeInfo('0x...');
//   if (age) console.log(age.firstTxDate, age.ageInDays);
//
// Env var (optional — works without key at lower rate limit):
//   VITE_BASESCAN_API_KEY=your_key_here

import { base } from 'wagmi/chains';

import { ALLOWED_CHAIN_ID } from '@/config/wagmiConfig';

// ---------------------------------------------------------------------------
// Internal config
// ---------------------------------------------------------------------------

const BASESCAN_API_KEY = import.meta.env.VITE_BASESCAN_API_KEY ?? '';

function getBasescanApiUrl(): string {
   // Base mainnet → api.basescan.org
   // Base Sepolia (or any other chain id) → api-sepolia.basescan.org
   if (ALLOWED_CHAIN_ID === base.id) {
      return 'https://api.basescan.org/api';
   }
   return 'https://api-sepolia.basescan.org/api';
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WalletAgeInfo {
   /** The queried wallet address */
   address: string;
   /** ISO 8601 timestamp of the first on-chain transaction */
   firstTxDate: string;
   /** Unix epoch seconds of the first on-chain transaction */
   firstTxTimestamp: number;
   /** How many days old the wallet is (based on first tx) */
   ageInDays: number;
   /**
    * false when the wallet has no transaction history at all.
    * A brand-new wallet counts as 0 days old.
    */
   hasHistory: boolean;
}

// ---------------------------------------------------------------------------
// Main helpers
// ---------------------------------------------------------------------------

/**
 * Returns age info for an EVM wallet based on its first on-chain transaction
 * on Base (mainnet or Sepolia, driven by VITE_ALLOWED_CHAIN_NAME).
 *
 * Returns null on network error or invalid address — always fails silently
 * so callers can proceed without wallet age data.
 *
 * A wallet with no history returns hasHistory: false and ageInDays: 0.
 */
export async function getWalletAgeInfo(address: string): Promise<WalletAgeInfo | null> {
   if (!address || !address.startsWith('0x') || address.length !== 42) return null;

   const url = new URL(getBasescanApiUrl());
   url.searchParams.set('module', 'account');
   url.searchParams.set('action', 'txlist');
   url.searchParams.set('address', address);
   url.searchParams.set('startblock', '0');
   url.searchParams.set('endblock', '99999999');
   url.searchParams.set('page', '1');
   url.searchParams.set('offset', '1'); // only need the very first tx
   url.searchParams.set('sort', 'asc');
   if (BASESCAN_API_KEY) url.searchParams.set('apikey', BASESCAN_API_KEY);

   try {
      const res = await fetch(url.toString());
      if (!res.ok) return null;

      const json = (await res.json()) as {
         status: string;
         message: string;
         result: Array<{ timeStamp: string }>;
      };

      // status '0' = no transactions found (brand-new wallet)
      if (json.status !== '1' || !Array.isArray(json.result) || json.result.length === 0) {
         return {
            address,
            firstTxDate: new Date().toISOString(),
            firstTxTimestamp: Math.floor(Date.now() / 1000),
            ageInDays: 0,
            hasHistory: false
         };
      }

      const firstTxTimestamp = parseInt(json.result[0].timeStamp, 10);
      const firstTxDate = new Date(firstTxTimestamp * 1000).toISOString();
      const ageInDays = Math.floor((Date.now() / 1000 - firstTxTimestamp) / 86400);

      return {
         address,
         firstTxDate,
         firstTxTimestamp,
         ageInDays,
         hasHistory: true
      };
   } catch {
      // Network error, rate limit, JSON parse failure — fail silently
      return null;
   }
}

/**
 * Convenience helper — returns just the wallet age in days.
 * Returns 0 if the wallet has no history, the address is invalid,
 * or the API call fails.
 */
export async function getWalletAgeDays(address: string): Promise<number> {
   const info = await getWalletAgeInfo(address);
   return info?.ageInDays ?? 0;
}

/**
 * Checks whether a wallet should be considered "new" (i.e. suspicious
 * from a fraud-detection perspective).
 *
 * @param address  - EVM wallet address
 * @param thresholdDays - Age below which a wallet is flagged as new (default 30)
 */
export async function isNewWallet(address: string, thresholdDays = 30): Promise<boolean> {
   const ageDays = await getWalletAgeDays(address);
   return ageDays < thresholdDays;
}
