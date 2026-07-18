import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

export type AdminRole = 'owner' | 'admin' | 'support';
export type NoticeAudience = 'borrower' | 'lender' | 'candidate_lender' | 'admin';
export type RestrictionStatus = 'active' | 'watchlist' | 'banned';
export type AccountStatus = 'active' | 'blocked' | 'banned';
export type RiskLevel = 'low' | 'medium' | 'high';
export type UserRole = 'borrower' | 'lender' | 'unset';
export type RecoveryPath = 'repay_now' | 'extension' | 'payment_plan' | 'bridge_loan' | 'manual';

export interface AdminUser {
   id: string;
   user_id: string;
   role: AdminRole;
   active: boolean;
   display_name: string | null;
}

export interface AdminRiskProfile {
   id?: string;
   user_id: string;
   score: number;
   risk_level: RiskLevel;
   status: 'active' | 'watchlist' | 'blocked';
   algorithm_version?: string | null;
   algorithm_note?: string | null;
   override_score?: number | null;
   override_reason?: string | null;
   calculated_at?: string | null;
   updated_at?: string | null;
}

export interface AdminRestriction {
   id: string;
   user_id: string;
   status: RestrictionStatus;
   reason: string;
   risk_level: RiskLevel;
   evidence_summary: string | null;
   admin_note: string | null;
   restricted_at: string | null;
   unrestricted_at: string | null;
   updated_at: string | null;
}

export interface AdminPointEvent {
   id: number;
   user_id: string;
   event_type: string;
   delta: number | string;
   source_type: string;
   source_id: string;
   created_at: string;
   metadata: Record<string, any>;
}

export interface AdminDirectoryUser {
   id: string;
   username: string;
   email: string | null;
   wallet_address: string | null;
   wallet_provider: string | null;
   wallet_connector_name: string | null;
   wallet_chain_id: number | null;
   user_role: UserRole;
   account_status: AccountStatus;
   is_world_id: 'ACTIVE' | 'INACTIVE' | null;
   cs: number | null;
   mal: number | null;
   nal: number | null;
   created_at: string | null;
   updated_at: string | null;
   openRequestCount: number;
   borrowedLoanCount: number;
   activeLoanCount: number;
   overdueLoanCount: number;
   paidLoanCount: number;
   lentLoanCount: number;
   totalBorrowedAmount: number;
   totalRepaymentAmount: number;
   totalRepaidAmount: number;
   outstandingDue: number;
   lastLoanAt: string | null;
   pointsTotal: number | string;
   pointsUpdatedAt: string | null;
   pointEventCount: number;
   latestPointEventAt: string | null;
   recentPointEvents: AdminPointEvent[];
   trustPointsTotal: number | string;
   trustPointsUpdatedAt: string | null;
   trustPointEventCount: number;
   latestTrustPointEventAt: string | null;
   recentTrustPointEvents: AdminPointEvent[];
   restriction: AdminRestriction | null;
   riskProfile: AdminRiskProfile | null;
}

export interface AdminLoanRecord {
   id: string;
   tracking_id: string;
   borrower_user_id: string | null;
   lender_user_id: string | null;
   borrower_wallet: string | null;
   lender_wallet: string | null;
   loan_amount: number;
   total_repayment_amount: number;
   repaid_amount: number | null;
   due_date: string;
   reason: string;
   coin: string;
   loan_status: 'Requested' | 'Lent' | null;
   repayment_status: 'Unpaid' | 'Partial' | 'Paid' | null;
   is_test: boolean;
   created_at: string | null;
   funded_at: string | null;
   borrower: Pick<AdminDirectoryUser, 'id' | 'username' | 'wallet_address' | 'user_role' | 'account_status' | 'is_world_id'> | null;
   lender: Pick<AdminDirectoryUser, 'id' | 'username' | 'wallet_address' | 'user_role' | 'account_status' | 'is_world_id'> | null;
}

export interface AdminLoanRequestReview {
   id: string;
   loan_id: string | null;
   borrower_user_id: string | null;
   status: 'needs_review' | 'reported' | 'duplicate' | 'kept' | 'deleted';
   reason: 'spam' | 'duplicate' | 'unsafe' | 'bad_data' | 'manual' | null;
   risk_level: RiskLevel;
   evidence_summary: string | null;
   admin_note: string | null;
   reviewed_by: string | null;
   reviewed_at: string | null;
   updated_at: string | null;
}

export interface AdminLoanRequest extends AdminLoanRecord {
   review: AdminLoanRequestReview | null;
}

export interface AdminDefaultCase {
   id: string;
   source: 'recovery_case' | 'overdue_loan';
   case_id: string | null;
   loan_id: string | null;
   borrower_user_id: string | null;
   lender_user_id: string | null;
   borrower: string;
   lender: string;
   amount_due: number;
   due_date: string | null;
   days_late: number;
   status: string;
   recovery_path: RecoveryPath | null;
   borrower_explanation: string | null;
   evidence_summary: string | null;
   admin_note: string | null;
   created_at: string | null;
   updated_at: string | null;
}

export interface AdminOverview {
   allUserCount: number;
   openLoanRequestCount: number;
   activeLoanCount: number;
   defaultedLoanCount: number;
   recoveryReviewCount: number;
   bannedUserCount: number;
   watchlistUserCount: number;
   loanRequestReviewCount: number;
   highRiskProfileCount: number;
}

export interface AdminIntegrityRun {
   id: string;
   status: 'success' | 'warning' | 'error';
   issue_count: number;
   summary: Record<string, any>;
   created_at: string;
}

export interface NoticeTemplateInput {
   audience: NoticeAudience;
   notice_type: string;
   title: string;
   body: string;
   metadata?: Record<string, unknown>;
}

type AnyRow = Record<string, any>;

async function requireOk<T>(request: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
   const { data, error } = await request;
   if (error) throw error;
   return data;
}

async function optionalOk<T>(request: PromiseLike<{ data: T; error: unknown }>, fallback: T): Promise<T> {
   const { data, error } = await request;
   if (error) return fallback;
   return data ?? fallback;
}

async function optionalCount(request: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
   const { count, error } = await request;
   if (error) return 0;
   return count ?? 0;
}

function countFromResult(count: number | null): number {
   return count ?? 0;
}

function toNumber(value: unknown): number {
   const numberValue = Number(value ?? 0);
   return Number.isFinite(numberValue) ? numberValue : 0;
}

function shortUser(row: AdminDirectoryUser | undefined | null) {
   if (!row) return null;
   return {
      id: row.id,
      username: row.username,
      wallet_address: row.wallet_address,
      user_role: row.user_role,
      account_status: row.account_status,
      is_world_id: row.is_world_id
   };
}

