export type LoanNotificationType = 'funded' | 'urgent_reminder' | 'final_reminder' | 'weekly_digest';

export type LoanNotificationLoan = {
   tracking_id: string;
   loan_amount: number;
   total_repayment_amount: number;
   due_date: string | null;
   funded_at: string | null;
   borrower_user: string | null;
   lender_user: string | null;
};

export type LoanNotificationRecipient = {
   username: string;
   email: string;
};

export type LoanNotificationAggregate = {
   count: number;
   totalAmount: number;
};

const formatCurrency = (amount: number) =>
   new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
   }).format(amount);

const formatDate = (dateValue: string | null) => {
   if (!dateValue) {
      return 'N/A';
   }

   return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeZone: 'UTC'
   }).format(new Date(dateValue));
};

const getEnvValue = (key: string) => {
   if (typeof Deno !== 'undefined' && 'env' in Deno) {
      return Deno.env.get(key);
   }

   if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
   }

   return undefined;
};

const buildDashboardLink = () => {
   const siteUrl = getEnvValue('VITE_SITE_URL') ?? '';
   if (!siteUrl) {
      return '/dashboard';
   }

   return `${siteUrl.replace(/\/$/, '')}/dashboard`;
};

export const buildLoanNotificationEmail = (
   type: LoanNotificationType,
   loan: LoanNotificationLoan | null,
   recipient: LoanNotificationRecipient,
   aggregate?: LoanNotificationAggregate
) => {
   const formattedLoanAmount = loan ? formatCurrency(loan.loan_amount) : '';
   const formattedTotalRepayment = loan ? formatCurrency(loan.total_repayment_amount) : '';
   const formattedDueDate = loan ? formatDate(loan.due_date) : '';
   const formattedFundedDate = loan ? formatDate(loan.funded_at) : '';
   const formattedAggregateTotal = aggregate ? formatCurrency(aggregate.totalAmount) : '';
   const dashboardLink = buildDashboardLink();

   if (type === 'funded') {
      if (!loan) {
         throw new Error('Loan details are required for funded notifications.');
      }

      return {
         subject: 'Your loan has been funded!',
         text: `Great news! Your request for ${formattedLoanAmount} (ID: ${loan.tracking_id}) was funded by ${loan.lender_user ?? 'a lender'} on ${formattedFundedDate}. 🍉

Your USDC is ready in your wallet!

To keep building your credit and unlocking higher tiers, remember to repay ${formattedTotalRepayment} by ${formattedDueDate}.

If you need help with how to do it or have other uses, contact support@moodeng.app`
      };
   }

   if (type === 'urgent_reminder') {
      return {
         subject: 'Urgent reminder: loans due in 3 days',
         text: `Hiii! Moodeng here with a quick check-in from the water. 🌊

You have ${aggregate?.count ?? 0} loans due in 3 days.

Total to Repay: ${formattedAggregateTotal}

Repaying these on time keeps your 'Good Standing' status and helps you climb to the next level of the Value Pyramid! ✨

If you need help with how to do it or have other uses, contact support@moodeng.app`
      };
   }

   if (type === 'final_reminder') {
      return {
         subject: 'Final reminder: repayment due in 24 hours',
         text: `Final splash! 💦

Your repayment of ${formattedAggregateTotal} is due in 24 hours.

Please make sure your wallet has the stablecoins ready for the transfer so your credit progress stays on track. You're so close to completing another successful cycle!

${dashboardLink}

If you need help with how to do it or have other uses, contact support@moodeng.app`
      };
   }

   return {
      subject: 'Your Weekly Moodeng Credit Digest',
      text: `Your Weekly Moodeng Credit Digest 📊

• Active Loans: ${aggregate?.count ?? 0}
• Total Outstanding: ${formattedAggregateTotal}
• Current Tier: [Tier Name]

Every on-time payment is a brick in your trust layer. Keep growing with me! 🦛

If you need help with how to do it or have other uses, contact support@moodeng.app`
   };
};

export const getReminderWindows = (referenceDate: Date, urgentHours: number, finalHours: number) => {
   const finalEnd = new Date(referenceDate);
   finalEnd.setUTCHours(finalEnd.getUTCHours() + finalHours);

   const urgentStart = new Date(referenceDate);
   urgentStart.setUTCHours(urgentStart.getUTCHours() + finalHours);

   const urgentEnd = new Date(referenceDate);
   urgentEnd.setUTCHours(urgentEnd.getUTCHours() + urgentHours);

   return {
      final: { start: referenceDate, end: finalEnd },
      urgent: { start: urgentStart, end: urgentEnd }
   };
};
