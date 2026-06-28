import { type JSX } from 'react';

import { isLineConfigured, startLineLogin } from '@/lib/lineAuth';

interface LineLoginButtonProps {
   isSignUp?: boolean;
}

const LineLogo = () => (
   <svg width="22" height="22" viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
      <path
         fill="#fff"
         d="M12 2C6.48 2 2 5.69 2 10.23c0 4.07 3.55 7.48 8.35 8.12.33.07.77.22.88.5.1.26.07.66.03.92l-.14.85c-.04.26-.2 1.02.89.56s5.86-3.45 8-5.91C21.3 13.5 22 11.94 22 10.23 22 5.69 17.52 2 12 2z"
      />
      <path
         fill="#06C755"
         d="M8.9 8.62h-.7a.2.2 0 0 0-.2.2v3.36c0 .1.09.19.2.19h.7a.2.2 0 0 0 .19-.2V8.83a.2.2 0 0 0-.19-.2zm3.74 0h-.7a.2.2 0 0 0-.2.2v2l-1.54-2.08-.01-.02-.04-.04h-.76a.2.2 0 0 0-.2.2v3.36c0 .1.09.19.2.19h.7a.2.2 0 0 0 .2-.2v-1.99l1.54 2.08.04.04h.77a.2.2 0 0 0 .2-.2V8.83a.2.2 0 0 0-.2-.2zm-5.43 2.86H5.74V8.83a.2.2 0 0 0-.2-.2h-.7a.2.2 0 0 0-.2.2v3.36c0 .05.02.1.06.13.03.04.08.06.13.06h2.16a.2.2 0 0 0 .2-.2v-.7a.2.2 0 0 0-.2-.2zm9.74-1.86a.2.2 0 0 0 .2-.2v-.7a.2.2 0 0 0-.2-.2h-2.16a.2.2 0 0 0-.13.05.2.2 0 0 0-.06.14v3.36c0 .05.02.1.06.13.03.04.08.06.13.06h2.16a.2.2 0 0 0 .2-.2v-.7a.2.2 0 0 0-.2-.2h-1.26v-.49h1.26a.2.2 0 0 0 .2-.2v-.69a.2.2 0 0 0-.2-.2h-1.26v-.49h1.26z"
      />
   </svg>
);

export default function LineLoginButton({ isSignUp = false }: LineLoginButtonProps): JSX.Element | null {
   if (!isLineConfigured()) return null;

   const label = isSignUp ? 'Sign Up with LINE' : 'Sign In with LINE';

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
