/**
 * bot_id is the numeric id of @MoodenCreditstaging_bot — the same bot whose token is TELEGRAM_API_TOKEN
 * and whose BotFather /setdomain is moodeng.app (see TelegramLoginTile).
 */
const TELEGRAM_BOT_ID = '7975444499';

/**
 * Telegram's OAuth page for our bot. `request_access=write` asks the person to let the bot message
 * them (Telegram then returns allows_write_to_pm, and telegram-login saves users.chat_id), so the bot
 * can reach them from the first minute, which the Indonesia track needs for its step 1.
 */
export const buildTelegramOAuthUrl = (origin: string = window.location.origin): string => {
   const returnTo = `${origin}/auth/telegram/callback`;
   return (
      `https://oauth.telegram.org/auth?bot_id=${TELEGRAM_BOT_ID}` +
      `&origin=${encodeURIComponent(origin)}` +
      `&request_access=write` +
      `&return_to=${encodeURIComponent(returnTo)}`
   );
};

/**
 * Leaves for Telegram's OAuth page. Paints a spinner first, then navigates on the next frame so the
 * loading state actually shows before the browser leaves (mirrors LINE).
 */
export const startTelegramLogin = (): void => {
   const url = buildTelegramOAuthUrl();
   requestAnimationFrame(() =>
      requestAnimationFrame(() => {
         window.location.href = url;
      })
   );
};
