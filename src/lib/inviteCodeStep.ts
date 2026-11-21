// "Who invited you?" — the first screen of sign-up (/sign-up) and of the pre-screening link (/screen)
// (George 2026-11-21: friends kept signing up without the affiliate's code, so the affiliate never saw
// them). Before there's an account the code is parked here and attached right after sign-up by the
// same code paths a /screen/CODE or /invite/CODE link uses; a signed-in person's code is added at once.
// The Welcome step's code box stays as a second chance.
import { readParkedAffiliateInvite } from '@/lib/affiliateInvite';
import { normalizeInviteCode, readPendingInvite, rememberPendingInvite } from '@/lib/friendReferrals';
import { isPersonalInviteCode, parkTeamCode, readParkedTeamCode } from '@/lib/preScreening';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/** When they answered the screen (a code or "No one invited me"), so it isn't asked again. */
export const CODE_STEP_KEY = 'md_code_step';
const ASK_AGAIN_AFTER_MS = 7 * 86_400_000;

export type InviteSuggestion = { code: string; inviter: string | null };

export const cleanInviteInput = (raw: string) =>
   raw
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 24);

/** The one code their typing points to (server: suggest_invite_code). Never throws — no suggestion instead. */
export async function suggestInviteCode(raw: string): Promise<InviteSuggestion | null> {
   const text = cleanInviteInput(raw);
   if (text.length < 2) return null;
   try {
      const { data, error } = await getSupabaseBrowserClient().rpc('suggest_invite_code', { p_text: text });
      if (error || !Array.isArray(data) || !data[0]) return null;
      const row = data[0] as { code?: unknown; inviter?: unknown };
      if (typeof row.code !== 'string' || !row.code) return null;
      return { code: row.code.toUpperCase(), inviter: typeof row.inviter === 'string' && row.inviter ? row.inviter : null };
   } catch {
      return null;
   }
}

/** Before sign-up: a personal code waits like an /invite/CODE link, a team code like /screen/CODE. */
export function parkInviteCode(code: string): void {
   const clean = normalizeInviteCode(code);
   if (isPersonalInviteCode(clean)) rememberPendingInvite(clean);
   else parkTeamCode(clean);
   markCodeStepDone();
}

export function markCodeStepDone(): void {
   try {
      window.localStorage.setItem(CODE_STEP_KEY, String(Date.now()));
   } catch {
      // Storage blocked: they may see the screen once more.
   }
}

export const codeStepDone = (now = Date.now()) => {
   try {
      const at = Number(window.localStorage.getItem(CODE_STEP_KEY));
      return Number.isFinite(at) && at > 0 && now - at < ASK_AGAIN_AFTER_MS;
   } catch {
      return false;
   }
};

/** Signed in: only a borrower whose account is days old and has no code yet. */
export const shouldAskInviteCodeSignedIn = (user: { userRole?: string | null; hasReferral?: boolean; createdAt?: string } | null) => {
   if (!user || user.userRole === 'lender' || user.userRole === 'affiliate' || user.hasReferral || codeStepDone()) return false;
   const created = user.createdAt ? Date.parse(user.createdAt) : Number.NaN;
   return Number.isFinite(created) && Date.now() - created < 3 * 86_400_000;
};

/** Signed out: ask unless they already answered, or a link already brought a code (or an affiliate invite). */
export const shouldAskInviteCodeSignedOut = () =>
   !codeStepDone() && !readParkedTeamCode() && !readPendingInvite() && !readParkedAffiliateInvite();
