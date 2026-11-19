import { waitForTransactionReceipt, writeContract } from '@wagmi/core';
import { parseAbi } from 'viem';

import { USDC_ADDRESS } from '@/config/loanFundingConfig';
import { ALLOWED_CHAIN_ID, config } from '@/config/wagmiConfig';

const USDC_TRANSFER_ABI = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);

/** Dollars → USDC base units (6 decimals), rounded to the cent. */
export const usdcUnits = (usd: number): bigint => BigInt(Math.round(usd * 100)) * 10_000n;

/** Sends `usd` USDC on Base from the connected wallet to `to`. Returns the tx hash once mined. */
export async function sendUsdc(to: string, usd: number): Promise<`0x${string}`> {
   if (!/^0x[a-fA-F0-9]{40}$/.test(to)) throw new Error('That wallet address looks wrong.');
   if (!(usd > 0)) throw new Error('Nothing to send.');
   const hash = await writeContract(config, {
      address: USDC_ADDRESS as `0x${string}`,
      abi: USDC_TRANSFER_ABI,
      functionName: 'transfer',
      args: [to as `0x${string}`, usdcUnits(usd)],
      chainId: ALLOWED_CHAIN_ID
   });
   const receipt = await waitForTransactionReceipt(config, { hash, chainId: ALLOWED_CHAIN_ID });
   if (receipt.status !== 'success') throw new Error('The transfer failed on-chain. Nothing was sent.');
   return hash;
}
