// Wording + rules for "reminders couldn't turn on" (reminders-stuck edge function).
//
// The onboarding Facebook step asks borrowers to turn on push reminders. When a phone can't (the
// browser blocks notifications, Chrome fails to subscribe, or they're inside Facebook's own browser,
// which has no push at all), the app now lets them continue — and the bot tells them on Messenger
// how to fix it in Chrome/Safari, while the team gets a heads-up. A borrower on 2026-10-15 tapped
// "Turn on reminders" 22 times and gave up; nobody knew until she messaged the Page.
//
// Kept free of Deno/Supabase imports so the app's test runner can cover it too.

export type RemindersStuckReason = 'failed' | 'blocked' | 'in_app';
export type RemindersStuckOs = 'android' | 'ios' | 'other';

export const REMINDERS_STUCK_REASONS: readonly RemindersStuckReason[] = ['failed', 'blocked', 'in_app'];

// One Messenger note + one team alert per borrower per day, however many times the screen reports it.
export const REMINDERS_REALERT_AFTER_MS = 24 * 60 * 60 * 1000;

const firstName = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || '';

const browserFor = (os: RemindersStuckOs) => (os === 'ios' ? 'Safari' : 'Chrome');

/** The borrower's Messenger note: what happened and how to fix it in Chrome/Safari. Taglish, like the Page's replies. */
export const buildRemindersStuckMessage = (reason: RemindersStuckReason, os: RemindersStuckOs, name?: string | null) => {
   const hi = firstName(name) ? `Hi ${firstName(name)}!` : 'Hi!';
   const browser = browserFor(os);
   const steps =
      reason === 'blocked'
         ? [
              `1. Buksan ang moodeng.app sa ${browser}`,
              os === 'ios'
                 ? '2. Settings → Notifications → hanapin ang Moodeng → i-on ang Allow Notifications'
                 : '2. I-tap ang 🔒 sa tabi ng address → Permissions → Notifications → Allow',
              '3. Bumalik sa Moodeng at i-tap ang "Turn on reminders"'
           ]
         : [
              `1. Buksan ang moodeng.app sa ${browser} app${reason === 'in_app' ? ' (hindi sa loob ng Facebook)' : ''}`,
              '2. Mag-sign in gamit ang email mo',
              '3. I-tap ang "Turn on reminders" at Allow'
           ];
   const why =
      reason === 'blocked'
         ? 'Nakita naming naka-block ang notifications ng Moodeng sa browser mo, kaya hindi ka namin ma-remind sa phone.'
         : reason === 'in_app'
           ? 'Binuksan mo ang Moodeng sa loob ng Facebook, at hindi gumagana doon ang reminders.'
           : 'Nakita naming hindi gumana ang reminders sa phone mo.';
   return [
      `${hi} ${why}`,
      '',
      'Para hindi mo ma-miss ang video call at due date mo:',
      ...steps,
      '',
      'Kung ayaw pa rin, okay lang po — dito ka namin ire-remind sa Messenger. Mag-message lang kung may tanong. 🦛'
   ].join('\n');
};

const REASON_LABEL: Record<RemindersStuckReason, string> = {
   failed: 'their phone could not turn them on (allowed, but setup failed)',
   blocked: 'notifications are blocked in their browser',
   in_app: "they're inside Facebook's browser, which has no reminders"
};

export type MessengerOutcome = 'sent' | 'not_connected' | 'window_closed' | 'failed';

const MESSENGER_LINE: Record<MessengerOutcome, string> = {
   sent: '💬 Bot sent them the Chrome/Safari steps on Messenger.',
   not_connected: "💬 Not messaged: Facebook isn't connected yet.",
   window_closed: "💬 Not messaged: outside Messenger's 24h window. Reach them from the Page inbox.",
   failed: '💬 Messenger send failed. Reach them from the Page inbox.'
};

/** The team's heads-up (KYC Telegram group + Discord). */
export const buildRemindersStuckAlert = (
   borrower: { display_name: string | null; username: string | null; email: string | null },
   reason: RemindersStuckReason,
   os: RemindersStuckOs,
   messenger: MessengerOutcome,
   failures?: number
) => {
   const who = borrower.display_name?.trim() || borrower.username || 'A borrower';
   const handle = [borrower.username ? `@${borrower.username}` : null, borrower.email].filter(Boolean).join(' · ');
   const phone = os === 'ios' ? 'iPhone' : os === 'android' ? 'Android' : 'computer';
   const tries = reason === 'failed' && failures ? ` — tapped ${failures}×` : '';
   return [
      `🔕 Reminders didn't turn on — ${who}`,
      handle,
      `Why: ${REASON_LABEL[reason]}${tries} (${phone})`,
      MESSENGER_LINE[messenger],
      'They can still continue and book their call.'
   ]
      .filter(Boolean)
      .join('\n');
};
