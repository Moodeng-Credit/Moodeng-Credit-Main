import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendEmail } from '../_shared/email.ts';
import {
   buildLoanNotificationEmail,
   getCloseToDefaultWindow,
   LoanNotificationLoan,
   LoanNotificationType,
   LoanNotificationRecipient
} from '../_shared/loanNotifications.ts';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const hasNotificationBeenSent = async (supabase: ReturnType<typeof createClient>, payload: { loanId: string; userId: string; type: LoanNotificationType }) => {
   const { data } = await supabase
      .from('loan_notifications')
      .select('id')
      .eq('loan_id', payload.loanId)
      .eq('user_id', payload.userId)
      .eq('notification_type', payload.type)
      .maybeSingle();

   return Boolean(data);
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

const notifyBorrower = async (
   supabase: ReturnType<typeof createClient>,
   loan: LoanNotificationLoan & { id: string },
   borrower: LoanNotificationRecipient & { id: string },
   type: LoanNotificationType
) => {
   const alreadySent = await hasNotificationBeenSent(supabase, { loanId: loan.id, userId: borrower.id, type });

   if (alreadySent) {
      return false;
   }

   const { subject, text } = buildLoanNotificationEmail(type, loan, borrower);

   await sendEmail(borrower.email, subject, text);

   const { error: insertError } = await supabase.from('loan_notifications').insert({
      loan_id: loan.id,
      user_id: borrower.id,
      notification_type: type
   });

   if (insertError) {
      throw new Error(insertError.message);
   }

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
   const closeToDefaultDays = Number.parseInt(Deno.env.get('CLOSE_TO_DEFAULT_DAYS') ?? `${body.closeToDefaultDays ?? 3}`, 10);
   const referenceDate = body.referenceDate ? new Date(body.referenceDate) : new Date();

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   const { data: loans, error } = await supabase
      .from('loans')
      .select('id, tracking_id, borrower_user, loan_amount, total_repayment_amount, due_date, repayment_status')
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

   const { end: closeToDefaultEnd } = getCloseToDefaultWindow(referenceDate, Number.isNaN(closeToDefaultDays) ? 3 : closeToDefaultDays);

   let sentCount = 0;

   for (const loan of loans ?? []) {
      if (!loan.borrower_user || !loan.due_date) {
         continue;
      }

      const borrower = borrowers.get(loan.borrower_user);
      if (!borrower?.email) {
         continue;
      }

      const dueDate = new Date(loan.due_date);
      const notificationType: LoanNotificationType | null =
         dueDate.getTime() < referenceDate.getTime()
            ? 'outstanding'
            : dueDate.getTime() <= closeToDefaultEnd.getTime()
              ? 'close_to_default'
              : null;

      if (!notificationType) {
         continue;
      }

      const wasSent = await notifyBorrower(supabase, loan, borrower, notificationType);
      if (wasSent) {
         sentCount += 1;
      }
   }

   return new Response(JSON.stringify({ message: 'Notifications processed', sent: sentCount }), { status: 200, headers: corsHeaders });
});
