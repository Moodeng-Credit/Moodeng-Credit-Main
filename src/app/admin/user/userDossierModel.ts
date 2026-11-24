import { getLoanPastDueAt } from '@/utils/loanOverdue';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// One person's whole account for Admin → Users → click a name (UserDossierPage). The data comes from
// admin_user_dossier() (one admin-only read) and Didit's photos from admin-messenger 'didit_media'.

type Json = Record<string, unknown>;

export interface DossierLoan {
   id: string;
   amount: number | null;
   total: number | null;
   repaid: number | null;
   loan_status: string | null;
   repayment_status: string | null;
   reason: string | null;
   created_at: string;
   funded_at: string | null;
   due_date: string | null;
   due_timezone: string | null;
   repayment_schedule_late_at: string | null;
   repaid_at: string | null;
   refunded_at: string | null;
   market: string | null;
   funding_method: string | null;
   two_part: boolean;
   on_hold_reason: string | null;
   offplatform_settled_at: string | null;
   is_test: boolean | null;
}

export interface DossierUser {
   id: string;
   username: string;
   display_name: string | null;
   email: string | null;
   created_at: string;
   user_role: string | null;
   account_status: string | null;
   market: string | null;
   is_test: boolean | null;
   facebook_name: string | null;
   facebook_profile_url: string | null;
   messenger_verified_at: string | null;
   instagram_handle: string | null;
   tiktok_handle: string | null;
   whatsapp_number: string | null;
   whatsapp_verified_at: string | null;
   viber_number: string | null;
   telegram_username: string | null;
   wallet_address: string | null;
   wallet_provider: string | null;
   wallet_suspended: boolean | null;
   cs: number | null;
   credit_progression_paused: boolean | null;
   mal: number | null;
   nal: number | null;
   current_risk_score: number | null;
   current_risk_band: string | null;
   loan_access_status: string | null;
   loan_access_approved_at: string | null;
   loan_access_reject_reason: string | null;
   loan_requests_blocked: boolean | null;
   ghosted_at: string | null;
   blocked_for_good_at: string | null;
   profession: string | null;
   location: string | null;
   income_type: string | null;
   income_description: string | null;
   monthly_income: number | null;
   monthly_expenses: number | null;
   other_income: string | null;
   payday_type: string | null;
   payday_start: number | null;
   payday_end: number | null;
   about_gender: string | null;
   about_age: string | number | null;
   about_kids: string | number | null;
   is_didit: string | null;
   is_world_id: boolean;
   is_veriff: string | null;
   didit_id_status: string | null;
   didit_decline_reason: string | null;
   didit_submitted_at: string | null;
   liveness_status: string | null;
   wallet_face_status: string | null;
   video_call_starts_at: string | null;
   video_call_host: string | null;
   video_call_outcome: string | null;
   video_call_outcome_at: string | null;
   video_call_joined_at: string | null;
   video_call_left_at: string | null;
   signup_source: string | null;
   signup_campaign: string | null;
   signup_referrer: string | null;
   signup_browser: string | null;
   signup_os: string | null;
   prescreen_path: string | null;
}

