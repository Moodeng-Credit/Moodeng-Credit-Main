import { LOAN_MANAGER_ADDRESS, USDC_ADDRESS, isRealLoanManagerEnabled } from '@/config/loanFundingConfig';

import { mockLoanManagerService } from '@/lib/web3/loanManager/mockService';
import { approveUsdc, readUsdcAllowance, readUsdcBalance, realLoanManagerService } from '@/lib/web3/loanManager/realService';
import { type LoanManagerService } from '@/lib/web3/loanManager/types';

export * from '@/lib/web3/loanManager/types';

/**
 * Returns the active LoanManager service: real wagmi/viem implementation when the
 * feature flag + address are configured, otherwise the in-memory mock. Callers use the
 * same interface in both cases.
 */
export const getLoanManagerService = (): LoanManagerService =>
   isRealLoanManagerEnabled() ? realLoanManagerService : mockLoanManagerService;

/**
 * Ensures `spender` (the LoanManager) is approved to pull at least `amount` USDC from
 * `owner`. No-op in mock mode. Returns true if an approval tx was sent.
 */
export const ensureUsdcAllowance = async (owner: string, amount: bigint): Promise<boolean> => {
   if (!isRealLoanManagerEnabled()) return false;
   const current = await readUsdcAllowance(owner, LOAN_MANAGER_ADDRESS, USDC_ADDRESS);
   if (current >= amount) return false;
   await approveUsdc(LOAN_MANAGER_ADDRESS, amount, USDC_ADDRESS);
   return true;
};

/** Reads the USDC balance for an account. Returns null in mock mode (balance not enforced). */
export const getUsdcBalance = async (account: string): Promise<bigint | null> => {
   if (!isRealLoanManagerEnabled()) return null;
   return readUsdcBalance(account, USDC_ADDRESS);
};
