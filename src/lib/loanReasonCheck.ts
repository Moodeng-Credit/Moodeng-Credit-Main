import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Single door to the DeepSeek effort check (`check-loan-input`) for the loan reason.
 *
 * Two callers ask the same question about the same text: the reason field asks while the
 * borrower types (so the "Looks good" tick means something), and the submit handler asks
 * again as the enforcement gate. Without a shared cache that's two DeepSeek calls and — worse
 * — two chances to disagree, so the field could tick a reason that submit then rejects.
 *
 * Verdicts are memoized per normalized text for the life of the tab, and concurrent asks for
 * the same text share one in-flight request.
 */

/** Verdict categories from check-loan-input (see supabase/functions/check-loan-input/loan-reason-guide.md). */
export type ReasonCategory = 'good' | 'tip' | 'vague' | 'placeholder' | 'not_english' | 'not_allowed';

export type ReasonVerdict = {
   /** False only when DeepSeek actually judged the text weak. Unreachable ⇒ true. */
   ok: boolean;
   /** One friendly line: why it was flagged, or a tip when it passed as "tip". */
   hint: string;
   /** Empty when the check couldn't run or an older function version answered. */
   category: ReasonCategory | '';
   /** A full English reason built from theirs (the translation for not_english). May be empty. */
   suggestion: string;
   /** False when the check couldn't run (offline, timeout, bad response) — we failed open. */
   checked: boolean;
   /** True when the slower "second opinion" reviewer judged it (see `escalate`). */
   escalated?: boolean;
};

/** An earlier attempt that was flagged, sent to the second-opinion reviewer as context. */
export type ReasonAttempt = { text: string; hint: string };

/** App language the borrower picked; the check writes its hint in it (the suggestion stays English for lenders). */
export type ReasonCheckLocale = 'en' | 'fil' | 'id' | 'th' | 'vi';

const normalizeKey = (text: string, locale: ReasonCheckLocale = 'en') => `${locale}|${text.trim().replace(/\s+/g, ' ').toLowerCase()}`;

const verdicts = new Map<string, ReasonVerdict>();
const inFlight = new Map<string, Promise<ReasonVerdict>>();

/** Verdict already known for this text, without asking. */
export const getCachedReasonVerdict = (text: string, locale: ReasonCheckLocale = 'en'): ReasonVerdict | undefined =>
   verdicts.get(normalizeKey(text, locale));

/**
 * Ask the effort check about a reason. Never throws and never blocks the borrower: an
 * unreachable check returns `{ ok: true, checked: false }` so the request still goes through
 * — callers use `checked` to decide whether they're allowed to *praise* the text.
 */
export const checkLoanReason = async (
   text: string,
   locale: ReasonCheckLocale = 'en',
   /**
    * Second opinion for a borrower who is stuck (flagged repeatedly, or stopped on submit again and
    * again): a slower reasoning model sees their earlier attempts, lets the reason through if it
    * actually says what the money is for, and otherwise explains exactly what's missing.
    */
   escalation?: { history: ReasonAttempt[] }
): Promise<ReasonVerdict> => {
   const key = normalizeKey(text, locale);
   const cached = verdicts.get(key);
   // A quick verdict doesn't answer a request for a second opinion; an escalated one answers both.
   if (cached && (!escalation || cached.escalated)) return cached;

   const flightKey = escalation ? `${key}|second-opinion` : key;
   const pending = inFlight.get(flightKey);
   if (pending) return pending;

   const request = (async (): Promise<ReasonVerdict> => {
      try {
         const { data, error } = await getSupabaseBrowserClient().functions.invoke('check-loan-input', {
            body: escalation
               ? { text: text.trim(), kind: 'reason', locale, escalate: true, history: escalation.history.slice(-5) }
               : { text: text.trim(), kind: 'reason', locale }
         });
         if (error || typeof data?.ok !== 'boolean') {
            // Fail open, but don't remember it — a network blip shouldn't pin a verdict for
            // the rest of the session.
            return { ok: true, hint: '', category: '', suggestion: '', checked: false };
         }
         const verdict: ReasonVerdict = {
            ok: data.ok,
            hint: data.hint ?? '',
            category: (data.category as ReasonCategory | undefined) ?? '',
            suggestion: data.suggestion ?? '',
            checked: true,
            ...(data.escalated === true ? { escalated: true } : {})
         };
         verdicts.set(key, verdict);
         return verdict;
      } catch (error) {
         console.error('check-loan-input (reason) failed, allowing:', error);
         return { ok: true, hint: '', category: '', suggestion: '', checked: false };
      } finally {
         inFlight.delete(flightKey);
      }
   })();

   inFlight.set(flightKey, request);
   return request;
};

/** Test seam — drops every remembered verdict. */
export const resetLoanReasonVerdicts = () => {
   verdicts.clear();
   inFlight.clear();
};
