import { type User, WorldId } from '@/types/authTypes';
import { type Loan, LoanStatus, RepaymentStatus } from '@/types/loanTypes';

export const DEMO_BORROWER_INSIGHTS_USER: User = {
   id: 'demo-borrower-insights-user',
   username: 'graceling21',
   email: 'demo-borrower-insights@moodeng.app',
   displayName: 'graceling21',
   isWorldId: WorldId.ACTIVE,
   mal: 0,
   nal: 0,
   cs: 20,
   incomeDescription:
      'Runs a small sari-sari store in Cebu. Steady daily cash flow from the store, plus weekend online reselling — usually repays from the following week’s sales.',
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

/**
 * Lender-side sample for `/user/:username?demo=lender`. The insights page flips to its
 * lender variant for anyone whose role is lender, and this is the fixture that lets that
 * variant be reviewed without hunting for a real lender with funded loans.
 */
export const DEMO_LENDER_INSIGHTS_USER: User = {
   id: 'demo-lender-insights-user',
   username: 'tanirak.i-2a14e3',
   email: 'demo-lender-insights@moodeng.app',
   displayName: 'tanirak.i-2a14e3',
   isWorldId: WorldId.ACTIVE,
   mal: 0,
   nal: 0,
   cs: 0,
   createdAt: '2026-03-01T10:00:00.000Z',
   updatedAt: '2026-07-01T10:00:00.000Z',
   userRole: 'lender'
};

const makeDemoBorrowerProfile = (id: string, username: string): User => ({
   id,
   username,
   email: `${username}@example.com`,
   isWorldId: WorldId.ACTIVE,
   mal: 0,
   nal: 0,
   cs: 20,
   createdAt: '2026-03-01T10:00:00.000Z',
   updatedAt: '2026-03-01T10:00:00.000Z',
   userRole: 'borrower'
});

export const DEMO_BORROWER_PROFILES: Record<string, User> = {
   'demo-borrower-a': makeDemoBorrowerProfile('demo-borrower-a', 'graceling21'),
   'demo-borrower-b': makeDemoBorrowerProfile('demo-borrower-b', 'mimitoting28'),
   'demo-borrower-c': makeDemoBorrowerProfile('demo-borrower-c', 'jollysakura19'),
   'demo-borrower-d': makeDemoBorrowerProfile('demo-borrower-d', 'cabantuganprincess20')
};

const makeDemoLentLoan = (
   id: string,
   borrowerUser: string,
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
   borrowerUser,
   lenderUser: DEMO_LENDER_INSIGHTS_USER.id,
   loanAmount,
   repaidAmount,
   totalRepaymentAmount,
   reason: 'Demo funded loan',
   loanStatus: LoanStatus.LENT,
   repaymentStatus,
   dueDate,
   coin: 'USDC',
   hash: [],
   createdAt: fundedAt,
   updatedAt,
   fundedAt
});

export const DEMO_LENDER_INSIGHTS_LOANS: Loan[] = [
   makeDemoLentLoan(
      'demo-lent-loan-1',
      'demo-borrower-a',
      20,
      23,
      23,
      '2026-05-02T10:00:00.000Z',
      '2026-05-10T10:00:00.000Z',
      '2026-05-08T10:00:00.000Z',
      RepaymentStatus.PAID
   ),
   makeDemoLentLoan(
      'demo-lent-loan-2',
      'demo-borrower-b',
      15,
      17,
      17,
      '2026-05-14T10:00:00.000Z',
      '2026-05-21T10:00:00.000Z',
      '2026-05-19T10:00:00.000Z',
      RepaymentStatus.PAID
   ),
   makeDemoLentLoan(
      'demo-lent-loan-3',
      'demo-borrower-a',
      40,
      45,
      45,
      '2026-06-01T10:00:00.000Z',
      '2026-06-10T10:00:00.000Z',
      '2026-06-09T10:00:00.000Z',
      RepaymentStatus.PAID
   ),
   makeDemoLentLoan(
      'demo-lent-loan-4',
      'demo-borrower-c',
      25,
      28,
      10,
      '2026-07-05T10:00:00.000Z',
      '2026-08-05T10:00:00.000Z',
      '2026-07-20T10:00:00.000Z',
      RepaymentStatus.PARTIAL
   ),
   makeDemoLentLoan(
      'demo-lent-loan-5',
      'demo-borrower-d',
      30,
      34,
      0,
      '2026-06-20T10:00:00.000Z',
      '2026-07-10T10:00:00.000Z',
      '2026-06-20T10:00:00.000Z',
      RepaymentStatus.UNPAID
   )
];

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
   makeDemoLoan(
      'demo-insight-loan-1',
      'demo-lender-a',
      15,
      16,
      16,
      '2026-04-02T10:00:00.000Z',
      '2026-04-06T10:00:00.000Z',
      '2026-04-05T10:00:00.000Z',
      RepaymentStatus.PAID
   ),
   makeDemoLoan(
      'demo-insight-loan-2',
      'demo-lender-b',
      10,
      12,
      12,
      '2026-04-06T10:00:00.000Z',
      '2026-04-11T10:00:00.000Z',
      '2026-04-10T10:00:00.000Z',
      RepaymentStatus.PAID
   ),
   makeDemoLoan(
      'demo-insight-loan-3',
      'demo-lender-a',
      20,
      22,
      22,
      '2026-04-12T10:00:00.000Z',
      '2026-04-17T10:00:00.000Z',
      '2026-04-16T10:00:00.000Z',
      RepaymentStatus.PAID
   ),
   makeDemoLoan(
      'demo-insight-loan-4',
      'demo-lender-c',
      12,
      14,
      14,
      '2026-04-18T10:00:00.000Z',
      '2026-04-24T10:00:00.000Z',
      '2026-04-23T10:00:00.000Z',
      RepaymentStatus.PAID
   ),
   makeDemoLoan(
      'demo-insight-loan-5',
      'demo-lender-d',
      15,
      16,
      16,
      '2026-04-25T10:00:00.000Z',
      '2026-04-30T10:00:00.000Z',
      '2026-04-29T10:00:00.000Z',
      RepaymentStatus.PAID
   ),
   makeDemoLoan(
      'demo-insight-loan-6',
      'demo-lender-a',
      30,
      33,
      10,
      '2026-05-01T10:00:00.000Z',
      '2026-05-08T10:00:00.000Z',
      '2026-05-03T10:00:00.000Z',
      RepaymentStatus.PARTIAL
   ),
   makeDemoLoan(
      'demo-insight-loan-7',
      'demo-lender-e',
      15,
      16,
      0,
      '2026-05-02T10:00:00.000Z',
      '2026-05-10T10:00:00.000Z',
      '2026-05-02T10:00:00.000Z',
      RepaymentStatus.UNPAID
   )
];
