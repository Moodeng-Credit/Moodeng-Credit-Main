import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

export type AdminRole = 'owner' | 'admin' | 'support';
export type NoticeAudience = 'borrower' | 'lender' | 'candidate_lender' | 'admin';
export type RestrictionStatus = 'active' | 'watchlist' | 'banned';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface AdminUser {
   id: string;
   user_id: string;
   role: AdminRole;
   active: boolean;
   display_name: string | null;
}

export interface AdminDirectoryUser {
   id: string;
   username: string | null;
   wallet_address: string | null;
}

export interface AdminOverview {
   defaultedLoanCount: number;
   recoveryReviewCount: number;
   bannedUserCount: number;
   loanRequestReviewCount: number;
   highRiskProfileCount: number;
}

export interface NoticeTemplateInput {
   audience: NoticeAudience;
   notice_type: string;
   title: string;
   body: string;
   metadata?: Record<string, unknown>;
}

export interface DefaultedLoanRow {
   id: string;
   tracking_id: string | null;
   borrower_user_id: string | null;
   lender_user_id: string | null;
   loan_amount: number | string | null;
   total_repayment_amount: number | string | null;
   repaid_amount: number | string | null;
   due_date: string | null;
   borrower_wallet: string | null;
   lender_wallet: string | null;
   loan_status: string | null;
   repayment_status: string | null;
}

export interface RecoveryCaseRow {
   id: string;
   borrower_user_id: string;
   case_manager_user_id: string | null;
   status: string;
   recovery_path: string | null;
   borrower_explanation: string | null;
   evidence_summary: string | null;
   borrower_deposit_amount: number | string | null;
   borrower_deposit_tx: string | null;
   admin_note: string | null;
   created_at: string;
   updated_at: string;
   default_recovery_case_loans?: Array<Record<string, unknown>>;
   default_recovery_messages?: Array<Record<string, unknown>>;
}

export interface LoanRequestReviewRow {
   id: string;
   loan_id: string | null;
   borrower_user_id: string | null;
   status: string;
   reason: string | null;
   risk_level: RiskLevel;
   evidence_summary: string | null;
   admin_note: string | null;
   reviewed_by: string | null;
   reviewed_at: string | null;
   created_at: string;
   updated_at: string;
   loans?: Record<string, unknown> | null;
   users?: AdminDirectoryUser | null;
}

export interface RiskProfileRow {
   id: string;
   user_id: string;
   score: number;
   risk_level: RiskLevel;
   status: string;
   algorithm_version: string;
   algorithm_note: string | null;
   override_score: number | null;
   override_reason: string | null;
   calculated_at: string;
   users?: AdminDirectoryUser | null;
   admin_risk_factors?: Array<Record<string, unknown>>;
}

async function requireOk<T>(request: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
   const { data, error } = await request;
   if (error) throw error;
   return data;
}

function countFromResult(count: number | null): number {
   return count ?? 0;
}

function supabase() {
   return getSupabaseBrowserClient();
}

export async function getCurrentAdmin(fallbackUserId?: string | null): Promise<AdminUser | null> {
   if (!isSupabaseBrowserConfigured()) return null;

   const client = supabase();
   const { data: auth, error: authError } = await client.auth.getUser();
   if (authError) throw authError;

   const userId = auth.user?.id ?? fallbackUserId;
   if (!userId) return null;

   return requireOk(
      client
         .from('admin_users')
         .select('id,user_id,role,active,display_name')
         .eq('user_id', userId)
         .eq('active', true)
         .maybeSingle()
   );
}

export async function getAdminOverview(): Promise<AdminOverview> {
   const client = supabase();
   const now = new Date().toISOString();

   const [defaultedLoans, recoveryReviews, bannedUsers, loanRequestReviews, highRiskProfiles] = await Promise.all([
      client.from('loans').select('id', { count: 'exact', head: true }).lt('due_date', now).in('repayment_status', ['Unpaid', 'Partial']),
      client.from('default_recovery_cases').select('id', { count: 'exact', head: true }).in('status', ['needs_review', 'active']),
      client.from('admin_account_restrictions').select('id', { count: 'exact', head: true }).eq('status', 'banned'),
      client.from('admin_loan_request_reviews').select('id', { count: 'exact', head: true }).in('status', ['needs_review', 'reported', 'duplicate']),
      client.from('admin_risk_profiles').select('id', { count: 'exact', head: true }).eq('risk_level', 'high')
   ]);

   const failed = [defaultedLoans, recoveryReviews, bannedUsers, loanRequestReviews, highRiskProfiles].find((response) => response.error);
   if (failed?.error) throw failed.error;

   return {
      defaultedLoanCount: countFromResult(defaultedLoans.count),
      recoveryReviewCount: countFromResult(recoveryReviews.count),
      bannedUserCount: countFromResult(bannedUsers.count),
      loanRequestReviewCount: countFromResult(loanRequestReviews.count),
      highRiskProfileCount: countFromResult(highRiskProfiles.count)
   };
}

export async function listAdminDirectoryUsers(search?: string): Promise<AdminDirectoryUser[]> {
   let query = supabase().from('users').select('id,username,wallet_address').order('username', { ascending: true }).limit(50);
   const trimmedSearch = search?.trim();

   if (trimmedSearch) query = query.or(`username.ilike.%${trimmedSearch}%,wallet_address.ilike.%${trimmedSearch}%`);

   return requireOk(query);
}

export async function listDefaultedLoans(): Promise<DefaultedLoanRow[]> {
   const now = new Date().toISOString();
   return requireOk(
      supabase()
         .from('loans')
         .select('id,tracking_id,borrower_user_id,lender_user_id,loan_amount,total_repayment_amount,repaid_amount,due_date,borrower_wallet,lender_wallet,loan_status,repayment_status')
         .lt('due_date', now)
         .in('repayment_status', ['Unpaid', 'Partial'])
         .order('due_date', { ascending: true })
   );
}

export async function listRecoveryCases(): Promise<RecoveryCaseRow[]> {
   return requireOk(
      supabase()
         .from('default_recovery_cases')
         .select('*, default_recovery_case_loans(*), default_recovery_messages(*)')
         .order('created_at', { ascending: false })
   );
}

export async function listLoanRequestReviews(): Promise<LoanRequestReviewRow[]> {
   return requireOk(
      supabase()
         .from('admin_loan_request_reviews')
         .select('*, loans(id,tracking_id,loan_amount,reason,due_date,borrower_user_id), users(id,username,wallet_address)')
         .order('updated_at', { ascending: false })
   );
}

export async function listRiskProfiles(): Promise<RiskProfileRow[]> {
   return requireOk(
      supabase()
         .from('admin_risk_profiles')
         .select('*, users(id,username,wallet_address), admin_risk_factors(*)')
         .order('score', { ascending: false })
   );
}

export async function findUserByUsername(username: string): Promise<AdminDirectoryUser | null> {
   const normalizedUsername = username.trim();
   if (!normalizedUsername) return null;

   return requireOk(supabase().from('users').select('id,username,wallet_address').ilike('username', normalizedUsername).maybeSingle());
}

export async function sendNoticeToUsers(recipientUserIds: string[], notice: NoticeTemplateInput, createdBy?: string | null) {
   const uniqueRecipientUserIds = [...new Set(recipientUserIds.filter(Boolean))];
   if (!uniqueRecipientUserIds.length) return [];

   return requireOk(
      supabase()
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

   return requireOk(
      supabase()
         .from('admin_account_restrictions')
         .upsert(
            {
               user_id: user.id,
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
