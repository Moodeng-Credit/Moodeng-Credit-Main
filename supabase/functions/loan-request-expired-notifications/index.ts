import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { getBorrowerTelegramNotificationsEnabled, sendBorrowerLoanNotification } from '../_shared/borrowerNotificationDelivery.ts';
import { LoanNotificationLoan, LoanNotificationRecipient } from '../_shared/loanNotifications.ts';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type SupabaseClient = any;

type BorrowerRecord = LoanNotificationRecipient & { id: string };
type ExpiredRequestLoan = LoanNotificationLoan & { id: string; created_at: string | null };
type SentLoanNotificationRow = { loan_id: string };

const DEFAULT_REQUEST_EXPIRATION_DAYS = 7;

const parseExpirationDays = (value: unknown) => {
   const parsed = Number.parseInt(String(value ?? ''), 10);
   return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REQUEST_EXPIRATION_DAYS;
};

const getExpirationCutoff = (referenceDate: Date, expirationDays: number) => {
   const cutoff = new Date(referenceDate);
   cutoff.setUTCDate(cutoff.getUTCDate() - expirationDays);
   return cutoff;
};

const loadBorrowers = async (supabase: SupabaseClient, userIds: string[]): Promise<Map<string, BorrowerRecord>> => {
   if (!userIds.length) {
      return new Map<string, BorrowerRecord>();
   }

   const { data, error } = await supabase.from('users').select('id, username, telegram_username, email, chat_id').in('id', userIds);

   if (error || !data) {
      throw new Error(error?.message ?? 'Failed to load borrowers');
   }

   return new Map<string, BorrowerRecord>((data as BorrowerRecord[]).map((borrower) => [borrower.id, borrower]));
};

const loadSentLoanIds = async (supabase: SupabaseClient, payload: { loanIds: string[]; userId: string }) => {
   if (!payload.loanIds.length) {
      return new Set<string>();
   }

   const { data, error } = await supabase
      .from('loan_notifications')
      .select('loan_id')
      .in('loan_id', payload.loanIds)
      .eq('user_id', payload.userId)
      .eq('notification_type', 'request_expired');

   if (error) {
      throw new Error(error.message);
   }

   return new Set(((data ?? []) as SentLoanNotificationRow[]).map((item) => item.loan_id));
};

const recordRequestExpiredNotification = async (supabase: SupabaseClient, borrowerId: string, loanId: string) => {
   const { error } = await supabase.from('loan_notifications').insert({
      loan_id: loanId,
      user_id: borrowerId,
      notification_type: 'request_expired'
   });

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
   const expirationDays = parseExpirationDays(body.expirationDays ?? Deno.env.get('REQUEST_EXPIRATION_DAYS'));
   const expiredBefore = getExpirationCutoff(referenceDate, expirationDays);
   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   const { data: loans, error } = await supabase
      .from('loans')
      .select(
         'id, tracking_id, borrower_user_id, loan_amount, total_repayment_amount, due_date, created_at, funded_at, lender_user_id, repayment_status'
      )
      .eq('loan_status', 'Requested')
      .lte('created_at', expiredBefore.toISOString());

   if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
   }

   const expiredLoans = (loans ?? []) as ExpiredRequestLoan[];
   const borrowerIds = Array.from(new Set(expiredLoans.map((loan) => loan.borrower_user_id).filter(Boolean))) as string[];
   const borrowers = await loadBorrowers(supabase, borrowerIds);
   const telegramEnabled = await getBorrowerTelegramNotificationsEnabled(supabase);

   const borrowerBuckets = new Map<string, ExpiredRequestLoan[]>();

   for (const loan of expiredLoans) {
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
      if (!borrower?.email && !borrower?.chat_id) {
         continue;
      }

      const sentLoanIds = await loadSentLoanIds(supabase, {
         loanIds: borrowerLoans.map((loan) => loan.id),
         userId: borrower.id
      });
      const pendingLoans = borrowerLoans.filter((loan) => !sentLoanIds.has(loan.id));

      for (const loan of pendingLoans) {
         const delivery = await sendBorrowerLoanNotification('request_expired', loan, borrower, undefined, { telegramEnabled });

         if (!delivery.emailSent && !delivery.telegramSent) {
            continue;
         }

         await recordRequestExpiredNotification(supabase, borrower.id, loan.id);
         sentCount += 1;
      }
   }

   return new Response(
      JSON.stringify({
         message: 'Expired request notifications sent',
         sent: sentCount,
         expiredBefore: expiredBefore.toISOString()
      }),
      { status: 200, headers: corsHeaders }
   );
});
