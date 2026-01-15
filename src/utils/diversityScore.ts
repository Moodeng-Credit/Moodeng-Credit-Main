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
   distribution: Array<{ name: string; percent: string }>;
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

   // Calculate unique lenders (those who lent only once)
   const uniqueLendersCount = Object.values(countMap).filter((count) => count === 1).length;

   // Calculate score as percentage of unique lenders
   const score = Math.round((uniqueLendersCount / loans.length) * 100);

   // Create distribution array
   const distribution = Object.keys(countMap).map((name) => ({
      name,
      percent: `${Math.round((countMap[name] / loans.length) * 100)}%`
   }));

   // Calculate repeat lenders
   const repeatLenders = Object.keys(countMap).length - uniqueLendersCount;

   return {
      score,
      distribution,
      uniqueLenders: uniqueLendersCount,
      repeatLenders
   };
};