function daysLate(dueDate: string | null | undefined) {
   if (!dueDate) return 0;
   const due = new Date(dueDate).getTime();
   if (!Number.isFinite(due)) return 0;
   return Math.max(0, Math.floor((Date.now() - due) / 86_400_000));
}

function outstandingDue(loan: Pick<AdminLoanRecord, 'total_repayment_amount' | 'repaid_amount'>) {
   return Math.max(0, toNumber(loan.total_repayment_amount) - toNumber(loan.repaid_amount));
}

function normalizeRole(role: unknown): UserRole {
   return role === 'borrower' || role === 'lender' ? role : 'unset';
}

function normalizeAccountStatus(status: unknown): AccountStatus {
   return status === 'blocked' || status === 'banned' ? status : 'active';
}

function normalizeRiskLevel(value: unknown): RiskLevel {
   return value === 'high' || value === 'medium' ? value : 'low';
}

function mapRiskProfile(row: AnyRow | undefined): AdminRiskProfile | null {
   if (!row) return null;
   return {
      id: row.id,
      user_id: row.user_id,
      score: toNumber(row.score),
      risk_level: normalizeRiskLevel(row.risk_level),
      status: row.status === 'blocked' || row.status === 'watchlist' ? row.status : 'active',
      algorithm_version: row.algorithm_version ?? null,
      algorithm_note: row.algorithm_note ?? null,
      override_score: row.override_score ?? null,
      override_reason: row.override_reason ?? null,
      calculated_at: row.calculated_at ?? row.computed_at ?? null,
      updated_at: row.updated_at ?? null
   };
}

function mapRestriction(row: AnyRow | undefined): AdminRestriction | null {
   if (!row) return null;
   return {
      id: row.id,
      user_id: row.user_id,
      status: row.status === 'banned' || row.status === 'active' ? row.status : 'watchlist',
      reason: row.reason ?? 'manual',
      risk_level: normalizeRiskLevel(row.risk_level),
      evidence_summary: row.evidence_summary ?? null,
      admin_note: row.admin_note ?? null,
      restricted_at: row.restricted_at ?? null,
      unrestricted_at: row.unrestricted_at ?? null,
      updated_at: row.updated_at ?? null
   };
}

function mapLoan(row: AnyRow, usersById: Map<string, AdminDirectoryUser>): AdminLoanRecord {
   return {
      id: row.id,
      tracking_id: row.tracking_id,
      borrower_user_id: row.borrower_user_id ?? null,
      lender_user_id: row.lender_user_id ?? null,
      borrower_wallet: row.borrower_wallet ?? null,
      lender_wallet: row.lender_wallet ?? null,
      loan_amount: toNumber(row.loan_amount),
      total_repayment_amount: toNumber(row.total_repayment_amount),
      repaid_amount: row.repaid_amount == null ? null : toNumber(row.repaid_amount),
      due_date: row.due_date,
      reason: row.reason,
      coin: row.coin,
      loan_status: row.loan_status ?? null,
      repayment_status: row.repayment_status ?? null,
      is_test: Boolean(row.is_test),
      created_at: row.created_at ?? null,
      funded_at: row.funded_at ?? null,
      borrower: shortUser(row.borrower_user_id ? usersById.get(row.borrower_user_id) : null),
      lender: shortUser(row.lender_user_id ? usersById.get(row.lender_user_id) : null)
   };
}

function mapReview(row: AnyRow | undefined): AdminLoanRequestReview | null {
   if (!row) return null;
   return {
      id: row.id,
      loan_id: row.loan_id ?? null,
      borrower_user_id: row.borrower_user_id ?? null,
      status: row.status ?? 'needs_review',
      reason: row.reason ?? null,
      risk_level: normalizeRiskLevel(row.risk_level),
      evidence_summary: row.evidence_summary ?? null,
      admin_note: row.admin_note ?? null,
      reviewed_by: row.reviewed_by ?? null,
      reviewed_at: row.reviewed_at ?? null,
      updated_at: row.updated_at ?? null
   };
}

function mapPointEvent(row: AnyRow): AdminPointEvent {
   return {
      id: toNumber(row.id),
      user_id: row.user_id,
      event_type: row.event_type,
      delta: row.delta ?? 0,
      source_type: row.source_type,
      source_id: row.source_id,
      created_at: row.created_at,
      metadata: row.metadata ?? {}
   };
}

async function fetchUsersByIds(userIds: string[]): Promise<Map<string, AdminDirectoryUser>> {
   const uniqueIds = [...new Set(userIds.filter(Boolean))];
   if (!uniqueIds.length) return new Map();

   const rows = await requireOk<AnyRow[]>(
      getSupabaseBrowserClient()
         .from('users')
         .select(
            'id,username,email,wallet_address,wallet_provider,wallet_connector_name,wallet_chain_id,user_role,account_status,is_world_id,cs,mal,nal,created_at,updated_at'
         )
         .in('id', uniqueIds)
   );

   const emptyLoans: AnyRow[] = [];
   return buildDirectoryRows(rows, emptyLoans, [], [], [], [], [], []).then((users) => new Map(users.map((user) => [user.id, user])));
}

