// The KYC admin cards (Telegram KYC group) and their after-states — see adminCards.ts.
//
//   kyc_review  "👀 IN MANUAL REVIEW — check the Didit dashboard" (diditNotifications.notifyAdmins).
//               Nothing to decide in-app — the verdict is given in the Didit console — so the card
//               carries a 🔎 Open Didit console link, and the Didit verdict (webhook or pull sync)
//               stamps it: ✅ DIDIT APPROVED / ❌ DIDIT DECLINED / 🚫 DUPLICATE FACE …
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
