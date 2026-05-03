import type { User } from '@/types/authTypes';
import type { Loan } from '@/types/loanTypes';

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
   if (diversity < 20) return 'Very Low';
   return 'Unknown';
};

export const calculateLenderDiversity = (
   loans: Loan[],
   userProfiles?: Record<string, User>
): {
   score: number;
   distribution: Array<{ name: string; count: number; percent: string; percentValue: number }>;
   uniqueLenders: number;
   repeatLenders: number;
} => {
   if (loans.length === 0) {
      return {
         score: 0,
         distribution: [],
         uniqueLenders: 0,
         repeatLenders: 0
      };
   }

   // Count loans by lender
   const countMap = loans.reduce((acc: Record<string, number>, loan: Loan) => {
      const lenderName = loan.lenderUser ? userProfiles?.[loan.lenderUser]?.username ?? loan.lenderUser : 'Unknown';
      acc[lenderName] = (acc[lenderName] || 0) + 1;
      return acc;
   }, {});

   const lenderCounts = Object.values(countMap);
   const uniqueLendersCount = lenderCounts.length;
   const repeatLenders = lenderCounts.filter((count) => count > 1).length;

   const mostFrequentLenderShare = Math.max(...lenderCounts) / loans.length;
   const concentrationPenalty =
      loans.length >= 3 && mostFrequentLenderShare > 0.8 ? 25 : loans.length >= 3 && mostFrequentLenderShare > 0.6 ? 15 : 0;
   const score = Math.max(0, Math.min(100, uniqueLendersCount * 20) - concentrationPenalty);

   const distribution = Object.keys(countMap)
      .map((name) => {
         const percentValue = Math.round((countMap[name] / loans.length) * 100);
         return {
            name,
            count: countMap[name],
            percent: `${percentValue}%`,
            percentValue
         };
      })
      .sort((a, b) => b.count - a.count);

   return {
      score,
      distribution,
      uniqueLenders: uniqueLendersCount,
      repeatLenders
   };
};
