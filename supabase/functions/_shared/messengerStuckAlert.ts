import { postDiscord } from './discord.ts';
import type { TelegramInlineKeyboard } from './telegram.ts';

// When a borrower's Facebook (Messenger) confirmation stalls:
//   * the messenger-stuck-alerts cron emails the borrower a fresh way through (link + code) and posts
//     a card to the KYC Telegram group (with a "Mark Facebook verified" button) and Discord #kyc;
//   * sendpulse-events posts an "Is this them?" card when a Facebook chat arrives without a code but
//     with a name close to a borrower who just tapped Verify.
//
// Why: Meta doesn't guarantee the m.me ref reaches the bot (first-time "Get Started", some Android
// Messenger versions, Facebook Lite, no Messenger app). The borrower is stuck on the contact step
// and nobody knows unless they happen to open the Page inbox — Aya on 2026-09-29, Merry the same
// morning, joanni on 09-28, Brian on 09-26.

// How long a code may sit unconfirmed before we call the borrower stuck. The bot normally
// confirms within seconds, and the app offers the typed-code backup as soon as they come back.
export const STUCK_AFTER_MS = 10 * 60 * 1000;
// Don't dig up old attempts (e.g. the first run after deploy, or after the cron was down).
export const LOOKBACK_MS = 2 * 60 * 60 * 1000;
// One ping (and one email) per borrower per day, however many times they retry.
export const REALERT_AFTER_MS = 24 * 60 * 60 * 1000;
// The emailed link and code stay valid this long — people read email hours later.
export const EMAILED_CODE_TTL_MS = 24 * 60 * 60 * 1000;

export type StuckBorrower = {
   id: string;
   username: string | null;
   display_name: string | null;
   email: string | null;
   user_role: string | null;
   account_status?: string | null;
   messenger_verified_at: string | null;
   messenger_stuck_alerted_at: string | null;
};

export type StuckCode = { code: string; user_id: string; created_at: string; suggested_contact_name?: string | null };

export type EmailOutcome = 'sent' | 'failed' | 'no_email';

// Lenders are skipped like in sendpulse-messenger-verify (explicit 'lender' only — some real
// borrowers still have a NULL role). Banned/blocked accounts can't borrow, so no point chasing them.
export const shouldAlertStuck = (borrower: StuckBorrower, now = Date.now()) => {
   if (borrower.messenger_verified_at || borrower.user_role === 'lender') return false;
   if (borrower.account_status && borrower.account_status !== 'active') return false;
   const last = borrower.messenger_stuck_alerted_at ? Date.parse(borrower.messenger_stuck_alerted_at) : Number.NaN;
   return Number.isNaN(last) || now - last >= REALERT_AFTER_MS;
};

export const isEmailable = (email: string | null | undefined): email is string => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email?.trim() ?? '');

const borrowerName = (b: Pick<StuckBorrower, 'username' | 'display_name'>) => b.display_name?.trim() || b.username || 'A borrower';

const EMAIL_LINE: Record<EmailOutcome, string> = {
   sent: '📧 We emailed them a link and the code (both work for 24 h).',
   failed: "📧 Emailing them failed — they haven't heard from us.",
   no_email: "📧 No email on file — they haven't heard from us."
};

export const buildMessengerStuckAlert = (borrower: StuckBorrower, code: StuckCode, now = Date.now(), email: EmailOutcome = 'no_email') => {
   const who = [borrower.username ? `@${borrower.username}` : null, borrower.email].filter(Boolean).join(' · ');
   const minutes = Math.max(1, Math.round((now - Date.parse(code.created_at)) / 60_000));
   return [
      `📵 Facebook not confirmed — ${borrowerName(borrower)}`,
      who || null,
      `Tapped "Verify via Messenger" ${minutes} min ago (code ${code.code}), and our bot never heard from them.`,
      code.suggested_contact_name ? `🤔 Possible match: "${code.suggested_contact_name}" messaged the Page without a code.` : null,
      EMAIL_LINE[email],
      'If they stay stuck, find them in the Page inbox. Once you have them, tap ✅ Mark Facebook verified.'
   ]
      .filter(Boolean)
      .join('\n');
};

// sendpulse-events: a Facebook chat arrived without a code, and its name is close to this borrower's.
export const buildMatchSuggestionCard = (
   borrower: Pick<StuckBorrower, 'username' | 'display_name' | 'email'>,
   knownNames: string[],
   facebookName: string,
   code: StuckCode,
   now = Date.now()
) => {
   const who = [borrower.username ? `@${borrower.username}` : null, borrower.email].filter(Boolean).join(' · ');
   const minutes = Math.max(0, Math.round((now - Date.parse(code.created_at)) / 60_000));
   return [
      `🤔 Is this them? "${facebookName}" just messaged the Page without a code.`,
      `${borrowerName(borrower)}${who ? ` (${who})` : ''} tapped "Verify via Messenger" ${minutes} min ago (code ${code.code}).`,
      knownNames.length ? `Names we have for them: ${knownNames.join(' · ')}` : null,
      'If it is, tap ✅ — we also save that Facebook chat so reminders reach them.'
   ]
      .filter(Boolean)
      .join('\n');
};