export interface Dossier {
   user: DossierUser;
   loans: DossierLoan[];
   lent_count: number;
   loan_cap: { cap_usd: number; note: string | null; set_at: string } | null;
   access_requests: Array<{
      kind: string | null;
      status: string | null;
      channel: string | null;
      reason: string | null;
      created_at: string;
      decided_at: string | null;
      decided_by: string | null;
   }>;
   kyc: Array<{
      session_status: string | null;
      session_created_at: string | null;
      full_name: string | null;
      date_of_birth: string | null;
      gender: string | null;
      document_type: string | null;
      issuing_state: string | null;
      document_last4: string | null;
      marital_status: string | null;
      city: string | null;
      province: string | null;
      region: string | null;
      formatted_address: string | null;
      warnings: unknown;
   }>;
   kyc_declines: Array<{ kind: string | null; declined_at: string; voided_at: string | null }>;
   face_checks: Array<{
      status: string | null;
      liveness_score: number | null;
      match_score: number | null;
      decline_reason: string | null;
      amount: number | null;
      created_at: string;
   }>;
   call_screenings: Array<{
      call_starts_at: string | null;
      answers: Json | null;
      notes: string | null;
      red_flags: string | null;
      score: number | null;
      created_at: string;
      updated_at: string | null;
      by: string | null;
   }>;
   call_transcripts: Array<{
      call_started_at: string | null;
      host: string | null;
      risk_level: string | null;
      transcript: string | null;
      summary: {
         summary?: string;
         loan_use?: string;
         repayment_plan?: string;
         income_and_work?: string;
         consistency_with_bio?: string;
         red_flags?: string[];
         positives?: string[];
      } | null;
      form_check: unknown;
   }>;
   call_events: Array<{ kind: string; call_at: string | null; recorded_at: string }>;
   no_shows: Array<{ kind: string | null; recorded_at: string; active: boolean }>;
   bot_answers: Array<{ kind: string | null; items: unknown; fit_verdict: string | null; fit_reason: string | null; created_at: string }>;
   prescreens: Array<{
      created_at: string;
      status: string | null;
      score: number | null;
      verdict: string | null;
      repay_chance: number | null;
      summary: string | null;
      overall: number | null;
      flags: string[] | null;
      repay_reasons: string[] | null;
      team_decision: string | null;
      team_reason: string | null;
      team_decided_at: string | null;
   }>;
   income_docs: Array<{
      created_at: string;
      doc_type: string | null;
      verdict: string | null;
      score: number | null;
      risk: string | null;
      repay_chance: number | null;
      repay_reasons: string[] | null;
      memo: string | null;
      ai_note: string | null;
      decision: string | null;
      decision_reason: string | null;
      decided_at: string | null;
      metrics: Json | null;
   }>;
   risk_scores: Array<{ score: number; band: string | null; at: string }>;
   risk_alerts: Array<{ severity: string | null; signal: string | null; message: string | null; created_at: string }>;
   linked_alert: { detail: unknown; alerted_at: string; auto_rejected_at: string | null; team_cleared_at: string | null } | null;
   restriction: { status: string; reason: string | null; admin_note: string | null; restricted_at: string | null } | null;
   activity: {
      sign_ins: number;
      last_sign_in: string | null;
      days_seen: number;
      last_seen: string | null;
      ips: number;
      devices: number;
      hosting_ip: boolean;
      places: Array<{ city: string | null; country: string | null; days: number; last_seen: string }>;
      messenger_messages: number;
      messenger_last_seen: string | null;
      push_devices: number;
      reminders_sent: number;
   };
   rewards: {
      trust_points: number | null;
      iou_points: number | null;
      vouchers: Array<{
         reward: string | null;
         brand: string | null;
         amount_php: number | null;
         status: string | null;
         created_at: string;
      }>;
      spins: number;
      interest_refunds: Array<{ kind: string | null; amount_usd: number | null; status: string | null; created_at: string }>;
   };
   referrals: {
      own_code: string | null;
      invited_by: { id: string; username: string; code: string | null; at: string } | null;
      invited: Array<{ id: string; username: string; at: string; repaid: boolean }>;
   };
   /** AI guess of age + gender from one photo (user_demographic_estimates). Growth analytics only. */
   photo_estimate?: PhotoEstimate | null;
}

export interface PhotoEstimate {
   face_visible: boolean;
   est_gender: string | null;
   est_age_low: number | null;
   est_age_high: number | null;
   confidence: number | null;
   source_photo: string;
   created_at: string;
}

const PHOTO_SOURCE: Record<string, string> = {
   prescreen_intro_video: 'pre-screen video',
   avatar: 'profile photo',
   didit_selfie: 'Didit selfie',
   income_doc: 'income doc'
};

/** "Female · about 24–31 (from pre-screen video)" — null when there's nothing to show. */
export function photoEstimateText(e: PhotoEstimate | null | undefined): string | null {
   if (!e) return null;
   const from = PHOTO_SOURCE[e.source_photo] ?? e.source_photo;
   if (!e.face_visible) return `No face in the ${from}`;
   const gender = e.est_gender && e.est_gender !== 'unclear' ? e.est_gender[0].toUpperCase() + e.est_gender.slice(1) : null;
   const ages = e.est_age_low != null && e.est_age_high != null ? `about ${e.est_age_low}–${e.est_age_high}` : null;
   const body = [gender, ages].filter(Boolean).join(' · ');
   return body ? `${body} (AI guess from ${from})` : null;
}