async function buildDirectoryRows(
   userRows: AnyRow[],
   loanRows: AnyRow[],
   restrictionRows: AnyRow[],
   riskRows: AnyRow[],
   pointRows: AnyRow[],
   pointEventRows: AnyRow[],
   trustPointRows: AnyRow[],
   trustPointEventRows: AnyRow[]
): Promise<AdminDirectoryUser[]> {
   const restrictionsByUserId = new Map(restrictionRows.map((row) => [row.user_id, mapRestriction(row)]));
   const riskByUserId = new Map(riskRows.map((row) => [row.user_id, mapRiskProfile(row)]));
   const pointsByUserId = new Map(pointRows.map((row) => [row.user_id, row]));
   const trustPointsByUserId = new Map(trustPointRows.map((row) => [row.user_id, row]));
   const pointEventsByUserId = pointEventRows.reduce((eventsByUser, row) => {
      const userEvents = eventsByUser.get(row.user_id) ?? [];
      userEvents.push(mapPointEvent(row));
      eventsByUser.set(row.user_id, userEvents);
      return eventsByUser;
   }, new Map<string, AdminPointEvent[]>());
   const trustPointEventsByUserId = trustPointEventRows.reduce((eventsByUser, row) => {
      const userEvents = eventsByUser.get(row.user_id) ?? [];
      userEvents.push(mapPointEvent(row));
      eventsByUser.set(row.user_id, userEvents);
      return eventsByUser;
   }, new Map<string, AdminPointEvent[]>());
   const now = Date.now();

   return userRows.map((row) => {
      const userLoans = loanRows.filter((loan) => loan.borrower_user_id === row.id || loan.lender_user_id === row.id);
      const borrowedLoans = userLoans.filter((loan) => loan.borrower_user_id === row.id);
      const lentLoans = userLoans.filter((loan) => loan.lender_user_id === row.id);
      const openRequests = borrowedLoans.filter((loan) => loan.loan_status === 'Requested');
      const activeLoans = borrowedLoans.filter((loan) => loan.loan_status === 'Lent' && loan.repayment_status !== 'Paid');
      const overdueLoans = activeLoans.filter((loan) => {
         const due = new Date(loan.due_date).getTime();
         return Number.isFinite(due) && due < now;
      });
      const paidLoans = borrowedLoans.filter((loan) => loan.repayment_status === 'Paid');
      const loanActivityDates = userLoans
         .map((loan) => loan.funded_at ?? loan.created_at ?? null)
         .filter(Boolean)
         .sort((first, second) => new Date(second).getTime() - new Date(first).getTime());
      const userPointEvents = pointEventsByUserId.get(row.id) ?? [];
      const latestPointEventAt = userPointEvents[0]?.created_at ?? null;
      const pointsRow = pointsByUserId.get(row.id);
      const userTrustPointEvents = trustPointEventsByUserId.get(row.id) ?? [];
      const latestTrustPointEventAt = userTrustPointEvents[0]?.created_at ?? null;
      const trustPointsRow = trustPointsByUserId.get(row.id);

      return {
         id: row.id,
         username: row.username ?? 'Unnamed user',
         email: row.email ?? null,
         wallet_address: row.wallet_address ?? null,
         wallet_provider: row.wallet_provider ?? null,
         wallet_connector_name: row.wallet_connector_name ?? null,
         wallet_chain_id: row.wallet_chain_id ?? null,
         user_role: normalizeRole(row.user_role),
         account_status: normalizeAccountStatus(row.account_status),
         is_world_id: row.is_world_id ?? null,
         cs: row.cs ?? null,
         mal: row.mal ?? null,
         nal: row.nal ?? null,
         created_at: row.created_at ?? null,
         updated_at: row.updated_at ?? null,
         openRequestCount: openRequests.length,
         borrowedLoanCount: borrowedLoans.length,
         activeLoanCount: activeLoans.length,
         overdueLoanCount: overdueLoans.length,
         paidLoanCount: paidLoans.length,
         lentLoanCount: lentLoans.length,
         totalBorrowedAmount: borrowedLoans.reduce((sum, loan) => sum + toNumber(loan.loan_amount), 0),
         totalRepaymentAmount: borrowedLoans.reduce((sum, loan) => sum + toNumber(loan.total_repayment_amount), 0),
         totalRepaidAmount: borrowedLoans.reduce((sum, loan) => sum + toNumber(loan.repaid_amount), 0),
         outstandingDue: activeLoans.reduce(
            (sum, loan) => sum + Math.max(0, toNumber(loan.total_repayment_amount) - toNumber(loan.repaid_amount)),
            0
         ),
         lastLoanAt: loanActivityDates[0] ?? null,
         pointsTotal: pointsRow?.points_total ?? 0,
         pointsUpdatedAt: pointsRow?.updated_at ?? null,
         pointEventCount: userPointEvents.length,
         latestPointEventAt,
         recentPointEvents: userPointEvents.slice(0, 3),
         trustPointsTotal: trustPointsRow?.points_total ?? 0,
         trustPointsUpdatedAt: trustPointsRow?.updated_at ?? null,
         trustPointEventCount: userTrustPointEvents.length,
         latestTrustPointEventAt,
         recentTrustPointEvents: userTrustPointEvents.slice(0, 3),
         restriction: restrictionsByUserId.get(row.id) ?? null,
         riskProfile: riskByUserId.get(row.id) ?? null
      };
   });
}

export async function getCurrentAdmin(fallbackUserId?: string | null): Promise<AdminUser | null> {
   if (!isSupabaseBrowserConfigured()) return null;

   const supabase = getSupabaseBrowserClient();
   const { data: auth, error: authError } = await supabase.auth.getUser();
   if (authError) throw authError;

   const userId = auth.user?.id ?? fallbackUserId;
   if (!userId) return null;

   return requireOk(
      supabase.from('admin_users').select('id,user_id,role,active,display_name').eq('user_id', userId).eq('active', true).maybeSingle()
   );
}

export async function getAdminOverview(): Promise<AdminOverview> {
   const supabase = getSupabaseBrowserClient();
   const now = new Date().toISOString();

   const [
      allUsers,
      openRequests,
      activeLoans,
      defaultedLoans,
      recoveryReviews,
      bannedUsers,
      watchlistUsers,
      loanRequestReviews,
      highRiskProfiles
   ] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('loans').select('id', { count: 'exact', head: true }).eq('loan_status', 'Requested'),
      supabase
         .from('loans')
         .select('id', { count: 'exact', head: true })
         .eq('loan_status', 'Lent')
         .in('repayment_status', ['Unpaid', 'Partial']),
      supabase
         .from('loans')
         .select('id', { count: 'exact', head: true })
         .eq('loan_status', 'Lent')
         .in('repayment_status', ['Unpaid', 'Partial'])
         .lt('due_date', now),
      optionalCount(
         supabase.from('default_recovery_cases').select('id', { count: 'exact', head: true }).in('status', ['needs_review', 'active'])
      ),
      optionalCount(supabase.from('admin_account_restrictions').select('id', { count: 'exact', head: true }).eq('status', 'banned')),
      optionalCount(supabase.from('admin_account_restrictions').select('id', { count: 'exact', head: true }).eq('status', 'watchlist')),
      optionalCount(
         supabase
            .from('admin_loan_request_reviews')
            .select('id', { count: 'exact', head: true })
            .in('status', ['needs_review', 'reported', 'duplicate'])
      ),
      optionalCount(supabase.from('admin_risk_profiles').select('id', { count: 'exact', head: true }).eq('risk_level', 'high'))
   ]);

   const failed = [allUsers, openRequests, activeLoans, defaultedLoans].find((response: any) => response.error);
   if ((failed as any)?.error) throw (failed as any).error;

   return {
      allUserCount: countFromResult((allUsers as any).count),
      openLoanRequestCount: countFromResult((openRequests as any).count),
      activeLoanCount: countFromResult((activeLoans as any).count),
      defaultedLoanCount: countFromResult((defaultedLoans as any).count),
      recoveryReviewCount: recoveryReviews,
      bannedUserCount: bannedUsers,
      watchlistUserCount: watchlistUsers,
      loanRequestReviewCount: loanRequestReviews,
      highRiskProfileCount: highRiskProfiles
   };
}

