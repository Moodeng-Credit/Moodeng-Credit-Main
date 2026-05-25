export type TelegramLoanRequest = {
   id: string;
   tracking_id?: string | null;
   loan_amount: number | string;
   coin?: string | null;
   due_date?: string | null;
   created_at?: string | null;
   reason?: string | null;
   borrower_user_id?: string | null;
};

export type TelegramLoanHistory = {
   id: string;
   loan_amount?: number | string | null;
   created_at?: string | null;
   funded_at?: string | null;
   updated_at?: string | null;
   loan_status?: string | null;
   repayment_status?: string | null;
   lender_user_id?: string | null;
   is_deleted?: boolean | null;
};

export type TelegramBorrowerProfile = {
   username?: string | null;
   cs?: number | null;
   mal?: number | null;
};

type BorrowerStats = {
   totalLoans: number;
   loansRepaid: number;
   creditScore: number | string;
   maxActiveLoans: number | string;
   avgDaysBetweenLoans?: number;
   typicalPaymentTimeHours?: number;
   usualLoanSize?: number;
   lenderDiversityScore?: number;
   repeatLenders?: number;
};

const millisecondsPerDay = 24 * 60 * 60 * 1000;

const toDate = (value?: string | null) => {
   if (!value) return null;
   const date = new Date(value);
   return Number.isNaN(date.getTime()) ? null : date;
};

const toAmount = (value: number | string | null | undefined) => {
   const amount = Number(value ?? 0);
   return Number.isFinite(amount) ? amount : 0;
};

const formatAmount = (value: number | string | null | undefined) => toAmount(value).toFixed(2);