export async function loadDossier(userId: string): Promise<Dossier | null> {
   const supabase = getSupabaseBrowserClient();
   const [{ data, error }, estimate] = await Promise.all([
      supabase.rpc('admin_user_dossier' as never, { p_user_id: userId } as never),
      // Admin-only table (RLS); a failure here never blocks the page.
      supabase
         .from('user_demographic_estimates' as never)
         .select('face_visible,est_gender,est_age_low,est_age_high,confidence,source_photo,created_at')
         .eq('user_id' as never, userId as never)
         .maybeSingle()
         .then(
            (r) => (r.error ? null : ((r.data as PhotoEstimate | null) ?? null)),
            () => null
         )
   ]);
   if (error) throw new Error(error.message);
   const dossier = (data as Dossier | null) ?? null;
   return dossier ? { ...dossier, photo_estimate: estimate } : null;
}

export interface DiditSessionMedia {
   sessionId: string;
   status: string | null;
   createdAt: string | null;
   features: string[];
   method: string | null;
   documentType: string | null;
   issuingCountry: string | null;
   faceMatchScore: number | null;
   livenessScore: number | null;
   warnings: string[];
   photos: Array<{ label: string; url: string }>;
   error?: string;
}

/** Didit sessions with fresh photo links. Never throws: the page shows what it can without them. */
export async function loadDiditMedia(userId: string): Promise<{ sessions: DiditSessionMedia[]; error?: string }> {
   try {
      const { data, error } = await getSupabaseBrowserClient().functions.invoke('admin-messenger', {
         body: { action: 'didit_media', userId }
      });
      if (error) return { sessions: [], error: error.message };
      const sessions = (data as { sessions?: DiditSessionMedia[] } | null)?.sessions;
      return Array.isArray(sessions)
         ? { sessions, error: (data as { error?: string }).error }
         : { sessions: [], error: 'Not available yet' };
   } catch (err) {
      return { sessions: [], error: err instanceof Error ? err.message : 'Could not load' };
   }
}

// ---------- Pure helpers ----------

const DAY = 86_400_000;

export type LoanOutcome = 'on_time' | 'late' | 'open' | 'overdue' | 'refunded' | 'requested';

/** The loan's deadline: end of its due day on the borrower's clock (the app's ONE deadline rule). */
const deadline = (loan: DossierLoan): number | null =>
   loan.due_date ? getLoanPastDueAt(loan.due_date, loan.due_timezone).getTime() : null;

/** How one loan went. Repaid before the end of the due day = on time. */
export function loanOutcome(loan: DossierLoan, now = Date.now()): LoanOutcome {
   if (loan.refunded_at) return 'refunded';
   if (loan.loan_status === 'Requested') return 'requested';
   const due = deadline(loan);
   const settled = loan.repaid_at ?? (loan.repayment_status === 'Paid' ? loan.offplatform_settled_at : null);
   if (settled) return due != null && new Date(settled).getTime() >= due ? 'late' : 'on_time';
   if (loan.repayment_status === 'Paid') return 'on_time';
   return loan.repayment_schedule_late_at || (due != null && now >= due) ? 'overdue' : 'open';
}

/** Whole days repaid before (+) or after (−) the end of the due day; null if not repaid. */
export function daysEarly(loan: DossierLoan): number | null {
   const due = deadline(loan);
   if (!loan.repaid_at || due == null) return null;
   const diff = (due - new Date(loan.repaid_at).getTime()) / DAY;
   return diff >= 0 ? Math.floor(diff) : -Math.ceil(-diff);
}

export interface LoanStats {
   count: number;
   borrowed: number;
   repaid: number;
   outstanding: number;
   onTime: number;
   late: number;
   overdue: number;
   open: number;
   onTimeRate: number | null;
   avgDaysEarly: number | null;
   biggest: number;
   firstLoanAt: string | null;
   lastRepaidAt: string | null;
}