const escapeHtml = (s: string) =>
   s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// The automatic email to a stuck borrower — the same help an admin would write, without an admin.
export const buildStuckEmail = (
   borrower: Pick<StuckBorrower, 'display_name'>,
   code: string,
   links: { messenger: string; apply: string; page: string }
) => {
   const first = borrower.display_name?.trim().split(/\s+/)[0] || 'there';
   const subject = 'Finish connecting your Facebook to Moodeng';
   // Code first: it works on every phone. The m.me one-tap link never opens Messenger from Android
   // Chrome (2026-10-10 tests), and most stuck borrowers are on Android, so it's only an extra.
   const text = [
      `Hi ${first},`,
      '',
      "Your Facebook isn't connected to Moodeng yet. Two quick steps:",
      '',
      `1. Open Messenger or Facebook, search for Moodeng Credit and open our chat: ${links.page}`,
      `2. Send us this code: ${code}`,
      '   We confirm you automatically. If the chat shows "Get Started", tap it first.',
      '',
      `On an iPhone or a computer you can also just open this link: ${links.messenger}`,
      '',
      `Then continue your loan application: ${links.apply}`,
      '',
      'The code works for 24 hours. Stuck? Just reply to this email and we will help.',
      '',
      'The Moodeng Credit team'
   ].join('\n');
   const button = (href: string, label: string) =>
      `<a href="${escapeHtml(href)}" style="display:inline-block;background:#6b55f7;color:#fff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px">${label}</a>`;
   const html = `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#2d2340;max-width:520px">
<p>Hi ${escapeHtml(first)},</p>
<p>Your Facebook isn't connected to Moodeng yet. Two quick steps:</p>
<p><b>1.</b> Open Messenger or Facebook, search for <b>Moodeng Credit</b> and open our chat.</p>
<p>${button(links.page, 'Open Moodeng Credit')}</p>
<p><b>2.</b> Send us this code. We confirm you automatically. If the chat shows <b>Get Started</b>, tap it first.</p>
<p style="font-size:22px;font-weight:bold;letter-spacing:2px">${escapeHtml(code)}</p>
<p style="color:#6b5b86">On an iPhone or a computer you can also just <a href="${escapeHtml(links.messenger)}">tap here</a> instead.</p>
<p>Then continue your loan application:</p>
<p>${button(links.apply, 'Continue my application')}</p>
<p style="color:#6b5b86">The code works for 24 hours. Stuck? Just reply to this email and we will help.</p>
<p>The Moodeng Credit team</p>
</div>`;
   return { subject, text, html };
};

// Telegram callback_data for the card button: "mv:<user uuid>" (≤64 bytes).
export const buildMessengerVerifyCallback = (userId: string) => `mv:${userId}`;

export const parseMessengerVerifyCallback = (data?: string | null): { userId: string } | null => {
   const match = (data ?? '').match(/^mv:([0-9a-f-]{36})$/i);
   return match ? { userId: match[1] } : null;
};

export const messengerStuckKeyboard = (
   userId: string,
   pageInboxUrl: string,
   label = '✅ Mark Facebook verified'
): TelegramInlineKeyboard => [
   [{ text: label, callback_data: buildMessengerVerifyCallback(userId) }],
   [{ text: '💬 Open Page inbox', url: pageInboxUrl }]
];

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

/**
 * The button's action: stamp the borrower's Messenger line as verified, like /confirm does. If
 * sendpulse-events saw a likely Facebook chat for them ("Is this them?"), that chat's SendPulse contact
 * id is saved too, so reminders can reach them. Their open code is left alone on purpose — if the
 * bot does get through before it expires, sendpulse-messenger-verify still stores the contact id.
 */
export const markMessengerVerified = async (supabase: SupabaseClient, userId: string, admin: string) => {
   const { data: openCode } = await supabase
      .from('contact_verification_codes')
      .select('suggested_contact_id, suggested_contact_name')
      .eq('user_id', userId)
      .eq('channel', 'messenger')
      .is('verified_at', null)
      .maybeSingle();
   const contactId = (openCode as { suggested_contact_id?: string | null } | null)?.suggested_contact_id ?? null;

   const { data: updated, error } = await supabase
      .from('users')
      .update({ messenger_verified_at: new Date().toISOString(), ...(contactId ? { messenger_psid: contactId } : {}) })
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

   const matched = (openCode as { suggested_contact_name?: string | null } | null)?.suggested_contact_name;
   const summary = `✅ Facebook marked verified for ${borrowerName(updated)}${matched ? ` (Facebook: ${matched})` : ''} — by ${admin}`;
   await postDiscord({ content: summary }, { prefer: ['DISCORD_KYC_WEBHOOK_URL'] });
   return { ok: true, summary };
};
