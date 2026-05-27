import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
   getBorrowerTelegramNotificationsEnabled,
   sendBorrowerLoanNotification
} from '../_shared/borrowerNotificationDelivery.ts';
import { LoanNotificationType } from '../_shared/loanNotifications.ts';
import {
   calculateTrustPointRewardDelta,
   markLoansRepaid
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
type MilestoneCompletionRow = { milestone_id: string };

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

const loadTrustPointRewardData = async (supabase: SupabaseClient, borrowerId: string) => {
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
      .select('milestone_id')
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
      completedMilestoneIds: new Set<string>(completionRows.map((completion) => completion.milestone_id)),
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
      .select('id, tracking_id, borrower_user_id, loan_amount, total_repayment_amount, repaid_amount, due_date, funded_at, lender_user_id')
      .eq('id', loanId)
      .maybeSingle();

   if (loanError) {
      return new Response(JSON.stringify({ error: loanError.message }), { status: 500, headers: corsHeaders });
   }

   if (!loan) {
      return new Response(JSON.stringify({ error: 'Loan not found' }), { status: 404, headers: corsHeaders });
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

   if (!borrower?.email && !borrower?.chat_id) {
      return new Response(JSON.stringify({ error: 'Borrower notification target not found' }), { status: 404, headers: corsHeaders });
   }

   const { data: trustPoints } = await supabase.from('user_trust_points').select('points_total').eq('user_id', borrower.id).maybeSingle();

   const { data: lender } = loan.lender_user_id
      ? await supabase.from('users').select('username').eq('id', loan.lender_user_id).maybeSingle()
      : { data: null };

   const loanPayload = {
      ...loan,
      lender_username: lender?.username ?? null
   };
   const borrowerPayload = {
      ...borrower,
      trust_points_total: trustPoints?.points_total ?? 0
   };

   const alreadySent = await hasNotificationBeenSent(supabase, { loanId: loan.id, userId: borrower.id, type: 'funded' });

   if (alreadySent) {
      return new Response(JSON.stringify({ message: 'Notification already sent' }), { status: 200, headers: corsHeaders });
   }

   const rewardReferenceDate = new Date();
   const trustPointRewardData = await loadTrustPointRewardData(supabase, borrower.id);
   const trustPointsReward = calculateTrustPointRewardDelta({
      beforeLoans: trustPointRewardData.loans,
      afterLoans: markLoansRepaid(trustPointRewardData.loans, [loan.id], rewardReferenceDate),
      user: borrower,
      milestoneDefinitions: trustPointRewardData.milestoneDefinitions,
      completedMilestoneIds: trustPointRewardData.completedMilestoneIds,
      referenceDate: rewardReferenceDate
   });

   const telegramEnabled = await getBorrowerTelegramNotificationsEnabled(supabase);
   const delivery = await sendBorrowerLoanNotification(
      'funded',
      loanPayload,
      {
         ...borrowerPayload,
         trust_points_reward: trustPointsReward,
         trust_points_reward_kind: 'potential'
      },
      undefined,
      { telegramEnabled }
   );

   if (!delivery.emailSent && !delivery.telegramSent) {
      return new Response(JSON.stringify({ error: 'Borrower notification target not found' }), { status: 404, headers: corsHeaders });
   }

   const { error: insertError } = await supabase.from('loan_notifications').insert({
      loan_id: loan.id,
      user_id: borrower.id,
      notification_type: 'funded'
   });

   if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: corsHeaders });
   }

   return new Response(JSON.stringify({ message: 'Notification sent' }), { status: 200, headers: corsHeaders });
});
