// "Your credit limit went up" — the words for the Messenger + WhatsApp note a borrower gets whenever
// users.cs goes up (repayment level-up, the admin ±1 level button, or a hand edit). Sent by
// admin-messenger { action: 'limit_up' }, which the DB trigger private.notify_limit_up calls via pg_net.
// Pure, so it can be tested.

export type LimitUpLang = 'en' | 'fil';

export const limitUpLang = (preferredLocale: string | null | undefined): LimitUpLang =>
   /^(fil|tl)/i.test(preferredLocale ?? '') ? 'fil' : 'en';

export const limitUpFirstName = (u: { display_name?: string | null; facebook_name?: string | null; username?: string | null }) =>
   (u.display_name?.trim() || u.facebook_name?.trim() || u.username?.trim() || 'there').split(/\s+/)[0];

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

/** Messenger free text (only lands inside Meta's 24h window). */
export const limitUpMessengerText = (name: string, from: number, to: number, lang: LimitUpLang) =>
   lang === 'fil'
      ? `🎉 Congrats, ${name}! Tumaas na ang credit limit mo: ${money(to)} na (dati ${money(from)}). Pwede ka nang humiram hanggang ${money(to)}: https://moodeng.app`
      : `🎉 Good news, ${name}! Your credit limit is now ${money(to)} (was ${money(from)}). You can borrow up to ${money(to)}: https://moodeng.app`;

/** {{2}} of the approved WhatsApp template moodeng_follow_up ("Hi {{1}}, … an update on your account: {{2}} …"). */
// No "$" here: Meta template params reject it (#1779), so amounts are written as USDC.
const usdc = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2)} USDC`;
export const limitUpWhatsAppLine = (from: number, to: number, lang: LimitUpLang) =>
   lang === 'fil'
      ? `Tumaas na ang credit limit mo: ${usdc(to)} na (dati ${usdc(from)}). Pwede ka nang humiram hanggang ${usdc(to)} sa moodeng.app`
      : `Your credit limit went up from ${usdc(from)} to ${usdc(to)}. You can now borrow up to ${usdc(to)} at moodeng.app`;
