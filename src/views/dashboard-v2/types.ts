export type MoodengTierId = 'rookie' | 'rising' | 'prime' | 'apex';

/** Figma "slicing" frame: waiting for a loan (or unverified) / has a loan / repaid. */
export type MoodengMood = 'waiting' | 'loan' | 'repaid';

export type DashboardV2MilestoneStatus = 'next' | 'unlocked' | 'locked';

export interface DashboardV2Milestone {
   id: string;
   title: string;
   reward: string;
   status: DashboardV2MilestoneStatus;
   /** Voucher-style reward row (yellow highlight + coupon icon in the design). */
   isVoucher: boolean;
   actionTo?: string;
}

export interface DashboardV2Due {
   id: string;
   amount: number;
   daysRemaining: number;
   lenderName: string;
   isOverdue: boolean;
}

export interface CreditLevelHint {
   /** Rendered in the accent color, e.g. "$13.32". */
   highlight: string;
   /** Rendered muted, e.g. " left to LV.2". */
   rest: string;
}

export interface DashboardV2Model {
   firstName: string;
   daysLive: number;
   isVerified: boolean;
   pandesal: number;
   tier: MoodengTierId;
   mood: MoodengMood;
   creditLevel: number;
   /** 0–1 progress toward the next credit level. */
   creditProgress: number;
   creditHint: CreditLevelHint;
   showConnectWallet: boolean;
   milestones: DashboardV2Milestone[];
   summary: {
      repaymentsTotal: number;
      active: number;
      pending: number;
      defaulted: number;
   };
   dues: DashboardV2Due[];
   hasOverdue: boolean;
   insightsHref: string;
}

export type DashboardV2PreviewState = 'real' | 'unverified' | 'verified' | 'defaulted';
