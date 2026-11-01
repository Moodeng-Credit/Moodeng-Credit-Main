// Data for the admin call sheet (CallSheet.tsx): the borrower's profile as the host sees it on their
// onboarding call, and the call_screenings row the host fills in. Reads and writes go straight to
// tables the admin's RLS allows.
import type { FormCheck } from '@/app/admin/callFormCheck';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type AnyRow = Record<string, any>;

// The Fillout "Screening Questions" form, as fields the host fills in during the call.
export interface ScreeningAnswers {
   fullName?: string;
   role?: string;
   facebookUrl?: string;
   tiktokUrl?: string;
   referral?: string;
   loanUse?: string;
   exchanges?: string[];
   showedCashInOut?: boolean;
   informedTerms?: boolean;
   addedEmma?: boolean;
}

export const EXCHANGES = ['Coins.ph', 'PDAX', 'GCash (GCrypto)', 'Maya', 'Binance', 'Bybit', 'OKX', 'Tokocrypto', 'Other'];

// The two how-to videos the host walks through on the call (the same ones the Fillout form embedded;
// titles checked on YouTube 2026-10-13).
export const CASH_VIDEOS = [
   { label: 'Cash out via Coins.ph', url: 'https://www.youtube.com/watch?v=SMasdjEpDkg' },
   { label: 'Repay your loan in 1 minute (Coins.ph)', url: 'https://www.youtube.com/watch?v=Eu9JzDMOSmw' }
];

export interface CallScreening {
   id: string | null;
   answers: ScreeningAnswers;
   notes: string;
   redFlags: string;
   score: number | null;
   updatedAt: string | null;
   updatedBy: string | null;
}

export interface CallSheetProfile {
   userId: string;
   username: string | null;
   displayName: string | null;
   email: string | null;
   createdAt: string | null;
   profession: string | null;
   incomeType: string | null;
   monthlyIncome: string | null;
   monthlyExpenses: string | null;
   otherIncome: string | null;
   incomeDescription: string | null;
   gapReasons: string[];
   location: string | null;
   facebookVerified: boolean;
   idVerified: boolean;
   liveness: boolean;
   walletAddress: string | null;
   referralCode: string | null;
   loans: Array<{
      trackingId: string;
      amount: number;
      repay: number;
      status: string;
      repayment: string;
      fundedAt: string | null;
      reason: string | null;
   }>;
}

const EMPTY_SCREENING: CallScreening = { id: null, answers: {}, notes: '', redFlags: '', score: null, updatedAt: null, updatedBy: null };

export async function loadCallSheet(
   userId: string,
   callStartsAt: string | null
): Promise<{ profile: CallSheetProfile; screening: CallScreening }> {
   const supabase = getSupabaseBrowserClient();
   let screeningQuery = supabase.from('call_screenings').select('*').eq('user_id', userId);
   screeningQuery = callStartsAt ? screeningQuery.eq('call_starts_at', callStartsAt) : screeningQuery.is('call_starts_at', null);
   const [userRes, loansRes, screeningRes] = await Promise.all([
      supabase
         .from('users')
         .select(
            'id,username,display_name,email,created_at,profession,income_type,monthly_income,monthly_expenses,other_income,income_description,gap_reasons,location,messenger_verified_at,is_didit,is_world_id,liveness_status,wallet_address,redeemed_referral_code_id'
         )
         .eq('id', userId)
         .maybeSingle(),
      supabase
         .from('loans')
         .select('tracking_id,loan_amount,total_repayment_amount,loan_status,repayment_status,funded_at,reason,created_at')
         .eq('borrower_user_id', userId)
         .order('created_at', { ascending: false })
         .limit(10),
      screeningQuery.order('updated_at', { ascending: false }).limit(1).maybeSingle()
   ]);
   if (userRes.error) throw userRes.error;
   const u = (userRes.data ?? {}) as AnyRow;

   let referralCode: string | null = null;
   if (u.redeemed_referral_code_id) {
      const { data } = await supabase.from('referral_codes').select('code').eq('id', u.redeemed_referral_code_id).maybeSingle();
      referralCode = (data as AnyRow | null)?.code ?? null;
   }

   const s = screeningRes.data as AnyRow | null;
   return {
      profile: {
         userId,
         username: u.username ?? null,
         displayName: u.display_name ?? null,
         email: u.email ?? null,
         createdAt: u.created_at ?? null,
         profession: u.profession ?? null,
         incomeType: u.income_type ?? null,
         monthlyIncome: u.monthly_income ?? null,
         monthlyExpenses: u.monthly_expenses ?? null,
         otherIncome: u.other_income ?? null,
         incomeDescription: u.income_description ?? null,
         gapReasons: Array.isArray(u.gap_reasons) ? u.gap_reasons : [],
         location: u.location ?? null,
         facebookVerified: Boolean(u.messenger_verified_at),
         idVerified: u.is_didit === 'ACTIVE' || u.is_world_id === 'ACTIVE',
         liveness: u.liveness_status === 'APPROVED',
         walletAddress: u.wallet_address ?? null,
         referralCode,
         loans: ((loansRes.data ?? []) as AnyRow[]).map((l) => ({
            trackingId: l.tracking_id,
            amount: Number(l.loan_amount ?? 0),
            repay: Number(l.total_repayment_amount ?? 0),
            status: l.loan_status,
            repayment: l.repayment_status,
            fundedAt: l.funded_at,
            reason: l.reason
         }))
      },
      screening: s
         ? {
              id: s.id,
              answers: (s.answers ?? {}) as ScreeningAnswers,
              notes: s.notes ?? '',
              redFlags: s.red_flags ?? '',
              score: s.score ?? null,
              updatedAt: s.updated_at ?? null,
              updatedBy: s.updated_by ?? null
           }
         : EMPTY_SCREENING
   };
}

