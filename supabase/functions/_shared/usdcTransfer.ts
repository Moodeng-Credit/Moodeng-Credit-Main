// Base USDC transfer verification shared by confirm-loan-payment and record-withdrawal.

export const USDC_ADDRESS = (Deno.env.get('BASE_USDC_ADDRESS') || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913').toLowerCase();
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
// Same public bundler endpoint @base-org/account's own getPaymentStatus() calls — no secret needed.
export const BUNDLER_URL = 'https://api.developer.coinbase.com/rpc/v1/base/S-fOd2n2Oi4fl4e1Crm83XeDXZ7tkg8O';
export const ALCHEMY_ID = Deno.env.get('ALCHEMY_ID') ?? '';
export const RPC_URL = ALCHEMY_ID ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_ID}` : 'https://mainnet.base.org';

export const topicToAddress = (topic: string) => `0x${topic.slice(-40)}`.toLowerCase();
export const hexToBigInt = (hex: string) => (hex && hex !== '0x' ? BigInt(hex) : 0n);

export interface RawLog {
   address?: string;
   topics?: string[];
   data?: string;
}

export interface DecodedTransfer {
   from: string;
   to: string;
   value: bigint;
}

export const decodeUsdcTransfers = (logs: RawLog[] | undefined): DecodedTransfer[] => {
   const transfers: DecodedTransfer[] = [];
   for (const log of logs ?? []) {
      if ((log.address ?? '').toLowerCase() !== USDC_ADDRESS) continue;
      const topics = log.topics ?? [];
      if (topics[0]?.toLowerCase() !== TRANSFER_TOPIC || topics.length < 3) continue;
      transfers.push({
         from: topicToAddress(topics[1]),
         to: topicToAddress(topics[2]),
         value: hexToBigInt(log.data ?? '0x0')
      });
   }
   return transfers;
};

export const USER_OPERATION_EVENT_TOPIC = '0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f';

// The smart-account payments (ERC-4337 userOperations) inside a transaction, by sender.
export const decodeUserOpHashes = (logs: RawLog[] | undefined, sender: string): string[] =>
   (logs ?? [])
      .filter((log) => (log.topics ?? [])[0]?.toLowerCase() === USER_OPERATION_EVENT_TOPIC && (log.topics ?? []).length >= 3)
      .filter((log) => topicToAddress((log.topics as string[])[2]) === sender)
      .map((log) => (log.topics as string[])[1].toLowerCase());

export const rpcCall = async (url: string, method: string, params: unknown[]) => {
   const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
   });
   const json = await res.json();
   if (json.error) throw new Error(json.error.message || 'RPC error');
   return json.result;
};

export class PaymentNotConfirmedError extends Error {
   constructor() {
      super('Payment is not confirmed on-chain yet');
   }
}

export interface VerifiedTransfer {
   from: string;
   to: string;
   micros: bigint;
   blockNumber?: string;
   // The real, Basescan-verifiable on-chain transaction hash. For 'wallet' payments this equals the
   // input hash; for 'base' (ERC-4337) payments the input is a userOperation hash — which 404s on the
   // explorer — so we surface the bundler's resolved transactionHash instead.
   txHash?: string;
   // Hashes this payment spends against replay. A Base Account payment spends only its userOp hash
   // (a bundler can put several people's payments in one transaction, so the bundle tx hash isn't
   // this payment's). A plain transaction spends its own hash plus any of the sender's userOps inside
   // it, so resubmitting a Base payment's bundle tx as a 'wallet' payment can't count it twice.
   spendHashes: string[];
}

// Confirms `hash` on-chain and returns the USDC transfer it produced. Throws
// PaymentNotConfirmedError if it's simply not landed yet (caller should retry), or a plain
// Error for anything short of "money definitely moved to someone" (failed tx, wrong token, no
// USDC transfer in the receipt at all).
export const verifyPayment = async (method: 'wallet' | 'base', hash: string): Promise<VerifiedTransfer> => {
   if (method === 'base') {
      const result = await rpcCall(BUNDLER_URL, 'eth_getUserOperationReceipt', [hash]);
      if (!result) throw new PaymentNotConfirmedError();
      if (!result.success) throw new Error('Payment failed on-chain');
      const transfers = decodeUsdcTransfers(result.receipt?.logs);
      if (transfers.length === 0) throw new Error('No USDC transfer found in this payment');
      const sender = (result.sender ?? '').toLowerCase();
      const bySender = transfers.filter((t) => t.from === sender);
      const chosen = bySender[0] ?? transfers[0];
      return {
         from: chosen.from,
         to: chosen.to,
         micros: chosen.value,
         blockNumber: result.receipt?.blockNumber,
         txHash: result.receipt?.transactionHash,
         spendHashes: [hash.toLowerCase()]
      };
   }

   const receipt = await rpcCall(RPC_URL, 'eth_getTransactionReceipt', [hash]);
   if (!receipt) throw new PaymentNotConfirmedError();
   if (receipt.status !== '0x1') throw new Error('Transaction failed on-chain');
   const transfers = decodeUsdcTransfers(receipt.logs);
   if (transfers.length === 0) throw new Error('No USDC transfer found in this transaction');
   return {
      from: transfers[0].from,
      to: transfers[0].to,
      micros: transfers[0].value,
      blockNumber: receipt.blockNumber,
      txHash: receipt.transactionHash ?? hash,
      spendHashes: [...new Set([hash.toLowerCase(), ...decodeUserOpHashes(receipt.logs, transfers[0].from)])]
   };
};