export async function getLatestAdminIntegrityRun(): Promise<AdminIntegrityRun | null> {
   return optionalOk<AdminIntegrityRun | null>(
      getSupabaseBrowserClient()
         .from('admin_integrity_runs')
         .select('id,status,issue_count,summary,created_at')
         .order('created_at', { ascending: false })
         .limit(1)
         .maybeSingle(),
      null
   );
}

export async function listAdminDirectoryUsers(search?: string): Promise<AdminDirectoryUser[]> {
   const supabase = getSupabaseBrowserClient();
   let query = supabase
      .from('users')
      .select(
         'id,username,email,wallet_address,wallet_provider,wallet_connector_name,wallet_chain_id,user_role,account_status,is_world_id,cs,mal,nal,created_at,updated_at'
      )
      .order('updated_at', { ascending: false })
      .limit(100);
   const trimmedSearch = search?.trim();

   if (trimmedSearch) {
      query = query.or(`username.ilike.%${trimmedSearch}%,wallet_address.ilike.%${trimmedSearch}%,email.ilike.%${trimmedSearch}%`);
   }

   const users = await requireOk<AnyRow[]>(query);
   const userIds = users.map((user) => user.id);

   const [loans, restrictions, riskProfiles, points, pointEvents, trustPoints, trustPointEvents] = await Promise.all([
      userIds.length
         ? requireOk<AnyRow[]>(
              supabase
                 .from('loans')
                 .select(
                    'id,borrower_user_id,lender_user_id,loan_amount,total_repayment_amount,repaid_amount,due_date,loan_status,repayment_status,created_at,funded_at'
                 )
                 .or(`borrower_user_id.in.(${userIds.join(',')}),lender_user_id.in.(${userIds.join(',')})`)
           )
         : Promise.resolve([]),
      userIds.length
         ? optionalOk<AnyRow[]>(supabase.from('admin_account_restrictions').select('*').in('user_id', userIds), [])
         : Promise.resolve([]),
      userIds.length
         ? optionalOk<AnyRow[]>(supabase.from('admin_risk_profiles').select('*').in('user_id', userIds), [])
         : Promise.resolve([]),
      userIds.length
         ? optionalOk<AnyRow[]>(
              supabase.from('user_points').select('user_id,points_total,updated_at,last_event_id').in('user_id', userIds),
              []
           )
         : Promise.resolve([]),
      userIds.length
         ? optionalOk<AnyRow[]>(
              supabase
                 .from('point_events')
                 .select('id,user_id,event_type,delta,source_type,source_id,created_at,metadata')
                 .in('user_id', userIds)
                 .order('created_at', { ascending: false })
                 .limit(300),
              []
           )
         : Promise.resolve([]),
      userIds.length
         ? optionalOk<AnyRow[]>(
              supabase.from('user_trust_points').select('user_id,points_total,updated_at,last_event_id').in('user_id', userIds),
              []
           )
         : Promise.resolve([]),
      userIds.length
         ? optionalOk<AnyRow[]>(
              supabase
                 .from('trust_point_events')
                 .select('id,user_id,event_type,delta,source_type,source_id,created_at,metadata')
                 .in('user_id', userIds)
                 .order('created_at', { ascending: false })
                 .limit(300),
              []
           )
         : Promise.resolve([])
   ]);

   return buildDirectoryRows(users, loans, restrictions, riskProfiles, points, pointEvents, trustPoints, trustPointEvents);
}

export async function listAdminLoanRequests(): Promise<AdminLoanRequest[]> {
   const supabase = getSupabaseBrowserClient();
   const rows = await requireOk<AnyRow[]>(
      supabase
         .from('loans')
         .select(
            'id,tracking_id,borrower_user_id,lender_user_id,borrower_wallet,lender_wallet,loan_amount,total_repayment_amount,repaid_amount,due_date,reason,coin,loan_status,repayment_status,created_at,funded_at'
         )
         .eq('loan_status', 'Requested')
         .order('created_at', { ascending: false })
         .limit(100)
   );

   const userIds = rows.flatMap((loan) => [loan.borrower_user_id, loan.lender_user_id].filter(Boolean));
   const usersById = await fetchUsersByIds(userIds);
   const loanIds = rows.map((loan) => loan.id);
   const reviews = loanIds.length
      ? await optionalOk<AnyRow[]>(supabase.from('admin_loan_request_reviews').select('*').in('loan_id', loanIds), [])
      : [];
   const reviewsByLoanId = new Map(reviews.map((review) => [review.loan_id, mapReview(review)]));

   return rows.map((row) => ({
      ...mapLoan(row, usersById),
      review: reviewsByLoanId.get(row.id) ?? null
   }));
}

// Loan explorer — every loan, filterable by lifecycle state.
export type LoanExplorerStatus = 'all' | 'requested' | 'active' | 'overdue' | 'repaid';

export async function listAdminLoans(
   status: LoanExplorerStatus = 'all',
   { includeTest = false, limit = 500 }: { includeTest?: boolean; limit?: number } = {}
): Promise<AdminLoanRecord[]> {
   const supabase = getSupabaseBrowserClient();
   const now = new Date().toISOString();
   let query = supabase
      .from('loans')
      .select(
         'id,tracking_id,borrower_user_id,lender_user_id,borrower_wallet,lender_wallet,loan_amount,total_repayment_amount,repaid_amount,due_date,reason,coin,loan_status,repayment_status,is_test,created_at,funded_at'
      );

   if (!includeTest) query = query.eq('is_test', false);

   if (status === 'requested') {
      query = query.eq('loan_status', 'Requested');
   } else if (status === 'active') {
      query = query.eq('loan_status', 'Lent').in('repayment_status', ['Unpaid', 'Partial']).gte('due_date', now);
   } else if (status === 'overdue') {
      query = query.eq('loan_status', 'Lent').in('repayment_status', ['Unpaid', 'Partial']).lt('due_date', now);
   } else if (status === 'repaid') {
      query = query.eq('loan_status', 'Lent').eq('repayment_status', 'Paid');
   }

   const rows = await requireOk<AnyRow[]>(query.order('created_at', { ascending: false }).limit(limit));
   const userIds = rows.flatMap((loan) => [loan.borrower_user_id, loan.lender_user_id].filter(Boolean));
   const usersById = await fetchUsersByIds(userIds);
   return rows.map((row) => mapLoan(row, usersById));
}

