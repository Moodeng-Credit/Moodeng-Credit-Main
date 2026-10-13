// Data for admin → Finance → Credit line and Growth → Marketing. Reads go straight to tables the admin's RLS
// allows; the numbers are computed in creditLineModel / marketingModel.
import type { CreditFacility, FacilityLedgerRow, FacilityLoanInput } from '@/app/admin/creditLineModel';
import type { MarketingLoan, MarketingSpendRow, MarketingUser, MonthlyGoals, ReferralCodeRow } from '@/app/admin/marketingModel';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type AnyRow = Record<string, any>;

async function requireOk<T>(request: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
   const { data, error } = await request;
   if (error) throw error;
   return data;
}

async function optionalOk<T>(request: PromiseLike<{ data: T; error: unknown }>, fallback: T): Promise<T> {
   const { data, error } = await request;
   return error ? fallback : (data ?? fallback);
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// ---- Credit line ------------------------------------------------------------------------------

export interface CreditLineData {
   facilities: CreditFacility[];
   facility: CreditFacility | null;
   loans: FacilityLoanInput[];
   ledger: FacilityLedgerRow[];
   // Funded loans by the facility's lenders, since its start, not yet in any facility — to add.
   candidates: Array<{
      id: string;
      tracking_id: string;
      funded_at: string;
      loan_amount: number;
      funding_method: string | null;
      username: string | null;
   }>;
   // Borrower history before each facility loan (for drafting rationale).
   history: Map<string, { prior: number; repaid: number; late: number; creditLimit: number | null }>;
}

const LOAN_FIELDS =
   'id,tracking_id,borrower_user_id,lender_user_id,funded_at,due_date,loan_amount,total_repayment_amount,repaid_amount,repaid_at,repayment_status,hash,reason,funding_method,is_test,refunded_at,loan_status';

export async function loadCreditLine(facilityId?: string): Promise<CreditLineData> {
   const supabase = getSupabaseBrowserClient();
   const facilities = (await requireOk<AnyRow[]>(supabase.from('credit_facilities').select('*').order('created_at'))).map(
      (f) => ({ ...f, commitment_usd: num(f.commitment_usd), annual_rate: num(f.annual_rate) }) as CreditFacility
   );
   const facility = facilities.find((f) => f.id === facilityId) ?? facilities[0] ?? null;
   if (!facility) return { facilities, facility: null, loans: [], ledger: [], candidates: [], history: new Map() };

   const [links, ledgerRows, allLinks] = await Promise.all([
      requireOk<AnyRow[]>(supabase.from('credit_facility_loans').select('loan_id,rationale').eq('facility_id', facility.id)),
      requireOk<AnyRow[]>(supabase.from('credit_facility_ledger').select('*').eq('facility_id', facility.id).order('occurred_at')),
      requireOk<AnyRow[]>(supabase.from('credit_facility_loans').select('loan_id'))
   ]);
   const rationale = new Map(links.map((l) => [l.loan_id as string, (l.rationale as string | null) ?? null]));
   const loanRows = links.length
      ? await requireOk<AnyRow[]>(
           supabase
              .from('loans')
              .select(LOAN_FIELDS)
              .in('id', [...rationale.keys()])
        )
      : [];

   const lenderIds = [...new Set(loanRows.map((l) => l.lender_user_id).filter(Boolean))];
   const linked = new Set(allLinks.map((l) => l.loan_id as string));
   const candidateRows = lenderIds.length
      ? await requireOk<AnyRow[]>(
           supabase
              .from('loans')
              .select(LOAN_FIELDS)
              .in('lender_user_id', lenderIds)
              .gte('funded_at', `${facility.start_date}T00:00:00+08:00`)
              .eq('is_test', false)
              .is('refunded_at', null)
              .order('funded_at', { ascending: false })
        )
      : [];
   const candidatesRaw = candidateRows.filter((l) => !linked.has(l.id));

   const borrowerIds = [...new Set([...loanRows, ...candidatesRaw].map((l) => l.borrower_user_id))];
   const [users, kyc, borrowerLoans] = borrowerIds.length
      ? await Promise.all([
           requireOk<AnyRow[]>(
              supabase
                 .from('users')
                 .select(
                    'id,username,display_name,facebook_name,is_didit,is_world_id,liveness_status,messenger_verified_at,video_call_outcome,cs'
                 )
                 .in('id', borrowerIds)
           ),
           optionalOk<AnyRow[]>(
              supabase.from('kyc_identities').select('user_id,document_type,issuing_state,fetched_at').in('user_id', borrowerIds),
              []
           ),
           requireOk<AnyRow[]>(
              supabase
                 .from('loans')
                 .select('id,borrower_user_id,funded_at,due_date,repaid_at,repayment_status,is_test,refunded_at')
                 .in('borrower_user_id', borrowerIds)
                 .not('funded_at', 'is', null)
           )
        ])
      : [[], [], []];
   const userById = new Map(users.map((u) => [u.id as string, u]));
   const kycByUser = new Map<string, AnyRow>();
   // A borrower can have several Didit sessions; keep the newest one that carries document details.
   for (const k of kyc) {
      if (!k.document_type) continue;
      const seen = kycByUser.get(k.user_id);
      if (!seen || String(k.fetched_at ?? '') > String(seen.fetched_at ?? '')) kycByUser.set(k.user_id, k);
   }

   const loans: FacilityLoanInput[] = loanRows.map((l) => {
      const u = userById.get(l.borrower_user_id) ?? {};
      const k = kycByUser.get(l.borrower_user_id);
      return {
         id: l.id,
         tracking_id: l.tracking_id,
         borrower_user_id: l.borrower_user_id,
         funded_at: l.funded_at,
         due_date: l.due_date,
         loan_amount: num(l.loan_amount),
         total_repayment_amount: num(l.total_repayment_amount),
         repaid_amount: num(l.repaid_amount),
         repaid_at: l.repaid_at,
         repayment_status: l.repayment_status,
         hash: l.hash ?? [],
         reason: l.reason,
         rationale: rationale.get(l.id) ?? null,
         borrower: {
            username: u.username ?? null,
            display_name: u.display_name ?? null,
            facebook_name: u.facebook_name ?? null,
            kyc_passed: u.is_didit === 'ACTIVE' || u.is_world_id === 'ACTIVE',
            kyc_document: k?.document_type ? `${k.document_type}/${k.issuing_state ?? '?'}` : null,
            liveness: u.liveness_status === 'APPROVED',
            facebook_verified: Boolean(u.messenger_verified_at),
            video_call_attended: u.video_call_outcome === 'attended'
         }
      };
   });

   const history = new Map<string, { prior: number; repaid: number; late: number; creditLimit: number | null }>();
   for (const l of loanRows) {
      const prior = borrowerLoans.filter(
         (x) => x.borrower_user_id === l.borrower_user_id && !x.is_test && !x.refunded_at && x.funded_at < l.funded_at
      );
      history.set(l.id, {
         prior: prior.length,
         repaid: prior.filter((x) => x.repayment_status === 'Paid').length,
         late: prior.filter((x) => x.repaid_at && x.due_date && x.repaid_at > x.due_date).length,
         creditLimit: userById.get(l.borrower_user_id)?.cs ?? null
      });
   }

   return {
      facilities,
      facility,
      loans,
      ledger: ledgerRows.map((r) => ({ ...r, amount_usd: num(r.amount_usd) }) as FacilityLedgerRow),
      candidates: candidatesRaw.map((l) => ({
         id: l.id,
         tracking_id: l.tracking_id,
         funded_at: l.funded_at,
         loan_amount: num(l.loan_amount),
         funding_method: l.funding_method ?? null,
         username: userById.get(l.borrower_user_id)?.username ?? null
      })),
      history
   };
}

export async function setFacilityLoanRationale(facilityId: string, loanId: string, rationale: string) {
   await requireOk(
      getSupabaseBrowserClient().from('credit_facility_loans').update({ rationale }).eq('facility_id', facilityId).eq('loan_id', loanId)
   );
}

export async function addFacilityLoan(facilityId: string, loanId: string, rationale: string | null) {
   await requireOk(
      getSupabaseBrowserClient().from('credit_facility_loans').insert({ facility_id: facilityId, loan_id: loanId, rationale })
   );
}

export async function removeFacilityLoan(facilityId: string, loanId: string) {
   await requireOk(getSupabaseBrowserClient().from('credit_facility_loans').delete().eq('facility_id', facilityId).eq('loan_id', loanId));
}

export async function addLedgerEntry(entry: Omit<FacilityLedgerRow, 'id'> & { facility_id: string }) {
   await requireOk(getSupabaseBrowserClient().from('credit_facility_ledger').insert(entry));
}

export async function deleteLedgerEntry(id: number) {
   await requireOk(getSupabaseBrowserClient().from('credit_facility_ledger').delete().eq('id', id));
}

// ---- Marketing --------------------------------------------------------------------------------

export interface MarketingData {
   loans: MarketingLoan[];
   users: MarketingUser[];
   spend: MarketingSpendRow[];
   codes: ReferralCodeRow[];
   goals: MonthlyGoals;
   // Borrowers left out of the month's goal plan (set aside or no longer lent to).
   excluded: Set<string>;
}

export const DEFAULT_GOALS: MonthlyGoals = { lent_usd: 500, marketing_budget_usd: 50, cac_target_usd: 5 };

export async function loadMarketing(month: string): Promise<MarketingData> {
   const supabase = getSupabaseBrowserClient();
   const [loans, users, spend, codes, goals, excluded] = await Promise.all([
      requireOk<AnyRow[]>(
         supabase
            .from('loans')
            .select(
               'id,borrower_user_id,loan_status,created_at,funded_at,due_date,repaid_at,repayment_status,loan_amount,total_repayment_amount,refunded_at'
            )
            .eq('is_test', false)
            .is('refunded_at', null)
            .limit(10000)
      ),
      requireOk<AnyRow[]>(
         supabase
            .from('users')
            .select(
               'id,username,display_name,facebook_name,created_at,is_didit,is_world_id,messenger_verified_at,redeemed_referral_code_id,cs,user_role,is_test,account_status,loan_access_status'
            )
            .limit(20000)
      ),
      optionalOk<AnyRow[]>(supabase.from('marketing_spend').select('*').order('spent_on', { ascending: false }), []),
      optionalOk<AnyRow[]>(supabase.from('referral_codes').select('id,code,channel,label'), []),
      optionalOk<AnyRow[]>(supabase.from('monthly_goals').select('metric,target').eq('month', `${month}-01`), []),
      optionalOk<AnyRow[]>(supabase.from('goal_excluded_users').select('user_id'), [])
   ]);
   const goalMap = Object.fromEntries(goals.map((g) => [g.metric, num(g.target)]));
   return {
      loans: loans.map(
         (l) => ({ ...l, loan_amount: num(l.loan_amount), total_repayment_amount: num(l.total_repayment_amount) }) as MarketingLoan
      ),
      users: users
         .filter((u) => u.user_role !== 'lender')
         .map((u) => ({
            id: u.id,
            username: u.username,
            display_name: u.display_name,
            facebook_name: u.facebook_name,
            created_at: u.created_at,
            verified: u.is_didit === 'ACTIVE' || u.is_world_id === 'ACTIVE',
            messenger_verified_at: u.messenger_verified_at,
            redeemed_referral_code_id: u.redeemed_referral_code_id,
            credit_limit: u.cs ?? null,
            is_test: Boolean(u.is_test),
            account_status: u.account_status ?? null,
            loan_access_status: u.loan_access_status ?? null
         })),
      spend: spend.map((s) => ({ ...s, amount_usd: num(s.amount_usd) }) as MarketingSpendRow),
      codes: codes.map((c) => ({ id: c.id, code: c.code, channel: c.channel ?? 'person', label: c.label ?? null })),
      goals: { ...DEFAULT_GOALS, ...goalMap },
      excluded: new Set(excluded.map((e) => e.user_id as string))
   };
}

export async function setGoalExcluded(userId: string, excluded: boolean, reason?: string) {
   const table = getSupabaseBrowserClient().from('goal_excluded_users');
   await requireOk(excluded ? table.upsert({ user_id: userId, reason: reason ?? null }) : table.delete().eq('user_id', userId));
}

export async function saveGoal(month: string, metric: keyof MonthlyGoals, target: number) {
   await requireOk(
      getSupabaseBrowserClient()
         .from('monthly_goals')
         .upsert({ month: `${month}-01`, metric, target, updated_at: new Date().toISOString() }, { onConflict: 'month,metric' })
   );
}

export async function addSpend(row: Omit<MarketingSpendRow, 'id'>) {
   await requireOk(getSupabaseBrowserClient().from('marketing_spend').insert(row));
}

export async function deleteSpend(id: number) {
   await requireOk(getSupabaseBrowserClient().from('marketing_spend').delete().eq('id', id));
}

export async function setCodeChannel(id: string, channel: ReferralCodeRow['channel'], label: string | null) {
   await requireOk(getSupabaseBrowserClient().from('referral_codes').update({ channel, label }).eq('id', id));
}