const formatPaymentTime = (hours: number) => {
   if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} minutes`;
   if (hours < 24) return `${Number(hours.toFixed(1))} hours`;
   return `${Number((hours / 24).toFixed(1))} days`;
};

const calculateDurationDays = (loan: TelegramLoanRequest) => {
   const createdAt = toDate(loan.created_at);
   const dueDate = toDate(loan.due_date);
   if (!createdAt || !dueDate) return null;

   const days = Math.round((dueDate.getTime() - createdAt.getTime()) / millisecondsPerDay);
   return Number.isFinite(days) && days >= 0 ? days : null;
};

const calculateStats = (currentLoanId: string, history: TelegramLoanHistory[], borrower: TelegramBorrowerProfile | null): BorrowerStats => {
   const previousLoans = history.filter((loan) => loan.id !== currentLoanId && loan.is_deleted !== true);
   const fundedLoans = previousLoans.filter((loan) => loan.loan_status === 'Lent');
   const paidLoans = previousLoans.filter((loan) => loan.repayment_status === 'Paid');
   const stats: BorrowerStats = {
      totalLoans: previousLoans.length,
      loansRepaid: paidLoans.length,
      creditScore: borrower?.cs ?? 'N/A',
      maxActiveLoans: borrower?.mal ?? 'N/A'
   };

   if (previousLoans.length >= 2) {
      const dates = previousLoans
         .map((loan) => toDate(loan.created_at))
         .filter((date): date is Date => Boolean(date))
         .sort((a, b) => a.getTime() - b.getTime());

      if (dates.length >= 2) {
         const gaps = dates.slice(1).map((date, index) => (date.getTime() - dates[index].getTime()) / millisecondsPerDay);
         stats.avgDaysBetweenLoans = Number((gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length).toFixed(1));
      }
   }

   const payTimes = paidLoans
      .map((loan) => {
         const fundedAt = toDate(loan.funded_at);
         const repaidAt = toDate(loan.updated_at);
         if (!fundedAt || !repaidAt) return null;
         const hours = (repaidAt.getTime() - fundedAt.getTime()) / (60 * 60 * 1000);
         return hours >= 0 ? hours : null;
      })
      .filter((hours): hours is number => hours !== null);

   if (payTimes.length) {
      stats.typicalPaymentTimeHours = Number((payTimes.reduce((sum, hours) => sum + hours, 0) / payTimes.length).toFixed(1));
   }

   if (previousLoans.length) {
      stats.usualLoanSize = Number(
         (previousLoans.reduce((sum, loan) => sum + toAmount(loan.loan_amount), 0) / previousLoans.length).toFixed(2)
      );
   }

   if (fundedLoans.length) {
      const uniqueLenders = new Set(fundedLoans.map((loan) => loan.lender_user_id).filter(Boolean));
      stats.lenderDiversityScore = Math.round((uniqueLenders.size / fundedLoans.length) * 100);
      stats.repeatLenders = fundedLoans.length - uniqueLenders.size;
   }

   return stats;
};

export const getBestTelegramLoanInsights = (stats: BorrowerStats, maxInsights = 2) => {
   const candidates: Array<[number, string]> = [];

   const paymentHours = stats.typicalPaymentTimeHours;
   if (paymentHours !== undefined) {
      if (paymentHours < 1) candidates.push([10, `⚡ Repays extremely fast - avg ${formatPaymentTime(paymentHours)}`]);
      else if (paymentHours < 6) candidates.push([9, `⚡ Fast repayment - typically within ${formatPaymentTime(paymentHours)}`]);
      else if (paymentHours < 24) candidates.push([7, `✅ Repays same day - avg ${formatPaymentTime(paymentHours)}`]);
      else if (paymentHours <= 72) candidates.push([5, `✅ Reliable repayment - avg ${formatPaymentTime(paymentHours)}`]);
   }

   const repeatLenders = stats.repeatLenders;
   if (repeatLenders !== undefined) {
      if (repeatLenders >= 5) candidates.push([9, `🔁 ${repeatLenders} repeat fundings from returning lenders`]);
      else if (repeatLenders >= 2) candidates.push([6, `🔁 ${repeatLenders} repeat fundings - lenders come back`]);
   }

   const diversity = stats.lenderDiversityScore;
   if (diversity !== undefined) {
      if (diversity >= 70) candidates.push([7, `🌐 ${diversity}% lender diversity - funded by many lenders`]);
      else if (diversity >= 50) candidates.push([4, `🌐 ${diversity}% lender diversity`]);
   }

   const daysBetween = stats.avgDaysBetweenLoans;
   if (daysBetween !== undefined) {
      if (daysBetween <= 3) candidates.push([6, `📅 Very active - borrows every ${daysBetween} days on average`]);
      else if (daysBetween <= 7) candidates.push([4, `📅 Regular borrower - every ${daysBetween} days on average`]);
   }

   return candidates
      .sort((a, b) => b[0] - a[0])
      .slice(0, maxInsights)
      .map(([, message]) => message);
};

export const buildTelegramLoanRequestMessage = (
   loan: TelegramLoanRequest,
   history: TelegramLoanHistory[],
   borrower: TelegramBorrowerProfile | null,
   loanUrl: string
) => {
   const stats = calculateStats(loan.id, history, borrower);
   const durationDays = calculateDurationDays(loan);
   const lines = ['🚀 New Loan Request', '', `💰 Amount: ${formatAmount(loan.loan_amount)} ${loan.coin ?? 'USDC'}`];

   if (durationDays !== null) {
      lines.push(`⏳ Duration: ${durationDays} days`);
   }

   lines.push(`📝 Reason: ${loan.reason?.trim() || 'No reason provided'}`, '');

   if (stats.totalLoans === 0) {
      lines.push('🆕 New Borrower', `⭐ Credit Score: ${stats.creditScore}`, `🔢 Max Active Loans: ${stats.maxActiveLoans}`, '');
      lines.push('👉 Fund early & build a relationship');
   } else if (stats.totalLoans < 5) {
      lines.push(
         '📈 Growing Borrower',
         `⭐ Credit Score: ${stats.creditScore}`,
         `📊 ${stats.totalLoans} loans | ${stats.loansRepaid} repaid`,
         ''
      );
      lines.push(...getBestTelegramLoanInsights(stats, 1), '', '👉 Fund this loan');
   } else {
      lines.push(
         '🔥 Proven Borrower',
         `⭐ Credit Score: ${stats.creditScore}`,
         `📊 ${stats.totalLoans} loans | ${stats.loansRepaid} repaid`,
         ''
      );
      lines.push(...getBestTelegramLoanInsights(stats, 2), '', '👉 Fund this loan');
   }

   lines.push(loanUrl);
   return lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
};