// Mark a user or loan as test / real (admin-only, via the gated RPC). Lets admins fix
// misclassifications or flag new test data straight from the panel.
export async function setEntityTest(entity: 'user' | 'loan', id: string, isTest: boolean): Promise<void> {
   const supabase = getSupabaseBrowserClient();
   const { error } = await supabase.rpc('admin_set_entity_test', { p_entity: entity, p_id: id, p_is_test: isTest });
   if (error) throw error;
}

// Growth analytics — current-state breakdowns plus a weekly registration trend. Computed
// client-side from lightweight row sets (small user/loan tables); no aggregation RPC needed.
export interface GrowthAnalytics {
   totalUsers: number;
   borrowers: number;
   lenders: number;
   unsetRole: number;
   blockedUsers: number;
   worldIdVerified: number;
   diditVerified: number;
   anyVerified: number;
   verifiedRate: number; // 0..1 of all users with at least one verification
   registrationsByWeek: Array<{ weekStart: string; count: number; cumulative: number }>;
   totalLoans: number;
   requestedLoans: number;
   activeLoans: number;
   overdueLoans: number;
   repaidLoans: number;
   volumeLent: number;
   volumeRepaid: number;
   volumeOutstanding: number;
   repaymentRate: number; // repaid loans / (funded loans)
}

function isoWeekStart(dateStr: string): string {
   const d = new Date(dateStr);
   const day = (d.getUTCDay() + 6) % 7; // Monday = 0
   d.setUTCDate(d.getUTCDate() - day);
   d.setUTCHours(0, 0, 0, 0);
   return d.toISOString().slice(0, 10);
}

export async function getGrowthAnalytics({ includeTest = false }: { includeTest?: boolean } = {}): Promise<GrowthAnalytics> {
   const supabase = getSupabaseBrowserClient();
   const now = Date.now();

   let usersQuery = supabase.from('users').select('id,created_at,user_role,is_world_id,is_didit,account_status').limit(5000);
   let loansQuery = supabase
      .from('loans')
      .select('loan_amount,repaid_amount,loan_status,repayment_status,due_date,created_at')
      .limit(5000);
   if (!includeTest) {
      usersQuery = usersQuery.eq('is_test', false);
      loansQuery = loansQuery.eq('is_test', false);
   }

   const [users, loans] = await Promise.all([requireOk<AnyRow[]>(usersQuery), requireOk<AnyRow[]>(loansQuery)]);

   const isActive = (v: unknown) => String(v ?? '').toUpperCase() === 'ACTIVE';
   let borrowers = 0;
   let lenders = 0;
   let unsetRole = 0;
   let blockedUsers = 0;
   let worldIdVerified = 0;
   let diditVerified = 0;
   let anyVerified = 0;

   for (const u of users) {
      if (u.user_role === 'borrower') borrowers += 1;
      else if (u.user_role === 'lender') lenders += 1;
      else unsetRole += 1;
      if (String(u.account_status ?? '').toLowerCase() === 'blocked' || String(u.account_status ?? '').toLowerCase() === 'banned')
         blockedUsers += 1;
      const world = isActive(u.is_world_id);
      const didit = isActive(u.is_didit);
      if (world) worldIdVerified += 1;
      if (didit) diditVerified += 1;
      if (world || didit) anyVerified += 1;
   }

   // Weekly registration buckets, chronological, with a running cumulative total.
   const weekCounts = new Map<string, number>();
   for (const u of users) {
      if (!u.created_at) continue;
      const wk = isoWeekStart(u.created_at);
      weekCounts.set(wk, (weekCounts.get(wk) ?? 0) + 1);
   }
   const sortedWeeks = [...weekCounts.keys()].sort();
   let running = 0;
   const registrationsByWeek = sortedWeeks.map((weekStart) => {
      const count = weekCounts.get(weekStart) ?? 0;
      running += count;
      return { weekStart, count, cumulative: running };
   });

   let requestedLoans = 0;
   let activeLoans = 0;
   let overdueLoans = 0;
   let repaidLoans = 0;
   let volumeLent = 0;
   let volumeRepaid = 0;
   let volumeOutstanding = 0;

   for (const l of loans) {
      const amount = toNumber(l.loan_amount);
      const repaid = l.repaid_amount == null ? 0 : toNumber(l.repaid_amount);
      const dueMs = l.due_date ? new Date(l.due_date).getTime() : null;
      if (l.loan_status === 'Requested') {
         requestedLoans += 1;
      } else if (l.loan_status === 'Lent') {
         volumeLent += amount;
         volumeRepaid += repaid;
         if (l.repayment_status === 'Paid') {
            repaidLoans += 1;
         } else {
            volumeOutstanding += Math.max(amount - repaid, 0);
            if (dueMs != null && dueMs < now) overdueLoans += 1;
            else activeLoans += 1;
         }
      }
   }

   const fundedLoans = activeLoans + overdueLoans + repaidLoans;

   return {
      totalUsers: users.length,
      borrowers,
      lenders,
      unsetRole,
      blockedUsers,
      worldIdVerified,
      diditVerified,
      anyVerified,
      verifiedRate: users.length ? anyVerified / users.length : 0,
      registrationsByWeek,
      totalLoans: loans.length,
      requestedLoans,
      activeLoans,
      overdueLoans,
      repaidLoans,
      volumeLent,
      volumeRepaid,
      volumeOutstanding,
      repaymentRate: fundedLoans ? repaidLoans / fundedLoans : 0
   };
}

