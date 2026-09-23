import type { DashboardV2Milestone, DashboardV2Model, DashboardV2PreviewState } from '@/views/dashboard-v2/types';

// SAMPLE DATA: values copied from the Figma frames so each design state can be reviewed as drawn.

const SAMPLE_MILESTONES: DashboardV2Milestone[] = [
   {
      id: 'first-loan-request',
      title: 'Post your first loan request',
      reward: '+10 Pandesal',
      status: 'next',
      isVoucher: false,
      actionTo: '/request-board'
   },
   {
      id: 'first-funded-loan',
      title: 'Get funded by a lender',
      reward: '+15 Pandesal',
      status: 'locked',
      isVoucher: false
   },
   {
      id: 'first-on-time-repayment',
      title: 'Repay a loan on time',
      reward: '₱50 GrabFood voucher',
      status: 'locked',
      isVoucher: true
   }
];

const SAMPLE_BASE: Omit<DashboardV2Model, 'isVerified' | 'pandesal' | 'mood' | 'creditLevel' | 'creditProgress' | 'creditHint' | 'dues' | 'summary' | 'hasOverdue'> = {
   firstName: 'Jimmy',
   daysLive: 6,
   tier: 'rookie',
   showConnectWallet: true,
   milestones: SAMPLE_MILESTONES,
   insightsHref: '/dashboard-v2-preview'
};

export const SAMPLE_STATES: Record<Exclude<DashboardV2PreviewState, 'real'>, DashboardV2Model> = {
   unverified: {
      ...SAMPLE_BASE,
      isVerified: false,
      pandesal: 0,
      mood: 'waiting',
      creditLevel: 0,
      creditProgress: 0,
      creditHint: { highlight: '$20', rest: ' left to LV.1' },
      summary: { repaymentsTotal: 0, active: 0, pending: 0, defaulted: 0 },
      dues: [],
      hasOverdue: false
   },
   verified: {
      ...SAMPLE_BASE,
      isVerified: true,
      pandesal: 30,
      mood: 'loan',
      creditLevel: 1,
      creditProgress: 0.4,
      creditHint: { highlight: '$13.32', rest: ' left to LV.2' },
      summary: { repaymentsTotal: 1, active: 5, pending: 1.68, defaulted: 0 },
      dues: [
         { id: 'sample-due-1', amount: 5, daysRemaining: 5, lenderName: 'Maricar Cruz', isOverdue: false },
         { id: 'sample-due-2', amount: 1.68, daysRemaining: 13, lenderName: 'Milagros Reyes', isOverdue: false }
      ],
      hasOverdue: false
   },
   defaulted: {
      ...SAMPLE_BASE,
      isVerified: true,
      pandesal: 30,
      mood: 'repaid',
      creditLevel: 1,
      creditProgress: 0.35,
      creditHint: { highlight: '$10.32', rest: ' left to LV.2' },
      summary: { repaymentsTotal: 1, active: 5, pending: 1.68, defaulted: 3 },
      dues: [
         { id: 'sample-due-0', amount: 3, daysRemaining: 0, lenderName: 'Maricar Cruz', isOverdue: true },
         { id: 'sample-due-1', amount: 5, daysRemaining: 5, lenderName: 'Maricar Cruz', isOverdue: false },
         { id: 'sample-due-2', amount: 1.68, daysRemaining: 13, lenderName: 'Milagros Reyes', isOverdue: false }
      ],
      hasOverdue: true
   }
};
