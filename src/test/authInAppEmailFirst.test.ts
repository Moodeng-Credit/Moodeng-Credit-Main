import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// /sign-up and /sign-in inside Facebook/Messenger's browser: the passwordless code form (email, or a
// PH phone once SMS is on) leads, Google is only a small "open in Chrome" line, and PostHog gets
// signup/signin_inapp_email_* events.
const analytics = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock('posthog-js', () => ({ default: { capture: analytics.capture } }));
const where = vi.hoisted(() => ({ inPh: false }));
vi.mock('@/lib/isLikelyPhilippines', () => ({ isLikelyPhilippines: () => where.inPh }));

// The register/login thunks never settle here: we only care that the form was submitted.
vi.mock('react-redux', () => ({ useDispatch: () => () => ({ unwrap: () => new Promise(() => {}) }) }));
vi.mock('@/store/slices/authSlice', () => ({
   registerUser: vi.fn(() => ({ type: 'registerUser' })),
   requestOtpCode: vi.fn(() => ({ type: 'requestOtpCode' })),
   registerWithGoogle: vi.fn(),
   registerWithTelegram: vi.fn(),
   loginUser: vi.fn(() => ({ type: 'loginUser' })),
   loginWithGoogle: vi.fn(),
   loginWithTelegram: vi.fn()
}));
vi.mock('@/components/ToastSystem/hooks/useToast', () => ({
   useToast: () => ({ showToast: vi.fn(), showToastByConfig: vi.fn() })
}));
vi.mock('@/lib/supabase/client', () => ({
   getSupabaseBrowserClient: () => ({ auth: { signInWithOAuth: vi.fn() }, rpc: vi.fn() }),
   isSupabaseBrowserConfigured: () => true
}));
vi.mock('@/lib/postSignInPath', () => ({ getPostSignInPath: vi.fn() }));
// Signed out here (useSignedInRedirect has its own test).
vi.mock('@/hooks/useSignedInRedirect', () => ({ useSignedInRedirect: () => false }));
vi.mock('@/components/LineLoginButton', () => ({ default: () => null }));
vi.mock('@/components/TikTokLoginButton', () => ({ default: () => null }));
vi.mock('@/components/auth/TelegramLoginTile', () => ({ default: () => null }));

const { default: SignUpPage } = await import('@/views/signup/SignUpPage');
const { default: SignInPage } = await import('@/views/signin/SignInPage');

const FB_ANDROID_UA =
   'Mozilla/5.0 (Linux; Android 13; SM-A145F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.40.82;]';
const MESSENGER_IOS_UA =
   'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/460.0.0.37.111;]';
const CHROME_ANDROID_UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36';

const events = () => analytics.capture.mock.calls.map(([name]) => name as string);

