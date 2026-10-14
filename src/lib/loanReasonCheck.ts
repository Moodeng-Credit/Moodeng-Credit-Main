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
};

const normalizeKey = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

const verdicts = new Map<string, ReasonVerdict>();
const inFlight = new Map<string, Promise<ReasonVerdict>>();

/** Verdict already known for this text, without asking. */
export const getCachedReasonVerdict = (text: string): ReasonVerdict | undefined => verdicts.get(normalizeKey(text));

/**
 * Ask the effort check about a reason. Never throws and never blocks the borrower: an
 * unreachable check returns `{ ok: true, checked: false }` so the request still goes through
 * — callers use `checked` to decide whether they're allowed to *praise* the text.
 */
export const checkLoanReason = async (text: string): Promise<ReasonVerdict> => {
   const key = normalizeKey(text);
   const cached = verdicts.get(key);
   if (cached) return cached;

   const pending = inFlight.get(key);
   if (pending) return pending;

   const request = (async (): Promise<ReasonVerdict> => {
      try {
         const { data, error } = await getSupabaseBrowserClient().functions.invoke('check-loan-input', {
            body: { text: text.trim(), kind: 'reason' }
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
            checked: true
         };
         verdicts.set(key, verdict);
         return verdict;
      } catch (error) {
         console.error('check-loan-input (reason) failed, allowing:', error);
         return { ok: true, hint: '', category: '', suggestion: '', checked: false };
      } finally {
         inFlight.delete(key);
      }
   })();

   inFlight.set(key, request);
   return request;
};

/** Test seam — drops every remembered verdict. */
export const resetLoanReasonVerdicts = () => {
   verdicts.clear();
   inFlight.clear();
};
