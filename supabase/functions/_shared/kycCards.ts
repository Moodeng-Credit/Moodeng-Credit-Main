// The KYC admin cards (Telegram KYC group) and their after-states — see adminCards.ts.
//
//   kyc_review  "👀 IN MANUAL REVIEW — check the Didit dashboard" (diditNotifications.notifyAdmins).
//               Decidable in-app: ✅ Approve / ❌ Decline (callback "kv:<a|d>:<user uuid>", then a
//               "kv:<ya|yd>" confirm, "kv:b" goes back) set the verdict through the Didit API; the
//               🔎 Open Didit console link is there to look at the ID first. Didit then fires its
//               webhook like a console verdict, which runs the normal approved / declined flow (the
//               borrower's message included). The verdict stamps the card: ✅ DIDIT APPROVED / …
//   kyc_tries   "Out of KYC tries" (diditNotifications on the 3rd decline, create-didit-session).
//               Decidable in-app: 🔁 Give 3 more tries (callback "kr:<user uuid>") does what
//               /kycretry does, and either stamps the card.
import { type CardLink, type CardStamp, openInAdminButton, personName, stampDecisionCards } from './adminCards.ts';
import { KYC_TRIES } from './preKycGate.ts';
import type { TelegramInlineKeyboard } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// The Didit Business Console. Set DIDIT_CONSOLE_URL to deep-link a session: a "{session}" in it is
// replaced with the session id (the card prints the id either way, to paste into the console search).
export const diditConsoleUrl = (sessionId?: string | null) => {
   const base = Deno.env.get('DIDIT_CONSOLE_URL')?.trim() || 'https://business.didit.me';
   return base.includes('{session}') ? base.replace('{session}', encodeURIComponent(sessionId ?? '')) : base;
};

export const diditConsoleButton = (sessionId?: string | null): CardLink => ({
   text: '🔎 Open Didit console',
   url: diditConsoleUrl(sessionId)
});

// Telegram callback_data for "Give 3 more tries": "kr:<user uuid>" (≤64 bytes).
export const buildKycRetryCallback = (userId: string) => `kr:${userId}`;
export const parseKycRetryCallback = (data?: string | null): { userId: string } | null => {
   const match = (data ?? '').match(/^kr:([0-9a-f-]{36})$/i);
   return match ? { userId: match[1] } : null;
};

// Telegram callback_data for the manual-review card: "kv:<a|d|ya|yd|b>:<user uuid>" (≤64 bytes).
//   a / d    first tap on ✅ Approve / ❌ Decline → swaps in a confirm row (nothing saved yet)
//   ya / yd  ✅ Yes, approve / ❌ Yes, decline → sets the verdict in Didit
//   b        ◀ Back → the Approve / Decline row again
export type KycReviewStep = 'approve' | 'decline' | 'yes_approve' | 'yes_decline' | 'back';
const KYC_REVIEW_CODES: Record<KycReviewStep, string> = {
   approve: 'a',
   decline: 'd',
   yes_approve: 'ya',
   yes_decline: 'yd',
   back: 'b'
};
export const buildKycReviewCallback = (step: KycReviewStep, userId: string) => `kv:${KYC_REVIEW_CODES[step]}:${userId}`;
export const parseKycReviewCallback = (data?: string | null): { step: KycReviewStep; userId: string } | null => {
   const match = (data ?? '').match(/^kv:(a|d|ya|yd|b):([0-9a-f-]{36})$/i);
   if (!match) return null;
   const step = (Object.keys(KYC_REVIEW_CODES) as KycReviewStep[]).find((k) => KYC_REVIEW_CODES[k] === match[1].toLowerCase());
   return step ? { step, userId: match[2] } : null;
};

export const kycReviewDecisionRow = (userId: string) => [
   { text: '✅ Approve', callback_data: buildKycReviewCallback('approve', userId) },
   { text: '❌ Decline', callback_data: buildKycReviewCallback('decline', userId) }
];

export const kycReviewConfirmRows = (userId: string, decision: 'approve' | 'decline') => [
   [
      decision === 'approve'
         ? { text: '✅ Yes, approve their ID', callback_data: buildKycReviewCallback('yes_approve', userId) }
         : { text: '❌ Yes, decline their ID', callback_data: buildKycReviewCallback('yes_decline', userId) }
   ],
   [{ text: '◀ Back', callback_data: buildKycReviewCallback('back', userId) }]
];

export const kycReviewKeyboard = (userId: string, username?: string | null, sessionId?: string | null): TelegramInlineKeyboard => [
   kycReviewDecisionRow(userId),
   [diditConsoleButton(sessionId), openInAdminButton(userId, username)]
];

const DIDIT_API_BASE = () => (Deno.env.get('DIDIT_API_BASE')?.trim() || 'https://verification.didit.me/v3').replace(/\/$/, '');

/**
 * ✅ Yes, approve / ❌ Yes, decline on a manual-review card: set the verdict on the borrower's
 * latest Didit session (PATCH /v3/session/{id}/update-status/). Didit then fires its status webhook,
 * and didit-webhook does the rest exactly as for a console verdict (users row, borrower message,
 * stamping this person's review cards). Only a session still "In Review" is changed here.
 */
