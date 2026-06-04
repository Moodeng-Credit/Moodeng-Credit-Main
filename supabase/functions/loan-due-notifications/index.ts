import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
   getBorrowerTelegramNotificationsEnabled,
   sendBorrowerLoanNotification
} from '../_shared/borrowerNotificationDelivery.ts';
import {
   getLoanOutstandingAmount,
   getReminderWindows,
   LoanNotificationLoan,
   LoanNotificationRecipient,
   LoanNotificationType
} from '../_shared/loanNotifications.ts';
import {
   calculateTrustPointRewardDelta,
   markLoansRepaid
} from '../_shared/trustPointRewards.ts';
import type {
   TrustPointMilestoneDefinition,
   TrustPointRewardLoan,
   TrustPointRewardUser
} from '../_shared/trustPointRewards.ts';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type SupabaseClient = any;

type BorrowerRecord = LoanNotificationRecipient & TrustPointRewardUser & { id: string };
type TrustPointRow = { user_id: string; points_total: number | string | null };
type MilestoneCompletionRow = { user_id: string; milestone_id: string };
type SentLoanNotificationRow = { loan_id: string };

type TrustPointRewardContext = {
   loansByBorrowerId: Map<string, TrustPointRewardLoan[]>;
   completedMilestoneIdsByBorrowerId: Map<string, Set<string>>;
   milestoneDefinitions: TrustPointMilestoneDefinition[];
};

const getRequestSecret = (req: Request) => {
   const authorization = req.headers.get('Authorization') ?? '';
   const bearerToken = authorization.replace(/^Bearer\s+/i, '').trim();
   return bearerToken || req.headers.get('x-notification-secret');
};

const authorizeInternalRequest = async (supabase: SupabaseClient, req: Request) => {
   const requestSecret = getRequestSecret(req);
   if (!requestSecret) {
      return { authorized: false, status: 401, error: 'Unauthorized' };
   }

   const expectedSecret = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('TELEGRAM_NOTIFICATION_SECRET');
   if (expectedSecret && requestSecret === expectedSecret) {
      return { authorized: true, status: 200, error: null };
   }

   const { data, error } = await supabase.rpc('verify_internal_notification_secret', { candidate: requestSecret });
   if (error) {
      return { authorized: false, status: 500, error: error.message };
   }

   if (data !== true) {
      return { authorized: false, status: 401, error: 'Unauthorized' };
   }

   return { authorized: true, status: 200, error: null };
};

const loadBorrowers = async (supabase: SupabaseClient, userIds: string[]): Promise<Map<string, BorrowerRecord>> => {
   if (!userIds.length) {
      return new Map<string, BorrowerRecord>();
   }

   const { data, error } = await supabase
      .from('users')
      .select('id, username, telegram_username, email, cs, is_world_id, chat_id, notif_transaction_activity')
      .in('id', userIds);

   if (error || !data) {
      throw new Error(error?.message ?? 'Failed to load borrowers');
   }

   const { data: trustPoints, error: trustPointsError } = await supabase
      .from('user_trust_points')
      .select('user_id, points_total')
      .in('user_id', userIds);

   if (trustPointsError) {
      throw new Error(trustPointsError.message);
   }

   const trustPointRows = (trustPoints ?? []) as TrustPointRow[];
   const borrowerRows = data as BorrowerRecord[];
   const trustPointsByUserId = new Map(trustPointRows.map((row) => [row.user_id, row.points_total]));

   return new Map<string, BorrowerRecord>(
      borrowerRows.map((borrower) => [
         borrower.id,
         {
            ...borrower,
            trust_points_total: trustPointsByUserId.get(borrower.id) ?? 0
         }
      ])
   );
};