/** What the sheet starts with when nobody has filled it in yet: what we already know about them. */
export const prefillAnswers = (profile: CallSheetProfile): ScreeningAnswers => ({
   fullName: profile.displayName ?? undefined,
   role: profile.profession ?? undefined,
   referral: profile.referralCode ? `Referral code ${profile.referralCode}` : undefined,
   loanUse: profile.loans.find((l) => l.status === 'Requested')?.reason ?? undefined
});

export async function saveCallScreening(input: {
   id: string | null;
   userId: string;
   callStartsAt: string | null;
   meetingId?: string | null;
   answers: ScreeningAnswers;
   notes: string;
   redFlags: string;
   score: number | null;
}): Promise<{ id: string; updatedAt: string }> {
   const supabase = getSupabaseBrowserClient();
   const { data: auth } = await supabase.auth.getUser();
   const now = new Date().toISOString();
   const row = {
      answers: input.answers,
      notes: input.notes.trim() || null,
      red_flags: input.redFlags.trim() || null,
      score: input.score,
      updated_by: auth.user?.id ?? null,
      updated_at: now
   };
   const request = input.id
      ? supabase.from('call_screenings').update(row).eq('id', input.id).select('id,updated_at').single()
      : supabase
           .from('call_screenings')
           .insert({ ...row, user_id: input.userId, call_starts_at: input.callStartsAt, meeting_id: input.meetingId ?? null })
           .select('id,updated_at')
           .single();
   const { data, error } = await request;
   if (error) throw error;
   return { id: (data as AnyRow).id, updatedAt: (data as AnyRow).updated_at };
}

export interface CallTranscript {
   id: string;
   callStartedAt: string | null;
   transcript: string;
   riskLevel: 'low' | 'medium' | 'high' | null;
   summary: {
      summary?: string;
      loan_use?: string;
      repayment_plan?: string;
      income_and_work?: string;
      consistency_with_bio?: string;
      red_flags?: string[];
      positives?: string[];
      follow_up_questions?: string[];
   } | null;
   summarizedAt: string | null;
   summaryError: string | null;
   formCheck: FormCheck | null;
   formCheckedAt: string | null;
   formCheckError: string | null;
}

/** The borrower's latest recorded call (zoom-webhook saves it with its AI summary), or null. */
export async function loadCallTranscript(userId: string): Promise<CallTranscript | null> {
   const { data, error } = await getSupabaseBrowserClient()
      .from('call_transcripts')
      .select('id,call_started_at,transcript,risk_level,summary,summarized_at,summary_error,form_check,form_checked_at,form_check_error')
      .eq('user_id', userId)
      .order('call_started_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
   if (error || !data) return null;
   const r = data as AnyRow;
   return {
      id: r.id,
      callStartedAt: r.call_started_at,
      transcript: r.transcript ?? '',
      riskLevel: r.risk_level ?? null,
      summary: r.summary ?? null,
      summarizedAt: r.summarized_at ?? null,
      summaryError: r.summary_error ?? null,
      formCheck: r.form_check ?? null,
      formCheckedAt: r.form_checked_at ?? null,
      formCheckError: r.form_check_error ?? null
   };
}

// What they told the Messenger booking bot before the call (booking_bot_answers): each finished set of
// questions, or a "held off" with what they'd answered so far. Questions/answers are in English.
export interface BotAnswers {
   id: string;
   kind: 'answers' | 'held_off';
   items: Array<{ q: string; a: string }>;
   fitVerdict: 'good' | 'talk' | 'review' | null;
   fitReason: string | null;
   checks: string[];
   heldOffQuestion: string | null;
   heldOffValue: string | null;
   lang: string | null;
   holdingAt: string | null;
   createdAt: string;
}

/** Their latest Messenger booking-bot answers, newest first (a few, so a held off before them still shows). */
export async function loadBotAnswers(userId: string): Promise<BotAnswers[]> {
   const { data, error } = await getSupabaseBrowserClient()
      .from('booking_bot_answers')
      .select('id,kind,items,fit_verdict,fit_reason,checks,held_off_question,held_off_value,lang,holding_at,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3);
   if (error || !data) return [];
   return (data as AnyRow[]).map((r) => ({
      id: r.id,
      kind: r.kind,
      items: Array.isArray(r.items) ? r.items : [],
      fitVerdict: r.fit_verdict ?? null,
      fitReason: r.fit_reason ?? null,
      checks: Array.isArray(r.checks) ? r.checks : [],
      heldOffQuestion: r.held_off_question ?? null,
      heldOffValue: r.held_off_value ?? null,
      lang: r.lang ?? null,
      holdingAt: r.holding_at ?? null,
      createdAt: r.created_at
   }));
}
