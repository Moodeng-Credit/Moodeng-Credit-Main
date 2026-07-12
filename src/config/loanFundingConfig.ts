import { BASE_USDC_ADDRESS } from '@/config/wagmiConfig';

/**
 * Central config for the loan funding + Loan Note resale feature.
 *
 * Admin access is gated primarily on the authenticated account email (the repo's
 * existing admin model is account-based). An optional wallet allowlist is read from
 * env so a second on-chain factor can be layered in later. The smart contract itself
 * still enforces ORIGINATOR_ROLE, so the frontend allowlist is convenience, not the
 * security boundary.
 */

/**
 * Moodeng admin accounts allowed to see/use the funding modal.
 *
 * George: georgemlerner@gmail.com, georgedevdao@gmail.com
 * Emma (Chonlagarn): chonlagarn.i@gmail.com (Google), plus her Telegram/atomicmail/LINE
 * logins whose emails are auto-generated placeholders — listed so she keeps access
 * whichever account she signs in with.
 */
export const ADMIN_ACCOUNT_EMAILS: readonly string[] = [
   'georgemlerner@gmail.com',
   'georgedevdao@gmail.com',
   'chonlagarn.i@gmail.com',
   'telegram_1384264294@moodeng.credit',
   'emmacute1@atomicmail.io',
   'line_u655bfb6e597a640f8447e74cbede5bce@moodeng.app'
];

const normalizeAddress = (value?: string | null): string => (value ?? '').trim().toLowerCase();
const normalizeEmail = (value?: string | null): string => (value ?? '').trim().toLowerCase();

/**
 * Optional wallet allowlist (comma-separated) for admin funding actions.
 * e.g. VITE_ADMIN_WALLETS="0xabc...,0xdef..."
 * Empty by default until the two admin wallet addresses are known.
 */
export const ADMIN_WALLETS: readonly string[] = (import.meta.env.VITE_ADMIN_WALLETS ?? '')
   .split(',')
   .map((entry: string) => normalizeAddress(entry))
   .filter((entry: string) => entry.length > 0);

/** True when the given account email is one of the Moodeng admin accounts. */
export const isAdminEmail = (email?: string | null): boolean => {
   const normalized = normalizeEmail(email);
   if (!normalized) return false;
   return ADMIN_ACCOUNT_EMAILS.some((adminEmail) => normalizeEmail(adminEmail) === normalized);
};

/** True when the connected wallet is in the (optional) admin wallet allowlist. */
export const isAdminWallet = (walletAddress?: string | null): boolean => {
   const normalized = normalizeAddress(walletAddress);
   if (!normalized) return false;
   return ADMIN_WALLETS.includes(normalized);
};

/**
 * Resolves whether a user is a Moodeng funding admin.
 *
 * An account is admin if its email is allowlisted. If ADMIN_WALLETS is configured,
 * the connected wallet must additionally be allowlisted (defense in depth). When no
 * wallet allowlist is configured, the email check alone is sufficient.
 */
export const isFundingAdmin = (params: { email?: string | null; walletAddress?: string | null }): boolean => {
   if (!isAdminEmail(params.email)) return false;
   if (ADMIN_WALLETS.length === 0) return true;
   return isAdminWallet(params.walletAddress);
};

// -------------------------
// LoanManager / USDC contract config
// -------------------------

/** LoanManager contract address. Empty until deployed. */
export const LOAN_MANAGER_ADDRESS = (import.meta.env.VITE_LOAN_MANAGER_ADDRESS ?? '').trim();

/** USDC token address used for funding/repayments/settlement. Falls back to Base USDC. */
export const USDC_ADDRESS = (import.meta.env.VITE_USDC_ADDRESS ?? '').trim() || BASE_USDC_ADDRESS;

/** USDC uses 6 decimals on Base. */
export const USDC_DECIMALS = 6;

/**
 * Master switch. While false (default), the app uses the in-memory mock LoanManager
 * service so the full UI / DB / IOU flows are testable before deployment. Set to
 * "true" (and provide VITE_LOAN_MANAGER_ADDRESS) to use real wagmi/viem calls.
 */
export const ENABLE_REAL_LOAN_MANAGER = (import.meta.env.VITE_ENABLE_REAL_LOAN_MANAGER ?? '').trim().toLowerCase() === 'true';

/** Whether real on-chain calls are usable (flag on + address present). */
export const isRealLoanManagerEnabled = (): boolean => ENABLE_REAL_LOAN_MANAGER && /^0x[a-fA-F0-9]{40}$/.test(LOAN_MANAGER_ADDRESS);

/**
 * Optional Base paymaster (ERC-7677) endpoint that sponsors gas for LoanManager contract
 * calls so Base smart-wallet users transact gaslessly. Get it from Coinbase Developer
 * Platform (Paymaster), and allowlist the LoanManager address + functions in its policy.
 * e.g. VITE_PAYMASTER_URL="https://api.developer.coinbase.com/rpc/v1/base/<API_KEY>"
 */
export const PAYMASTER_URL = (import.meta.env.VITE_PAYMASTER_URL ?? '').trim();

/** True when a paymaster URL is configured (and real mode is on). Sponsorship is best-effort. */
export const isPaymasterEnabled = (): boolean => isRealLoanManagerEnabled() && /^https?:\/\//i.test(PAYMASTER_URL);

/** Basescan explorer links (Base mainnet) — shown to users for a trustable tx record. */
export const txExplorerUrl = (txHash: string): string => `https://basescan.org/tx/${txHash}`;
export const addressExplorerUrl = (address: string): string => `https://basescan.org/address/${address}`;

/**
 * IOU points awarded per 1 USDC of Loan Note purchase (lender side).
 * Off-chain points only; not an ERC20. Matches the platform's 1 point / USDC base rate.
 */
export const LENDER_IOU_POINTS_PER_USDC = 1;
