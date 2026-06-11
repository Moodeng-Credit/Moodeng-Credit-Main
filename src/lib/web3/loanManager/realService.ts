import { readContract, waitForTransactionReceipt, writeContract } from '@wagmi/core';

import { ALLOWED_CHAIN_ID, config } from '@/config/wagmiConfig';
import { LOAN_MANAGER_ADDRESS } from '@/config/loanFundingConfig';

import { ERC20_ABI, LOAN_MANAGER_ABI } from '@/lib/web3/loanManager/abi';
import {
   type CreateAndFundLoanParams,
   type LoanManagerService,
   type LoanStatus,
   type OnchainListing,
   type OnchainLoan,
   type TxResult
} from '@/lib/web3/loanManager/types';

/**
 * Real LoanManager service backed by wagmi/viem.
 *
 * Active only when VITE_ENABLE_REAL_LOAN_MANAGER=true and VITE_LOAN_MANAGER_ADDRESS is
 * a valid address. Mirrors mockService one-for-one so callers never branch on the flag.
 *
 * NOTE: USDC approval (originator funding allowance / buyer purchase allowance) is
 * handled by callers via the useUsdcAllowance helper before invoking the write methods
 * here, matching the on-chain requirement that the contract be approved to pull USDC.
 */

const address = () => LOAN_MANAGER_ADDRESS as `0x${string}`;

const read = <T>(functionName: string, args: readonly unknown[]): Promise<T> =>
   readContract(config, {
      address: address(),
      abi: LOAN_MANAGER_ABI,
      functionName: functionName as never,
      args: args as never,
      chainId: ALLOWED_CHAIN_ID
   }) as Promise<T>;

const write = async (functionName: string, args: readonly unknown[]): Promise<`0x${string}`> => {
   const hash = await writeContract(config, {
      address: address(),
      abi: LOAN_MANAGER_ABI,
      functionName: functionName as never,
      args: args as never,
      chainId: ALLOWED_CHAIN_ID
   });
   await waitForTransactionReceipt(config, { hash, chainId: ALLOWED_CHAIN_ID });
   return hash;
};

export const realLoanManagerService: LoanManagerService = {
   isMock: false,

   async createAndFundLoan(params: CreateAndFundLoanParams): Promise<TxResult> {
      // The contract assigns loanId = nextLoanId() (pre-increment). Read it before the
      // tx so we can return the minted id without decoding logs.
      const nextId = await read<bigint>('nextLoanId', []);
      const txHash = await write('createAndFundLoan', [
         params.borrower as `0x${string}`,
         BigInt(params.principal),
         BigInt(params.totalOwed),
         BigInt(params.dueDate),
         params.requestId as `0x${string}`
      ]);
      return { txHash, loanId: nextId.toString() };
   },

   async listLoanNote(loanId: string, price: string): Promise<TxResult> {
      const txHash = await write('listLoanNote', [BigInt(loanId), BigInt(price)]);
      return { txHash };
   },

   async buyLoanNote(loanId: string): Promise<TxResult> {
      const txHash = await write('buyLoanNote', [BigInt(loanId)]);
      return { txHash };
   },

   async repay(loanId: string, amount: string): Promise<TxResult> {
      const txHash = await write('repay', [BigInt(loanId), BigInt(amount)]);
      return { txHash };
   },

   async settle(loanId: string): Promise<TxResult> {
      const txHash = await write('settle', [BigInt(loanId)]);
      return { txHash };
   },

   async getHeld(loanId: string): Promise<string> {
      const result = await read<bigint>('heldRepayments', [BigInt(loanId)]);
      return result.toString();
   },

   async getLoan(loanId: string): Promise<OnchainLoan | null> {
      try {
         const result = await read<{
            borrower: string;
            principal: bigint;
            totalOwed: bigint;
            amountRepaid: bigint;
            dueDate: bigint;
            createdAt: bigint;
            requestId: string;
            status: number;
         }>('getLoan', [BigInt(loanId)]);
         return {
            loanId,
            borrower: result.borrower.toLowerCase(),
            principal: result.principal.toString(),
            totalOwed: result.totalOwed.toString(),
            amountRepaid: result.amountRepaid.toString(),
            dueDate: Number(result.dueDate),
            createdAt: Number(result.createdAt),
            requestId: result.requestId,
            status: result.status as LoanStatus
         };
      } catch {
         return null;
      }
   },

   async getRemainingOwed(loanId: string): Promise<string> {
      const result = await read<bigint>('getRemainingOwed', [BigInt(loanId)]);
      return result.toString();
   },

   async getRepaymentRecipient(loanId: string): Promise<string | null> {
      try {
         const result = await read<string>('getRepaymentRecipient', [BigInt(loanId)]);
         return result.toLowerCase();
      } catch {
         return null;
      }
   },

   async ownerOf(loanId: string): Promise<string | null> {
      try {
         const result = await read<string>('ownerOf', [BigInt(loanId)]);
         return result.toLowerCase();
      } catch {
         return null;
      }
   },

   async listings(loanId: string): Promise<OnchainListing | null> {
      try {
         const result = await read<readonly [string, bigint, boolean]>('listings', [BigInt(loanId)]);
         return { seller: result[0].toLowerCase(), price: result[1].toString(), active: result[2] };
      } catch {
         return null;
      }
   }
};

// USDC helpers (used by callers before write methods that pull funds).
export const readUsdcAllowance = (owner: string, spender: string, usdcAddress: string): Promise<bigint> =>
   readContract(config, {
      address: usdcAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [owner as `0x${string}`, spender as `0x${string}`],
      chainId: ALLOWED_CHAIN_ID
   }) as Promise<bigint>;

export const readUsdcBalance = (account: string, usdcAddress: string): Promise<bigint> =>
   readContract(config, {
      address: usdcAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account as `0x${string}`],
      chainId: ALLOWED_CHAIN_ID
   }) as Promise<bigint>;

export const approveUsdc = async (spender: string, amount: bigint, usdcAddress: string): Promise<`0x${string}`> => {
   const hash = await writeContract(config, {
      address: usdcAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender as `0x${string}`, amount],
      chainId: ALLOWED_CHAIN_ID
   });
   await waitForTransactionReceipt(config, { hash, chainId: ALLOWED_CHAIN_ID });
   return hash;
};
