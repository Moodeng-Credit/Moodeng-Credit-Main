import { type JSX } from 'react';

import { isLineConfigured, startLineLogin } from '@/lib/lineAuth';

interface LineLoginButtonProps {
   isSignUp?: boolean;
   /** Render a compact logo-only square (for the social icon row) instead of a full-width labelled bar. */
   iconOnly?: boolean;
}

/** Self-contained LINE app icon (green rounded square + white bubble + green wordmark). */
const LineLogo = ({ size = 22 }: { size?: number }) => (
   <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
      <rect width="24" height="24" rx="5.5" fill="#06C755" />
      {/* White speech bubble */}
      <path
         fill="#fff"
         d="M12 4.8c-4.18 0-7.58 2.76-7.58 6.15 0 3.04 2.7 5.58 6.34 6.06.25.05.58.16.67.38.07.19.05.49.02.69 0 0-.09.54-.11.66-.03.19-.15.76.67.41.82-.34 4.42-2.6 6.03-4.46 1.11-1.22 1.64-2.46 1.64-3.74C19.58 7.56 16.18 4.8 12 4.8z"
      />
      {/* LINE wordmark as crisp text */}
      <text
         x="12"
         y="12.7"
         textAnchor="middle"
         fill="#06C755"
         fontSize="4.4"
         fontWeight="700"
         letterSpacing="0.15"
         fontFamily="Helvetica, Arial, sans-serif"
      >
         LINE
      </text>
   </svg>
);

export default function LineLoginButton({ isSignUp = false, iconOnly = false }: LineLoginButtonProps): JSX.Element | null {
   if (!isLineConfigured()) return null;

   const label = isSignUp ? 'Sign Up with LINE' : 'Sign In with LINE';

   if (iconOnly) {
      return (
         <button
            type="button"
            onClick={startLineLogin}
            aria-label={label}
            title={label}
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#B5ACBE] bg-[#FDFCFD] shadow-[0px_2px_4px_rgba(27,28,29,0.04)] transition-opacity hover:opacity-95 dark:border-[#40354F] dark:bg-[#17121F]"
         >
            <LineLogo size={30} />
         </button>
      );
   }

   return (
      <button
         type="button"
         onClick={startLineLogin}
         className="flex h-[56px] min-h-[56px] w-full min-w-0 flex-row items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-[#06C755] px-4 py-4 shadow-[0px_2px_4px_rgba(27,28,29,0.04)] transition-opacity hover:opacity-95"
      >
         <LineLogo />
         <span
            className="min-w-0 truncate text-base font-medium tracking-[-0.02em] text-white"
            style={{ fontFamily: 'SF Pro Display, sans-serif' }}
         >
            {label}
         </span>
      </button>
   );
}
