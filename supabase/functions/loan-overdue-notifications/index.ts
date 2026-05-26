import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendEmail } from '../_shared/email.ts';
import {
   buildLoanNotificationEmail,
   getLoanOutstandingAmount,
   LoanNotificationLoan,
   LoanNotificationRecipient
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

const loadBorrowers = async (supabase: SupabaseClient, userIds: string[]): Promise<Map<string, BorrowerRecord>> => {
   if (!userIds.length) {
      return new Map<string, BorrowerRecord>();
   }

   const { data, error } = await supabase.from('users').select('id, username, email, cs, is_world_id').in('id', userIds);

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

const loadSentLoanIds = async (supabase: SupabaseClient, payload: { loanIds: string[]; userId: string }) => {
   if (!payload.loanIds.length) {
      return new Set<string>();
   }

   const { data, error } = await supabase
      .from('loan_notifications')
      .select('loan_id')
      .in('loan_id', payload.loanIds)
      .eq('user_id', payload.userId)
      .eq('notification_type', 'overdue');

   if (error) {
      throw new Error(error.message);
   }

   return new Set(((data ?? []) as SentLoanNotificationRow[]).map((item) => item.loan_id));
};

const recordOverdueNotification = async (supabase: SupabaseClient, borrowerId: string, loanIds: string[]) => {
   if (!loanIds.length) {
      return;
   }

   const { error } = await supabase.from('loan_notifications').insert(
      loanIds.map((loanId) => ({
         loan_id: loanId,
         user_id: borrowerId,
         notification_type: 'overdue'
      }))
   );

   if (error) {
      throw new Error(error.message);
   }
};

const getEarliestDueDate = (loans: Array<LoanNotificationLoan & { id: string }>) =>
   loans
      .map((loan) => loan.due_date)
      .filter((dueDate): dueDate is string => Boolean(dueDate))
      .sort((first, second) => new Date(first).getTime() - new Date(second).getTime())[0] ?? null;

const formatOverdueBy = (referenceDate: Date, dueDateValue: string | null) => {
   if (!dueDateValue) {
      return 'overdue';
   }

   const dueDate = new Date(dueDateValue);
   if (Number.isNaN(dueDate.getTime())) {
      return 'overdue';
   }

   const diffMs = Math.max(0, referenceDate.getTime() - dueDate.getTime());
   const days = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
   return `${days} ${days === 1 ? 'day' : 'days'}`;
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
   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   const { data: loans, error } = await supabase
      .from('loans')
      .select(
         'id, tracking_id, borrower_user_id, loan_amount, total_repayment_amount, repaid_amount, due_date, funded_at, lender_user_id, repayment_status'
      )
      .eq('loan_status', 'Lent')
      .in('repayment_status', ['Unpaid', 'Partial'])
      .not('due_date', 'is', null)
      .lt('due_date', referenceDate.toISOString());

   if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
   }

   const borrowerIds = Array.from(new Set((loans ?? []).map((loan) => loan.borrower_user_id).filter(Boolean))) as string[];
   const borrowers = await loadBorrowers(supabase, borrowerIds);
   const trustPointRewardContext = await loadTrustPointRewardContext(supabase, borrowerIds);

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

      const loanIds = borrowerLoans.map((loan) => loan.id);
      const sentLoanIds = await loadSentLoanIds(supabase, { loanIds, userId: borrower.id });
      const pendingLoans = borrowerLoans.filter((loan) => !sentLoanIds.has(loan.id));

      if (!pendingLoans.length) {
         continue;
      }

      const nextDueDate = getEarliestDueDate(pendingLoans);
      const aggregate = {
         count: pendingLoans.length,
         totalAmount: pendingLoans.reduce((sum, loan) => sum + getLoanOutstandingAmount(loan), 0),
         dueLabel: formatOverdueBy(referenceDate, nextDueDate),
         nextDueDate
      };
      const allBorrowerLoans = trustPointRewardContext.loansByBorrowerId.get(borrower.id) ?? [];
      const trustPointsReward = calculateTrustPointRewardDelta({
         beforeLoans: allBorrowerLoans,
         afterLoans: markLoansRepaid(
            allBorrowerLoans,
            pendingLoans.map((loan) => loan.id),
            referenceDate
         ),
         user: borrower,
         milestoneDefinitions: trustPointRewardContext.milestoneDefinitions,
         completedMilestoneIds: trustPointRewardContext.completedMilestoneIdsByBorrowerId.get(borrower.id),
         referenceDate
      });

      const { subject, text, html } = buildLoanNotificationEmail(
         'overdue',
         null,
         {
            ...borrower,
            trust_points_reward: trustPointsReward,
            trust_points_reward_kind: 'potential'
         },
         aggregate
      );

      await sendEmail(borrower.email, subject, text, html);

      await recordOverdueNotification(
         supabase,
         borrower.id,
         pendingLoans.map((loan) => loan.id)
      );

      sentCount += 1;
   }

   return new Response(JSON.stringify({ message: 'Overdue notifications sent', sent: sentCount }), { status: 200, headers: corsHeaders });
});
