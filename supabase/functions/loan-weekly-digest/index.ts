import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendEmail } from '../_shared/email.ts';
import { buildLoanNotificationEmail, LoanNotificationLoan, LoanNotificationRecipient } from '../_shared/loanNotifications.ts';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const loadBorrowers = async (supabase: ReturnType<typeof createClient>, userIds: string[]) => {
   if (!userIds.length) {
      return new Map<string, LoanNotificationRecipient & { id: string }>();
   }

   const { data, error } = await supabase.from('users').select('id, username, email').in('id', userIds);

   if (error || !data) {
      throw new Error(error?.message ?? 'Failed to load borrowers');
   }

   return new Map(data.map((borrower) => [borrower.id, borrower]));
};

const hasWeeklyDigestBeenSent = async (
   supabase: ReturnType<typeof createClient>,
   payload: { userId: string; sentAfter: string }
) => {
   const { data, error } = await supabase
      .from('loan_notifications')
      .select('id')
      .eq('user_id', payload.userId)
      .eq('notification_type', 'weekly_digest')
      .gte('email_sent_at', payload.sentAfter)
      .limit(1)
      .maybeSingle();

   if (error) {
      throw new Error(error.message);
   }

   return Boolean(data);
};

const recordWeeklyDigest = async (
   supabase: ReturnType<typeof createClient>,
   borrowerId: string,
   loanIds: string[]
) => {
   if (!loanIds.length) {
      return;
   }

   const { error } = await supabase.from('loan_notifications').insert(
      loanIds.map((loanId) => ({
         loan_id: loanId,
         user_id: borrowerId,
         notification_type: 'weekly_digest'
      }))
   );

   if (error) {
      throw new Error(error.message);
   }
};

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }

   if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
   }

   const body = await req.json().catch(() => ({}));
   const referenceDate = body.referenceDate ? new Date(body.referenceDate) : new Date();
   const lookbackDays = Number.parseInt(Deno.env.get('WEEKLY_DIGEST_LOOKBACK_DAYS') ?? `${body.lookbackDays ?? 7}`, 10);
   const sentAfter = new Date(referenceDate);
   sentAfter.setUTCDate(sentAfter.getUTCDate() - (Number.isNaN(lookbackDays) ? 7 : lookbackDays));

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   const { data: loans, error } = await supabase
      .from('loans')
      .select(
         'id, tracking_id, borrower_user_id, loan_amount, total_repayment_amount, due_date, funded_at, lender_user_id, repayment_status'
      )
      .eq('loan_status', 'Lent')
      .in('repayment_status', ['Unpaid', 'Partial']);

   if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
   }

   const borrowers = await loadBorrowers(
      supabase,
      Array.from(new Set((loans ?? []).map((loan) => loan.borrower_user_id).filter(Boolean))) as string[]
   );

   const borrowerBuckets = new Map<string, Array<LoanNotificationLoan & { id: string }>>();

   for (const loan of loans ?? []) {
      if (!loan.borrower_user_id) {
         continue;
      }

      const bucket = borrowerBuckets.get(loan.borrower_user_id) ?? [];
      bucket.push(loan);
      borrowerBuckets.set(loan.borrower_user_id, bucket);
   }

   let sentCount = 0;

   for (const [borrowerId, borrowerLoans] of borrowerBuckets.entries()) {
      const borrower = borrowers.get(borrowerId);
      if (!borrower?.email) {
         continue;
      }

      const alreadySent = await hasWeeklyDigestBeenSent(supabase, { userId: borrower.id, sentAfter: sentAfter.toISOString() });
      if (alreadySent) {
         continue;
      }

      const aggregate = {
         count: borrowerLoans.length,
         totalAmount: borrowerLoans.reduce((sum, loan) => sum + loan.total_repayment_amount, 0)
      };

      const { subject, text } = buildLoanNotificationEmail('weekly_digest', null, borrower, aggregate);

      await sendEmail(borrower.email, subject, text);

      await recordWeeklyDigest(
         supabase,
         borrower.id,
         borrowerLoans.map((loan) => loan.id)
      );

      sentCount += 1;
   }

   return new Response(JSON.stringify({ message: 'Weekly digests sent', sent: sentCount }), { status: 200, headers: corsHeaders });
});
