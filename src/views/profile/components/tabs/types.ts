import type { LucideIcon } from 'lucide-react';

export interface StatCardConfig {
   key: 'repayments' | 'active' | 'defaulted' | 'pending';
   label: string;
   bgColor: string;
   iconBg: string;
   icon: LucideIcon;
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
   lender?: string;
   reason?: string;
   repayTime?: string;
   isMaxCredit?: boolean;
   unlockRequirement?: string;
   hasRequestButton?: boolean;
}

export type RoleType = 'borrower' | 'lender';
