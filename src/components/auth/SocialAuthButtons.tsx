import { useEffect, useMemo, useRef, useState } from 'react';

import posthog from 'posthog-js';

import LineLoginButton from '@/components/LineLoginButton';
import TikTokLoginButton from '@/components/TikTokLoginButton';

import LastUsedBadge from './LastUsedBadge';
import TelegramLoginTile from './TelegramLoginTile';

import { getAuthRedirectUrl } from '@/lib/authRedirect';
import { isFacebookFamilyApp, isFacebookLoginEnabled } from '@/lib/facebookAuth';
import { buildAndroidIntentUrl, detectInAppBrowser, isFacebookInApp, openInSafari, watchForFailedHandOff } from '@/lib/inAppBrowser';
import { getLastUsedAuth, setLastUsedAuth } from '@/lib/lastUsedAuth';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

interface SocialAuthButtonsProps {
   isSignUp: boolean;
   onGoogleSuccess?: (credential: string) => void;
   onGoogleError?: () => void;
   onTelegramAuth: (authData: Record<string, string>) => void;
   /** The page already shows the big Facebook button elsewhere (sign-up puts it above email). */
   hideFacebook?: boolean;
}

const btnBase =
   'w-full min-w-0 flex flex-row justify-center items-center gap-2.5 px-4 py-4 h-[56px] min-h-[56px] rounded-xl transition-opacity hover:opacity-95 cursor-pointer overflow-hidden';

