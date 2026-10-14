// The call sheet's view of the AI form check (call_transcripts.form_check), re-graded against what the
// host has on the sheet right now. Mirrors the rules in supabase/functions/_shared/callFormCheck.ts: boxes
// and exchanges re-grade on their own; a text answer the host changed after the check reads "stale" until
// Re-check, because only DeepSeek can say whether two wordings mean the same thing.
import type { ScreeningAnswers } from '@/app/admin/callSheetData';

export type CheckVerdict = 'match' | 'differs' | 'ai_only' | 'not_in_call' | 'not_discussed' | 'stale';

export type CheckField =
   | 'fullName'
   | 'role'
   | 'facebookUrl'
   | 'tiktokUrl'
   | 'referral'
   | 'loanUse'
   | 'exchanges'
   | 'showedCashInOut'
   | 'informedTerms'
   | 'addedEmma';

export const TEXT_CHECK_FIELDS = ['fullName', 'role', 'facebookUrl', 'tiktokUrl', 'referral', 'loanUse'] as const;
export const BOX_CHECK_FIELDS = ['showedCashInOut', 'informedTerms', 'addedEmma'] as const;
export const CHECK_FIELDS: CheckField[] = [...TEXT_CHECK_FIELDS, 'exchanges', ...BOX_CHECK_FIELDS];

export interface FieldCheck {
   ai: string | string[] | boolean | null;
   host: string | string[] | boolean | null;
   verdict: Exclude<CheckVerdict, 'stale'>;
   evidence: string;
}

export interface FormCheck {
   fields: Partial<Record<CheckField, FieldCheck>>;
   summary: string;
   mismatches: number;
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function currentVerdict(field: CheckField, check: FieldCheck | undefined, answers: ScreeningAnswers): CheckVerdict {
   if (!check) return 'not_discussed';
   if (field === 'exchanges') {
      const ai = Array.isArray(check.ai) ? check.ai : [];
      const host = answers.exchanges ?? [];
      if (!ai.length) return 'not_discussed';
      if (!host.length) return 'ai_only';
      return ai.every((x) => host.includes(x)) ? 'match' : 'differs';
   }
   if ((BOX_CHECK_FIELDS as readonly string[]).includes(field)) {
      const host = Boolean(answers[field as (typeof BOX_CHECK_FIELDS)[number]]);
      const ai = check.ai === true;
      return host ? (ai ? 'match' : 'not_in_call') : ai ? 'ai_only' : 'not_discussed';
   }
   const host = text(answers[field as (typeof TEXT_CHECK_FIELDS)[number]]);
   const ai = text(check.ai);
   if (!ai) return 'not_discussed';
   if (!host) return 'ai_only';
   return host === text(check.host) ? check.verdict : 'stale';
}

export const isMismatch = (v: CheckVerdict) => v === 'differs' || v === 'not_in_call';

export function tallyCheck(check: FormCheck, answers: ScreeningAnswers) {
   const verdicts = CHECK_FIELDS.map((f) => currentVerdict(f, check.fields[f], answers));
   return {
      match: verdicts.filter((v) => v === 'match').length,
      mismatch: verdicts.filter(isMismatch).length,
      aiOnly: verdicts.filter((v) => v === 'ai_only').length,
      stale: verdicts.filter((v) => v === 'stale').length
   };
}
