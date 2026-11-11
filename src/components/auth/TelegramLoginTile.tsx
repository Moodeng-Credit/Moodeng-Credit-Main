import { type JSX, useState } from 'react';

import { startTelegramLogin } from '@/components/auth/telegramOAuth';

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
export const TelegramLogo = ({ size = 30 }: { size?: number }) => (
   <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#229ED9" />
      <path
         fill="#fff"
         d="M5.4 11.74c3.6-1.57 6-2.6 7.2-3.1 3.43-1.43 4.14-1.68 4.6-1.68.1 0 .33.02.48.14.12.1.16.24.17.34 0 .07.02.25 0 .38-.18 1.93-.97 6.6-1.37 8.76-.17.91-.5 1.22-.82 1.25-.7.06-1.23-.46-1.9-.9-1.06-.7-1.66-1.13-2.68-1.81-1.18-.78-.42-1.21.26-1.91.18-.18 3.25-2.98 3.31-3.23 0-.03 0-.15-.06-.21-.07-.06-.16-.04-.23-.02-.1.02-1.78 1.13-5.05 3.32-.48.33-.91.49-1.3.48-.43-.01-1.25-.24-1.86-.44-.75-.24-1.35-.37-1.3-.79.03-.21.33-.43.9-.65z"
      />
   </svg>
);

const Spinner = ({ className = '' }: { className?: string }) => (
   <svg className={`animate-spin ${className}`} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
   </svg>
);

export default function TelegramLoginTile(): JSX.Element {
   const [isLoading, setIsLoading] = useState(false);

   const handleClick = () => {
      if (isLoading) return;
      setIsLoading(true);
      startTelegramLogin();
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
         {isLoading ? <Spinner className="text-[#229ED9]" /> : <TelegramLogo />}
      </button>
   );
}

/**
 * The big full-width variant for /id (Indonesia track): same OAuth flow, one gold button, plus
 * Telegram's "let the bot message you" prompt (the track's step 1 needs it).
 * `onBeforeLeave` runs right before the browser leaves (e.g. to mark the sign-up intent).
 */
export function TelegramBigButton({
   label,
   onBeforeLeave,
   variant = 'gold'
}: {
   label: string;
   onBeforeLeave?: () => void;
   variant?: 'gold' | 'soft';
}): JSX.Element {
   const [isLoading, setIsLoading] = useState(false);
   const handleClick = () => {
      if (isLoading) return;
      setIsLoading(true);
      onBeforeLeave?.();
      startTelegramLogin({ requestWrite: true });
   };
   const gold = variant === 'gold';
   return (
      <button
         type="button"
         onClick={handleClick}
         disabled={isLoading}
         aria-busy={isLoading}
         className={
            gold
               ? 'flex min-h-[60px] w-full items-center justify-center gap-3 rounded-[18px] px-5 text-[19px] font-extrabold tracking-[-0.01em] text-[#4a2a00] shadow-[0_4px_0_#d99a00,0_10px_22px_rgba(255,190,26,0.35)] transition active:translate-y-[2px] disabled:opacity-80'
               : 'flex min-h-[52px] w-full items-center justify-center gap-3 rounded-[16px] border-2 border-[#ecdfb8] bg-white px-4 text-[16px] font-bold text-[#6b4a00] transition active:scale-[0.99] disabled:opacity-70 dark:border-[#4a3d1c] dark:bg-[#1c1710] dark:text-[#ffd36b]'
         }
         style={gold ? { backgroundImage: 'linear-gradient(180deg, #ffe27a 0%, #ffbe1a 100%)' } : undefined}
      >
         {isLoading ? <Spinner className={gold ? 'text-[#4a2a00]' : 'text-[#229ED9]'} /> : <TelegramLogo size={gold ? 30 : 24} />}
         <span>{label}</span>
      </button>
   );
}
