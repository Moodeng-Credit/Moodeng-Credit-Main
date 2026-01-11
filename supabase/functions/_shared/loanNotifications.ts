export type LoanNotificationType = 'funded' | 'close_to_default' | 'outstanding';

export type LoanNotificationLoan = {
   tracking_id: string;
   loan_amount: number;
   total_repayment_amount: number;
   due_date: string | null;
   borrower_user: string | null;
};

export type LoanNotificationRecipient = {
   username: string;
   email: string;
};

const formatCurrency = (amount: number) =>
   new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
   }).format(amount);

const formatDueDate = (dueDate: string | null) => {
   if (!dueDate) {
      return 'N/A';
   }

   return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC'
   }).format(new Date(dueDate));
};

export const buildLoanNotificationEmail = (
   type: LoanNotificationType,
   loan: LoanNotificationLoan,
   recipient: LoanNotificationRecipient
) => {
   const formattedLoanAmount = formatCurrency(loan.loan_amount);
   const formattedTotalRepayment = formatCurrency(loan.total_repayment_amount);
   const formattedDueDate = formatDueDate(loan.due_date);

   if (type === 'funded') {
      return {
         subject: 'Your loan has been funded! 🎉',
         text: `Hi ${recipient.username},\n\nGreat news! Your loan request has been funded.\n\nLoan ID: ${loan.tracking_id}\nLoan amount: ${formattedLoanAmount}\nTotal repayment: ${formattedTotalRepayment}\nDue date: ${formattedDueDate}\n\nYou can track your loan status in your Moodeng Credit dashboard.\n\n— Moodeng Credit Team`
      };
   }

   if (type === 'close_to_default') {
      return {
         subject: 'Your loan is close to default',
         text: `Hi ${recipient.username},\n\nThis is a reminder that your loan is approaching its due date.\n\nLoan ID: ${loan.tracking_id}\nOutstanding balance: ${formattedTotalRepayment}\nDue date: ${formattedDueDate}\n\nPlease make a repayment soon to avoid defaulting on your loan.\n\n— Moodeng Credit Team`
      };
   }

   return {
      subject: 'Your loan is overdue',
      text: `Hi ${recipient.username},\n\nYour loan is now overdue. Please make a repayment as soon as possible.\n\nLoan ID: ${loan.tracking_id}\nOutstanding balance: ${formattedTotalRepayment}\nDue date: ${formattedDueDate}\n\nIf you have already repaid, please ignore this message.\n\n— Moodeng Credit Team`
   };
};

export const getCloseToDefaultWindow = (referenceDate: Date, closeToDefaultDays: number) => {
   const start = new Date(referenceDate);
   const end = new Date(referenceDate);
   end.setUTCDate(end.getUTCDate() + closeToDefaultDays);
   return { start, end };
};
