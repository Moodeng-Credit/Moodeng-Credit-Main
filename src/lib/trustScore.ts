import { parseDateSafely } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';

import type { Loan } from '@/types/loanTypes';
import type { User } from '@/types/authTypes';

/**
 * Trust Score Calculation
 * 
 * Base Score = 50
 * +5 per on-time repayment
 * -10 per missed repayment
 * +10 for World ID verification
 * Max = 100, Min = 0
 */

export type TrustScoreLevel = 'Poor' | 'Fair' | 'Good Standing' | 'Excellent';

export interface TrustScoreData {
   score: number;
   level: TrustScoreLevel;
   color: string;
   percentage: number;
}

const BASE_SCORE = 50;
const ON_TIME_BONUS = 5;
const LATE_PENALTY = 10;
const VERIFICATION_BONUS = 10;
const MAX_SCORE = 100;
const MIN_SCORE = 0;

export const getTrustScoreLevel = (score: number): TrustScoreLevel => {
   if (score >= 90) return 'Excellent';
   if (score >= 70) return 'Good Standing';
   if (score >= 40) return 'Fair';
   return 'Poor';
};

export const getTrustScoreColor = (level: TrustScoreLevel): string => {
   switch (level) {
      case 'Excellent':
         return '#10b981'; // emerald-500
      case 'Good Standing':
         return '#22c55e'; // green-500
      case 'Fair':
         return '#f97316'; // orange-500
      case 'Poor':
         return '#ef4444'; // red-500
   }
};

export const calculateTrustScore = (user: User, loans: Loan[]): TrustScoreData => {
   let score = BASE_SCORE;

   // Add verification bonus
   if (user.isWorldId === 'ACTIVE') {
      score += VERIFICATION_BONUS;
   }

   // Filter to only paid loans
   const paidLoans = loans.filter((loan) => loan.repaymentStatus === 'Paid');

   paidLoans.forEach((loan) => {
      const repaidAmount = toNumber(loan.repaidAmount);
      const totalRepayment = toNumber(loan.totalRepaymentAmount);
      const isFullyRepaid = totalRepayment > 0 ? repaidAmount >= totalRepayment : repaidAmount > 0;

      if (!isFullyRepaid) return;

      const paidAt = parseDateSafely(loan.updatedAt);
      const dueDate = parseDateSafely(loan.dueDate);
      const isOnTime = paidAt.getTime() <= dueDate.getTime();

      if (isOnTime) {
         score += ON_TIME_BONUS;
      } else {
         score -= LATE_PENALTY;
      }
   });

   // Clamp score between MIN and MAX
   score = Math.max(MIN_SCORE, Math.min(MAX_SCORE, score));

   const level = getTrustScoreLevel(score);
   const color = getTrustScoreColor(level);
   const percentage = (score / MAX_SCORE) * 100;

   return {
      score,
      level,
      color,
      percentage
   };
};
