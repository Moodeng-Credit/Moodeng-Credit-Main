import type { MyRewards } from '@/lib/friendReferrals';

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
   /** Pandesal (Trust Points) awarded; the voucher milestone also carries its points. */
   points: number;
   /** Highest-value milestone — gets the "Top Reward" badge and the yellow highlight. */
   isTopReward: boolean;
   actionLabel?: string;
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
   /** The three milestones the dashboard card shows. */
   milestones: DashboardV2Milestone[];
   /** Every borrower milestone, in order, for the All Milestones page. */
   allMilestones: DashboardV2Milestone[];
   /** Pandesal needed for the next Moodeng tier, or null at Apex. */
   pandesalGoal: number | null;
   /** The borrower's generated invite code (e.g. SDOIVU01381), or null until it loads / when signed out. */
   referralCode: string | null;
   /** True when the invite code or rewards could not be loaded (e.g. the backend is not deployed yet). */
   referralUnavailable?: boolean;
   /** True while the invite code / rewards are still loading from the database. */
   referralLoading?: boolean;
   /** Voucher rewards as computed by the database (what can be claimed, and claim statuses). */
   rewards: MyRewards;
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

export type DashboardV2PreviewState = 'real' | 'unverified' | 'verified' | 'defaulted' | 'rewarded';

export type DashboardV2Language = 'en' | 'fil';
