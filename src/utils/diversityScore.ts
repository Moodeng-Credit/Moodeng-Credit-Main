import type { User } from '@/types/authTypes';
import type { Loan } from '@/types/loanTypes';

export interface WalletLivenessData {
   ageInDays: number;
   transferCount: number;
   hasMoreThan100Transfers: boolean;
   daysSinceLastTx: number;
   hasHistory: boolean;
}

export interface LenderGravityDetail {
   lenderId: string;
   name: string;
   gravity: number;
   newnessFactor: number;
   burstFactor: number;
   accountAgeAtFirstLoanDays: number;
   walletTrustScore?: number;
}

export interface LenderDistributionItem {
   name: string;
   count: number;
   percent: string;
   percentValue: number;
}

export const getDiversityColor = (diversity: number): string => {
   if (diversity >= 80) return 'green';
   if (diversity >= 60) return 'blue';
   if (diversity >= 40) return 'yellow';
   if (diversity >= 20) return 'orange';
   return 'red';
};

export const getDiversityStatus = (diversity: number): string => {
   if (diversity >= 80) return 'Excellent';
   if (diversity >= 60) return 'Good';
   if (diversity >= 40) return 'Fair';
   if (diversity >= 20) return 'Low';
   return 'Very Low';
};

const SECONDS_PER_DAY = 86400;

function maxItemsIn30DayWindow(timestamps: number[]): number {
   if (timestamps.length === 0) return 0;

   const sorted = [...timestamps].sort((a, b) => a - b);
   let max = 1;

   for (let start = 0; start < sorted.length; start++) {
      let count = 1;
      for (let end = start + 1; end < sorted.length; end++) {
         if (sorted[end] - sorted[start] <= 30 * SECONDS_PER_DAY) {
            count += 1;
            continue;
         }
         break;
      }
      max = Math.max(max, count);
   }

   return max;
}

function computeBurstFactor(loanTimestampsSeconds: number[]): number {
   if (loanTimestampsSeconds.length < 2) return 1;

   const sorted = [...loanTimestampsSeconds].sort((a, b) => a - b);
   const gaps = sorted.slice(1).map((timestamp, index) => (timestamp - sorted[index]) / SECONDS_PER_DAY);
   const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;

   if (mean === 0) return 2;

   const standardDeviation = Math.sqrt(gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / gaps.length);
   const burstiness = (standardDeviation - mean) / (standardDeviation + mean);

   return 1 + Math.max(0, burstiness);
}

function computeWalletTrustScore(accountAgeAtFirstLoanDays: number, liveness: WalletLivenessData): number {
   const ageTrustScore = Math.min(1, accountAgeAtFirstLoanDays / 180);

   if (!liveness.hasHistory) {
      return 0.4 * ageTrustScore;
   }

   const effectiveCount = liveness.hasMoreThan100Transfers ? 150 : liveness.transferCount;
   const activityTrustScore = Math.min(1, Math.sqrt(effectiveCount) / 10);
   const dormancyTrustScore = Math.exp(-liveness.daysSinceLastTx / 365);

   return 0.4 * ageTrustScore + 0.3 * activityTrustScore + 0.3 * dormancyTrustScore;
}

const toTimestampSeconds = (date: string | undefined): number => {
   const timestamp = date ? new Date(date).getTime() : NaN;
   return Number.isFinite(timestamp) ? timestamp / 1000 : Date.now() / 1000;
};

function getEarlyHistoryConfidence(fundedLoanCount: number): number {
   if (fundedLoanCount < 2) return 0;
   if (fundedLoanCount >= 8) return 1;
   return (fundedLoanCount - 1) / 7;
}

function blendTowardNeutralScore(rawScore: number, confidence: number): number {
   const neutralScore = 50;
   return Math.round(rawScore * confidence + neutralScore * (1 - confidence));
}

