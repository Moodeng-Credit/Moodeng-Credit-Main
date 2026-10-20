import type { JSX } from 'react';

import { PhFlag } from './PhFlag';

/** Filled phone handset (Material "call"), small, so the PH flag beside it carries the meaning. */
const PhoneIcon = () => (
   <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0" aria-hidden="true" focusable="false">
      <path
         className="fill-[#6010D2] dark:fill-[#C084FC]"
         d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z"
      />
   </svg>
);

/**
 * Philippine mobile number login as an icon tile, next to Telegram/LINE: a small phone with the PH
 * flag beside it, so it reads as "Philippine numbers only". Tapping it opens the text-code form
 * (SMS codes only go to +63 numbers, see SMS_NON_PH_MESSAGE).
 */
export default function PhPhoneLoginTile({ isSignUp, onClick }: { isSignUp: boolean; onClick: () => void }): JSX.Element {
   const label = isSignUp ? 'Sign up with a Philippine mobile number' : 'Sign in with a Philippine mobile number';

   return (
      <button
         type="button"
         onClick={onClick}
         aria-label={label}
         title={label}
         className="flex h-14 w-14 shrink-0 items-center justify-center gap-1 rounded-xl border border-[#B5ACBE] bg-[#FDFCFD] shadow-[0px_2px_4px_rgba(27,28,29,0.04)] transition-opacity hover:opacity-95 dark:border-[#40354F] dark:bg-[#17121F]"
      >
         <PhoneIcon />
         <PhFlag className="h-3 w-[18px]" />
      </button>
   );
}
