import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
   isPlaceholderEmail,
   getBorrowerTelegramNotificationsEnabled,
   sendBorrowerLoanNotification
} from '../_shared/borrowerNotificationDelivery.ts';
import {
   getLoanOutstandingAmount,
   LoanNotificationLoan,
   LoanNotificationRecipient
} from '../_shared/loanNotifications.ts';
import { dueDayBounds, loanTimezone, localHour, QUIET_HOURS_END, resolveTimezone } from '../_shared/loanDeadline.ts';
import { loadBorrowerTimezones, postDueTeamFeed } from '../_shared/loanDueTeamFeed.ts';
import { loadPushSubscriptions } from '../_shared/pushDelivery.ts';
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

// notif_transaction_activity is selected below and gates this notification, but isn't part of the
// shared recipient type, so declare it here.
type BorrowerRecord = LoanNotificationRecipient &
   TrustPointRewardUser & { id: string; notif_transaction_activity?: boolean | null };
type TrustPointRow = { user_id: string; points_total: number | string | null };
type MilestoneCompletionRow = { user_id: string; milestone_id: string };
type SentLoanNotificationRow = { loan_id: string; notification_type: OverdueStage };

// One overdue notice when the loan goes overdue, then a gentle check-in at 3 and at 7 days late.
// Each stage is recorded per loan, so every stage goes out at most once.
type OverdueStage = 'overdue' | 'overdue_followup_3' | 'overdue_followup_7';
const OVERDUE_STAGES: OverdueStage[] = ['overdue', 'overdue_followup_3', 'overdue_followup_7'];
const DAY_MS = 24 * 60 * 60 * 1000;

const getOverdueStage = (referenceDate: Date, dueDateValue: string | null): OverdueStage => {
   const daysLate = dueDateValue ? Math.floor((referenceDate.getTime() - new Date(dueDateValue).getTime()) / DAY_MS) : 0;
   if (daysLate >= 7) return 'overdue_followup_7';
   if (daysLate >= 3) return 'overdue_followup_3';
   return 'overdue';
};

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

// Same internal-secret check as loan-due-notifications. The hourly cron sends x-notification-secret;
// nothing else may call this, because `referenceDate` in the body would let a caller mark every
// active loan as overdue and email all borrowers a false overdue notice.
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
      .select('id, username, telegram_username, email, cs, is_world_id, is_didit, chat_id, notif_transaction_activity, notif_push, messenger_psid')
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
         'id, borrower_user_id, loan_amount, total_repayment_amount, repaid_amount, due_date, funded_at, lender_user_id, loan_status, repayment_status, repaid_at, refunded_at, is_test, due_timezone, credit_limit_at_repayment, updated_at'
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

const loadSentStagesByLoanId = async (supabase: SupabaseClient, payload: { loanIds: string[]; userId: string }) => {
   const sent = new Map<string, Set<OverdueStage>>();
   if (!payload.loanIds.length) {
      return sent;
   }

   const { data, error } = await supabase
      .from('loan_notifications')
      .select('loan_id, notification_type')
      .in('loan_id', payload.loanIds)
      .eq('user_id', payload.userId)
      .in('notification_type', OVERDUE_STAGES);

   if (error) {
      throw new Error(error.message);
   }

   for (const row of (data ?? []) as SentLoanNotificationRow[]) {
      const stages = sent.get(row.loan_id) ?? new Set<OverdueStage>();
      stages.add(row.notification_type);
      sent.set(row.loan_id, stages);
   }

   return sent;
};

