import { postDiscord } from './discord.ts';
import type { TelegramInlineKeyboard } from './telegram.ts';

// The team ping when a borrower's Facebook (Messenger) confirmation stalls — posted by the
// messenger-stuck-alerts cron to the KYC Telegram group (with a "Mark Facebook verified" button)
// and Discord #kyc.
//
// Why it exists: some phones never pass the m.me link on to the SendPulse bot (Facebook Lite,
// Messenger Lite, no Messenger app, or a first-time "Get Started" that arrives without the code).
// The borrower is stuck on the contact step and nobody knows unless they happen to open the Page
// inbox — Aya on 2026-09-29, Merry the same morning, joanni on 09-28, Brian on 09-26.

// How long a code may sit unconfirmed before we call the borrower stuck. The bot normally
// confirms within seconds, and the app offers the typed-code backup after a minute.
export const STUCK_AFTER_MS = 10 * 60 * 1000;
// Don't dig up old attempts (e.g. the first run after deploy, or after the cron was down).
export const LOOKBACK_MS = 2 * 60 * 60 * 1000;
// One ping per borrower per day, however many times they retry.
export const REALERT_AFTER_MS = 24 * 60 * 60 * 1000;

export type StuckBorrower = {
   id: string;
   username: string | null;
   display_name: string | null;
   email: string | null;
   user_role: string | null;
   messenger_verified_at: string | null;
   messenger_stuck_alerted_at: string | null;
};

export type StuckCode = { code: string; user_id: string; created_at: string };

// Lenders are skipped like in sendpulse-messenger-verify (explicit 'lender' only — some real
// borrowers still have a NULL role).
export const shouldAlertStuck = (borrower: StuckBorrower, now = Date.now()) => {
   if (borrower.messenger_verified_at || borrower.user_role === 'lender') return false;
   const last = borrower.messenger_stuck_alerted_at ? Date.parse(borrower.messenger_stuck_alerted_at) : Number.NaN;
   return Number.isNaN(last) || now - last >= REALERT_AFTER_MS;
};

const borrowerName = (b: Pick<StuckBorrower, 'username' | 'display_name'>) => b.display_name?.trim() || b.username || 'A borrower';

export const buildMessengerStuckAlert = (borrower: StuckBorrower, code: StuckCode, now = Date.now()) => {
   const who = [borrower.username ? `@${borrower.username}` : null, borrower.email].filter(Boolean).join(' · ');
   const minutes = Math.max(1, Math.round((now - Date.parse(code.created_at)) / 60_000));
   return [
      `📵 Facebook not confirmed — ${borrowerName(borrower)}`,
      who || null,
      `Tapped "Verify via Messenger" ${minutes} min ago (code ${code.code}), and our bot never heard from them.`,
      'Look for them in the Page inbox or email them. Once you have them, tap ✅ Mark Facebook verified.'
   ]
      .filter(Boolean)
      .join('\n');
};

// Telegram callback_data for the card button: "mv:<user uuid>" (≤64 bytes).
export const buildMessengerVerifyCallback = (userId: string) => `mv:${userId}`;

export const parseMessengerVerifyCallback = (data?: string | null): { userId: string } | null => {
   const match = (data ?? '').match(/^mv:([0-9a-f-]{36})$/i);
   return match ? { userId: match[1] } : null;
};

export const messengerStuckKeyboard = (userId: string, pageInboxUrl: string): TelegramInlineKeyboard => [
   [{ text: '✅ Mark Facebook verified', callback_data: buildMessengerVerifyCallback(userId) }],
   [{ text: '💬 Open Page inbox', url: pageInboxUrl }]
];

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

/**
 * The button's action: stamp the borrower's Messenger line as verified, like /confirm does. Their
 * open code is left alone on purpose — if the bot does get through before it expires,
 * sendpulse-messenger-verify still stores their SendPulse contact id, which Messenger reminders need.
 */
export const markMessengerVerified = async (supabase: SupabaseClient, userId: string, admin: string) => {
   const { data: updated, error } = await supabase
      .from('users')
      .update({ messenger_verified_at: new Date().toISOString() })
      .eq('id', userId)
      .is('messenger_verified_at', null)
      .select('username, display_name')
      .maybeSingle();
   if (error) return { ok: false, summary: `Couldn't update: ${error.message}` };

   if (!updated) {
      const { data: existing } = await supabase.from('users').select('username, display_name').eq('id', userId).maybeSingle();
      if (!existing) return { ok: false, summary: 'Borrower not found.' };
      return { ok: true, summary: `Facebook already verified for ${borrowerName(existing)}. Nothing to do.` };
   }

   const summary = `✅ Facebook marked verified for ${borrowerName(updated)} — by ${admin}`;
   await postDiscord({ content: summary }, { prefer: ['DISCORD_KYC_WEBHOOK_URL'] });
   return { ok: true, summary };
};
