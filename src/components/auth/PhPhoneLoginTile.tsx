import type { JSX } from 'react';

/**
 * A phone showing the Philippine flag on its screen, so the tile reads as "Philippine numbers
 * only". Drawn (like PhFlag) rather than an emoji, which shows as "PH" on Windows/older Android.
 */
const PhPhoneLogo = () => (
   <svg width="22" height="32" viewBox="0 0 22 32" className="shrink-0" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="20" height="30" rx="4.5" className="fill-[#250650] dark:fill-[#F8F4FF]" />
      <rect x="3" y="4.5" width="16" height="21" rx="1.5" className="fill-[#FDFCFD] dark:fill-[#17121F]" />
      <rect x="8.5" y="2.25" width="5" height="1" rx="0.5" className="fill-[#FDFCFD] dark:fill-[#17121F]" />
      <circle cx="11" cy="28.25" r="1.25" className="fill-[#FDFCFD] dark:fill-[#17121F]" />
      {/* Flag fills the screen width: blue over red, white triangle with the sun and stars */}
      <g transform="translate(3 10.5)">
         <rect width="16" height="4.5" fill="#0038A8" />
         <rect y="4.5" width="16" height="4.5" fill="#CE1126" />
         <path d="M0 0 L7.8 4.5 L0 9 Z" fill="#FFFFFF" />
         <circle cx="2.7" cy="4.5" r="1.05" fill="#FCD116" />
         <circle cx="0.85" cy="1.2" r="0.38" fill="#FCD116" />
         <circle cx="0.85" cy="7.8" r="0.38" fill="#FCD116" />
         <circle cx="6" cy="4.5" r="0.38" fill="#FCD116" />
      </g>
   </svg>
);

/**
 * Philippine mobile number login as an icon tile, next to Telegram/LINE. Tapping it opens the
 * text-code form (SMS codes only go to +63 numbers, see SMS_NON_PH_MESSAGE).
 */
export default function PhPhoneLoginTile({ isSignUp, onClick }: { isSignUp: boolean; onClick: () => void }): JSX.Element {
   const label = isSignUp ? 'Sign up with a Philippine mobile number' : 'Sign in with a Philippine mobile number';

   return (
      <button
         type="button"
         onClick={onClick}
         aria-label={label}
         title={label}
         className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[#B5ACBE] bg-[#FDFCFD] shadow-[0px_2px_4px_rgba(27,28,29,0.04)] transition-opacity hover:opacity-95 dark:border-[#40354F] dark:bg-[#17121F]"
      >
         <PhPhoneLogo />
      </button>
   );
}