describe('email first inside Facebook/Messenger', () => {
   let container: HTMLDivElement;
   let root: Root;
   const originalUA = navigator.userAgent;

   const render = async (page: () => JSX.Element, ua: string) => {
      Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
      await act(async () => {
         root.render(createElement(MemoryRouter, null, createElement(page)));
      });
   };
   const buttonWithText = (text: string) =>
      Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) ?? null;
   const isBefore = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
   const type = async (input: HTMLInputElement, value: string) => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      await act(async () => {
         setValue?.call(input, value);
         input.dispatchEvent(new Event('input', { bubbles: true }));
      });
   };
   const submit = async () => {
      const form = container.querySelector('form') as HTMLFormElement;
      await act(async () => {
         form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
   };

   beforeEach(() => {
      // These tests are about the sign-up form, so skip the "Who invited you?" screen before it.
      window.localStorage.setItem('md_code_step', String(Date.now()));
      vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
      vi.stubEnv('PROD', true);
      analytics.capture.mockClear();
      where.inPh = false;
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

   it('/sign-up in Facebook: Continue with Facebook first, the email code form under it (Facebook login is on)', async () => {
      await render(SignUpPage, FB_ANDROID_UA);
      const firstControl = container.querySelector('button, a, input');
      expect(firstControl?.textContent).toContain('Continue with Facebook');
      expect(container.querySelector('form input[type="email"]')).not.toBeNull();
      expect(buttonWithText('Continue')).not.toBeNull();
      expect(container.textContent).not.toContain('Sign Up with Google');
   });

   it('/sign-up in Facebook with the kill switch off: the code form, nothing else (no Google, Telegram/LINE, tour or company lines)', async () => {
      vi.stubEnv('VITE_FACEBOOK_LOGIN_ENABLED', 'false');
      await render(SignUpPage, FB_ANDROID_UA);
      expect(container.textContent).toContain('Sign up to Moodeng');
      expect(container.querySelector('input[type="password"]')).toBeNull();
      const continueButton = buttonWithText('Continue');
      expect(continueButton).not.toBeNull();
      // The code form (its field, then Continue) comes before any sign-in provider.
      const firstControl = container.querySelector('button, a, input');
      expect(firstControl && container.querySelector('form')?.contains(firstControl)).toBe(true);
      expect(container.textContent).toContain("Used Google before? Type your Gmail and we'll email you a code.");
      expect(container.textContent).not.toContain('Signed up with Telegram or LINE?');
      expect(container.textContent).not.toContain('Google sign-in works in');
      expect(container.textContent).not.toContain('Take a tour first');
      expect(container.textContent).not.toContain('Building Credit Asia LLC');
      expect(container.querySelector('a[href="/academy"]')?.textContent).toBe('How it works');
      expect(container.textContent).not.toContain('Sign Up with Google');
      expect(container.querySelector('path[fill="#4285F4"]')).toBeNull();
      expect(analytics.capture).toHaveBeenCalledWith('signup_inapp_email_shown', { app: 'Facebook', os: 'android' });
   });

   it('/sign-up in Messenger: submitting the email form is tracked', async () => {
      await render(SignUpPage, MESSENGER_IOS_UA);
      await type(container.querySelector('input[type="email"]') as HTMLInputElement, 'new.user@example.com');
      await submit();
      expect(analytics.capture).toHaveBeenCalledWith('signup_inapp_email_submitted', { app: 'Messenger', os: 'ios' });
   });

   const googleTile = (label: string) => container.querySelector(`button[aria-label="${label}"]`);

   it('/sign-up in Chrome: Facebook first, Google a small tile under it, then email; no in-app events', async () => {
      await render(SignUpPage, CHROME_ANDROID_UA);
      const facebook = buttonWithText('Continue with Facebook');
      const google = googleTile('Sign Up with Google');
      const email = buttonWithText('Sign Up with Email');
      expect(container.querySelector('button, a, input')).toBe(facebook);
      expect(facebook && google && email && isBefore(facebook, google) && isBefore(google, email)).toBe(true);
      expect(container.textContent).not.toContain('8-digit code');
      expect(events()).toEqual([]);
   });

   it('/sign-in in Facebook: Continue with Facebook, then the code form (no Google line, password link, tour or company lines)', async () => {
      await render(SignInPage, FB_ANDROID_UA);
      expect(container.querySelector('form')).not.toBeNull();
      const facebook = buttonWithText('Continue with Facebook') as HTMLButtonElement;
      expect(container.querySelector('button, a, input')).toBe(facebook);
      expect(isBefore(facebook, container.querySelector('form') as HTMLFormElement)).toBe(true);
      expect(container.textContent).not.toContain('Google sign-in works in');
      expect(container.textContent).not.toContain('Sign In with Google');
      expect(container.textContent).not.toContain('Take a tour first');
      expect(container.textContent).not.toContain('Building Credit Asia LLC');
      expect(analytics.capture).toHaveBeenCalledWith('signin_inapp_email_shown', { app: 'Facebook', os: 'android' });

      expect(container.querySelector('input[type="password"]')).toBeNull();
      expect(buttonWithText('password')).toBeNull();
      await type(container.querySelector('input[type="email"]') as HTMLInputElement, 'me@example.com');
      await submit();
      expect(analytics.capture).toHaveBeenCalledWith('signin_inapp_email_submitted', { app: 'Facebook', os: 'android' });
   });

   it('/sign-in in Chrome: Facebook first, Google tile, then the email + password form, which offers a code instead', async () => {
      await render(SignInPage, CHROME_ANDROID_UA);
      const facebook = buttonWithText('Continue with Facebook') as HTMLButtonElement;
      const google = googleTile('Sign In with Google') as HTMLButtonElement;
      expect(container.querySelector('button, a, input')).toBe(facebook);
      expect(isBefore(facebook, google)).toBe(true);
      expect(isBefore(google, container.querySelector('form') as HTMLFormElement)).toBe(true);
      expect(container.querySelector('input[type="password"]')).not.toBeNull();
      expect(buttonWithText('Email me a code')).not.toBeNull();
      expect(events()).toEqual([]);
   });
   it('/sign-in in Chrome, in the Philippines: Facebook, then the +63 number box, Google tile under it', async () => {
      where.inPh = true;
      await render(SignInPage, CHROME_ANDROID_UA);
      const phone = container.querySelector('#otp-input') as HTMLInputElement;
      expect(phone.type).toBe('tel');
      expect(container.textContent).toContain('+63');
      expect(buttonWithText('Text me a code')).not.toBeNull();
      expect(container.querySelector('input[type="password"]')).toBeNull();
      const facebook = buttonWithText('Continue with Facebook') as HTMLButtonElement;
      expect(container.querySelector('button, a, input')).toBe(facebook);
      expect(isBefore(facebook, phone)).toBe(true);
      expect(container.querySelectorAll('button[aria-label="Continue with Facebook"]')).toHaveLength(0);
      const google = googleTile('Sign In with Google') as HTMLButtonElement;
      expect(isBefore(phone, google)).toBe(true);
      // Password sign-in is one step away, on the email screen.
      expect(buttonWithText('password')).toBeNull();
      await act(async () => (buttonWithText('email') as HTMLButtonElement).click());
      expect(buttonWithText('password')).not.toBeNull();
   });
});
