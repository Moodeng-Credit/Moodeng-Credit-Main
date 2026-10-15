// Wording + rules for "reminders couldn't turn on" (served by messenger-stuck-alerts, body `reminders: true`).
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
   if (reason === 'failed') {
      // Notifications were allowed and they were already in Chrome/Safari: the phone itself can't
      // take them (often no Google services). Retry steps would only send them back to a dead end.
      return [
         `${hi} Nakita naming hindi gumagana ang reminders sa phone mo — hindi mo ito kasalanan, at wala ka nang kailangang gawin.`,
         '',
         'Dito na lang namin ipapadala ang reminders mo sa Messenger (video call at due date), kaya huwag i-mute ang chat na ito. 🙏',
         '',
         'Puwede ka nang mag-Continue. Mag-message lang kung may tanong. 🦛'
      ].join('\n');
   }
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

export type RemindersStuckFailure = { stage: 'service-worker' | 'subscribe' | 'save'; errorName?: string; errorMessage?: string };

const FAILURE_STAGES = ['service-worker', 'subscribe', 'save'] as const;

/** Validates the app-reported failure detail (untrusted input) and trims it for the alert. */
export const parseRemindersStuckFailure = (raw: unknown): RemindersStuckFailure | null => {
   if (!raw || typeof raw !== 'object') return null;
   const r = raw as Record<string, unknown>;
   if (!FAILURE_STAGES.includes(r.stage as RemindersStuckFailure['stage'])) return null;
   const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : undefined);
   return { stage: r.stage as RemindersStuckFailure['stage'], errorName: text(r.errorName), errorMessage: text(r.errorMessage) };
};

const STAGE_LABEL: Record<RemindersStuckFailure['stage'], string> = {
   subscribe: 'Chrome refused to sign the phone up (phone-side)',
   'service-worker': "the app's background worker didn't start",
   save: '⚠️ OUR SIDE: saving the sign-up to our database failed — check register_push_subscription'
};

const describeFailure = (failure: RemindersStuckFailure) => {
   const error = [failure.errorName, failure.errorMessage].filter(Boolean).join(': ');
   return `Where: ${STAGE_LABEL[failure.stage]}${error ? ` — ${error}` : ''}`;
};

export type MessengerOutcome = 'sent' | 'not_connected' | 'window_closed' | 'failed';

const MESSENGER_LINE: Record<MessengerOutcome, string> = {
   sent: '💬 Bot messaged them on Messenger.',
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
   failures?: number,
   failure?: RemindersStuckFailure | null
) => {
   const who = borrower.display_name?.trim() || borrower.username || 'A borrower';
   const handle = [borrower.username ? `@${borrower.username}` : null, borrower.email].filter(Boolean).join(' · ');
   const phone = os === 'ios' ? 'iPhone' : os === 'android' ? 'Android' : 'computer';
   const tries = reason === 'failed' && failures ? ` — tapped ${failures}×` : '';
   return [
      `🔕 Reminders didn't turn on — ${who}`,
      handle,
      `Why: ${REASON_LABEL[reason]}${tries} (${phone})`,
      failure ? describeFailure(failure) : null,
      MESSENGER_LINE[messenger],
      'They can still continue and book their call.'
   ]
      .filter(Boolean)
      .join('\n');
};

// Daily check (pg_cron → messenger-stuck-alerts { reminders: true, mode: 'daily_check' }): if borrowers kept reaching the
// reminders card but no phone signed up for reminders, push is probably broken for everyone (a
// Chrome update, a bad VAPID key, our save failing) rather than one odd phone. On 2026-10-15 we only
// noticed after a borrower messaged the Page.
export const REMINDERS_HEALTH_MIN_REACHED = 3;

export const shouldAlertRemindersHealth = (reached: number, subscribed: number) =>
   reached >= REMINDERS_HEALTH_MIN_REACHED && subscribed === 0;

export const buildRemindersHealthAlert = (counts: { reached: number; subscribed: number; stuck: number }) =>
   [
      '🚨 No one turned on reminders in the last 24h',
      `${counts.reached} borrowers connected Facebook (and reached the reminders step), but 0 phones signed up for reminders.`,
      counts.stuck ? `${counts.stuck} of them hit "reminders didn't turn on" — see those alerts for the error.` : null,
      'iPhones outside the Home Screen never sign up, so check whether these were Android. If they were, push may be broken for everyone: try "Turn on reminders" on an Android phone.'
   ]
      .filter(Boolean)
      .join('\n');
