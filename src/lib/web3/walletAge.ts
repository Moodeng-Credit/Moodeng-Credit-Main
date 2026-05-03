// Queries Alchemy's Transfers API for the first on-chain transaction of an EVM
// wallet address across Ethereum mainnet + Base mainnet, giving a true
// multi-chain wallet age even if the user has never transacted on Base before.
//
// On testnet (Base Sepolia) only that chain is checked — wallet age is not
// meaningful in a test environment anyway.
//
// Usage:
//   const age = await getWalletAgeInfo('0x...');
//   if (age) console.log(age.firstTxDate, age.ageInDays);
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

// On mainnet we check both Ethereum and Base to catch wallets with history
// on other chains that are new to Base.
const MAINNET_RPC_URLS = [
   `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
   `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
];

const TESTNET_RPC_URLS = [`https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WalletAgeInfo {
   /** The queried wallet address */
   address: string;
   /** ISO 8601 timestamp of the first on-chain transaction across all checked chains */
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
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fetches the earliest transfer timestamp for one direction (from/to) on one chain.
 * Returns null if no transfers found or on any error.
 */
async function fetchEarliestTransfer(
   rpcUrl: string,
   address: string,
   direction: 'from' | 'to'
): Promise<number | null> {
   const param = direction === 'from' ? 'fromAddress' : 'toAddress';

   const body = {
      id: 1,
      jsonrpc: '2.0',
      method: 'alchemy_getAssetTransfers',
      params: [
         {
            fromBlock: '0x0',
            toBlock: 'latest',
            [param]: address,
            category: ['external', 'internal', 'erc20'],
            maxCount: '0x1',
            order: 'asc',
            withMetadata: true
         }
      ]
   };

   try {
      const res = await fetch(rpcUrl, {
         method: 'POST',
         headers: { 'content-type': 'application/json' },
         body: JSON.stringify(body)
      });
      if (!res.ok) return null;

      const json = (await res.json()) as {
         result?: { transfers: Array<{ metadata?: { blockTimestamp?: string } }> };
      };

      const transfers = json.result?.transfers;
      if (!transfers || transfers.length === 0) return null;

      const ts = transfers[0].metadata?.blockTimestamp;
      if (!ts) return null;

      return Math.floor(new Date(ts).getTime() / 1000);
   } catch {
      return null;
   }
}

/**
 * Returns the earliest known transaction timestamp for a wallet on a single chain,
 * checking both incoming and outgoing transfers in parallel.
 */
async function getEarliestTimestampOnChain(rpcUrl: string, address: string): Promise<number | null> {
   const [incoming, outgoing] = await Promise.all([
      fetchEarliestTransfer(rpcUrl, address, 'to'),
      fetchEarliestTransfer(rpcUrl, address, 'from')
   ]);

   const found = [incoming, outgoing].filter((t): t is number => t !== null);
   return found.length > 0 ? Math.min(...found) : null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns age info for an EVM wallet based on its earliest known on-chain
 * transaction. On mainnet, checks both Ethereum and Base so wallets with
 * years of ETH history but new to Base still show their true age.
 *
 * Returns null on invalid address or if VITE_ALCHEMY_API_KEY is missing.
 * Always fails silently — callers should fall back to account createdAt.
 *
 * A wallet with no history on any chain returns hasHistory: false, ageInDays: 0.
 */
export async function getWalletAgeInfo(address: string): Promise<WalletAgeInfo | null> {
   if (!address || !address.startsWith('0x') || address.length !== 42) return null;
   if (!ALCHEMY_API_KEY) return null;

   const rpcUrls = IS_MAINNET ? MAINNET_RPC_URLS : TESTNET_RPC_URLS;

   // Query all chains in parallel, take the earliest timestamp found
   const timestamps = await Promise.all(rpcUrls.map((url) => getEarliestTimestampOnChain(url, address)));
   const found = timestamps.filter((t): t is number => t !== null);

   if (found.length === 0) {
      return {
         address,
         firstTxDate: new Date().toISOString(),
         firstTxTimestamp: Math.floor(Date.now() / 1000),
         ageInDays: 0,
         hasHistory: false
      };
   }

   const firstTxTimestamp = Math.min(...found);
   const firstTxDate = new Date(firstTxTimestamp * 1000).toISOString();
   const ageInDays = Math.floor((Date.now() / 1000 - firstTxTimestamp) / 86400);

   return {
      address,
      firstTxDate,
      firstTxTimestamp,
      ageInDays,
      hasHistory: true
   };
}

/**
 * Convenience helper — returns just the wallet age in days.
 * Returns 0 if the wallet has no history, address is invalid,
 * or the API key is missing.
 */
export async function getWalletAgeDays(address: string): Promise<number> {
   const info = await getWalletAgeInfo(address);
   return info?.ageInDays ?? 0;
}

/**
 * Returns true if the wallet should be considered "new" from a
 * fraud-detection perspective.
 *
 * @param address       - EVM wallet address
 * @param thresholdDays - Age below which wallet is flagged as new (default 30)
 */
export async function isNewWallet(address: string, thresholdDays = 30): Promise<boolean> {
   const ageDays = await getWalletAgeDays(address);
   return ageDays < thresholdDays;
}
