// Pre-screening (moodeng.app/screen): remembers on this browser that the person did it, and ties the
// result to their account the first time they're signed in (claim_pre_screening). Best-effort: storage
// or network failures never block anything.
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const KEY = 'md_prescreen';
const CLAIMED_KEY = 'md_prescreen_claimed';

type Saved = { token: string; done: boolean };

export const readPreScreening = (): Saved | null => {
   try {
      const saved = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Saved | null;
      return saved && typeof saved.token === 'string' ? saved : null;
   } catch {
      return null;
   }
};

export const savePreScreening = (token: string, done: boolean) => {
   try {
      window.localStorage.setItem(KEY, JSON.stringify({ token, done }));
   } catch {
      // Storage blocked: the result just won't be tied to their account.
   }
};

/**
 * Call once on page load. The pre-screening's "Sign up" button carries ?ps=<token>, so the result
 * still reaches the account when the sign-up happens in another browser than the one that recorded
 * (a link copied out of Facebook's or Messenger's browser).
 */
export const capturePreScreeningToken = () => {
   try {
      const token = new URLSearchParams(window.location.search).get('ps');
      if (token && /^[0-9a-f]{32}$/.test(token) && readPreScreening()?.token !== token) savePreScreening(token, true);
   } catch {
      // Storage blocked: skip.
   }
};

/** Once per signed-in account on this browser. */
export const claimPreScreening = (userId: string) => {
   try {
      const saved = readPreScreening();
      if (!saved?.done || window.localStorage.getItem(CLAIMED_KEY) === userId) return;
      void getSupabaseBrowserClient()
         .rpc('claim_pre_screening', { p_token: saved.token })
         .then(({ error }) => {
            if (error) console.warn('claim_pre_screening failed', error.message);
            else window.localStorage.setItem(CLAIMED_KEY, userId);
         });
   } catch {
      // Storage blocked: skip.
   }
};
