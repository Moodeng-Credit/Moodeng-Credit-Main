import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/LineLoginButton', () => ({ default: () => null }));
vi.mock('@/components/TikTokLoginButton', () => ({ default: () => null }));
vi.mock('@/components/auth/TelegramLoginTile', () => ({ default: () => null }));

const FB_ANDROID_UA =
   'Mozilla/5.0 (Linux; Android 13; SM-A145F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.40.82;]';
const FB_IOS_UA =
   'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.82;]';
const MESSENGER_IOS_UA =
   'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/460.0.0.37.111;FBBV/600000000;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBCR/;FBID/phone;FBLC/en_US;FBOP/5]';
const INSTAGRAM_ANDROID_UA =
   'Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 Instagram 337.0.0.35.102 Android';
const CHROME_ANDROID_UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36';
const SAFARI_IOS_UA =
   'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

describe('Google sign-in inside an app browser', () => {
   let container: HTMLDivElement;
   let root: Root;
   const originalUA = navigator.userAgent;

   const renderWith = async (ua: string) => {
      Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
      const { SocialAuthButtons } = await import('@/components/auth/SocialAuthButtons');
      await act(async () => {
         root.render(createElement(MemoryRouter, null, createElement(SocialAuthButtons, { isSignUp: true, onTelegramAuth: vi.fn() })));
      });
   };

   beforeEach(() => {
      vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
      vi.unstubAllEnvs();
      Object.defineProperty(window.navigator, 'userAgent', { value: originalUA, configurable: true });
   });

   // No full-width Google button at all: the Google logo button is the only <svg> with Google's blue.
   const hasGoogleButton = () => container.querySelector('path[fill="#4285F4"]') !== null;

   it('Facebook on Android: no Google button, just a small line linking to Chrome', async () => {
      await renderWith(FB_ANDROID_UA);
      expect(hasGoogleButton()).toBe(false);
      expect(container.textContent).not.toContain('Sign Up with Google');
      expect(container.textContent).not.toContain('Google: open in');
      expect(container.textContent).toContain('Google sign-in works in Chrome, not inside Facebook.');
      const link = Array.from(container.querySelectorAll('a')).find((a) => a.textContent === 'Open in Chrome');
      expect(link?.getAttribute('href')).toMatch(/^intent:\/\/.*package=com\.android\.chrome/);
   });

   it('Facebook on iPhone: no Google button, the line offers Safari', async () => {
      await renderWith(FB_IOS_UA);
      expect(hasGoogleButton()).toBe(false);
      expect(container.textContent).toContain('Google sign-in works in Safari, not inside Facebook.');
      expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent === 'Open in Safari')).toBe(true);
   });

   it('Messenger on iPhone: no Google button either', async () => {
      await renderWith(MESSENGER_IOS_UA);
      expect(hasGoogleButton()).toBe(false);
      expect(container.textContent).toContain('not inside Messenger.');
   });

   it('other app browsers (Instagram) keep the full-width "Google: open in Chrome" button', async () => {
      await renderWith(INSTAGRAM_ANDROID_UA);
      expect(hasGoogleButton()).toBe(true);
      expect(container.textContent).toContain('Google: open in Chrome');
   });

   it.each([
      ['Chrome on Android', CHROME_ANDROID_UA],
      ['Safari on iPhone', SAFARI_IOS_UA]
   ])('%s keeps a normal Google button (a small tile under Facebook)', async (_name, ua) => {
      await renderWith(ua);
      expect(hasGoogleButton()).toBe(true);
      expect(container.querySelector('button[aria-label="Sign Up with Google"]')).not.toBeNull();
      expect(container.textContent).not.toContain('open in Chrome');
      expect(container.textContent).not.toContain('Google sign-in works in');
   });
});

const signInWithOAuth = vi.fn().mockResolvedValue({ error: null });
vi.mock('@/lib/supabase/client', () => ({
   getSupabaseBrowserClient: () => ({ auth: { signInWithOAuth } }),
   isSupabaseBrowserConfigured: () => true
}));