export const calculateLenderDiversity = (
   loans: Loan[],
   userProfiles?: Record<string, User>,
   walletData?: Record<string, WalletLivenessData>
): {
   score: number;
   rawScore: number;
   confidence: number;
   hasEnoughHistory: boolean;
   distribution: LenderDistributionItem[];
   uniqueLenders: number;
   repeatLenders: number;
   gravityDetails: LenderGravityDetail[];
   coordinationBoost: number;
   totalGravity: number;
} => {
   const fundedLoans = loans.filter((loan) => loan.loanStatus === 'Lent' && loan.lenderUser);

   if (fundedLoans.length === 0) {
      return {
         score: 0,
         rawScore: 0,
         confidence: 0,
         hasEnoughHistory: false,
         distribution: [],
         uniqueLenders: 0,
         repeatLenders: 0,
         gravityDetails: [],
         coordinationBoost: 1,
         totalGravity: 0
      };
   }

   const totalAmount = fundedLoans.reduce((sum, loan) => sum + Number(loan.loanAmount), 0);
   const nowSeconds = Date.now() / 1000;
   const loansByLender = fundedLoans.reduce<Record<string, Loan[]>>((acc, loan) => {
      const lenderId = loan.lenderUser!;
      acc[lenderId] = acc[lenderId] ?? [];
      acc[lenderId].push(loan);
      return acc;
   }, {});

   const lenderIds = Object.keys(loansByLender);
   const uniqueLenders = lenderIds.length;
   const repeatLenders = lenderIds.filter((lenderId) => loansByLender[lenderId].length > 1).length;

   const distribution = lenderIds
      .map((lenderId) => {
         const lenderLoans = loansByLender[lenderId];
         const lenderTotal = lenderLoans.reduce((sum, loan) => sum + Number(loan.loanAmount), 0);
         const percentValue = totalAmount > 0 ? Math.round((lenderTotal / totalAmount) * 100) : 0;

         return {
            name: userProfiles?.[lenderId]?.username ?? lenderId,
            count: lenderLoans.length,
            percent: `${percentValue}%`,
            percentValue
         };
      })
      .sort((a, b) => b.count - a.count || b.percentValue - a.percentValue);

   if (fundedLoans.length < 2) {
      return {
         score: 0,
         rawScore: 0,
         confidence: 0,
         hasEnoughHistory: false,
         distribution,
         uniqueLenders,
         repeatLenders,
         gravityDetails: [],
         coordinationBoost: 1,
         totalGravity: 0
      };
   }

   const gravityDetails: LenderGravityDetail[] = [];
   let totalGravity = 0;

   for (const lenderId of lenderIds) {
      const lenderLoans = loansByLender[lenderId];
      const lenderProfile = userProfiles?.[lenderId];
      const lenderAmount = lenderLoans.reduce((sum, loan) => sum + Number(loan.loanAmount), 0);
      const amountShare = totalAmount > 0 ? lenderAmount / totalAmount : 0;
      const hhi = amountShare * amountShare;
      const timestamps = lenderLoans.map((loan) => toTimestampSeconds(loan.fundedAt ?? loan.createdAt)).sort((a, b) => a - b);
      const firstLoanTimestamp = timestamps[0] ?? nowSeconds;
      const accountCreatedTimestamp = lenderProfile?.createdAt ? toTimestampSeconds(lenderProfile.createdAt) : firstLoanTimestamp;
      const accountAgeAtFirstLoanDays = Math.max(1, (firstLoanTimestamp - accountCreatedTimestamp) / SECONDS_PER_DAY);
      const liveness = walletData?.[lenderId];
      let walletTrustScore: number | undefined;

      const newnessFactor = liveness
         ? (() => {
              walletTrustScore = computeWalletTrustScore(accountAgeAtFirstLoanDays, liveness);
              return Math.max(1, 180 * (1 - walletTrustScore));
           })()
         : Math.max(1, 180 / accountAgeAtFirstLoanDays);

      const recencyDecay = timestamps.reduce((sum, timestamp) => {
         const daysSinceLoan = Math.max(0, (nowSeconds - timestamp) / SECONDS_PER_DAY);
         return sum + Math.exp(-daysSinceLoan / 60);
      }, 0);
      const burstFactor = computeBurstFactor(timestamps);
      const gravity = hhi * newnessFactor * recencyDecay * burstFactor;

      gravityDetails.push({
         lenderId,
         name: lenderProfile?.username ?? lenderId,
         gravity,
         newnessFactor,
         burstFactor,
         accountAgeAtFirstLoanDays,
         walletTrustScore
      });

      totalGravity += gravity;
   }

   const joinTimestamps = lenderIds
      .map((lenderId) => userProfiles?.[lenderId]?.createdAt)
      .filter((createdAt): createdAt is string => Boolean(createdAt))
      .map(toTimestampSeconds);
   const maxCoordinated = maxItemsIn30DayWindow(joinTimestamps);
   const coordinationRate = uniqueLenders > 1 ? maxCoordinated / uniqueLenders : 0;
   const coordinationBoost = 1 + coordinationRate * coordinationRate;
   const rawScore = Math.max(0, Math.min(100, Math.round(100 - 20 * Math.log(1 + totalGravity * coordinationBoost))));
   const confidence = getEarlyHistoryConfidence(fundedLoans.length);
   const score = blendTowardNeutralScore(rawScore, confidence);

   return {
      score,
      rawScore,
      confidence,
      hasEnoughHistory: true,
      distribution,
      uniqueLenders,
      repeatLenders,
      gravityDetails: gravityDetails.sort((a, b) => b.gravity - a.gravity),
      coordinationBoost,
      totalGravity
   };
};
