import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendEmail } from '../_shared/email.ts';
import {
   buildLoanNotificationEmail,
   getReminderWindows,
   LoanNotificationLoan,
   LoanNotificationType,
   LoanNotificationRecipient
} from '../_shared/loanNotifications.ts';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const loadBorrowers = async (supabase: ReturnType<typeof createClient>, usernames: string[]) => {
   if (!usernames.length) {
      return new Map<string, LoanNotificationRecipient & { id: string }>();
   }

   const { data, error } = await supabase.from('users').select('id, username, email').in('username', usernames);

   if (error || !data) {
      throw new Error(error?.message ?? 'Failed to load borrowers');
   }

   return new Map(data.map((borrower) => [borrower.username, borrower]));
};

const loadSentLoanIds = async (
   supabase: ReturnType<typeof createClient>,
   payload: { loanIds: string[]; userId: string; type: LoanNotificationType }
) => {
   if (!payload.loanIds.length) {
      return new Set<string>();
   }

   const { data, error } = await supabase
      .from('loan_notifications')
      .select('loan_id')
      .in('loan_id', payload.loanIds)
      .eq('user_id', payload.userId)
      .eq('notification_type', payload.type);

   if (error) {
      throw new Error(error.message);
   }

   return new Set((data ?? []).map((item) => item.loan_id));
};

const recordNotification = async (
   supabase: ReturnType<typeof createClient>,
   borrowerId: string,
   type: LoanNotificationType,
   loanIds: string[]
) => {
   if (!loanIds.length) {
      return;
   }

   const { error } = await supabase.from('loan_notifications').insert(
      loanIds.map((loanId) => ({
         loan_id: loanId,
         user_id: borrowerId,
         notification_type: type
      }))
   );

   if (error) {
      throw new Error(error.message);
   }
};

const notifyBorrower = async (
   supabase: ReturnType<typeof createClient>,
   borrower: LoanNotificationRecipient & { id: string },
   loans: Array<LoanNotificationLoan & { id: string }>,
   type: LoanNotificationType
) => {
   const loanIds = loans.map((loan) => loan.id);
   const sentLoanIds = await loadSentLoanIds(supabase, { loanIds, userId: borrower.id, type });
   const pendingLoans = loans.filter((loan) => !sentLoanIds.has(loan.id));

   if (!pendingLoans.length) {
      return false;
   }

   const aggregate = {
      count: pendingLoans.length,
      totalAmount: pendingLoans.reduce((sum, loan) => sum + loan.total_repayment_amount, 0)
   };

   const { subject, text } = buildLoanNotificationEmail(type, null, borrower, aggregate);

   await sendEmail(borrower.email, subject, text);

   await recordNotification(
      supabase,
      borrower.id,
      type,
      pendingLoans.map((loan) => loan.id)
   );

   return true;
};

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }

   if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
   }

   const body = await req.json().catch(() => ({}));
   const urgentReminderHours = Number.parseInt(
      Deno.env.get('URGENT_REMINDER_HOURS') ?? `${body.urgentReminderHours ?? 72}`,
      10
   );
   const finalReminderHours = Number.parseInt(
      Deno.env.get('FINAL_REMINDER_HOURS') ?? `${body.finalReminderHours ?? 24}`,
      10
   );
   const referenceDate = body.referenceDate ? new Date(body.referenceDate) : new Date();

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   const { data: loans, error } = await supabase
      .from('loans')
      .select(
         'id, tracking_id, borrower_user, loan_amount, total_repayment_amount, due_date, funded_at, lender_user, repayment_status'
      )
      .eq('loan_status', 'Lent')
      .in('repayment_status', ['Unpaid', 'Partial'])
      .not('due_date', 'is', null);

   if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
   }

   const borrowers = await loadBorrowers(
      supabase,
      Array.from(new Set((loans ?? []).map((loan) => loan.borrower_user).filter(Boolean))) as string[]
   );

   const { final, urgent } = getReminderWindows(
      referenceDate,
      Number.isNaN(urgentReminderHours) ? 72 : urgentReminderHours,
      Number.isNaN(finalReminderHours) ? 24 : finalReminderHours
   );

   const borrowerBuckets = new Map<
      string,
      {
         urgent: Array<LoanNotificationLoan & { id: string }>;
         final: Array<LoanNotificationLoan & { id: string }>;
      }
   >();

   for (const loan of loans ?? []) {
      if (!loan.borrower_user || !loan.due_date) {
         continue;
      }

      const dueDate = new Date(loan.due_date);

      const isFinalWindow = dueDate.getTime() >= final.start.getTime() && dueDate.getTime() <= final.end.getTime();
      const isUrgentWindow = dueDate.getTime() > urgent.start.getTime() && dueDate.getTime() <= urgent.end.getTime();

      if (!isFinalWindow && !isUrgentWindow) {
         continue;
      }

      const bucket = borrowerBuckets.get(loan.borrower_user) ?? { urgent: [], final: [] };
      if (isFinalWindow) {
         bucket.final.push(loan);
      } else if (isUrgentWindow) {
         bucket.urgent.push(loan);
      }

      borrowerBuckets.set(loan.borrower_user, bucket);
   }

   let sentCount = 0;

   for (const [borrowerUsername, bucket] of borrowerBuckets.entries()) {
      const borrower = borrowers.get(borrowerUsername);
      if (!borrower?.email) {
         continue;
      }

      if (bucket.urgent.length) {
         const wasSent = await notifyBorrower(supabase, borrower, bucket.urgent, 'urgent_reminder');
         if (wasSent) {
            sentCount += 1;
         }
      }

      if (bucket.final.length) {
         const wasSent = await notifyBorrower(supabase, borrower, bucket.final, 'final_reminder');
         if (wasSent) {
            sentCount += 1;
         }
      }
   }

   return new Response(JSON.stringify({ message: 'Notifications processed', sent: sentCount }), { status: 200, headers: corsHeaders });
});
