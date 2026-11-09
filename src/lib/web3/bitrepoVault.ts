import { readContract, waitForTransactionReceipt, writeContract } from '@wagmi/core';
import { type Hex, keccak256, parseAbi, stringToHex } from 'viem';

import { USDC_ADDRESS } from '@/config/loanFundingConfig';
import { ALLOWED_CHAIN_ID, config } from '@/config/wagmiConfig';
import { ERC20_ABI } from '@/lib/web3/loanManager/abi';

/**
 * BitRepo originator vault on Base (OriginatorVault 0.2.0, verified on Sourcify). BitRepo deposits
 * USDC; Moodeng's lending wallet holds OPERATOR_ROLE, so it can draw a loan straight to a borrower
 * and repay it, without BitRepo's own site. The wallet that signs is the permission: the contract
 * checks hasRole(OPERATOR_ROLE, msg.sender), not any login.
 *
 * Each draw is keyed by our loans.id (a string), so vault loan = Moodeng loan one-to-one.
 * Repayments pay the vault's interest first, then principal, then the rest of totalDue goes to
 * Moodeng's cover (our margin, withdrawable above the cover rule).
 */
export const BITREPO_VAULT_ADDRESS = ((import.meta.env.VITE_BITREPO_VAULT_ADDRESS ?? '').trim() ||
   '0x1a59968e6B5E1c458B2Df429d2c111ed21E01443') as `0x${string}`;

export const BITREPO_VAULT_URL = `https://app.bitrepo.xyz/originator-vaults/base/${BITREPO_VAULT_ADDRESS}`;

export const BITREPO_VAULT_ABI = parseAbi([
   'function draw(string loanId, address recipient, uint256 amount, uint256 dueDate, uint256 totalDue, bytes32 borrowerId, bytes data)',
   'function repay(string loanId, uint256 amount, bytes data)',
   'function getAvailableToDraw() view returns (uint256)',
   'function getLoan(string loanId) view returns (uint256 loanPrincipal, uint256 interest, uint256 dueDate, bool pastDue, uint256 totalDueLeft)',
   'function termLimit() view returns (uint256)',
   'function paused() view returns (bool)',
   'function OPERATOR_ROLE() view returns (bytes32)',
   'function hasRole(bytes32 role, address account) view returns (bool)',
   'event Drawn(string loanId, address operator, address recipient, uint256 amount, uint256 dueDate, uint256 totalDue, bytes32 borrowerId, bytes data)'
]);

const read = <T>(functionName: string, args: readonly unknown[] = []): Promise<T> =>
   readContract(config, {
      address: BITREPO_VAULT_ADDRESS,
      abi: BITREPO_VAULT_ABI,
      functionName: functionName as never,
      args: args as never,
      chainId: ALLOWED_CHAIN_ID
   }) as Promise<T>;

export interface VaultStatus {
   availableToDraw: bigint;
   termLimitSeconds: number;
   paused: boolean;
   /** Whether `account` may draw (holds OPERATOR_ROLE). False when no account is given. */
   canDraw: boolean;
}

export async function readVaultStatus(account?: string | null): Promise<VaultStatus> {
   const [availableToDraw, termLimit, paused, role] = await Promise.all([
      read<bigint>('getAvailableToDraw'),
      read<bigint>('termLimit'),
      read<boolean>('paused'),
      read<Hex>('OPERATOR_ROLE')
   ]);
   const canDraw = account ? await read<boolean>('hasRole', [role, account as `0x${string}`]) : false;
   return { availableToDraw, termLimitSeconds: Number(termLimit), paused, canDraw };
}

export interface VaultLoan {
   principal: bigint;
   interest: bigint;
   dueDate: number;
   pastDue: boolean;
   totalDueLeft: bigint;
   /** What a full payoff takes right now: the larger of totalDueLeft and principal + interest. */
   payoff: bigint;
}

export async function readVaultLoan(loanId: string): Promise<VaultLoan> {
   const [principal, interest, dueDate, pastDue, totalDueLeft] = await read<readonly [bigint, bigint, bigint, boolean, bigint]>('getLoan', [
      loanId
   ]);
   const owedToVault = principal + interest;
   return {
      principal,
      interest,
      dueDate: Number(dueDate),
      pastDue,
      totalDueLeft,
      payoff: totalDueLeft > owedToVault ? totalDueLeft : owedToVault
   };
}

/** A borrower id the vault only logs: hashed, so BitRepo can count repeat borrowers without seeing who they are. */
export const vaultBorrowerId = (borrowerUserId: string): Hex => keccak256(stringToHex(`moodeng-borrower:${borrowerUserId}`));

/** Draws `amount` (USDC base units) from the vault straight to the borrower. Returns the tx hash once mined. */
export async function drawFromVault(params: {
   loanId: string;
   recipient: string;
   amount: bigint;
   dueDate: number;
   totalDue: bigint;
   borrowerId: Hex;
}): Promise<`0x${string}`> {
   const hash = await writeContract(config, {
      address: BITREPO_VAULT_ADDRESS,
      abi: BITREPO_VAULT_ABI,
      functionName: 'draw',
      args: [
         params.loanId,
         params.recipient as `0x${string}`,
         params.amount,
         BigInt(params.dueDate),
         params.totalDue,
         params.borrowerId,
         '0x'
      ],
      chainId: ALLOWED_CHAIN_ID
   });
   const receipt = await waitForTransactionReceipt(config, { hash, chainId: ALLOWED_CHAIN_ID });
   if (receipt.status !== 'success') throw new Error('The vault draw failed on-chain. Nothing was sent.');
   return hash;
}

/**
 * Pays `amount` (USDC base units) from the connected wallet toward a vault loan: approves the vault
 * for exactly that amount if needed, then repays. The vault never takes more than the loan owes.
 */
export async function repayVaultLoan(owner: string, loanId: string, amount: bigint): Promise<`0x${string}`> {
   const allowance = (await readContract(config, {
      address: USDC_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [owner as `0x${string}`, BITREPO_VAULT_ADDRESS],
      chainId: ALLOWED_CHAIN_ID
   })) as bigint;
   if (allowance < amount) {
      const approveHash = await writeContract(config, {
         address: USDC_ADDRESS as `0x${string}`,
         abi: ERC20_ABI,
         functionName: 'approve',
         args: [BITREPO_VAULT_ADDRESS, amount],
         chainId: ALLOWED_CHAIN_ID
      });
      await waitForTransactionReceipt(config, { hash: approveHash, chainId: ALLOWED_CHAIN_ID });
   }
   const hash = await writeContract(config, {
      address: BITREPO_VAULT_ADDRESS,
      abi: BITREPO_VAULT_ABI,
      functionName: 'repay',
      args: [loanId, amount, '0x'],
      chainId: ALLOWED_CHAIN_ID
   });
   const receipt = await waitForTransactionReceipt(config, { hash, chainId: ALLOWED_CHAIN_ID });
   if (receipt.status !== 'success') throw new Error('The vault repayment failed on-chain.');
   return hash;
}
