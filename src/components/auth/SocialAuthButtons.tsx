import { useEffect, useRef, useState } from 'react';

import LineLoginButton from '@/components/LineLoginButton';

import LastUsedBadge from './LastUsedBadge';
import TelegramLoginTile from './TelegramLoginTile';

import { getAuthRedirectUrl } from '@/lib/authRedirect';
import { getLastUsedAuth, setLastUsedAuth } from '@/lib/lastUsedAuth';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

interface SocialAuthButtonsProps {
   isSignUp: boolean;
   onGoogleSuccess?: (credential: string) => void;
   onGoogleError?: () => void;
   onTelegramAuth: (authData: Record<string, string>) => void;
}

const btnBase =
   'w-full min-w-0 flex flex-row justify-center items-center gap-2.5 px-4 py-4 h-[56px] min-h-[56px] rounded-xl transition-opacity hover:opacity-95 cursor-pointer overflow-hidden';

const FacebookLogo = ({ size = 30 }: { size?: number }) => (
   <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
      <path
         fill="#1877F2"
         d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.312 0 2.686.234 2.686.234v2.953H15.83c-1.491 0-1.956.925-1.956 1.874V12h3.328l-.532 3.469h-2.796v8.385C19.612 22.954 24 17.99 24 12z"
      />
   </svg>
);

const GoogleLogo = () => (
   <svg width="20" height="20" viewBox="0 0 24 24" className="shrink-0">
      <path
         fill="#4285F4"
         d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
         fill="#34A853"
         d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
         fill="#FBBC05"
         d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
         fill="#EA4335"
         d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
   </svg>
);

export function SocialAuthButtons({ isSignUp }: SocialAuthButtonsProps) {
   const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
   const [isGoogleLoading, setIsGoogleLoading] = useState(false);
   const [googleError, setGoogleError] = useState('');
   const [lastUsed] = useState(getLastUsedAuth);
   const [showFacebookSoon, setShowFacebookSoon] = useState(false);
   const facebookSoonTimer = useRef<number | null>(null);

   const googleLabel = isSignUp ? 'Sign Up with Google' : 'Sign In with Google';
   // Facebook login is not live yet — the tile is grayed out; tapping it flashes a "Soon" hint.
   const facebookLabel = 'Facebook sign-in coming soon';

   const handleFacebookComingSoon = () => {
      if (facebookSoonTimer.current) window.clearTimeout(facebookSoonTimer.current);
      setShowFacebookSoon(true);
      facebookSoonTimer.current = window.setTimeout(() => setShowFacebookSoon(false), 1800);
   };

   useEffect(() => () => {
      if (facebookSoonTimer.current) window.clearTimeout(facebookSoonTimer.current);
   }, []);
   const hasGoogleClientId = typeof clientId === 'string' && clientId.trim().length > 0 && !clientId.startsWith('encrypted:');

   const handleGoogleClick = async () => {
      if (isGoogleLoading) return;
      setGoogleError('');

      if (!hasGoogleClientId || !isSupabaseBrowserConfigured()) {
         setGoogleError('Google sign-up is not configured in this local app. Ask for the .env.keys file, then restart the dev server.');
         return;
      }

      setIsGoogleLoading(true);
      try {
         const supabase = getSupabaseBrowserClient();
         const redirectTo = getAuthRedirectUrl();

         // Record the provider before we redirect away — the OAuth redirect flow returns
         // through AuthInitializer, which has no way to know which tile was tapped. Best-effort.
         setLastUsedAuth('google');

         const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo }
         });
         if (error) {
            console.error('[SocialAuthButtons] Google OAuth error:', error.message);
            setGoogleError(error.message || 'Google sign-up could not start. Please try again.');
            setIsGoogleLoading(false);
         }
         // If successful, the browser redirects — no need to reset loading state
      } catch (err) {
         console.error('[SocialAuthButtons] Google OAuth exception:', err);
         setGoogleError(err instanceof Error ? err.message : 'Google sign-up could not start. Please try again.');
         setIsGoogleLoading(false);
      }
   };

   return (
      <div className="flex w-full max-w-[400px] min-w-0 flex-col gap-4">
         {/* Google: uses Supabase OAuth redirect flow */}
         {clientId && (
            <div className="relative w-full">
               <button
                  type="button"
                  onClick={handleGoogleClick}
                  disabled={isGoogleLoading}
                  className={`${btnBase} border border-[#B5ACBE] bg-[#FDFCFD] shadow-[0px_2px_4px_rgba(27,28,29,0.04)] dark:border-[#40354F] dark:bg-[#17121F] ${
                     isGoogleLoading ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
               >
                  <GoogleLogo />
                  <span
                     className="min-w-0 truncate text-base font-medium tracking-[-0.02em] text-[#141218] dark:text-[#F8F4FF]"
                     style={{ fontFamily: 'SF Pro Display, sans-serif' }}
                  >
                     {isGoogleLoading ? 'Redirecting...' : googleLabel}
                  </span>
               </button>
               {lastUsed === 'google' && <LastUsedBadge className="-top-2 right-3" />}
            </div>
         )}
         {googleError ? <p className="text-sm font-medium leading-5 text-[#B91C1C]">{googleError}</p> : null}

         {/* Secondary providers as small logo-square tiles, left-aligned under the Google button */}
         <div className="flex w-full min-w-0 items-center justify-start gap-3">
            {/* Telegram: plain icon tile that redirects to Telegram OAuth (no embedded widget) */}
            <div className="relative">
               <TelegramLoginTile />
               {lastUsed === 'telegram' && <LastUsedBadge size="sm" className="-top-2 left-1/2 -translate-x-1/2" />}
            </div>

            {/* LINE: redirects to LINE Login OAuth, handled by the line-login edge fn */}
            <div className="relative">
               <LineLoginButton isSignUp={isSignUp} iconOnly />
               {lastUsed === 'line' && <LastUsedBadge size="sm" className="-top-2 left-1/2 -translate-x-1/2" />}
            </div>

            {/* Facebook: not live yet — grayed out; tapping it flashes a "Soon" hint */}
            <div className="relative">
               <button
                  type="button"
                  onClick={handleFacebookComingSoon}
                  aria-disabled="true"
                  aria-label={facebookLabel}
                  title={facebookLabel}
                  className="flex h-14 w-14 shrink-0 cursor-not-allowed items-center justify-center overflow-hidden rounded-xl border border-[#B5ACBE] bg-[#F3F1F5] opacity-60 grayscale transition-opacity hover:opacity-70 dark:border-[#40354F] dark:bg-[#17121F]"
               >
                  <FacebookLogo />
               </button>
               {showFacebookSoon ? (
                  <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#6B6577] px-2 py-0.5 text-[10px] font-semibold leading-none text-white shadow-sm dark:bg-[#4B4256]">
                     Soon
                  </span>
               ) : null}
            </div>
         </div>
      </div>
   );
}
