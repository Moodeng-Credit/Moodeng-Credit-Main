export interface StatCardConfig {
   key: 'repayments' | 'active' | 'defaulted' | 'pending';
   label: string;
   bgColor: string;
   iconBg: string;
   icon: string;
   textColor: string;
}

export interface StatsData {
   repayments: { count: number; total: number };
   active: { count: number; total: number };
   defaulted: { count: number; total: number };
   pending: { count: number; total: number };
}

export interface CreditLevel {
   id: string;
   unlocked: boolean;
   amount: number;
   date?: string;
   isMaxCredit?: boolean;
   unlockRequirement?: string;
   requestable?: boolean;
   progressionPaused?: boolean;
}

export type RoleType = 'borrower' | 'lender';

export type MilestoneStatus = 'completed' | 'next' | 'locked';

export interface Milestone {
   id: string;
   title: string;
   description: string;
   status: MilestoneStatus;
   icon?: string;
}
