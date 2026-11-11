import { waitForTransactionReceipt, writeContract } from '@wagmi/core';
import { parseAbi } from 'viem';

import { USDC_ADDRESS } from '@/config/loanFundingConfig';
import { ALLOWED_CHAIN_ID, config } from '@/config/wagmiConfig';
import { BASE_ALCHEMY_RPC_URL } from '@/lib/web3/baseAlchemy';

/**
 * Where the BitRepo pilot advance goes back to (BitRepo's own wallet on Base; they redeploy it into
 * the vault). Only for loans funded from the advance: vault loans are repaid through the vault.
 */
export const BITREPO_RETURN_ADDRESS = '0xb991B5dD8e6cb2d9D517572CD736f37480bF07DD' as const;

const USDC_TRANSFER_ABI = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);

/** Sends `amount` (USDC base units) from the connected wallet to BitRepo. Returns the tx hash once mined. */
export async function sendUsdcToBitrepo(amount: bigint): Promise<`0x${string}`> {
   const hash = await writeContract(config, {
      address: USDC_ADDRESS as `0x${string}`,
      abi: USDC_TRANSFER_ABI,
      functionName: 'transfer',
      args: [BITREPO_RETURN_ADDRESS, amount],
      chainId: ALLOWED_CHAIN_ID
   });
   const receipt = await waitForTransactionReceipt(config, { hash, chainId: ALLOWED_CHAIN_ID });
   if (receipt.status !== 'success') throw new Error('The transfer to BitRepo failed on-chain. Nothing was sent.');
   return hash;
}

export interface BitrepoTransfer {
   hash: string;
   amount: number;
   at: string; // ISO time of the block
}

/** USDC transfers on Base from `from` to BitRepo's return address, oldest first. */
export async function listTransfersToBitrepo(from: string): Promise<BitrepoTransfer[]> {
   const response = await fetch(BASE_ALCHEMY_RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
         jsonrpc: '2.0',
         id: 1,
         method: 'alchemy_getAssetTransfers',
         params: [
            {
               fromBlock: '0x0',
               toBlock: 'latest',
               fromAddress: from,
               toAddress: BITREPO_RETURN_ADDRESS,
               contractAddresses: [USDC_ADDRESS],
               category: ['erc20'],
               withMetadata: true
            }
         ]
      })
   });
   const body = (await response.json()) as {
      error?: { message?: string };
      result?: { transfers?: Array<{ hash: string; value: number | null; metadata?: { blockTimestamp?: string } }> };
   };
   if (body.error) throw new Error(body.error.message || 'Could not read transfers on Base.');
   return (body.result?.transfers ?? [])
      .filter((t) => t.value && t.metadata?.blockTimestamp)
      .map((t) => ({ hash: t.hash, amount: Number(t.value), at: t.metadata?.blockTimestamp as string }))
      .sort((a, b) => a.at.localeCompare(b.at));
}
