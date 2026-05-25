import { describe, expect, it } from 'vitest';

import { buildTelegramLoanRequestMessage, getBestTelegramLoanInsights } from '../../supabase/functions/_shared/telegramLoanNotifications';

const currentLoan = {
   id: 'loan-current',
   loan_amount: 15,
   coin: 'USDC',
   created_at: '2026-05-25T00:00:00.000Z',
   due_date: '2026-05-28T00:00:00.000Z',
   reason: 'Inventory top up',
   borrower_user_id: 'borrower-1'
};

describe('buildTelegramLoanRequestMessage', () => {
   it('builds a concise new borrower request from previous loan history', () => {
      const message = buildTelegramLoanRequestMessage(currentLoan, [currentLoan], { mal: 3 }, 'https://example.com/request-board');

      expect(message).toContain('🚀 New Loan Request');
      expect(message).toContain('💰 Amount: 15.00 USDC');
      expect(message).toContain('⏳ Duration: 3 days');
      expect(message).toContain('🆕 New Borrower');
      expect(message).not.toContain('Credit Score');
      expect(message).toContain('🔢 Max Active Loans: 3');
      expect(message).toContain('https://example.com/request-board');
   });

   it('shows growing borrower history from prior loans only', () => {
      const message = buildTelegramLoanRequestMessage(
         currentLoan,
         [
            {
               id: 'loan-1',
               loan_status: 'Lent',
               repayment_status: 'Paid',
               lender_user_id: 'lender-1',
               created_at: '2026-05-20T00:00:00.000Z'
            },
            currentLoan
         ],
         { mal: 3 },
         'https://example.com/request-board'
      );

      expect(message).toContain('📈 Growing Borrower');
      expect(message).not.toContain('Credit Score');
      expect(message).toContain('📊 1 loans | 1 repaid');
   });
});

describe('getBestTelegramLoanInsights', () => {
   it('keeps the strongest positive borrower insights', () => {
      const insights = getBestTelegramLoanInsights(
         {
            totalLoans: 8,
            loansRepaid: 7,
            maxActiveLoans: 3,
            typicalPaymentTimeHours: 0.3,
            repeatLenders: 5,
            lenderDiversityScore: 30,
            avgDaysBetweenLoans: 14
         },
         2
      );

      expect(insights).toEqual(['⚡ Repays extremely fast - avg 18 minutes', '🔁 5 repeat fundings from returning lenders']);
   });
});
