import { getAccount } from '@wagmi/core';

import { config } from '@/config/wagmiConfig';

import {
   type CreateAndFundLoanParams,
   type LoanManagerService,
   LoanStatus,
   type OnchainListing,
   type OnchainLoan,
   type TxResult
} from '@/lib/web3/loanManager/types';

/**
 * In-memory + localStorage-backed mock of the LoanManager contract.
 *
 * Used while VITE_ENABLE_REAL_LOAN_MANAGER is false so the entire admin funding,
 * lender purchase, IOU points, and DB-recording flow can be built and tested without
 * a deployed contract. State persists across reloads.
 *
 * Repayments are automatic: repay() forwards to the current recipient (listing seller if
 * listed, else owner). There is no claimable balance and no claim step.
 */

const STORAGE_KEY = 'moodeng:mock-loan-manager:v2';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

interface MockState {
   nextLoanId: number;
   loans: Record<string, OnchainLoan>;
   owners: Record<string, string>;
   listings: Record<string, OnchainListing>;
   /** USDC base units held (escrowed) per loanId, awaiting release. */
   held: Record<string, string>;
}

const emptyState = (): MockState => ({ nextLoanId: 1, loans: {}, owners: {}, listings: {}, held: {} });

const readState = (): MockState => {
   if (typeof window === 'undefined') return emptyState();
   try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      return { ...emptyState(), ...(JSON.parse(raw) as MockState) };
   } catch {
      return emptyState();
   }
};

const writeState = (state: MockState): void => {
   if (typeof window === 'undefined') return;
   try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
   } catch {
      // ignore quota / serialization issues in the mock
   }
};

const delay = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms));

const fakeTxHash = (): string => {
   const hex = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
   return `0x${hex}`;
};

const connectedAddress = (): string => {
   const account = getAccount(config);
   return (account.address ?? ZERO_ADDRESS).toLowerCase();
};

// Repayment recipient: listing seller if actively listed (escrowed), else current owner.
const recipientFor = (state: MockState, loanId: string): string | null => {
   const listing = state.listings[loanId];
   if (listing && listing.active) return listing.seller;
   return state.owners[loanId] ?? null;
};

export const mockLoanManagerService: LoanManagerService = {
   isMock: true,

   async createAndFundLoan(params: CreateAndFundLoanParams): Promise<TxResult> {
      await delay();
      const state = readState();
      const loanId = String(state.nextLoanId);
      const originator = connectedAddress();
      const now = Math.floor(Date.now() / 1000);

      state.loans[loanId] = {
         loanId,
         borrower: params.borrower.toLowerCase(),
         principal: params.principal,
         totalOwed: params.totalOwed,
         amountRepaid: '0',
         dueDate: params.dueDate,
         createdAt: now,
         requestId: params.requestId,
         status: LoanStatus.Active
      };
      state.owners[loanId] = originator;
      state.nextLoanId += 1;
      writeState(state);

      return { txHash: fakeTxHash(), loanId };
   },

   async listLoanNote(loanId: string, price: string): Promise<TxResult> {
      await delay();
      const state = readState();
      const loan = state.loans[loanId];
      if (!loan) throw new Error('Mock: loan does not exist');
      state.listings[loanId] = { seller: connectedAddress(), price, active: true };
      writeState(state);
      return { txHash: fakeTxHash() };
   },

   async buyLoanNote(loanId: string): Promise<TxResult> {
      await delay();
      const state = readState();
      const listing = state.listings[loanId];
      if (!listing || !listing.active) throw new Error('Mock: listing is not active');
      const buyer = connectedAddress();
      if (buyer === listing.seller) throw new Error('Mock: buyer is seller');

      listing.active = false;
      state.owners[loanId] = buyer; // lender now owns the Note (and is the repayment recipient)
      writeState(state);
      return { txHash: fakeTxHash() };
   },

   async repay(loanId: string, amount: string): Promise<TxResult> {
      await delay();
      const state = readState();
      const loan = state.loans[loanId];
      if (!loan) throw new Error('Mock: loan does not exist');
      if (loan.status !== LoanStatus.Active) throw new Error('Mock: loan not active');

      // Hold the repayment in the contract (do not release yet).
      const remaining = BigInt(loan.totalOwed) - BigInt(loan.amountRepaid);
      const pay = BigInt(amount) > remaining ? remaining : BigInt(amount);
      state.held[loanId] = (BigInt(state.held[loanId] ?? '0') + pay).toString();
      loan.amountRepaid = (BigInt(loan.amountRepaid) + pay).toString();

      if (BigInt(loan.amountRepaid) >= BigInt(loan.totalOwed)) {
         loan.status = LoanStatus.Repaid;
         if (state.listings[loanId]) state.listings[loanId].active = false;
         state.held[loanId] = '0'; // released to the recipient on full payoff
      }
      writeState(state);
      return { txHash: fakeTxHash() };
   },

   async settle(loanId: string): Promise<TxResult> {
      await delay();
      const state = readState();
      const loan = state.loans[loanId];
      if (!loan) throw new Error('Mock: loan does not exist');
      if (Math.floor(Date.now() / 1000) < loan.dueDate) throw new Error('Mock: not yet due');
      if (BigInt(state.held[loanId] ?? '0') === 0n) throw new Error('Mock: nothing to release');
      state.held[loanId] = '0'; // released to the recipient
      writeState(state);
      return { txHash: fakeTxHash() };
   },

   async getHeld(loanId: string): Promise<string> {
      const state = readState();
      return state.held[loanId] ?? '0';
   },

   async getLoan(loanId: string): Promise<OnchainLoan | null> {
      const state = readState();
      return state.loans[loanId] ?? null;
   },

   async getRemainingOwed(loanId: string): Promise<string> {
      const state = readState();
      const loan = state.loans[loanId];
      if (!loan) return '0';
      return (BigInt(loan.totalOwed) - BigInt(loan.amountRepaid)).toString();
   },

   async getRepaymentRecipient(loanId: string): Promise<string | null> {
      const state = readState();
      return recipientFor(state, loanId);
   },

   async ownerOf(loanId: string): Promise<string | null> {
      const state = readState();
      return state.owners[loanId] ?? null;
   },

   async listings(loanId: string): Promise<OnchainListing | null> {
      const state = readState();
      return state.listings[loanId] ?? null;
   }
};
