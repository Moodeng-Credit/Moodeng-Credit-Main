/**
 * Shared types for the LoanManager contract service.
 *
 * The service exposes the exact surface the app needs and is implemented twice:
 *  - mockService (in-memory, default) so frontend/DB/IOU flows work pre-deployment
 *  - realService (wagmi/viem) used when VITE_ENABLE_REAL_LOAN_MANAGER=true
 *
 * REPAYMENT MODEL — automatic payout (NOT claimable):
 *  When the borrower repays via repay(loanId, amount), the contract immediately forwards
 *  the USDC to the repayment recipient — the listing seller if the Note is actively listed
 *  in escrow, otherwise ownerOf(loanId). There is no claim step and no claimable balance.
 *  See REPAYMENT_MODEL.md for the contract-side requirements.
 */

export enum LoanStatus {
   Active = 0,
   Repaid = 1,
   Defaulted = 2
}

export const LOAN_STATUS_LABEL: Record<LoanStatus, 'Active' | 'Repaid' | 'Defaulted'> = {
   [LoanStatus.Active]: 'Active',
   [LoanStatus.Repaid]: 'Repaid',
   [LoanStatus.Defaulted]: 'Defaulted'
};

/** Mirrors the on-chain Loan struct. Amounts are USDC base units (6 decimals) as strings. */
export interface OnchainLoan {
   loanId: string;
   borrower: string;
   /** USDC base units (string to stay precise). */
   principal: string;
   totalOwed: string;
   amountRepaid: string;
   /** Unix seconds. */
   dueDate: number;
   createdAt: number;
   requestId: string;
   status: LoanStatus;
}

/** Mirrors the on-chain Listing struct for the escrow marketplace. */
export interface OnchainListing {
   seller: string;
   /** USDC base units. */
   price: string;
   active: boolean;
}

export interface CreateAndFundLoanParams {
   borrower: string;
   /** USDC base units. */
   principal: string;
   totalOwed: string;
   /** Unix seconds. */
   dueDate: number;
   /** bytes32 request id (0x-prefixed, 32 bytes). */
   requestId: string;
}

export interface TxResult {
   txHash: string;
   /** Present for createAndFundLoan: the minted loanId / tokenId. */
   loanId?: string;
}

/**
 * The full LoanManager service interface. Both mock and real implementations satisfy
 * this contract so callers never branch on the feature flag.
 *
 * There is intentionally NO claimRepayments / getClaimable: repayments are routed
 * automatically to the Note owner by repay().
 */
export interface LoanManagerService {
   readonly isMock: boolean;

   // --- Writes ---
   createAndFundLoan(params: CreateAndFundLoanParams): Promise<TxResult>;
   /** Lists a Loan Note into escrow so a lender can buy it (price in USDC base units). */
   listLoanNote(loanId: string, price: string): Promise<TxResult>;
   buyLoanNote(loanId: string): Promise<TxResult>;
   /**
    * Borrower repays. Pulls USDC from the borrower and immediately forwards it to the
    * repayment recipient (listing seller if escrowed/listed, else ownerOf). amount is
    * USDC base units.
    */
   repay(loanId: string, amount: string): Promise<TxResult>;

   // --- Reads ---
   getLoan(loanId: string): Promise<OnchainLoan | null>;
   getRemainingOwed(loanId: string): Promise<string>;
   /** The wallet that repayments are automatically sent to (listing seller if listed, else owner). */
   getRepaymentRecipient(loanId: string): Promise<string | null>;
   ownerOf(loanId: string): Promise<string | null>;
   listings(loanId: string): Promise<OnchainListing | null>;
}
