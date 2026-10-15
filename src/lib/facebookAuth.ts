import type { InAppBrowserInfo } from '@/lib/inAppBrowser';

/**
 * Facebook login runs through Supabase Auth's built-in Facebook provider (no edge function).
 * It stays hidden until VITE_FACEBOOK_LOGIN_ENABLED=true, which should only be set after the
 * Meta app is Live and its App ID/Secret are saved in Supabase (Auth → Providers → Facebook).
 * Before that, testers can turn it on for their own browser with ?facebook=1 (off again with ?facebook=0).
 */
export const FACEBOOK_TEST_FLAG_KEY = 'moodeng:facebook-test';

export function isFacebookLoginEnabled(): boolean {
   if (import.meta.env.VITE_FACEBOOK_LOGIN_ENABLED === 'true') return true;
   try {
      const flag = new URLSearchParams(window.location.search).get('facebook');
      if (flag === '1') localStorage.setItem(FACEBOOK_TEST_FLAG_KEY, '1');
      if (flag === '0') localStorage.removeItem(FACEBOOK_TEST_FLAG_KEY);
      return localStorage.getItem(FACEBOOK_TEST_FLAG_KEY) === '1';
   } catch {
      return false;
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

/** Supabase's error when Facebook gives no email (phone-only Facebook accounts, or email permission declined). */
export function isMissingProviderEmailError(message: string | null | undefined): boolean {
   return /email.*external provider/i.test(message ?? '');
}