describe('Continue with Facebook', () => {
   let container: HTMLDivElement;
   let root: Root;
   const originalUA = navigator.userAgent;

   const renderWith = async (ua: string, isSignUp = true) => {
      Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
      const { SocialAuthButtons } = await import('@/components/auth/SocialAuthButtons');
      await act(async () => {
         root.render(createElement(MemoryRouter, null, createElement(SocialAuthButtons, { isSignUp, onTelegramAuth: vi.fn() })));
      });
   };
   const facebookButtons = () =>
      Array.from(container.querySelectorAll('button')).filter((b) => /Facebook/.test(b.textContent + (b.getAttribute('aria-label') ?? '')));

   beforeEach(() => {
      vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
      localStorage.clear();
      signInWithOAuth.mockClear();
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
      vi.unstubAllEnvs();
      localStorage.clear();
      Object.defineProperty(window.navigator, 'userAgent', { value: originalUA, configurable: true });
   });

   it('is hidden everywhere with the VITE_FACEBOOK_LOGIN_ENABLED=false kill switch (no grayed "coming soon" tile)', async () => {
      vi.stubEnv('VITE_FACEBOOK_LOGIN_ENABLED', 'false');
      await renderWith(FB_ANDROID_UA);
      expect(facebookButtons()).toHaveLength(0);
      expect(container.textContent).not.toContain('Continue with Facebook');
      expect(container.textContent).not.toContain('Soon');
   });

   it("inside Facebook's browser it is the main button, first on the page, and starts Supabase's Facebook OAuth", async () => {
      await renderWith(FB_IOS_UA, false);
      const buttons = facebookButtons();
      expect(buttons).toHaveLength(1);
      expect(buttons[0].textContent).toContain('Continue with Facebook');
      expect(container.querySelector('button, a')).toBe(buttons[0]);
      expect(container.textContent).toContain('Google sign-in works in Safari, not inside Facebook.');

      await act(async () => buttons[0].click());
      expect(signInWithOAuth).toHaveBeenCalledWith({
         provider: 'facebook',
         options: { redirectTo: expect.stringMatching(/\/auth\/confirm$/), scopes: 'email,public_profile' }
      });
      expect(localStorage.getItem('moodeng:last-auth-method')).toBe('facebook');
   });

   it('in a normal browser it is the main button, with Google as a small tile under it (on by default, no env flag)', async () => {
      await renderWith(CHROME_ANDROID_UA);
      const buttons = facebookButtons();
      expect(buttons).toHaveLength(1);
      expect(buttons[0].textContent).toContain('Continue with Facebook');
      expect(container.querySelector('button, a')).toBe(buttons[0]);
      const googleTile = container.querySelector('button[aria-label="Sign Up with Google"]') as HTMLButtonElement;
      expect(googleTile.textContent).toBe('');
      expect(buttons[0].compareDocumentPosition(googleTile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      await act(async () => buttons[0].click());
      expect(signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ provider: 'facebook' }));
      await act(async () => googleTile.click());
      expect(signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ provider: 'google' }));
   });

   it("other apps' browsers (LINE) keep Facebook as a small tile: Facebook blocks its login in their web views", async () => {
      await renderWith(
         'Mozilla/5.0 (Linux; Android 13; SM-A145F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36 Line/14.10.0'
      );
      const { detectInAppBrowser } = await import('@/lib/inAppBrowser');
      expect(detectInAppBrowser().appName).toBe('LINE');
      expect(container.textContent).not.toContain('Continue with Facebook');
   });

   it('?facebook=0 hides it in this browser only, ?facebook=1 brings it back', async () => {
      const { isFacebookLoginEnabled } = await import('@/lib/facebookAuth');
      window.history.replaceState(null, '', '/sign-in?facebook=0');
      expect(isFacebookLoginEnabled()).toBe(false);
      window.history.replaceState(null, '', '/sign-in');
      expect(isFacebookLoginEnabled()).toBe(false);
      window.history.replaceState(null, '', '/sign-in?facebook=1');
      expect(isFacebookLoginEnabled()).toBe(true);
      window.history.replaceState(null, '', '/');
      expect(isFacebookLoginEnabled()).toBe(true);
   });
});

describe('Facebook accounts without an email', () => {
   it("recognises Supabase's missing-email error", async () => {
      const { isMissingProviderEmailError } = await import('@/lib/facebookAuth');
      expect(isMissingProviderEmailError('Error getting user email from external provider')).toBe(true);
      expect(isMissingProviderEmailError('User is banned')).toBe(false);
      expect(isMissingProviderEmailError(null)).toBe(false);
   });
});