export async function listAdminDefaultCases(): Promise<AdminDefaultCase[]> {
   const supabase = getSupabaseBrowserClient();
   const now = new Date().toISOString();

   const [overdueLoans, recoveryCases, recoveryCaseLoans] = await Promise.all([
      requireOk<AnyRow[]>(
         supabase
            .from('loans')
            .select(
               'id,tracking_id,borrower_user_id,lender_user_id,borrower_wallet,lender_wallet,loan_amount,total_repayment_amount,repaid_amount,due_date,reason,coin,loan_status,repayment_status,created_at,funded_at'
            )
            .eq('loan_status', 'Lent')
            .in('repayment_status', ['Unpaid', 'Partial'])
            .lt('due_date', now)
            .order('due_date', { ascending: true })
            .limit(100)
      ),
      optionalOk<AnyRow[]>(supabase.from('default_recovery_cases').select('*').in('status', ['needs_review', 'active']), []),
      optionalOk<AnyRow[]>(supabase.from('default_recovery_case_loans').select('*').in('status', ['unresolved', 'in_recovery']), [])
   ]);

   const userIds = [
      ...overdueLoans.flatMap((loan) => [loan.borrower_user_id, loan.lender_user_id]),
      ...recoveryCases.flatMap((row) => [row.borrower_user_id, row.case_manager_user_id]),
      ...recoveryCaseLoans.flatMap((row) => [row.borrower_user_id, row.original_lender_user_id])
   ].filter(Boolean);
   const usersById = await fetchUsersByIds(userIds);
   const recoveryById = new Map(recoveryCases.map((row) => [row.id, row]));
   const loanIdsInRecovery = new Set(recoveryCaseLoans.map((row) => row.loan_id).filter(Boolean));

   const fromRecovery = recoveryCaseLoans.map((row) => {
      const recovery = recoveryById.get(row.case_id) ?? {};
      const borrower = row.borrower_user_id ? usersById.get(row.borrower_user_id) : null;
      const lender = row.original_lender_user_id ? usersById.get(row.original_lender_user_id) : null;

      return {
         id: row.id,
         source: 'recovery_case' as const,
         case_id: row.case_id ?? null,
         loan_id: row.loan_id ?? null,
         borrower_user_id: row.borrower_user_id ?? recovery.borrower_user_id ?? null,
         lender_user_id: row.original_lender_user_id ?? null,
         borrower: borrower?.username ?? 'Unknown borrower',
         lender: lender?.username ?? 'No lender on file',
         amount_due: toNumber(row.amount_due),
         due_date: row.due_date ?? null,
         days_late: daysLate(row.due_date),
         status: recovery.status ?? row.status ?? 'needs_review',
         recovery_path: recovery.recovery_path ?? null,
         borrower_explanation: recovery.borrower_explanation ?? null,
         evidence_summary: recovery.evidence_summary ?? null,
         admin_note: recovery.admin_note ?? null,
         created_at: recovery.created_at ?? row.created_at ?? null,
         updated_at: recovery.updated_at ?? null
      };
   });

   const fromOverdueLoans = overdueLoans
      .filter((loan) => !loanIdsInRecovery.has(loan.id))
      .map((loan) => {
         const borrower = loan.borrower_user_id ? usersById.get(loan.borrower_user_id) : null;
         const lender = loan.lender_user_id ? usersById.get(loan.lender_user_id) : null;

         return {
            id: `loan:${loan.id}`,
            source: 'overdue_loan' as const,
            case_id: null,
            loan_id: loan.id,
            borrower_user_id: loan.borrower_user_id ?? null,
            lender_user_id: loan.lender_user_id ?? null,
            borrower: borrower?.username ?? 'Unknown borrower',
            lender: lender?.username ?? 'No lender on file',
            amount_due: outstandingDue(mapLoan(loan, usersById)),
            due_date: loan.due_date ?? null,
            days_late: daysLate(loan.due_date),
            status: 'needs_review',
            recovery_path: null,
            borrower_explanation: loan.reason ?? null,
            evidence_summary: `Live overdue loan ${loan.tracking_id}`,
            admin_note: null,
            created_at: loan.created_at ?? null,
            updated_at: loan.updated_at ?? null
         };
      });

   return [...fromRecovery, ...fromOverdueLoans].sort((a, b) => b.days_late - a.days_late);
}

export async function findUserByUsername(username: string): Promise<AdminDirectoryUser | null> {
   const normalizedUsername = username.trim();
   if (!normalizedUsername) return null;

   const rows = await listAdminDirectoryUsers(normalizedUsername);
   return rows.find((row) => row.username.toLowerCase() === normalizedUsername.toLowerCase()) ?? null;
}

export async function sendNoticeToUsers(
   recipientUserIds: string[],
   notice: NoticeTemplateInput,
   createdBy?: string | null
): Promise<AnyRow[]> {
   const uniqueRecipientUserIds = [...new Set(recipientUserIds.filter(Boolean))];
   if (!uniqueRecipientUserIds.length) return [];

   return requireOk(
      getSupabaseBrowserClient()
         .from('admin_user_notices')
         .insert(
            uniqueRecipientUserIds.map((recipientUserId) => ({
               recipient_user_id: recipientUserId,
               audience: notice.audience,
               notice_type: notice.notice_type,
               title: notice.title,
               body: notice.body,
               metadata: notice.metadata ?? {},
               created_by: createdBy ?? null
            }))
         )
         .select()
   );
}

export async function sendNoticeToUsername(username: string, notice: NoticeTemplateInput, createdBy?: string | null) {
   const recipient = await findUserByUsername(username);
   if (!recipient) throw new Error(`Could not find user "${username}".`);

   const [sentNotice] = await sendNoticeToUsers([recipient.id], notice, createdBy);
   return sentNotice;
}

export async function logAdminAction(input: {
   action: string;
   target_table?: string | null;
   target_id?: string | null;
   target_user_id?: string | null;
   metadata?: Record<string, unknown>;
}) {
   const supabase = getSupabaseBrowserClient();
   const { data: auth } = await supabase.auth.getUser();

   return requireOk(
      supabase
         .from('admin_audit_logs')
         .insert({
            actor_user_id: auth.user?.id ?? null,
            action: input.action,
            target_table: input.target_table ?? null,
            target_id: input.target_id ?? null,
            target_user_id: input.target_user_id ?? null,
            metadata: input.metadata ?? {}
         })
         .select()
         .single()
   );
}

export async function upsertLoanRequestReview(input: {
   loan_id: string;
   borrower_user_id?: string | null;
   status: 'needs_review' | 'reported' | 'duplicate' | 'kept' | 'deleted';
   reason: 'spam' | 'duplicate' | 'unsafe' | 'bad_data' | 'manual';
   risk_level: RiskLevel;
   evidence_summary?: string | null;
   admin_note?: string | null;
   reviewed_by?: string | null;
}) {
   return requireOk(
      getSupabaseBrowserClient()
         .from('admin_loan_request_reviews')
         .upsert(
            {
               loan_id: input.loan_id,
               borrower_user_id: input.borrower_user_id ?? null,
               status: input.status,
               reason: input.reason,
               risk_level: input.risk_level,
               evidence_summary: input.evidence_summary ?? null,
               admin_note: input.admin_note ?? null,
               reviewed_by: input.reviewed_by ?? null,
               reviewed_at: new Date().toISOString()
            },
            { onConflict: 'loan_id' }
         )
         .select()
         .single()
   );
}

export async function upsertRiskProfileByUsername(input: {
   username: string;
   score: number;
   risk_level: RiskLevel;
   status: 'active' | 'watchlist' | 'blocked';
   algorithm_note?: string | null;
   override_reason?: string | null;
   override_by?: string | null;
}) {
   const user = await findUserByUsername(input.username);
   if (!user) throw new Error(`Could not find user "${input.username}".`);

   return requireOk(
      getSupabaseBrowserClient()
         .from('admin_risk_profiles')
         .upsert(
            {
               user_id: user.id,
               score: input.score,
               risk_level: input.risk_level,
               status: input.status,
               algorithm_version: 'admin_manual_review_v1',
               algorithm_note: input.algorithm_note ?? null,
               override_score: input.score,
               override_reason: input.override_reason ?? null,
               override_by: input.override_by ?? null,
               override_at: new Date().toISOString()
            },
            { onConflict: 'user_id' }
         )
         .select()
         .single()
   );
}

