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

/**
 * Once per signed-in account on this browser (again once they finish one they had only started).
 * An unfinished one is tied too, so the team sees "started the pre-screening, didn't finish".
 */
export const claimPreScreening = (userId: string) => {
   try {
      const saved = readPreScreening();
      const claimedAs = `${userId}:${saved?.done ? 'done' : 'open'}`;
      if (!saved || window.localStorage.getItem(CLAIMED_KEY) === claimedAs) return;
      void getSupabaseBrowserClient()
         .rpc('claim_pre_screening', { p_token: saved.token })
         .then(({ error }) => {
            if (error) console.warn('claim_pre_screening failed', error.message);
            else window.localStorage.setItem(CLAIMED_KEY, claimedAs);
         });
   } catch {
      // Storage blocked: skip.
   }
};

// Pre-screening after sign-up (migration 20261118090000): opening an affiliate's /screen link marks this
// browser; the first signed-in visit joins the account to the path (join_prescreen_path), so its
// onboarding goes Facebook → pre-screening → team ✅ → wallet. The flag also rides on the sign-up link
// (?prescreen=1), for a sign-up that finishes in another browser.
const PATH_KEY = 'md_prescreen_path';

export const markPrescreenPath = () => {
   try {
      window.localStorage.setItem(PATH_KEY, String(Date.now()));
   } catch {
      // Storage blocked: the ?prescreen=1 on the sign-up link still carries it.
   }
};

export const hasPrescreenPathFlag = () => {
   try {
      if (new URLSearchParams(window.location.search).get('prescreen') === '1') return true;
      const at = Number(window.localStorage.getItem(PATH_KEY));
      return Number.isFinite(at) && at > 0 && Date.now() - at < 7 * 86_400_000;
   } catch {
      return false;
   }
};

/** Call once on page load: keeps ?prescreen=1 from the sign-up link. */
export const capturePrescreenPathFlag = () => {
   try {
      if (new URLSearchParams(window.location.search).get('prescreen') === '1') markPrescreenPath();
   } catch {
      // skip
   }
};

/** After sign-in on a flagged browser: put the account on the path (server decides if it may). */
export const joinPrescreenPath = async (): Promise<boolean> => {
   if (!hasPrescreenPathFlag()) return false;
   const { data, error } = await getSupabaseBrowserClient().rpc('join_prescreen_path');
   if (error) return false;
   try {
      window.localStorage.removeItem(PATH_KEY);
   } catch {
      // skip
   }
   return data === true;
};

// Team codes on the pre-screening link (moodeng.app/screen/MAHJID, /screen/irish — George 2026-11-18).
// A personal invite code (6 letters + 5 digits) goes through /invite/CODE as before. Anything else is a
// team code (referral_codes): parked here when the link opens, then attached to the new account right
// after sign-up with redeem_referral_code — the same thing as typing it in the loan form's code box.
export const TEAM_CODE_STORAGE_KEY = 'md_team_code';
const TEAM_KEY = TEAM_CODE_STORAGE_KEY;
const PERSONAL_CODE = /^[A-Z]{6}[0-9]{5}$/;

export const isPersonalInviteCode = (code: string) => PERSONAL_CODE.test(code.trim().toUpperCase());

export const parkTeamCode = (code: string) => {
   const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 40);
   if (!clean || isPersonalInviteCode(clean)) return;
   try {
      window.localStorage.setItem(TEAM_KEY, JSON.stringify({ code: clean, at: Date.now() }));
   } catch {
      // Storage blocked: the code just isn't attached.
   }
};

/** The team code waiting to be attached after sign-up (fresh: under 7 days), or null. */
export const readParkedTeamCode = (now = Date.now()): string | null => {
   try {
      const parked = JSON.parse(window.localStorage.getItem(TEAM_KEY) ?? 'null') as { code?: unknown; at?: unknown } | null;
      if (!parked || typeof parked.code !== 'string' || typeof parked.at !== 'number' || now - parked.at > 7 * 86_400_000) return null;
      return parked.code;
   } catch {
      return null;
   }
};

/**
 * After sign-in: attach a parked team code to an account made after the link was opened (never to an
 * older account, and never over a code they already have — the server keeps the first one). Cleared
 * on any definite answer; a network error leaves it for the next page load.
 */
export const redeemParkedTeamCode = async (accountCreatedAt: string | null | undefined) => {
   let parked: { code?: string; at?: number } | null = null;
   try {
      parked = JSON.parse(window.localStorage.getItem(TEAM_KEY) ?? 'null');
   } catch {
      return;
   }
   if (!parked?.code || !parked.at) return;
   const clear = () => {
      try {
         window.localStorage.removeItem(TEAM_KEY);
      } catch {
         // skip
      }
   };
   const created = accountCreatedAt ? Date.parse(accountCreatedAt) : NaN;
   // Made before the link was opened (an old account): not a referral.
   if (!Number.isFinite(created) || created < parked.at - 10 * 60_000 || Date.now() - parked.at > 7 * 86_400_000) return clear();
   const { error } = await getSupabaseBrowserClient().rpc('redeem_referral_code', { code_input: parked.code });
   if (!error || !/network|fetch/i.test(error.message)) clear();
};
