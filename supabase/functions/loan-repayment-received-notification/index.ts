import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendEmail } from '../_shared/email.ts';
import { getTelegramBotSettingEnabled } from '../_shared/borrowerNotificationDelivery.ts';
import {
   buildLenderRepaymentTelegram,
   buildLoanNotificationEmail,
   LoanNotificationType
} from '../_shared/loanNotifications.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';
import {
   calculateTrustPointRewardDelta,
   markLoansUnpaid
} from '../_shared/trustPointRewards.ts';
import type {
   TrustPointMilestoneDefinition,
   TrustPointRewardLoan
} from '../_shared/trustPointRewards.ts';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type SupabaseClient = any;
type MilestoneCompletionRow = { milestone_id: string; completed_at: string };

const hasNotificationBeenSent = async (
   supabase: SupabaseClient,
   payload: { loanId: string; userId: string; type: LoanNotificationType }
) => {
   const { data } = await supabase
      .from('loan_notifications')
      .select('id')
      .eq('loan_id', payload.loanId)
      .eq('user_id', payload.userId)
      .eq('notification_type', payload.type)
      .maybeSingle();

   return Boolean(data);
};

const getLenderDirectNotificationsEnabled = async (supabase: SupabaseClient) => {
   const envValue = Deno.env.get('LENDER_TELEGRAM_NOTIFICATIONS_ENABLED') ?? Deno.env.get('TELEGRAM_DIRECT_MESSAGES_ENABLED');
   if (envValue) {
      return envValue === 'true';
   }

   return getTelegramBotSettingEnabled(supabase, 'lender_direct_notifications_enabled');
};