const loadTrustPointRewardContext = async (
   supabase: SupabaseClient,
   userIds: string[]
): Promise<TrustPointRewardContext> => {
   if (!userIds.length) {
      return {
         loansByBorrowerId: new Map(),
         completedMilestoneIdsByBorrowerId: new Map(),
         milestoneDefinitions: []
      };
   }

   const { data: loans, error: loansError } = await supabase
      .from('loans')
      .select(
         'id, borrower_user_id, loan_amount, total_repayment_amount, repaid_amount, due_date, funded_at, lender_user_id, loan_status, repayment_status, updated_at'
      )
      .in('borrower_user_id', userIds);

   if (loansError) {
      throw new Error(loansError.message);
   }

   const { data: completions, error: completionsError } = await supabase
      .from('user_milestone_completions')
      .select('user_id, milestone_id')
      .in('user_id', userIds);

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

   const loansByBorrowerId = new Map<string, TrustPointRewardLoan[]>();
   for (const loan of (loans ?? []) as TrustPointRewardLoan[]) {
      if (!loan.borrower_user_id) {
         continue;
      }

      const borrowerLoans = loansByBorrowerId.get(loan.borrower_user_id) ?? [];
      borrowerLoans.push(loan);
      loansByBorrowerId.set(loan.borrower_user_id, borrowerLoans);
   }

   const completedMilestoneIdsByBorrowerId = new Map<string, Set<string>>();
   for (const completion of (completions ?? []) as MilestoneCompletionRow[]) {
      const completedIds = completedMilestoneIdsByBorrowerId.get(completion.user_id) ?? new Set<string>();
      completedIds.add(completion.milestone_id);
      completedMilestoneIdsByBorrowerId.set(completion.user_id, completedIds);
   }

   return {
      loansByBorrowerId,
      completedMilestoneIdsByBorrowerId,
      milestoneDefinitions: (milestoneDefinitions ?? []) as TrustPointMilestoneDefinition[]
   };
};

const loadSentLoanIds = async (
   supabase: SupabaseClient,
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

   return new Set(((data ?? []) as SentLoanNotificationRow[]).map((item) => item.loan_id));
};

