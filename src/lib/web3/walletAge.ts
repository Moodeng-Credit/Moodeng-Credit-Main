const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY ?? '';

const CHAINS = [
   { rpcUrl: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}` }
];

export interface WalletAgeInfo {
   address: string;
   firstTxDate: string;
   firstTxTimestamp: number;
   ageInDays: number;
   hasHistory: boolean;
   totalTransferCount: number;
   hasMoreThan100Transfers: boolean;
   lastTxDate: string;
   lastTxTimestamp: number;
}

const WALLET_AGE_CACHE_TTL_MS = 10 * 60 * 1000;
const walletAgeCache = new Map<string, { info: WalletAgeInfo | null; fetchedAt: number }>();
const walletAgeRequests = new Map<string, Promise<WalletAgeInfo | null>>();

interface TransferData {
   earliestTimestamp: number | null;
   latestTimestamp: number | null;
   count: number;
   hasMore: boolean;
}

interface AlchemyTransferResponse {
   result?: {
      pageKey?: string;
      transfers?: Array<{ metadata?: { blockTimestamp?: string } }>;
   };
}

async function fetchTransferData(rpcUrl: string, address: string, direction: 'from' | 'to'): Promise<TransferData> {
   const key = direction === 'from' ? 'fromAddress' : 'toAddress';
   const params = {
      [key]: address,
      withMetadata: true,
      excludeZeroValue: false
   };

   const [ascRes, descRes] = await Promise.all([
      fetch(rpcUrl, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'alchemy_getAssetTransfers',
            params: [{ ...params, order: 'asc', maxCount: '0x1' }]
         })
      }),
      fetch(rpcUrl, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'alchemy_getAssetTransfers',
            params: [{ ...params, order: 'desc', maxCount: '0x64' }]
         })
      })
   ]);

   const [ascData, descData] = (await Promise.all([ascRes.json(), descRes.json()])) as [AlchemyTransferResponse, AlchemyTransferResponse];
   const ascTransfers = ascData.result?.transfers ?? [];
   const descTransfers = descData.result?.transfers ?? [];
   const toSeconds = (iso: string | undefined) => (iso ? Math.floor(new Date(iso).getTime() / 1000) : null);

   return {
      earliestTimestamp: toSeconds(ascTransfers[0]?.metadata?.blockTimestamp),
      latestTimestamp: toSeconds(descTransfers[0]?.metadata?.blockTimestamp),
      count: descData.result?.pageKey ? 100 : descTransfers.length,
      hasMore: Boolean(descData.result?.pageKey)
   };
}

async function fetchWalletAgeInfo(address: string): Promise<WalletAgeInfo | null> {
   if (!ALCHEMY_API_KEY) return null;
   if (!address?.startsWith('0x') || address.length !== 42) return null;

   try {
      const results = await Promise.all(
         CHAINS.flatMap((chain) => [fetchTransferData(chain.rpcUrl, address, 'from'), fetchTransferData(chain.rpcUrl, address, 'to')])
      );

      let earliestTimestamp: number | null = null;
      let latestTimestamp: number | null = null;
      let totalTransferCount = 0;
      let hasMoreThan100Transfers = false;

      for (const result of results) {
         if (result.earliestTimestamp !== null && (earliestTimestamp === null || result.earliestTimestamp < earliestTimestamp)) {
            earliestTimestamp = result.earliestTimestamp;
         }
         if (result.latestTimestamp !== null && (latestTimestamp === null || result.latestTimestamp > latestTimestamp)) {
            latestTimestamp = result.latestTimestamp;
         }
         totalTransferCount += result.count;
         hasMoreThan100Transfers = hasMoreThan100Transfers || result.hasMore;
      }

      const nowSeconds = Date.now() / 1000;
      const hasHistory = earliestTimestamp !== null;
      const firstTimestamp = earliestTimestamp ?? nowSeconds;
      const lastTimestamp = latestTimestamp ?? nowSeconds;
      const toDateString = (timestamp: number) => new Date(timestamp * 1000).toISOString().split('T')[0];

      return {
         address,
         firstTxDate: toDateString(firstTimestamp),
         firstTxTimestamp: firstTimestamp,
         ageInDays: Math.floor((nowSeconds - firstTimestamp) / 86400),
         hasHistory,
         totalTransferCount,
         hasMoreThan100Transfers,
         lastTxDate: toDateString(lastTimestamp),
         lastTxTimestamp: lastTimestamp
      };
   } catch {
      return null;
   }
}

export async function getWalletAgeInfo(address: string): Promise<WalletAgeInfo | null> {
   if (!ALCHEMY_API_KEY) return null;
   if (!address?.startsWith('0x') || address.length !== 42) return null;

   const cacheKey = address.toLowerCase();
   const cached = walletAgeCache.get(cacheKey);
   if (cached && Date.now() - cached.fetchedAt < WALLET_AGE_CACHE_TTL_MS) {
      return cached.info;
   }

   const activeRequest = walletAgeRequests.get(cacheKey);
   if (activeRequest) {
      return activeRequest;
   }

   const request = fetchWalletAgeInfo(address)
      .then((info) => {
         walletAgeCache.set(cacheKey, { info, fetchedAt: Date.now() });
         return info;
      })
      .finally(() => {
         walletAgeRequests.delete(cacheKey);
      });

   walletAgeRequests.set(cacheKey, request);
   return request;
}

export async function getWalletAgeDays(address: string): Promise<number | null> {
   const info = await getWalletAgeInfo(address);
   return info?.ageInDays ?? null;
}

export async function isNewWallet(address: string, thresholdDays = 30): Promise<boolean> {
   const ageDays = await getWalletAgeDays(address);
   if (ageDays === null) return false;
   return ageDays < thresholdDays;
}
