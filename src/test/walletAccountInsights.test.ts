import { describe, expect, it } from 'vitest';

import {
   buildRecentWalletActivity,
   buildRepaymentDestinations,
   getDistinctWalletCount,
   hasMeaningfulWalletHistory,
   type WalletConnectionEvent,
   type WalletLoanRecord
} from '@/views/account/walletAccountData';

const CURRENT_WALLET = '0x1111111111111111111111111111111111111111';
const PREVIOUS_WALLET = '0x2222222222222222222222222222222222222222';

function makeLoan(overrides: Partial<WalletLoanRecord> = {}): WalletLoanRecord {
   return {
      id: 'loan-1',
      tracking_id: 'LOAN-1001',
      borrower_user_id: 'borrower-1',
      borrower_wallet: CURRENT_WALLET,
      lender_user_id: 'lender-1',
      lender_wallet: PREVIOUS_WALLET,
      loan_amount: 20,
      total_repayment_amount: 21,
      repaid_amount: 21,
      loan_status: 'Lent',
      repayment_status: 'Paid',
      funded_at: '2026-07-20T09:00:00.000Z',
      repaid_at: '2026-07-24T09:00:00.000Z',
      updated_at: '2026-07-24T09:00:00.000Z',
      hash: ['0xfunding', '0xrepayment'],
      ...overrides
   };
}

describe('buildRecentWalletActivity', () => {
   it('matches verified loan hashes while leaving unrelated USDC transfers generic', () => {
      const rows = buildRecentWalletActivity({
         loans: [makeLoan()],
         transfers: [
            { direction: 'in', amount: 20, timestamp: '2026-07-20T09:00:00.000Z', hash: '0xfunding' },
            { direction: 'out', amount: 8, timestamp: '2026-07-22T09:00:00.000Z', hash: '0xother' },
            { direction: 'out', amount: 21, timestamp: '2026-07-24T09:00:00.000Z', hash: '0xrepayment' }
         ],
         userId: 'borrower-1',
         role: 'borrower',
         currentAddress: CURRENT_WALLET,
         limit: 3
      });

      expect(rows.map((row) => row.kind)).toEqual(['repayment_sent', 'usdc_sent', 'loan_received']);
      expect(rows[0]).toMatchObject({ amount: 21, loanId: 'loan-1', trackingId: 'LOAN-1001' });
   });

   it('uses only reliable funded and neutral final-repaid loan events when transfer history is unavailable', () => {
      const paid = makeLoan();
      const partial = makeLoan({
         id: 'loan-2',
         tracking_id: 'LOAN-1002',
         repayment_status: 'Partial',
         repaid_amount: 5,
         repaid_at: null,
         hash: ['0xfunding-2', '0xpartial']
      });

      const rows = buildRecentWalletActivity({
         loans: [paid, partial],
         userId: 'borrower-1',
         role: 'borrower',
         currentAddress: CURRENT_WALLET,
         limit: 10
      });

      expect(rows.filter((row) => row.kind === 'loan_repaid')).toHaveLength(1);
      expect(rows.find((row) => row.kind === 'loan_repaid')).toMatchObject({ direction: 'neutral', amount: 21 });
      expect(rows.find((row) => row.id === 'loan-2-repaid')).toBeUndefined();
      expect(rows.find((row) => row.id === 'loan-2-funded')).toBeDefined();
   });

   it('does not claim a saved wallet sent a repayment without a matching outgoing transfer', () => {
      const rows = buildRecentWalletActivity({
         loans: [makeLoan()],
         userId: 'borrower-1',
         role: 'borrower',
         currentAddress: CURRENT_WALLET,
         limit: 10
      });

      expect(rows.find((row) => row.kind === 'loan_repaid')).toMatchObject({
         direction: 'neutral',
         transactionHash: '0xrepayment'
      });
      expect(rows.some((row) => row.kind === 'repayment_sent')).toBe(false);
   });

   it('keeps a matching hash generic when its direction does not fit the loan event', () => {
      const rows = buildRecentWalletActivity({
         loans: [makeLoan()],
         transfers: [{ direction: 'out', amount: 20, timestamp: '2026-07-20T09:00:00.000Z', hash: '0xfunding' }],
         userId: 'borrower-1',
         role: 'borrower',
         currentAddress: CURRENT_WALLET
      });

      expect(rows.find((row) => row.transactionHash === '0xfunding')).toMatchObject({
         kind: 'usdc_sent',
         loanId: null,
         trackingId: null
      });
   });

   it('does not invent lender funding or repayment rows without on-chain transfers', () => {
      const rows = buildRecentWalletActivity({
         loans: [makeLoan({ lender_wallet: CURRENT_WALLET })],
         userId: 'lender-1',
         role: 'lender',
         currentAddress: CURRENT_WALLET,
         limit: 10
      });

      expect(rows).toEqual([]);
   });

   it('does not mix activity from a previous wallet into the current wallet feed', () => {
      const rows = buildRecentWalletActivity({
         loans: [makeLoan({ borrower_wallet: PREVIOUS_WALLET })],
         userId: 'borrower-1',
         role: 'borrower',
         currentAddress: CURRENT_WALLET
      });

      expect(rows).toEqual([]);
   });
});

describe('buildRepaymentDestinations', () => {
   it('groups active lender loans that still repay a previous funding wallet', () => {
      const destinations = buildRepaymentDestinations({
         loans: [
            makeLoan({ id: 'active-1', lender_user_id: 'lender-1', repayment_status: 'Partial' }),
            makeLoan({ id: 'active-2', lender_user_id: 'lender-1', repayment_status: 'Unpaid' }),
            makeLoan({
               id: 'current-wallet-loan',
               lender_user_id: 'lender-1',
               lender_wallet: CURRENT_WALLET,
               repayment_status: 'Unpaid'
            }),
            makeLoan({ id: 'paid-loan', lender_user_id: 'lender-1', repayment_status: 'Paid' })
         ],
         userId: 'lender-1',
         currentAddress: CURRENT_WALLET
      });

      expect(destinations).toEqual([{ walletAddress: PREVIOUS_WALLET, activeLoanCount: 2 }]);
   });
});

describe('wallet history classification', () => {
   const events: WalletConnectionEvent[] = [
      {
         id: 'current',
         event_type: 'connected',
         wallet_address: CURRENT_WALLET.toUpperCase(),
         previous_wallet_address: null,
         wallet_provider: 'base_wallet',
         wallet_connector_name: 'Base Account',
         wallet_chain_id: 8453,
         occurred_at: '2026-07-28T00:00:00.000Z'
      },
      {
         id: 'previous',
         event_type: 'historical',
         wallet_address: PREVIOUS_WALLET,
         previous_wallet_address: null,
         wallet_provider: null,
         wallet_connector_name: null,
         wallet_chain_id: 8453,
         occurred_at: '2026-07-20T00:00:00.000Z'
      }
   ];

   it('counts current and previous addresses case-insensitively', () => {
      expect(getDistinctWalletCount(events, CURRENT_WALLET)).toBe(2);
   });

   it('shows history when more than one wallet was used', () => {
      expect(hasMeaningfulWalletHistory(events, CURRENT_WALLET)).toBe(true);
   });
});