export const decideKycReview = async (
   svc: SupabaseClient,
   userId: string,
   decision: 'Approved' | 'Declined',
   by: string
): Promise<{ ok: boolean; summary: string; stamp?: CardStamp }> => {
   const { data: user } = await svc
      .from('users')
      .select('id, username, display_name, didit_session_id, didit_id_status, is_didit')
      .eq('id', userId)
      .maybeSingle();
   if (!user) return { ok: false, summary: `No user found for ${userId}.` };
   const name = personName(user);
   const sessionId = String(user.didit_session_id ?? '').trim();
   if (!sessionId) return { ok: false, summary: `${name} has no Didit session on file.` };
   if (user.is_didit === 'ACTIVE') {
      return {
         ok: false,
         summary: `${name} is already ID-verified.`,
         stamp: { header: `ℹ️ Already approved — ${name} is ID-verified`, by, verb: 'Tapped by' }
      };
   }
   if (!/review/i.test(String(user.didit_id_status ?? ''))) {
      return {
         ok: false,
         summary: `${name}'s ID check isn't in review any more (${user.didit_id_status ?? 'no status'}).`,
         stamp: { header: `ℹ️ Already decided — ${name}'s ID check is ${user.didit_id_status ?? 'closed'}`, by, verb: 'Tapped by' }
      };
   }
   const apiKey = Deno.env.get('DIDIT_API_KEY');
   if (!apiKey) throw new Error('DIDIT_API_KEY not configured');
   const res = await fetch(`${DIDIT_API_BASE()}/session/${encodeURIComponent(sessionId)}/update-status/`, {
      method: 'PATCH',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ new_status: decision, comment: `${decision} from the Telegram review card by ${by}` }),
      signal: AbortSignal.timeout(15_000)
   });
   if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { detail?: string; error?: string; message?: string };
      throw new Error(`Didit said ${res.status}: ${body.detail ?? body.error ?? body.message ?? 'no details'}`);
   }
   const approved = decision === 'Approved';
   return {
      ok: true,
      summary: approved
         ? `✅ Approved ${name}'s ID — they'll get the "you're verified" message in a moment.`
         : `❌ Declined ${name}'s ID — they'll be told to try again (uses one of their tries).`,
      stamp: {
         header: approved ? `✅ APPROVED — ${name} is ID-verified` : `❌ DECLINED — ${name}'s ID check failed`,
         by
      }
   };
};

export const kycTriesKeyboard = (userId: string, username?: string | null, sessionId?: string | null): TelegramInlineKeyboard => [
   [{ text: `🔁 Give ${KYC_TRIES} more tries`, callback_data: buildKycRetryCallback(userId) }],
   [diditConsoleButton(sessionId), openInAdminButton(userId, username)]
];

export type KycVerdict = 'review' | 'approved' | 'declined' | 'duplicate' | 'other';

// notifyAdmins gets a human outcome line ("✅ Approved — user is now verified", "❌ Declined — …",
// "👀 IN MANUAL REVIEW — …", "🚫 Duplicate face — blocked", "⚠️ Abandoned"); classify it.
export const classifyKycOutcome = (outcome: string): KycVerdict =>
   /review/i.test(outcome)
      ? 'review'
      : /approved/i.test(outcome)
        ? 'approved'
        : /declined/i.test(outcome)
          ? 'declined'
          : /duplicate/i.test(outcome)
            ? 'duplicate'
            : 'other';

// The after-state of a "manual review" card once Didit decides.
export const kycVerdictStamp = (outcome: string, name: string): CardStamp | null => {
   const verdict = classifyKycOutcome(outcome);
   if (verdict === 'review') return null;
   const reason = outcome.match(/declined\s*—\s*(.+)$/i)?.[1]?.trim();
   return {
      header:
         verdict === 'approved'
            ? `✅ DIDIT APPROVED — ${name} is ID-verified`
            : verdict === 'declined'
              ? `❌ DIDIT DECLINED — ${name}'s ID check failed`
              : verdict === 'duplicate'
                ? `🚫 DUPLICATE FACE — ${name} is blocked`
                : `⚠️ DIDIT: ${outcome.replace(/^⚠️\s*/, '').toUpperCase()} — ${name} didn't finish the ID check`,
      detail: reason ? `Reason: ${reason}` : null,
      by: 'Didit'
   };
};

/**
 * /kycretry and the 🔁 button: void the borrower's counted declines so they get KYC_TRIES fresh
 * tries, and stamp their "out of tries" cards.
 */
export const resetKycTries = async (
   svc: SupabaseClient,
   userId: string,
   by: string
): Promise<{ ok: boolean; summary: string; stamp?: CardStamp }> => {
   const { data: user } = await svc.from('users').select('id, username, display_name').eq('id', userId).maybeSingle();
   if (!user) return { ok: false, summary: `No user found for ${userId}.` };
   const handle = user.username ? `@${user.username}` : user.id;
   const { data: voided, error } = await svc
      .from('kyc_declines')
      .update({ voided_at: new Date().toISOString(), voided_by: by })
      .eq('user_id', user.id)
      .is('voided_at', null)
      .select('id');
   if (error) throw new Error(error.message);
   if (!voided?.length) {
      return {
         ok: false,
         summary: `${handle} wasn't out of tries — nothing to reset.`,
         stamp: { header: `ℹ️ Already decided — ${handle} has their ${KYC_TRIES} tries`, by, verb: 'Tapped by' }
      };
   }
   const stamp: CardStamp = { header: `🔁 ${KYC_TRIES} MORE TRIES — ${personName(user)} can verify their ID again`, by };
   await stampDecisionCards(svc, 'kyc_tries', user.id, stamp);
   return { ok: true, summary: `✅ ${handle} has ${KYC_TRIES} fresh ID verification tries — by ${by}`, stamp };
};
