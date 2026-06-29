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
      <path
         fill="#fff"
         d="M12 4.6c-4.3 0-7.8 2.84-7.8 6.33 0 3.13 2.78 5.75 6.53 6.24.26.06.6.17.69.39.08.2.05.5.03.71l-.11.67c-.03.2-.16.78.69.43s4.56-2.69 6.22-4.6c1.15-1.26 1.7-2.54 1.7-3.84C19.8 7.44 16.3 4.6 12 4.6z"
      />
      <path
         fill="#06C755"
         d="M9.13 9.43h-.55a.15.15 0 0 0-.15.15v3.4a.15.15 0 0 0 .15.15h.55a.15.15 0 0 0 .15-.15v-3.4a.15.15 0 0 0-.15-.15zm3.77 0h-.55a.15.15 0 0 0-.15.15v2.02l-1.56-2.1-.01-.02h-.6a.15.15 0 0 0-.15.15v3.4a.15.15 0 0 0 .15.15h.55a.15.15 0 0 0 .15-.15v-2.02l1.56 2.11.04.04h.57a.15.15 0 0 0 .15-.15v-3.4a.15.15 0 0 0-.15-.15zm-5.6 2.84H5.81V9.58a.15.15 0 0 0-.15-.15h-.55a.15.15 0 0 0-.15.15v3.4a.15.15 0 0 0 .15.15h2.04a.15.15 0 0 0 .15-.15v-.56a.15.15 0 0 0-.15-.15zm9.86-2.13a.15.15 0 0 0 .15-.15v-.56a.15.15 0 0 0-.15-.15h-2.04a.15.15 0 0 0-.15.15v3.4a.15.15 0 0 0 .15.15h2.04a.15.15 0 0 0 .15-.15v-.56a.15.15 0 0 0-.15-.15h-1.33v-.51h1.33a.15.15 0 0 0 .15-.15v-.56a.15.15 0 0 0-.15-.15h-1.33v-.51h1.33z"
      />
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