export async function upsertAccountRestrictionByUserId(input: {
   user_id: string;
   status: RestrictionStatus;
   reason: 'spam' | 'default' | 'duplicate' | 'abuse' | 'manual';
   risk_level: RiskLevel;
   admin_note?: string | null;
   evidence_summary?: string | null;
   updated_by?: string | null;
}) {
   return requireOk(
      getSupabaseBrowserClient()
         .from('admin_account_restrictions')
         .upsert(
            {
               user_id: input.user_id,
               status: input.status,
               reason: input.reason,
               risk_level: input.risk_level,
               admin_note: input.admin_note ?? null,
               evidence_summary: input.evidence_summary ?? null,
               restricted_at: input.status === 'banned' || input.status === 'watchlist' ? new Date().toISOString() : null,
               unrestricted_at: input.status === 'active' ? new Date().toISOString() : null,
               updated_by: input.updated_by ?? null
            },
            { onConflict: 'user_id' }
         )
         .select()
         .single()
   );
}

export async function upsertAccountRestrictionByUsername(input: {
   username: string;
   status: RestrictionStatus;
   reason: 'spam' | 'default' | 'duplicate' | 'abuse' | 'manual';
   risk_level: RiskLevel;
   admin_note?: string | null;
   evidence_summary?: string | null;
   updated_by?: string | null;
}) {
   const user = await findUserByUsername(input.username);
   if (!user) throw new Error(`Could not find user "${input.username}".`);
   return upsertAccountRestrictionByUserId({ ...input, user_id: user.id });
}

export async function saveDefaultRecoveryPlan(input: {
   item: AdminDefaultCase;
   recovery_path: RecoveryPath;
   note: string;
   actor_user_id?: string | null;
   payload?: Record<string, unknown>;
}) {
   const supabase = getSupabaseBrowserClient();
   let caseId = input.item.case_id;

   if (!caseId) {
      if (!input.item.borrower_user_id) throw new Error('This overdue loan has no borrower profile attached.');

      const createdCase = await requireOk<AnyRow>(
         supabase
            .from('default_recovery_cases')
            .insert({
               borrower_user_id: input.item.borrower_user_id,
               case_manager_user_id: input.actor_user_id ?? null,
               status: 'active',
               recovery_path: input.recovery_path,
               borrower_explanation: input.item.borrower_explanation ?? null,
               evidence_summary: input.item.evidence_summary ?? null,
               admin_note: input.note || null
            })
            .select()
            .single()
      );

      caseId = createdCase.id;
      await requireOk(
         supabase
            .from('default_recovery_case_loans')
            .insert({
               case_id: caseId,
               loan_id: input.item.loan_id,
               borrower_user_id: input.item.borrower_user_id,
               original_lender_user_id: input.item.lender_user_id,
               amount_due: input.item.amount_due,
               due_date: input.item.due_date,
               status: 'in_recovery'
            })
            .select()
            .single()
      );
   } else {
      await requireOk(
         supabase
            .from('default_recovery_cases')
            .update({
               case_manager_user_id: input.actor_user_id ?? null,
               status: 'active',
               recovery_path: input.recovery_path,
               admin_note: input.note || null
            })
            .eq('id', caseId)
            .select()
            .single()
      );
   }

   return requireOk(
      supabase
         .from('default_recovery_actions')
         .insert({
            case_id: caseId,
            admin_user_id: input.actor_user_id ?? null,
            action_type:
               input.recovery_path === 'extension'
                  ? 'extend_loan'
                  : input.recovery_path === 'payment_plan'
                    ? 'create_payment_plan'
                    : input.recovery_path === 'bridge_loan'
                      ? 'create_bridge_loan'
                      : input.recovery_path === 'manual'
                        ? 'manual_resolution'
                        : 'approve_recovery',
            payload: input.payload ?? {},
            note: input.note || null
         })
         .select()
         .single()
   );
}

// ---------------------------------------------------------------------------
// Self-lending / detection overview (admin_get_detection_overview RPC)
// ---------------------------------------------------------------------------
export type DetectionLinkType =
   | 'same_wallet_on_loan'
   | 'shared_wallet'
   | 'shared_email'
   | 'shared_ip'
   | 'shared_subnet';

export interface DetectionAccount {
   user_id: string;
   username: string | null;
   email?: string | null;
   role?: UserRole | null;
   whitelisted?: boolean;
}

export interface SelfLendingLoan {
   loan_id: string;
   tracking_id: string | null;
   loan_amount: number | null;
   coin: string | null;
   loan_status: string | null;
   created_at: string | null;
   borrower: DetectionAccount;
   lender: DetectionAccount;
   links: DetectionLinkType[];
   strongest: 'strong' | 'circumstantial';
}

export interface SharedWalletCluster {
   wallet_address: string;
   account_count: number;
   all_whitelisted: boolean;
   has_borrower: boolean;
   has_lender: boolean;
   accounts: DetectionAccount[];
}

export interface SharedIpCluster {
   ip_hash_short: string;
   account_count: number;
   all_whitelisted: boolean;
   country?: string | null;
   city?: string | null;
   asn_org?: string | null;
   is_hosting?: boolean;
   accounts: DetectionAccount[];
}

export interface SubnetCluster {
   subnet_hash_short: string;
   account_count: number;
   all_whitelisted: boolean;
   asn_org?: string | null;
   country?: string | null;
   accounts: DetectionAccount[];
}

export interface EmailCollision {
   canonical_email: string;
   account_count: number;
   accounts: DetectionAccount[];
}

export interface HostingIp {
   user_id: string;
   username: string | null;
   email: string | null;
   asn_org: string | null;
   country: string | null;
   login_count: number;
   whitelisted: boolean;
}

export interface DetectionOverview {
   generated_at: string;
   shared_wallets: SharedWalletCluster[];
   shared_ips: SharedIpCluster[];
   hosting_ips: HostingIp[];
   subnet_clusters: SubnetCluster[];
   email_collisions: EmailCollision[];
   self_lending_loans: SelfLendingLoan[];
}

