import { useState, type JSX } from 'react';

/**
 * Telegram login as a plain icon tile (no embedded widget / no invisible iframe).
 *
 * Clicking navigates the top window straight to Telegram's OAuth page, which —
 * after the user confirms — redirects back to /auth/telegram/callback with the
 * signed auth params (id, first_name, username, photo_url, auth_date, hash).
 * That callback validates the hash via the `telegram-login` edge function.
 *
 * This avoids the cross-origin iframe widget entirely (transform/opacity/clip
 * issues that made the old overlay tile unclickable).
 *
 * bot_id is the numeric id of @MoodenCreditstaging_bot — the same bot whose
 * token is TELEGRAM_API_TOKEN and whose BotFather /setdomain is moodeng.app.
 */
const TELEGRAM_BOT_ID = '7975444499';

const TelegramLogo = ({ size = 30 }: { size?: number }) => (
   <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#229ED9" />
      <path
         fill="#fff"
         d="M5.4 11.74c3.6-1.57 6-2.6 7.2-3.1 3.43-1.43 4.14-1.68 4.6-1.68.1 0 .33.02.48.14.12.1.16.24.17.34 0 .07.02.25 0 .38-.18 1.93-.97 6.6-1.37 8.76-.17.91-.5 1.22-.82 1.25-.7.06-1.23-.46-1.9-.9-1.06-.7-1.66-1.13-2.68-1.81-1.18-.78-.42-1.21.26-1.91.18-.18 3.25-2.98 3.31-3.23 0-.03 0-.15-.06-.21-.07-.06-.16-.04-.23-.02-.1.02-1.78 1.13-5.05 3.32-.48.33-.91.49-1.3.48-.43-.01-1.25-.24-1.86-.44-.75-.24-1.35-.37-1.3-.79.03-.21.33-.43.9-.65z"
      />
   </svg>
);

export default function TelegramLoginTile(): JSX.Element {
   const [isLoading, setIsLoading] = useState(false);

   const handleClick = () => {
      if (isLoading) return;
      setIsLoading(true);
      const origin = window.location.origin;
      const returnTo = `${origin}/auth/telegram/callback`;
      const url =
         `https://oauth.telegram.org/auth?bot_id=${TELEGRAM_BOT_ID}` +
         `&origin=${encodeURIComponent(origin)}` +
         `&return_to=${encodeURIComponent(returnTo)}`;
      window.location.href = url;
   };

   return (
      <button
         type="button"
         onClick={handleClick}
         disabled={isLoading}
         aria-label="Sign in with Telegram"
         aria-busy={isLoading}
         title="Sign in with Telegram"
         className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#B5ACBE] bg-[#FDFCFD] shadow-[0px_2px_4px_rgba(27,28,29,0.04)] transition-opacity hover:opacity-95 dark:border-[#40354F] dark:bg-[#17121F] ${
            isLoading ? 'cursor-not-allowed opacity-70' : ''
         }`}
      >
         <TelegramLogo />
      </button>
   );
}