const recordOverdueNotifications = async (supabase: SupabaseClient, borrowerId: string, rows: Array<{ loanId: string; stage: OverdueStage }>) => {
   if (!rows.length) {
      return;
   }

   const { error } = await supabase.from('loan_notifications').insert(
      rows.map((row) => ({
         loan_id: row.loanId,
         user_id: borrowerId,
         notification_type: row.stage
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

// Counted from the deadline (end of the borrower's due day), in whole days: 7 hours late = 1 day,
// the 3-day and 7-day follow-ups say 3 and 7.
const formatOverdueBy = (referenceDate: Date, deadline: Date | null | undefined) => {
   if (!deadline || Number.isNaN(deadline.getTime())) {
      return 'overdue';
   }

   const diffMs = Math.max(0, referenceDate.getTime() - deadline.getTime());
   const days = Math.max(1, Math.floor(diffMs / DAY_MS));
   return `${days} ${days === 1 ? 'day' : 'days'}`;
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
   const referenceDate = body.referenceDate ? new Date(body.referenceDate) : new Date();

   const { data: loans, error } = await supabase
      .from('loans')
      .select(
         'id, tracking_id, borrower_user_id, loan_amount, total_repayment_amount, repaid_amount, due_date, due_timezone, funded_at, lender_user_id, repayment_status'
      )
      .eq('loan_status', 'Lent')
      .in('repayment_status', ['Unpaid', 'Partial'])
      // Test loans don't get borrower reminders or team posts.
      .or('is_test.is.null,is_test.eq.false')
      .not('due_date', 'is', null)
      .lt('due_date', referenceDate.toISOString());

   if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
   }

   // `due_date < now` only says the due day has BEGUN (it is midnight UTC of that date). A loan is
   // overdue once the due day has ENDED in the borrower's own timezone.
   const candidateIds = Array.from(new Set((loans ?? []).map((loan) => loan.borrower_user_id).filter(Boolean))) as string[];
   const timezones = await loadBorrowerTimezones(supabase, candidateIds);
   const zoneFor = (borrowerId: string) => timezones.get(borrowerId) ?? resolveTimezone(null, null);
   const deadlineByLoanId = new Map<string, Date>();
   const overdueLoans = (loans ?? []).filter((loan) => {
      if (!loan.borrower_user_id || !loan.due_date) return false;
      // The zone saved on the loan when it was posted; older loans fall back to the borrower's.
      // Past due at the later of due_date + 24h and the end of their due day: the same moment the app
      // (getLoanPastDueAt) and on-time points use, so Manila isn't told "overdue" at 7 AM when the
      // app still says it's due until 8.
      const { end } = dueDayBounds(loan.due_date, loanTimezone(loan, zoneFor(loan.borrower_user_id)));
      const pastDueAt = new Date(Math.max(end.getTime(), new Date(loan.due_date).getTime() + DAY_MS));
      deadlineByLoanId.set(loan.id, pastDueAt);
      return referenceDate.getTime() >= pastDueAt.getTime();
   });

   const borrowerIds = Array.from(new Set(overdueLoans.map((loan) => loan.borrower_user_id).filter(Boolean))) as string[];
   const borrowers = await loadBorrowers(supabase, borrowerIds);
   const trustPointRewardContext = await loadTrustPointRewardContext(supabase, borrowerIds);
   const telegramEnabled = await getBorrowerTelegramNotificationsEnabled(supabase);
   const pushableBorrowerIds = new Set((await loadPushSubscriptions(supabase, borrowerIds)).keys());

   const borrowerBuckets = new Map<string, Array<LoanNotificationLoan & { id: string }>>();

   for (const loan of overdueLoans) {
      if (!loan.borrower_user_id) {
         continue;
      }

      const bucket = borrowerBuckets.get(loan.borrower_user_id) ?? [];
      bucket.push(loan);
      borrowerBuckets.set(loan.borrower_user_id, bucket);
   }

   let sentCount = 0;

   for (const [borrowerId, borrowerLoans] of borrowerBuckets.entries()) {
      // One borrower's failed send must not stop the run for everyone after them (or the team post).
      try {
         const borrower = borrowers.get(borrowerId);
         if (!borrower || ((!borrower.email || isPlaceholderEmail(borrower.email)) && !borrower.chat_id && !borrower.messenger_psid && !pushableBorrowerIds.has(borrowerId))) {
            continue;
         }

         // Hold until the borrower's local morning; nothing is recorded, so the next run retries.
         if (localHour(referenceDate, zoneFor(borrowerId)) < QUIET_HOURS_END) {
            continue;
         }

         const loanIds = borrowerLoans.map((loan) => loan.id);
         const sentStages = await loadSentStagesByLoanId(supabase, { loanIds, userId: borrower.id });
         const stageByLoanId = new Map(borrowerLoans.map((loan) => [loan.id, getOverdueStage(referenceDate, deadlineByLoanId.get(loan.id)?.toISOString() ?? loan.due_date ?? null)]));
         const pendingLoans = borrowerLoans.filter((loan) => !sentStages.get(loan.id)?.has(stageByLoanId.get(loan.id)!));

         if (!pendingLoans.length) {
            continue;
         }

         const nextDueDate = getEarliestDueDate(pendingLoans);
         const aggregate = {
            count: pendingLoans.length,
            totalAmount: pendingLoans.reduce((sum, loan) => sum + getLoanOutstandingAmount(loan), 0),
            dueLabel: formatOverdueBy(
               referenceDate,
               pendingLoans
                  .map((loan) => deadlineByLoanId.get(loan.id))
                  .filter((deadline): deadline is Date => Boolean(deadline))
                  .sort((first, second) => first.getTime() - second.getTime())[0]
            ),
            nextDueDate,
            // A check-in when every loan here already had its first overdue notice.
            followUp: pendingLoans.every((loan) => sentStages.get(loan.id)?.has('overdue'))
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

         const delivery = await sendBorrowerLoanNotification(
            'overdue',
            null,
            {
               ...borrower,
               trust_points_reward: trustPointsReward,
               trust_points_reward_kind: 'potential'
            },
            aggregate,
            {
               telegramEnabled,
               notifEnabled: borrower.notif_transaction_activity !== false,
               push: { supabase, userId: borrower.id }
            }
         );

         if (!delivery.emailSent && !delivery.telegramSent && !delivery.pushSent && !delivery.messengerSent) {
            continue;
         }

         await recordOverdueNotifications(
            supabase,
            borrower.id,
            pendingLoans.map((loan) => ({ loanId: loan.id, stage: stageByLoanId.get(loan.id)! }))
         );

         sentCount += 1;
      } catch (sendError) {
         console.error('overdue notice failed for borrower', borrowerId, sendError instanceof Error ? sendError.message : sendError);
      }
   }

   // Tell the team once per loan that it has gone overdue, whether or not the borrower could be reached.
   const announced = await postDueTeamFeed(
      supabase,
      'team_overdue',
      overdueLoans as Parameters<typeof postDueTeamFeed>[2],
      new Map(Array.from(borrowers.entries()).map(([id, borrower]) => [id, borrower.username ?? null])),
      timezones,
      referenceDate
   );

   return new Response(JSON.stringify({ message: 'Overdue notifications sent', sent: sentCount, teamAnnounced: announced }), {
      status: 200,
      headers: corsHeaders
   });
});