export async function getDetectionOverview(): Promise<DetectionOverview> {
   const supabase = getSupabaseBrowserClient();
   const { data, error } = await supabase.rpc('admin_get_detection_overview');
   if (error) throw error;
   const o = (data ?? {}) as Partial<DetectionOverview>;
   return {
      generated_at: o.generated_at ?? new Date().toISOString(),
      shared_wallets: o.shared_wallets ?? [],
      shared_ips: o.shared_ips ?? [],
      hosting_ips: o.hosting_ips ?? [],
      subnet_clusters: o.subnet_clusters ?? [],
      email_collisions: o.email_collisions ?? [],
      self_lending_loans: o.self_lending_loans ?? []
   };
}

// ---------------------------------------------------------------------------
// Fraud alert review queue (fraud_signal_alerts + review_status)
// ---------------------------------------------------------------------------
export type FraudAlertStatus = 'open' | 'ignored' | 'confirmed';

export interface FraudAlert {
   id: string;
   signal_type: string;
   subject_key: string;
   details: Record<string, unknown>;
   review_status: FraudAlertStatus;
   reviewed_at: string | null;
   reviewed_note: string | null;
   created_at: string;
}

export async function listFraudAlerts(): Promise<FraudAlert[]> {
   const supabase = getSupabaseBrowserClient();
   const { data, error } = await supabase
      .from('fraud_signal_alerts')
      .select('id, signal_type, subject_key, details, review_status, reviewed_at, reviewed_note, created_at')
      .order('created_at', { ascending: false });
   if (error) throw error;
   return (data ?? []) as FraudAlert[];
}

export async function setFraudAlertStatus(alertId: string, status: FraudAlertStatus, note?: string | null) {
   const supabase = getSupabaseBrowserClient();
   const { error } = await supabase.rpc('admin_set_fraud_alert_status', {
      p_alert_id: alertId,
      p_status: status,
      p_note: note ?? null
   });
   if (error) throw error;
}

// ---------------------------------------------------------------------------
// Referral codes (referral_codes) — RLS allows admin full CRUD.
// ---------------------------------------------------------------------------
export interface AdminReferralCode {
   id: string;
   code: string;
   boost_amount: number;
   is_active: boolean;
   max_uses: number | null;
   current_uses: number;
   expires_at: string | null;
   created_at: string;
}

export async function listReferralCodes(): Promise<AdminReferralCode[]> {
   const supabase = getSupabaseBrowserClient();
   const data = (await requireOk(
      supabase
         .from('referral_codes')
         .select('id, code, boost_amount, is_active, max_uses, current_uses, expires_at, created_at')
         .order('created_at', { ascending: false })
   )) as AnyRow[] | null;
   return (data ?? []).map((row) => ({ ...row, boost_amount: toNumber(row.boost_amount) })) as AdminReferralCode[];
}

export async function createReferralCode(input: {
   code: string;
   boost_amount: number;
   max_uses?: number | null;
   expires_at?: string | null;
}): Promise<AdminReferralCode> {
   const supabase = getSupabaseBrowserClient();
   const data = await requireOk(
      supabase
         .from('referral_codes')
         .insert({
            code: input.code.trim().toUpperCase(),
            boost_amount: input.boost_amount,
            max_uses: input.max_uses ?? null,
            expires_at: input.expires_at ?? null
         })
         .select('id, code, boost_amount, is_active, max_uses, current_uses, expires_at, created_at')
         .single()
   );
   return { ...(data as AnyRow), boost_amount: toNumber((data as AnyRow).boost_amount) } as AdminReferralCode;
}

export async function setReferralCodeActive(id: string, isActive: boolean): Promise<AdminReferralCode> {
   const supabase = getSupabaseBrowserClient();
   const data = await requireOk(
      supabase
         .from('referral_codes')
         .update({ is_active: isActive })
         .eq('id', id)
         .select('id, code, boost_amount, is_active, max_uses, current_uses, expires_at, created_at')
         .single()
   );
   return { ...(data as AnyRow), boost_amount: toNumber((data as AnyRow).boost_amount) } as AdminReferralCode;
}

// Edit a live code's terms (boost, usage cap, expiry) without recreating it. The code string
// itself is immutable — loans/users reference it — so it is not editable here.
export async function updateReferralCode(
   id: string,
   changes: {
      boost_amount?: number;
      max_uses?: number | null;
      expires_at?: string | null;
   }
): Promise<AdminReferralCode> {
   const supabase = getSupabaseBrowserClient();
   const patch: Record<string, unknown> = {};
   if (changes.boost_amount !== undefined) patch.boost_amount = changes.boost_amount;
   if (changes.max_uses !== undefined) patch.max_uses = changes.max_uses;
   if (changes.expires_at !== undefined) patch.expires_at = changes.expires_at;
   const data = await requireOk(
      supabase
         .from('referral_codes')
         .update(patch)
         .eq('id', id)
         .select('id, code, boost_amount, is_active, max_uses, current_uses, expires_at, created_at')
         .single()
   );
   return { ...(data as AnyRow), boost_amount: toNumber((data as AnyRow).boost_amount) } as AdminReferralCode;
}

// Only for codes with current_uses === 0 — FK refs from users/loans block redeemed codes.
export async function deleteReferralCode(id: string): Promise<void> {
   const supabase = getSupabaseBrowserClient();
   const { error } = await supabase.from('referral_codes').delete().eq('id', id);
   if (error) throw error;
}

// ---------------------------------------------------------------------------
// Whitelist management (fraud_detection_whitelist) — RLS allows admin write.
// ---------------------------------------------------------------------------
export async function addToWhitelist(userId: string, reason?: string | null) {
   const supabase = getSupabaseBrowserClient();
   const { error } = await supabase
      .from('fraud_detection_whitelist')
      .upsert({ user_id: userId, reason: reason ?? 'muted from admin panel' }, { onConflict: 'user_id' });
   if (error) throw error;
}

export async function removeFromWhitelist(userId: string) {
   const supabase = getSupabaseBrowserClient();
   const { error } = await supabase.from('fraud_detection_whitelist').delete().eq('user_id', userId);
   if (error) throw error;
}

// ---------------------------------------------------------------------------
// Login geo points for the hotspot map (admin_get_login_geo RPC)
// ---------------------------------------------------------------------------
export interface LoginGeoPoint {
   lat: number;
   lon: number;
   city: string | null;
   country: string | null;
   is_hosting: boolean;
   account_count: number;
   accounts: Array<{ user_id: string; username: string | null; role?: UserRole | null }>;
}

export async function getLoginGeo(): Promise<LoginGeoPoint[]> {
   const supabase = getSupabaseBrowserClient();
   const { data, error } = await supabase.rpc('admin_get_login_geo');
   if (error) throw error;
   return (data ?? []) as LoginGeoPoint[];
}
