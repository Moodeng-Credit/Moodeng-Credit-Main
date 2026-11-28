/**
 * George 2026-11-28: someone who says they URGENTLY need the loan, or types in CAPS, goes with weaker
 * borrowers. Either one = a big cut to the score and held under the auto ✅ line (flag only, never auto ❌).
 */

/** Points off the 0-100 score for urgency or CAPS (counted once, not per answer). */
export const URGENCY_CUT = 30;
/** Highest score an urgent / CAPS pre-screening can get (under 50 = no auto ✅; the team decides). */
export const URGENCY_CAP = 49;

// "emergency fund / savings" is a backup plan, not urgency.
const URGENT_PATTERNS: RegExp[] = [
   /\burgent(ly)?\b/i,
   /\bemergenc(y|ies)\b(?!\s+(fund|funds|savings?|money\s+saved))/i,
   /\ba\.?s\.?a\.?p\b/i,
   /\bas soon as possible\b/i,
   /\bneed (it|this|the money|the loan|money|a loan|cash)\s+(now|today|tonight|badly|fast|quickly|right away|immediately|asap)\b/i,
   /\b(badly|desperately) need\b/i,
   /\bdesperate(ly)?\b/i,
   /\b(please|pls|plz)\s+help\b/i,
   /\bkailangan\b[^.!?]{0,20}\b(agad|kaagad|ngayon na|ngayong araw)\b/i,
   /\b(agad-agad|agaran|madalian|apurahan|apura|ngayon na)\b/i
];

/** The urgent phrase found in this text, or null. Pure. */
export const urgentPhrase = (text: string | null | undefined): string | null => {
   if (!text) return null;
   for (const re of URGENT_PATTERNS) {
      const m = text.match(re);
      if (m) return m[0];
   }
   return null;
};

/**
 * Typed in CAPS: at least 10 letters and 70%+ of them capitals. Short answers ("BPO", "TASKUS") and
 * a capital at the start of words don't count. Only for typed text (transcripts are written by the AI). Pure.
 */
export const shouting = (text: string | null | undefined): boolean => {
   const letters = (text ?? '').match(/\p{L}/gu) ?? [];
   if (letters.length < 10) return false;
   const upper = letters.filter((c) => c !== c.toLowerCase() && c === c.toUpperCase()).length;
   return upper / letters.length >= 0.7;
};

export type UrgencyAnswer = { spoken?: string | null; typed?: Array<string | null | undefined> };

/** What was found across the answers, or null when nothing. Pure. */
export const urgencyCheck = (answers: UrgencyAnswer[]): { urgent: string | null; caps: boolean; reasons: string[] } | null => {
   let urgent: string | null = null;
   let caps = false;
   for (const a of answers) {
      const typed = (a.typed ?? []).filter((t): t is string => !!t?.trim());
      urgent ??= urgentPhrase(a.spoken) ?? typed.map(urgentPhrase).find((p) => p) ?? null;
      caps ||= typed.some(shouting);
   }
   if (!urgent && !caps) return null;
   return {
      urgent,
      caps,
      reasons: [...(urgent ? [`says it’s urgent (“${urgent.slice(0, 40)}”)`] : []), ...(caps ? ['typed in CAPS'] : [])]
   };
};

/** The score after the urgency cut and cap (unchanged when nothing was found). Pure. */
export const applyUrgency = (score: number | null, found: ReturnType<typeof urgencyCheck>): number | null =>
   score == null || !found ? score : Math.min(Math.max(0, score - URGENCY_CUT), URGENCY_CAP);