const recordNotification = async (
   supabase: SupabaseClient,
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

const formatHoursAsDueLabel = (hours: number) => {
   if (hours > 0 && hours % 24 === 0) {
      const days = hours / 24;
      return `${days} ${days === 1 ? 'day' : 'days'}`;
   }

   return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
};

const getNextDueDate = (loans: Array<LoanNotificationLoan & { id: string }>) =>
   loans
      .map((loan) => loan.due_date)
      .filter((dueDate): dueDate is string => Boolean(dueDate))
      .sort((first, second) => new Date(first).getTime() - new Date(second).getTime())[0] ?? null;

const notifyBorrower = async (
   supabase: SupabaseClient,
   borrower: BorrowerRecord,
   loans: Array<LoanNotificationLoan & { id: string }>,
   type: LoanNotificationType,
   dueLabel: string,
   rewardContext: TrustPointRewardContext,
   referenceDate: Date,
   telegramEnabled: boolean
) => {
   const loanIds = loans.map((loan) => loan.id);
   const sentLoanIds = await loadSentLoanIds(supabase, { loanIds, userId: borrower.id, type });
   const pendingLoans = loans.filter((loan) => !sentLoanIds.has(loan.id));

   if (!pendingLoans.length) {
      return false;
   }

   const aggregate = {
      count: pendingLoans.length,
      totalAmount: pendingLoans.reduce((sum, loan) => sum + getLoanOutstandingAmount(loan), 0),
      dueLabel,
      nextDueDate: getNextDueDate(pendingLoans)
   };
   const borrowerLoans = rewardContext.loansByBorrowerId.get(borrower.id) ?? [];
   const trustPointsReward = calculateTrustPointRewardDelta({
      beforeLoans: borrowerLoans,
      afterLoans: markLoansRepaid(
         borrowerLoans,
         pendingLoans.map((loan) => loan.id),
         referenceDate
      ),
      user: borrower,
      milestoneDefinitions: rewardContext.milestoneDefinitions,
      completedMilestoneIds: rewardContext.completedMilestoneIdsByBorrowerId.get(borrower.id),
      referenceDate
   });

   const delivery = await sendBorrowerLoanNotification(
      type,
      null,
      {
         ...borrower,
         trust_points_reward: trustPointsReward,
         trust_points_reward_kind: 'potential'
      },
      aggregate,
      { telegramEnabled, notifEnabled: (borrower as any).notif_transaction_activity !== false }
   );

   if (!delivery.emailSent && !delivery.telegramSent) {
      return false;
   }

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

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
   const authorization = await authorizeInternalRequest(supabase, req);
   if (!authorization.authorized) {
      return new Response(JSON.stringify({ error: authorization.error }), {
         status: authorization.status,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
   }

   const body = await req.json().catch(() => ({}));
   const urgentReminderHours = Number.parseInt(Deno.env.get('URGENT_REMINDER_HOURS') ?? `${body.urgentReminderHours ?? 72}`, 10);
   const finalReminderHours = Number.parseInt(Deno.env.get('FINAL_REMINDER_HOURS') ?? `${body.finalReminderHours ?? 24}`, 10);
   const referenceDate = body.referenceDate ? new Date(body.referenceDate) : new Date();

   const { data: loans, error } = await supabase
      .from('loans')
      .select(
         'id, tracking_id, borrower_user_id, loan_amount, total_repayment_amount, repaid_amount, due_date, funded_at, lender_user_id, repayment_status'
      )
      .eq('loan_status', 'Lent')
      .in('repayment_status', ['Unpaid', 'Partial'])
      .not('due_date', 'is', null);

   if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
   }

   const borrowerIds = Array.from(new Set((loans ?? []).map((loan) => loan.borrower_user_id).filter(Boolean))) as string[];
   const borrowers = await loadBorrowers(supabase, borrowerIds);
   const trustPointRewardContext = await loadTrustPointRewardContext(supabase, borrowerIds);
   const telegramEnabled = await getBorrowerTelegramNotificationsEnabled(supabase);

   const { final, urgent } = getReminderWindows(
      referenceDate,
      Number.isNaN(urgentReminderHours) ? 72 : urgentReminderHours,
      Number.isNaN(finalReminderHours) ? 24 : finalReminderHours
   );
   const urgentDueLabel = formatHoursAsDueLabel(Number.isNaN(urgentReminderHours) ? 72 : urgentReminderHours);
   const finalDueLabel = formatHoursAsDueLabel(Number.isNaN(finalReminderHours) ? 24 : finalReminderHours);

   const borrowerBuckets = new Map<
      string,
      {
         urgent: Array<LoanNotificationLoan & { id: string }>;
         final: Array<LoanNotificationLoan & { id: string }>;
      }
   >();

   for (const loan of loans ?? []) {
      if (!loan.borrower_user_id || !loan.due_date) {
         continue;
      }

      const dueDate = new Date(loan.due_date);

      const isFinalWindow = dueDate.getTime() >= final.start.getTime() && dueDate.getTime() <= final.end.getTime();
      const isUrgentWindow = dueDate.getTime() > urgent.start.getTime() && dueDate.getTime() <= urgent.end.getTime();

      if (!isFinalWindow && !isUrgentWindow) {
         continue;
      }

      const bucket = borrowerBuckets.get(loan.borrower_user_id) ?? { urgent: [], final: [] };
      if (isFinalWindow) {
         bucket.final.push(loan);
      } else if (isUrgentWindow) {
         bucket.urgent.push(loan);
      }

      borrowerBuckets.set(loan.borrower_user_id, bucket);
   }

   let sentCount = 0;

   for (const [borrowerId, bucket] of borrowerBuckets.entries()) {
      const borrower = borrowers.get(borrowerId);
      if (!borrower?.email && !borrower?.chat_id) {
         continue;
      }

      if (bucket.urgent.length) {
         const wasSent = await notifyBorrower(
            supabase,
            borrower,
            bucket.urgent,
            'urgent_reminder',
            urgentDueLabel,
            trustPointRewardContext,
            referenceDate,
            telegramEnabled
         );
         if (wasSent) {
            sentCount += 1;
         }
      }

      if (bucket.final.length) {
         const wasSent = await notifyBorrower(
            supabase,
            borrower,
            bucket.final,
            'final_reminder',
            finalDueLabel,
            trustPointRewardContext,
            referenceDate,
            telegramEnabled
         );
         if (wasSent) {
            sentCount += 1;
         }
      }
   }

   return new Response(JSON.stringify({ message: 'Notifications processed', sent: sentCount }), { status: 200, headers: corsHeaders });
});