const loadTrustPointRewardData = async (supabase: SupabaseClient, borrowerId: string, paidAt: Date) => {
   const { data: loans, error: loansError } = await supabase
      .from('loans')
      .select(
         'id, borrower_user_id, loan_amount, total_repayment_amount, repaid_amount, due_date, funded_at, lender_user_id, loan_status, repayment_status, updated_at'
      )
      .eq('borrower_user_id', borrowerId);

   if (loansError) {
      throw new Error(loansError.message);
   }

   const { data: completions, error: completionsError } = await supabase
      .from('user_milestone_completions')
      .select('milestone_id, completed_at')
      .eq('user_id', borrowerId);

   if (completionsError) {
      throw new Error(completionsError.message);
   }

   const { data: milestoneDefinitions, error: milestoneDefinitionsError } = await supabase
      .from('milestone_definitions')
      .select('id, points_awarded, is_active')
      .eq('is_active', true);

   if (milestoneDefinitionsError) {
      throw new Error(milestoneDefinitionsError.message);
   }

   const completionRows = (completions ?? []) as MilestoneCompletionRow[];

   return {
      loans: (loans ?? []) as TrustPointRewardLoan[],
      completedMilestoneIdsBeforePayment: new Set(
         completionRows
            .filter((completion) => new Date(completion.completed_at).getTime() < paidAt.getTime())
            .map((completion) => completion.milestone_id)
      ),
      milestoneDefinitions: (milestoneDefinitions ?? []) as TrustPointMilestoneDefinition[]
   };
};

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }

   if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
   }

   const { loanId } = await req.json().catch(() => ({}));

   if (!loanId) {
      return new Response(JSON.stringify({ error: 'loanId is required' }), { status: 400, headers: corsHeaders });
   }

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   const { data: loan, error: loanError } = await supabase
      .from('loans')
      .select(
         'id, tracking_id, borrower_user_id, loan_amount, total_repayment_amount, repaid_amount, due_date, funded_at, lender_user_id, repayment_status, updated_at'
      )
      .eq('id', loanId)
      .maybeSingle();

   if (loanError) {
      return new Response(JSON.stringify({ error: loanError.message }), { status: 500, headers: corsHeaders });
   }

   if (!loan) {
      return new Response(JSON.stringify({ error: 'Loan not found' }), { status: 404, headers: corsHeaders });
   }

   if (loan.repayment_status !== 'Paid') {
      return new Response(JSON.stringify({ error: 'Loan is not fully repaid' }), { status: 400, headers: corsHeaders });
   }

   if (!loan.borrower_user_id) {
      return new Response(JSON.stringify({ error: 'Loan borrower is missing' }), { status: 400, headers: corsHeaders });
   }

   const { data: borrower, error: borrowerError } = await supabase
      .from('users')
      .select('id, username, telegram_username, email, cs, is_world_id, chat_id')
      .eq('id', loan.borrower_user_id)
      .maybeSingle();

   if (borrowerError) {
      return new Response(JSON.stringify({ error: borrowerError.message }), { status: 500, headers: corsHeaders });
   }

   if (!borrower) {
      return new Response(JSON.stringify({ error: 'Borrower not found' }), { status: 404, headers: corsHeaders });
   }

   const { data: lender, error: lenderError } = loan.lender_user_id
      ? await supabase.from('users').select('id, username, telegram_username, email, chat_id').eq('id', loan.lender_user_id).maybeSingle()
      : { data: null, error: null };

   if (lenderError) {
      return new Response(JSON.stringify({ error: lenderError.message }), { status: 500, headers: corsHeaders });
   }

   if (!borrower?.email && !lender?.chat_id) {
      return new Response(JSON.stringify({ error: 'Repayment notification target not found' }), { status: 404, headers: corsHeaders });
   }

   const { data: trustPoints } = await supabase.from('user_trust_points').select('points_total').eq('user_id', borrower.id).maybeSingle();

   const borrowerPayload = {
      ...borrower,
      trust_points_total: trustPoints?.points_total ?? 0
   };

   const borrowerAlreadySent = borrower?.email
      ? await hasNotificationBeenSent(supabase, { loanId: loan.id, userId: borrower.id, type: 'repayment_received' })
      : true;
   const lenderAlreadySent = lender?.id
      ? await hasNotificationBeenSent(supabase, { loanId: loan.id, userId: lender.id, type: 'repayment_received' })
      : true;

   if (borrowerAlreadySent && lenderAlreadySent) {
      return new Response(JSON.stringify({ message: 'Notification already sent' }), { status: 200, headers: corsHeaders });
   }

   let emailSent = false;
   let telegramSent = false;
   const notificationRows: Array<{ loan_id: string; user_id: string; notification_type: LoanNotificationType }> = [];

   if (borrower?.email && !borrowerAlreadySent) {
      const parsedPaidAt = loan.updated_at ? new Date(loan.updated_at) : new Date();
      const paidAt = Number.isNaN(parsedPaidAt.getTime()) ? new Date() : parsedPaidAt;
      const trustPointRewardData = await loadTrustPointRewardData(supabase, borrower.id, paidAt);
      const trustPointsReward = calculateTrustPointRewardDelta({
         beforeLoans: markLoansUnpaid(trustPointRewardData.loans, [loan.id]),
         afterLoans: trustPointRewardData.loans,
         user: borrower,
         milestoneDefinitions: trustPointRewardData.milestoneDefinitions,
         completedMilestoneIds: trustPointRewardData.completedMilestoneIdsBeforePayment,
         referenceDate: paidAt
      });

      const { subject, text, html } = buildLoanNotificationEmail('repayment_received', loan, {
         ...borrowerPayload,
         trust_points_reward: trustPointsReward,
         trust_points_reward_kind: 'earned'
      });

      await sendEmail(borrowerPayload.email, subject, text, html);
      emailSent = true;
      notificationRows.push({
         loan_id: loan.id,
         user_id: borrower.id,
         notification_type: 'repayment_received'
      });
   }

   const lenderTelegramEnabled = await getLenderDirectNotificationsEnabled(supabase);
   if (lender?.chat_id && lenderTelegramEnabled && !lenderAlreadySent) {
      const { text, actionUrl } = buildLenderRepaymentTelegram(loan, lender, borrower);
      await sendTelegramMessage(lender.chat_id, text, {
         inlineKeyboard: [[{ text: 'Open Dashboard', url: actionUrl }]]
      });
      telegramSent = true;
      notificationRows.push({
         loan_id: loan.id,
         user_id: lender.id,
         notification_type: 'repayment_received'
      });
   }

   if (!emailSent && !telegramSent) {
      return new Response(JSON.stringify({ message: 'No eligible repayment notification target' }), { status: 200, headers: corsHeaders });
   }

   if (notificationRows.length) {
      const { error: insertError } = await supabase.from('loan_notifications').insert(notificationRows);

      if (insertError) {
         return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: corsHeaders });
      }
   }

   return new Response(JSON.stringify({ message: 'Notification sent', emailSent, telegramSent }), { status: 200, headers: corsHeaders });
});
