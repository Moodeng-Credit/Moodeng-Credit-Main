// Test accounts (users.is_test): team sign-ups made to try the flow. They're left out of the
// ☀️ Onboarding check-in, /pending, the stuck-borrower alerts and the money stats.
//
// The admin cards about a person (call booked / moved, wants to connect, Facebook connected, stuck
// on Facebook, call sheet) carry a "🧪 Test account?" button. Tapping it posts a confirm under the
// card; ✅ Yes marks them (and drops the button from the card), ✖ No removes the confirm. The
// /testaccount command in telegram-webhook does the same by @username.
import type { TelegramInlineKeyboard } from './telegram.ts';

// callback_data (≤64 bytes): "ta:q:<user uuid>" asks, "ta:y:<user uuid>" confirms, "ta:n" cancels.
export const TEST_ACCOUNT_CALLBACK_PREFIX = 'ta:';

export type TestAccountCallback = { step: 'ask' | 'yes'; userId: string } | { step: 'no' };

export const parseTestAccountCallback = (data?: string | null): TestAccountCallback | null => {
   if (data === 'ta:n') return { step: 'no' };
   const match = (data ?? '').match(/^ta:([qy]):([0-9a-f-]{36})$/i);
   if (!match) return null;
   return { step: match[1].toLowerCase() === 'q' ? 'ask' : 'yes', userId: match[2] };
};

export const TEST_ACCOUNT_BUTTON_TEXT = '🧪 Test account?';

/** The card's button row — none when they're already a test account. */
export const testAccountRow = (userId: string, isTest?: boolean | null): TelegramInlineKeyboard =>
   isTest ? [] : [[{ text: TEST_ACCOUNT_BUTTON_TEXT, callback_data: `ta:q:${userId}` }]];

export const testAccountConfirmKeyboard = (userId: string): TelegramInlineKeyboard => [
   [
      { text: '✅ Yes, test account', callback_data: `ta:y:${userId}` },
      { text: '✖ No', callback_data: 'ta:n' }
   ]
];

export const testAccountQuestion = (name: string) =>
   `🧪 Is ${name} a test account?\nTest accounts are left out of the onboarding check-in, the stuck alerts and the stats.`;

/** The card's buttons without the 🧪 row, once they're marked. */
export const withoutTestAccountRow = (keyboard: TelegramInlineKeyboard | undefined): TelegramInlineKeyboard =>
   (keyboard ?? []).filter((row) => !row.some((b) => 'callback_data' in b && b.callback_data.startsWith('ta:q:')));
