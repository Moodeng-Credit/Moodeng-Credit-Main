// Who the Messenger call-booking bot (messengerBookingBot.ts) answers: telegram_bot_settings 'messenger_booking_bot'.
//   'on'        everyone with a Moodeng account linked to their Messenger
//   'test'      test accounts only (users.is_test)
//   'test-dry'  test accounts only, and nothing is really booked or cancelled
//   anything else, or no row: nobody (messages go to support as before)
// Shared with botNextStep.ts, so the menu's "next step" only says "type BOOK" to people the bot will answer.

// deno-lint-ignore no-explicit-any
type Svc = any;

export const BOOKING_BOT_SETTING = 'messenger_booking_bot';
export type BookingBotMode = 'off' | 'on' | 'test' | 'test-dry';

export const readBookingBotMode = (value: unknown): BookingBotMode => {
   const v = String(value ?? '').replace(/"/g, '').trim();
   return v === 'on' || v === 'test' || v === 'test-dry' ? v : 'off';
};

export const bookingBotAnswers = (mode: BookingBotMode, isTest: boolean | null | undefined) =>
   mode === 'on' || ((mode === 'test' || mode === 'test-dry') && !!isTest);

export const loadBookingBotMode = async (svc: Svc): Promise<BookingBotMode> => {
   const { data } = await svc.from('telegram_bot_settings').select('value').eq('key', BOOKING_BOT_SETTING).maybeSingle();
   return readBookingBotMode(data?.value);
};
