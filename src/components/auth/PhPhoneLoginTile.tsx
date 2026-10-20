import type { JSX } from 'react';

import { PhFlag } from './PhFlag';

/** iPhone-style outline with a notch, small, so the PH flag beside it carries the meaning. */
const PhoneIcon = () => (
   <svg width="22" height="22" viewBox="0 0 24 24" className="shrink-0" aria-hidden="true" focusable="false">
      <rect x="5" y="1.5" width="14" height="21" rx="3.4" className="fill-[#6010D2] dark:fill-[#C084FC]" />
      <rect x="7" y="3.5" width="10" height="17" rx="1.8" className="fill-[#FDFCFD] dark:fill-[#17121F]" />
      <rect x="9.7" y="4.4" width="4.6" height="1.6" rx="0.8" className="fill-[#6010D2] dark:fill-[#C084FC]" />
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
         <PhFlag className="h-[14px] w-[21px]" />
      </button>
   );
}