const FacebookLogo = ({ size = 30, color = '#1877F2' }: { size?: number; color?: string }) => (
   <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
      <path
         fill={color}
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

/** True when "Continue with Facebook" should be the main button on this page (Facebook/Messenger/Instagram's browser). */
export function useFacebookPrimary(): boolean {
   return useMemo(() => isFacebookLoginEnabled() && isFacebookFamilyApp(detectInAppBrowser()), []);
}

/**
 * Facebook login through Supabase Auth's Facebook provider (OAuth redirect, returns via /auth/confirm).
 * 'full' is the main button inside Facebook's own browser, where the person is already signed in to
 * Facebook; 'tile' is the small square next to Telegram/LINE everywhere else.
 */
export function FacebookAuthButton({ isSignUp, variant }: { isSignUp: boolean; variant: 'full' | 'tile' }) {
   const [isLoading, setIsLoading] = useState(false);
   const [error, setError] = useState('');
   const lastUsed = useMemo(() => getLastUsedAuth(), []);
   const label = 'Continue with Facebook';
   const failMessage = isSignUp
      ? 'Facebook sign-up could not start. Please try again or use email.'
      : 'Facebook sign-in could not start. Please try again or use email.';

   const handleClick = async () => {
      if (isLoading) return;
      setError('');

      if (!isSupabaseBrowserConfigured()) {
         setError('Facebook sign-in is not configured in this local app. Ask for the .env.keys file, then restart the dev server.');
         return;
      }

      setIsLoading(true);
      if (import.meta.env.PROD) {
         const inApp = detectInAppBrowser();
         posthog.capture('facebook_login_tapped', { app: inApp.appName ?? 'browser', os: inApp.os, sign_up: isSignUp, variant });
      }
      try {
         // Recorded before the redirect: the return goes through /auth/confirm, which can't tell which tile was tapped.
         setLastUsedAuth('facebook');
         const { error: oauthError } = await getSupabaseBrowserClient().auth.signInWithOAuth({
            provider: 'facebook',
            options: { redirectTo: getAuthRedirectUrl(), scopes: 'email,public_profile' }
         });
         if (oauthError) {
            console.error('[SocialAuthButtons] Facebook OAuth error:', oauthError.message);
            setError(oauthError.message || failMessage);
            setIsLoading(false);
         }
         // On success the browser redirects to Facebook — leave the loading state on
      } catch (err) {
         console.error('[SocialAuthButtons] Facebook OAuth exception:', err);
         setError(err instanceof Error ? err.message : failMessage);
         setIsLoading(false);
      }
   };

   const errorLine = error ? <p className="mt-2 text-sm font-medium leading-5 text-[#B91C1C]">{error}</p> : null;

   if (variant === 'tile') {
      return (
         <div className="relative">
            <button
               type="button"
               onClick={handleClick}
               disabled={isLoading}
               aria-label={label}
               title={label}
               className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#B5ACBE] bg-[#FDFCFD] shadow-[0px_2px_4px_rgba(27,28,29,0.04)] transition-opacity hover:opacity-95 dark:border-[#40354F] dark:bg-[#17121F] ${
                  isLoading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
               }`}
            >
               <FacebookLogo />
            </button>
            {lastUsed === 'facebook' && <LastUsedBadge size="sm" className="-top-2 left-1/2 -translate-x-1/2" />}
            {error ? <p className="absolute left-0 top-full mt-1 w-64 text-xs font-medium leading-4 text-[#B91C1C]">{error}</p> : null}
         </div>
      );
   }

   return (
      <div className="relative w-full max-w-[400px]">
         <button
            type="button"
            onClick={handleClick}
            disabled={isLoading}
            className={`${btnBase} bg-[#1877F2] font-semibold shadow-[0px_2px_4px_rgba(27,28,29,0.04)] ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
         >
            <FacebookLogo size={24} color="#FFFFFF" />
            <span
               className="min-w-0 truncate text-base font-semibold tracking-[-0.02em] text-white"
               style={{ fontFamily: 'SF Pro Display, sans-serif' }}
            >
               {isLoading ? 'Opening Facebook...' : label}
            </span>
         </button>
         {lastUsed === 'facebook' && <LastUsedBadge className="-top-2 right-3" />}
         {errorLine}
      </div>
   );
}

export function SocialAuthButtons({ isSignUp, hideFacebook = false }: SocialAuthButtonsProps) {
   const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
   const [isGoogleLoading, setIsGoogleLoading] = useState(false);
   const [googleError, setGoogleError] = useState('');
   const [lastUsed] = useState(getLastUsedAuth);
   const [showFacebookSoon, setShowFacebookSoon] = useState(false);
   const facebookSoonTimer = useRef<number | null>(null);
   // Google refuses to sign in inside an app's built-in browser (Facebook, Messenger, Instagram…):
   // 6 people tapped "Sign up with Google" inside Facebook on 2026-10-13/14 and none got through.
   // There the button hands off to Chrome (Android) or Safari (iPhone) instead, and says so.
   const inApp = useMemo(() => detectInAppBrowser(), []);
   const [handOffSteps, setHandOffSteps] = useState(false);
   const stopWatchingRef = useRef<(() => void) | null>(null);
   const googleInApp = inApp.isInApp && (inApp.os === 'android' || inApp.os === 'ios');
   // Facebook/Messenger: only 9 of 76 visitors got in (Sep–Oct 2026), while email + code did work there.
   // So Google isn't a button at all — just a small "open in Chrome" line under the other options.
   const googleAsLine = googleInApp && isFacebookInApp(inApp);
   const handOffBrowser = inApp.os === 'ios' ? 'Safari' : 'Chrome';
   const facebookEnabled = useMemo(() => isFacebookLoginEnabled(), []);
   const facebookPrimary = facebookEnabled && isFacebookFamilyApp(inApp);

   const googleLabel = googleInApp
      ? `Google: open in ${inApp.os === 'ios' ? 'Safari' : 'Chrome'}`
      : isSignUp
        ? 'Sign Up with Google'
        : 'Sign In with Google';
   // Until Facebook login is switched on (VITE_FACEBOOK_LOGIN_ENABLED) the tile is grayed out; tapping it flashes a "Soon" hint.
   const facebookLabel = 'Facebook sign-in coming soon';

   const handleFacebookComingSoon = () => {
      if (facebookSoonTimer.current) window.clearTimeout(facebookSoonTimer.current);
      setShowFacebookSoon(true);
      facebookSoonTimer.current = window.setTimeout(() => setShowFacebookSoon(false), 1800);
   };

   useEffect(() => () => {
      if (facebookSoonTimer.current) window.clearTimeout(facebookSoonTimer.current);
      stopWatchingRef.current?.();
   }, []);

   const trackInAppGoogle = (event: string) => {
      if (!import.meta.env.PROD) return;
      posthog.capture(event, { app: inApp.appName ?? 'unknown', os: inApp.os, page: window.location.pathname, sign_up: isSignUp });
   };

   // Android: the button is a real intent:// link (tapped links get through Facebook's browser more
   // often than scripted ones). iPhone: try Safari's scheme. Either way, if we're still here 1.5s
   // later, show the manual steps under the button.
   const handleGoogleInApp = () => {
      trackInAppGoogle('inapp_google_tapped');
      if (inApp.os === 'ios') openInSafari(window.location.href, inApp);
      stopWatchingRef.current?.();
      stopWatchingRef.current = watchForFailedHandOff(() => {
         setHandOffSteps(true);
         trackInAppGoogle('inapp_google_handoff_failed');
      });
   };
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
         {/* Facebook's own browser: the person is already signed in to Facebook, so it leads */}
         {facebookPrimary && !hideFacebook ? <FacebookAuthButton isSignUp={isSignUp} variant="full" /> : null}

         {/* Google inside an app's browser: hand off to Chrome/Safari, where Google sign-in works */}
         {clientId && googleInApp && !googleAsLine ? (
            <div className="w-full">
               <a
                  href={inApp.os === 'android' ? buildAndroidIntentUrl(window.location.href) : undefined}
                  role={inApp.os === 'android' ? undefined : 'button'}
                  onClick={handleGoogleInApp}
                  className={`${btnBase} border border-[#B5ACBE] bg-[#FDFCFD] shadow-[0px_2px_4px_rgba(27,28,29,0.04)] dark:border-[#40354F] dark:bg-[#17121F]`}
               >
                  <GoogleLogo />
                  <span
                     className="min-w-0 truncate text-base font-medium tracking-[-0.02em] text-[#141218] dark:text-[#F8F4FF]"
                     style={{ fontFamily: 'SF Pro Display, sans-serif' }}
                  >
                     {googleLabel}
                  </span>
               </a>
               <p className="mt-2 text-sm leading-5 text-[#5b5470] dark:text-[#B5ACBE]">
                  {handOffSteps ? (
                     inApp.os === 'ios' ? (
                        <>
                           Tap <b>•••</b> at the top, choose <b>Open in Browser</b>, then tap Google there. Or use email below.
                        </>
                     ) : (
                        <>
                           Tap <b>⋮</b> at the top right, choose <b>Open in Chrome</b>, then tap Google there. Or use email below.
                        </>
                     )
                  ) : (
                     <>
                        Google sign-in doesn&apos;t work inside {inApp.appName ?? 'this app'}.{' '}
                        {facebookPrimary ? 'Facebook and email work here.' : 'Email works here.'}
                     </>
                  )}
               </p>
            </div>
         ) : null}

         {/* Google: uses Supabase OAuth redirect flow */}
         {clientId && !googleInApp && (
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

            {/* TikTok: redirects to TikTok Login Kit, handled by the tiktok-login edge fn (grayed out "Soon" until the app is approved) */}
            <div className="relative">
               <TikTokLoginButton isSignUp={isSignUp} iconOnly />
               {lastUsed === 'tiktok' && <LastUsedBadge size="sm" className="-top-2 left-1/2 -translate-x-1/2" />}
            </div>

            {/* Facebook: a live tile once enabled (the big button above when inside Facebook); until then grayed out with a "Soon" hint */}
            {facebookEnabled ? (
               facebookPrimary ? null : (
                  <FacebookAuthButton isSignUp={isSignUp} variant="tile" />
               )
            ) : (
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
            )}
         </div>

         {/* Google inside Facebook/Messenger: a small line, not a button (email above is the way in) */}
         {clientId && googleAsLine ? (
            <p className="text-sm leading-5 text-[#5b5470] dark:text-[#B5ACBE]">
               {handOffSteps ? (
                  inApp.os === 'ios' ? (
                     <>
                        For Google, tap <b>•••</b> at the top, choose <b>Open in Browser</b>, then tap Google there.
                     </>
                  ) : (
                     <>
                        For Google, tap <b>⋮</b> at the top right, choose <b>Open in Chrome</b>, then tap Google there.
                     </>
                  )
               ) : (
                  <>
                     Google sign-in works in {handOffBrowser}, not inside {inApp.appName}.{' '}
                     {inApp.os === 'android' ? (
                        <a
                           href={buildAndroidIntentUrl(window.location.href)}
                           onClick={handleGoogleInApp}
                           className="font-semibold text-[#8336F0] underline underline-offset-2"
                        >
                           Open in Chrome
                        </a>
                     ) : (
                        <button
                           type="button"
                           onClick={handleGoogleInApp}
                           className="font-semibold text-[#8336F0] underline underline-offset-2"
                        >
                           Open in Safari
                        </button>
                     )}
                  </>
               )}
            </p>
         ) : null}
      </div>
   );
}
