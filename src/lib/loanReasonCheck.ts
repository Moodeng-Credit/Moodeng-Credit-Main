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

export type ReasonVerdict = {
   /** False only when DeepSeek actually judged the text weak. Unreachable ⇒ true. */
   ok: boolean;
   /** DeepSeek's one-line suggestion. Empty when ok, or when it gave none. */
   hint: string;
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
            return { ok: true, hint: '', checked: false };
         }
         const verdict: ReasonVerdict = { ok: data.ok, hint: data.hint ?? '', checked: true };
         verdicts.set(key, verdict);
         return verdict;
      } catch (error) {
         console.error('check-loan-input (reason) failed, allowing:', error);
         return { ok: true, hint: '', checked: false };
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
