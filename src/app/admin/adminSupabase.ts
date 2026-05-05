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

async function requireOk<T>(request: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
   const { data, error } = await request;
   if (error) throw error;
   return data;
}

function countFromResult(count: number | null): number {
   return count ?? 0;
}

export async function getCurrentAdmin(fallbackUserId?: string | null): Promise<AdminUser | null> {
   if (!isSupabaseBrowserConfigured()) return null;

   const supabase = getSupabaseBrowserClient();
   const { data: auth, error: authError } = await supabase.auth.getUser();
   if (authError) throw authError;

   const userId = auth.user?.id ?? fallbackUserId;
   if (!userId) return null;

   return requireOk(
      supabase
         .from('admin_users')
         .select('id,user_id,role,active,display_name')
         .eq('user_id', userId)
         .eq('active', true)
         .maybeSingle()
   );
}

export async function getAdminOverview(): Promise<AdminOverview> {
   const supabase = getSupabaseBrowserClient();
   const now = new Date().toISOString();

   const [defaultedLoans, recoveryReviews, bannedUsers, loanRequestReviews, highRiskProfiles] = await Promise.all([
      supabase.from('loans').select('id', { count: 'exact', head: true }).lt('due_date', now).in('repayment_status', ['Unpaid', 'Partial']),
      supabase.from('default_recovery_cases').select('id', { count: 'exact', head: true }).in('status', ['needs_review', 'active']),
      supabase.from('admin_account_restrictions').select('id', { count: 'exact', head: true }).eq('status', 'banned'),
      supabase.from('admin_loan_request_reviews').select('id', { count: 'exact', head: true }).in('status', ['needs_review', 'reported', 'duplicate']),
      supabase.from('admin_risk_profiles').select('id', { count: 'exact', head: true }).eq('risk_level', 'high')
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
   const supabase = getSupabaseBrowserClient();
   let query = supabase.from('users').select('id,username,wallet_address').order('username', { ascending: true }).limit(25);
   const trimmedSearch = search?.trim();

   if (trimmedSearch) {
      query = query.or(`username.ilike.%${trimmedSearch}%,wallet_address.ilike.%${trimmedSearch}%`);
   }

   return requireOk(query);
}

export async function findUserByUsername(username: string): Promise<AdminDirectoryUser | null> {
   const normalizedUsername = username.trim();
   if (!normalizedUsername) return null;

   return requireOk(
      getSupabaseBrowserClient()
         .from('users')
         .select('id,username,wallet_address')
         .ilike('username', normalizedUsername)
         .maybeSingle()
   );
}

export async function sendNoticeToUsers(recipientUserIds: string[], notice: NoticeTemplateInput, createdBy?: string | null) {
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
      getSupabaseBrowserClient()
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
