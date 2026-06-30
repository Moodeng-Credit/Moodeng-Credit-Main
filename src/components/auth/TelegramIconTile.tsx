import { type JSX } from 'react';

import TelegramAuthButton from '@/components/TelegramAuthButton';

interface TelegramIconTileProps {
   onAuth: (authData: Record<string, string>) => void;
}

const TelegramLogo = () => (
   <svg width="30" height="30" viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#229ED9" />
      <path
         fill="#fff"
         d="M5.4 11.74c3.6-1.57 6-2.6 7.2-3.1 3.43-1.43 4.14-1.68 4.6-1.68.1 0 .33.02.48.14.12.1.16.24.17.34 0 .07.02.25 0 .38-.18 1.93-.97 6.6-1.37 8.76-.17.91-.5 1.22-.82 1.25-.7.06-1.23-.46-1.9-.9-1.06-.7-1.66-1.13-2.68-1.81-1.18-.78-.42-1.21.26-1.91.18-.18 3.25-2.98 3.31-3.23 0-.03 0-.15-.06-.21-.07-.06-.16-.04-.23-.02-.1.02-1.78 1.13-5.05 3.32-.48.33-.91.49-1.3.48-.43-.01-1.25-.24-1.86-.44-.75-.24-1.35-.37-1.3-.79.03-.21.33-.43.9-.65z"
      />
   </svg>
);

/**
 * A compact Telegram logo tile. The real (working) Telegram login widget is
 * layered invisibly on top so clicks still go through the official auth flow,
 * while the user sees a clean logo square that matches the other provider tiles.
 */
export default function TelegramIconTile({ onAuth }: TelegramIconTileProps): JSX.Element {
   return (
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[#B5ACBE] bg-[#FDFCFD] shadow-[0px_2px_4px_rgba(27,28,29,0.04)] dark:border-[#40354F] dark:bg-[#17121F]">
         <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <TelegramLogo />
         </span>
         {/*
            The real Telegram widget renders at its natural size (fitContent) and is
            centered + scaled up so its clickable "Log in with Telegram" link fully
            covers the 56px tile. It sits invisibly (opacity-0) on top of the logo, so
            a click anywhere on the tile goes through the official Telegram auth flow.
            The tile's overflow-hidden keeps the oversized widget clipped to the square.
         */}
         <div className="absolute inset-0 flex items-center justify-center opacity-0">
            <div className="scale-[1.8]">
               <TelegramAuthButton onAuth={onAuth} buttonSize="large" useRedirect hideLoading fitContent />
            </div>
         </div>
      </div>
   );
}