export function loanStats(loans: DossierLoan[], now = Date.now()): LoanStats {
   const real = loans.filter((l) => !l.is_test && l.loan_status !== 'Requested' && !l.refunded_at);
   const outcomes = real.map((l) => loanOutcome(l, now));
   const count = (o: LoanOutcome) => outcomes.filter((x) => x === o).length;
   const early = real.map(daysEarly).filter((d): d is number => d != null);
   const onTime = count('on_time');
   const late = count('late');
   const unpaid = real.filter((l) => !l.repaid_at && l.repayment_status !== 'Paid');
   const sorted = [...real].sort((a, b) => a.created_at.localeCompare(b.created_at));
   const repaidDates = real
      .map((l) => l.repaid_at)
      .filter((d): d is string => Boolean(d))
      .sort();
   return {
      count: real.length,
      borrowed: real.reduce((s, l) => s + Number(l.amount ?? 0), 0),
      repaid: real.reduce(
         (s, l) => s + (l.repayment_status === 'Paid' ? Math.max(Number(l.repaid ?? 0), Number(l.total ?? 0)) : Number(l.repaid ?? 0)),
         0
      ),
      outstanding: unpaid.reduce((s, l) => s + Math.max(0, Number(l.total ?? 0) - Number(l.repaid ?? 0)), 0),
      onTime,
      late,
      overdue: count('overdue'),
      open: count('open'),
      onTimeRate: onTime + late ? onTime / (onTime + late) : null,
      avgDaysEarly: early.length ? early.reduce((s, d) => s + d, 0) / early.length : null,
      biggest: real.reduce((m, l) => Math.max(m, Number(l.amount ?? 0)), 0),
      firstLoanAt: sorted[0]?.funded_at ?? sorted[0]?.created_at ?? null,
      lastRepaidAt: repaidDates[repaidDates.length - 1] ?? null
   };
}

export interface JourneyStep {
   label: string;
   at: string | null;
   done: boolean;
   note?: string;
}

/** Sign-up → … → latest repayment, in order, with dates where we have them. */
export function journey(d: Dossier): JourneyStep[] {
   const u = d.user;
   const ps = d.prescreens[0];
   const stats = loanStats(d.loans);
   const callDone = u.video_call_outcome != null || d.call_screenings.length > 0;
   const rejected = u.loan_access_status === 'rejected';
   return [
      { label: 'Signed up', at: u.created_at, done: true, note: u.signup_source ?? undefined },
      { label: 'Facebook linked', at: u.messenger_verified_at, done: Boolean(u.messenger_verified_at) },
      {
         label: 'Pre-screening',
         at: ps?.created_at ?? null,
         done: Boolean(ps),
         note: ps ? `${ps.score ?? '–'} pts · ${ps.team_decision ?? ps.verdict ?? ps.status ?? ''}` : undefined
      },
      {
         label: 'ID verified',
         at: u.didit_submitted_at,
         done: u.is_didit === 'ACTIVE' || u.is_world_id,
         note: u.didit_id_status ?? undefined
      },
      {
         label: 'Call',
         at: u.video_call_starts_at ?? d.call_screenings[0]?.call_starts_at ?? null,
         done: callDone,
         note: u.video_call_outcome ?? undefined
      },
      {
         label: rejected ? 'Rejected' : 'Approved',
         at: rejected ? (d.access_requests.find((r) => r.status === 'rejected')?.decided_at ?? null) : u.loan_access_approved_at,
         done: rejected || Boolean(u.loan_access_approved_at),
         note: rejected
            ? (u.loan_access_reject_reason ?? undefined)
            : (d.access_requests.find((r) => r.status === 'approved')?.decided_by ?? undefined)
      },
      { label: 'First loan', at: stats.firstLoanAt, done: stats.count > 0 },
      { label: 'Last repaid', at: stats.lastRepaidAt, done: Boolean(stats.lastRepaidAt) }
   ];
}

export const bkkDate = (iso: string | null | undefined) =>
   iso ? new Date(iso).toLocaleDateString('en-US', { timeZone: 'Asia/Bangkok', month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export const bkkDateTime = (iso: string | null | undefined) =>
   iso
      ? new Date(iso).toLocaleString('en-US', {
           timeZone: 'Asia/Bangkok',
           month: 'short',
           day: 'numeric',
           year: 'numeric',
           hour: 'numeric',
           minute: '2-digit'
        })
      : '—';

export const usd = (n: number | null | undefined) =>
   n == null ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: Number(n) % 1 ? 2 : 0 })}`;
