import { type JSX, useState } from 'react';

import { isTikTokConfigured, startTikTokLogin } from '@/lib/tiktokAuth';

interface TikTokLoginButtonProps {
   isSignUp?: boolean;
   /** Render a compact logo-only square (for the social icon row) instead of a full-width labelled bar. */
   iconOnly?: boolean;
}

const Spinner = ({ className = '' }: { className?: string }) => (
   <svg className={`animate-spin ${className}`} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
   </svg>
);

const NOTE =
   'M16.6 5.8c-.9-.6-1.5-1.5-1.7-2.6h-2.9v11.6c0 1.2-1 2.2-2.2 2.2s-2.2-1-2.2-2.2 1-2.2 2.2-2.2c.2 0 .5 0 .7.1V9.7c-.2 0-.5-.1-.7-.1-2.8 0-5.1 2.3-5.1 5.1s2.3 5.1 5.1 5.1 5.1-2.3 5.1-5.1V9.2c1 .8 2.3 1.2 3.6 1.2V7.5c-.8 0-1.6-.3-2.2-.8z';

/** TikTok-style mark: black rounded square with a white note and cyan / red offsets. */
const TikTokLogo = ({ size = 22 }: { size?: number }) => (
   <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
      <rect width="24" height="24" rx="5.5" fill="#010101" />
      <path d={NOTE} fill="#25F4EE" transform="translate(-.6 -.5) scale(.9) translate(1.3 1.3)" />
      <path d={NOTE} fill="#FE2C55" transform="translate(.6 .5) scale(.9) translate(1.3 1.3)" />
      <path d={NOTE} fill="#fff" transform="scale(.9) translate(1.3 1.3)" />
   </svg>
);

export default function TikTokLoginButton({ isSignUp = false, iconOnly = false }: TikTokLoginButtonProps): JSX.Element | null {
   const [isLoading, setIsLoading] = useState(false);

   if (!isTikTokConfigured()) return null;

   const label = isSignUp ? 'Sign Up with TikTok' : 'Sign In with TikTok';

   const handleClick = () => {
      if (isLoading) return;
      // Paint the loading state first, then redirect on the next frame.
      setIsLoading(true);
      requestAnimationFrame(() => requestAnimationFrame(() => startTikTokLogin()));
   };

   if (iconOnly) {
      return (
         <button
            type="button"
            onClick={handleClick}
            disabled={isLoading}
            aria-label={label}
            aria-busy={isLoading}
            title={label}
            className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#B5ACBE] bg-[#FDFCFD] shadow-[0px_2px_4px_rgba(27,28,29,0.04)] transition-opacity hover:opacity-95 dark:border-[#40354F] dark:bg-[#17121F] ${
               isLoading ? 'cursor-not-allowed opacity-70' : ''
            }`}
         >
            {isLoading ? <Spinner className="text-[#010101] dark:text-white" /> : <TikTokLogo size={30} />}
         </button>
      );
   }

   return (
      <button
         type="button"
         onClick={handleClick}
         disabled={isLoading}
         aria-busy={isLoading}
         className={`flex h-[56px] min-h-[56px] w-full min-w-0 flex-row items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-[#010101] px-4 py-4 shadow-[0px_2px_4px_rgba(27,28,29,0.04)] transition-opacity hover:opacity-95 ${
            isLoading ? 'cursor-not-allowed opacity-80' : ''
         }`}
      >
         {isLoading ? <Spinner className="text-white" /> : <TikTokLogo />}
         <span className="min-w-0 truncate text-base font-medium tracking-[-0.02em] text-white" style={{ fontFamily: 'SF Pro Display, sans-serif' }}>
            {isLoading ? 'Connecting…' : label}
         </span>
      </button>
   );
}
