import { WorldId, type User } from '@/types/authTypes';
import { LoanStatus, RepaymentStatus, type Loan } from '@/types/loanTypes';

export const DEMO_BORROWER_INSIGHTS_USER: User = {
   id: 'demo-borrower-insights-user',
   username: 'Cookiemonster1337',
   email: 'demo-borrower-insights@moodeng.app',
   displayName: 'Cookiemonster1337',
   isWorldId: WorldId.ACTIVE,
   mal: 0,
   nal: 0,
   cs: 20,
   createdAt: '2026-04-01T10:00:00.000Z',
   updatedAt: '2026-05-03T10:00:00.000Z',
   userRole: 'borrower'
};

export const DEMO_LENDER_PROFILES: Record<string, User> = {
   'demo-lender-a': {
      id: 'demo-lender-a',
      username: 'tanirak.i-2a14e3',
      email: 'tanirak@example.com',
      isWorldId: WorldId.ACTIVE,
      mal: 0,
      nal: 0,
      cs: 0,
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
      userRole: 'lender'
   },
   'demo-lender-b': {
      id: 'demo-lender-b',
      username: 'banjaron.i-3d19c7',
      email: 'banjaron@example.com',
      isWorldId: WorldId.ACTIVE,
      mal: 0,
      nal: 0,
      cs: 0,
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
      userRole: 'lender'
   },
   'demo-lender-c': {
      id: 'demo-lender-c',
      username: 'chonlagarn.i-4b49a8',
      email: 'chonlagarn@example.com',
      isWorldId: WorldId.ACTIVE,
      mal: 0,
      nal: 0,
      cs: 0,
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
      userRole: 'lender'
   },
   'demo-lender-d': {
      id: 'demo-lender-d',
      username: 'khonsolam.i-5c29b9',
      email: 'khonsolam@example.com',
      isWorldId: WorldId.ACTIVE,
      mal: 0,
      nal: 0,
      cs: 0,
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
      userRole: 'lender'
   },
   'demo-lender-e': {
      id: 'demo-lender-e',
      username: 'melakarn.i-6b77c5',
      email: 'melakarn@example.com',
      isWorldId: WorldId.ACTIVE,
      mal: 0,
      nal: 0,
      cs: 0,
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
      userRole: 'lender'
   }
};

const makeDemoLoan = (
   id: string,
   lenderUser: string,
   loanAmount: number,
   totalRepaymentAmount: number,
   repaidAmount: number,
   fundedAt: string,
   dueDate: string,
   updatedAt: string,
   repaymentStatus: string
): Loan => ({
   id,
   trackingId: id,
   borrowerUser: DEMO_BORROWER_INSIGHTS_USER.id,
   lenderUser,
   loanAmount,
   repaidAmount,
   totalRepaymentAmount,
   reason: 'Demo loan',
   loanStatus: LoanStatus.LENT,
   repaymentStatus,
   dueDate,
   coin: 'USDC',
   hash: [],
   createdAt: fundedAt,
   updatedAt,
   fundedAt
});

export const DEMO_BORROWER_INSIGHTS_LOANS: Loan[] = [
   makeDemoLoan('demo-insight-loan-1', 'demo-lender-a', 15, 16, 16, '2026-04-02T10:00:00.000Z', '2026-04-06T10:00:00.000Z', '2026-04-05T10:00:00.000Z', RepaymentStatus.PAID),
   makeDemoLoan('demo-insight-loan-2', 'demo-lender-b', 10, 12, 12, '2026-04-06T10:00:00.000Z', '2026-04-11T10:00:00.000Z', '2026-04-10T10:00:00.000Z', RepaymentStatus.PAID),
   makeDemoLoan('demo-insight-loan-3', 'demo-lender-a', 20, 22, 22, '2026-04-12T10:00:00.000Z', '2026-04-17T10:00:00.000Z', '2026-04-16T10:00:00.000Z', RepaymentStatus.PAID),
   makeDemoLoan('demo-insight-loan-4', 'demo-lender-c', 12, 14, 14, '2026-04-18T10:00:00.000Z', '2026-04-24T10:00:00.000Z', '2026-04-23T10:00:00.000Z', RepaymentStatus.PAID),
   makeDemoLoan('demo-insight-loan-5', 'demo-lender-d', 15, 16, 16, '2026-04-25T10:00:00.000Z', '2026-04-30T10:00:00.000Z', '2026-04-29T10:00:00.000Z', RepaymentStatus.PAID),
   makeDemoLoan('demo-insight-loan-6', 'demo-lender-a', 30, 33, 10, '2026-05-01T10:00:00.000Z', '2026-05-08T10:00:00.000Z', '2026-05-03T10:00:00.000Z', RepaymentStatus.PARTIAL),
   makeDemoLoan('demo-insight-loan-7', 'demo-lender-e', 15, 16, 0, '2026-05-02T10:00:00.000Z', '2026-05-10T10:00:00.000Z', '2026-05-02T10:00:00.000Z', RepaymentStatus.UNPAID)
];
