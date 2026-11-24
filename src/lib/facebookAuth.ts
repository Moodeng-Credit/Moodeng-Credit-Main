import type { InAppBrowserInfo } from '@/lib/inAppBrowser';

/**
 * Facebook login runs through Supabase Auth's built-in Facebook provider (no edge function).
 * ON for everyone since 2026-11-24: the Meta app "Moodeng Credit" (1190163573687726, U-Bridge's verified
 * portfolio) is Live, Meta approved email + public_profile in App Review (2026-11-24), and its App ID/Secret
 * are in Supabase (Auth → Providers → Facebook).
 * Kill switch: VITE_FACEBOOK_LOGIN_ENABLED=false hides it everywhere (needs a redeploy).
 * ?facebook=0 hides it in this browser only (for checking the page without it); ?facebook=1 brings it back.
 */
export const FACEBOOK_TEST_FLAG_KEY = 'moodeng:facebook-test';

export function isFacebookLoginEnabled(): boolean {
   if (import.meta.env.VITE_FACEBOOK_LOGIN_ENABLED === 'false') return false;
   try {
      const flag = new URLSearchParams(window.location.search).get('facebook');
      if (flag === '0') localStorage.setItem(FACEBOOK_TEST_FLAG_KEY, '0');
      if (flag === '1') localStorage.removeItem(FACEBOOK_TEST_FLAG_KEY);
      return localStorage.getItem(FACEBOOK_TEST_FLAG_KEY) !== '0';
   } catch {
      return true;
   }
}

/**
 * Inside Facebook's, Messenger's or Instagram's own browser the person is already signed in to
 * Facebook, so "Continue with Facebook" is one tap — it leads there, above email.
 * (Other apps' browsers keep it as a small tile: Facebook blocks its login in third-party WebViews.)
 */
export function isFacebookFamilyApp(inApp: InAppBrowserInfo): boolean {
   return inApp.isInApp && (inApp.appName === 'Facebook' || inApp.appName === 'Messenger' || inApp.appName === 'Instagram');
}

/**
 * Facebook first (2026-11-24, George): one person rarely has two Facebook accounts, while anyone can make
 * a new Gmail, so "Continue with Facebook" is the main button in normal browsers and inside
 * Facebook/Messenger/Instagram. Other apps' browsers (TikTok, LINE, Telegram…) keep it as a small tile:
 * Facebook blocks its login inside other apps' Android web views.
 */
export function isFacebookPrimaryHere(inApp: InAppBrowserInfo): boolean {
   return isFacebookLoginEnabled() && (!inApp.isInApp || isFacebookFamilyApp(inApp));
}

/** Supabase's error when Facebook gives no email (phone-only Facebook accounts, or email permission declined). */
export function isMissingProviderEmailError(message: string | null | undefined): boolean {
   return /email.*external provider/i.test(message ?? '');
}
