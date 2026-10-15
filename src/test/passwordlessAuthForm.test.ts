import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { detectInAppBrowser } from '@/lib/inAppBrowser';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// The passwordless form: ONE field with a 📱 +63 / ✉️ pill. Phone first for visitors in the
// Philippines (or whatever they used last time); letters/@ switch to email, digits to phone; a
// non-PH number moves them to email; sign-in never creates an account.
const h = vi.hoisted(() => ({
   capture: vi.fn(),
   requestOtpCode: vi.fn((args: unknown) => ({ type: 'requestOtpCode', args })),
   unwrap: vi.fn(),
   rpc: vi.fn(),
   inPh: true
}));
vi.mock('posthog-js', () => ({ default: { capture: h.capture } }));
vi.mock('react-redux', () => ({ useDispatch: () => () => ({ unwrap: h.unwrap }) }));
vi.mock('@/store/slices/authSlice', () => ({ requestOtpCode: h.requestOtpCode }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseBrowserClient: () => ({ rpc: h.rpc }) }));
vi.mock('@/lib/isLikelyPhilippines', () => ({ isLikelyPhilippines: () => h.inPh }));

const { PasswordlessAuthForm, pickInitialChannel } = await import('@/components/auth/PasswordlessAuthForm');

const CHROME_UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36';
const FB_UA =
   'Mozilla/5.0 (Linux; Android 13; SM-A145F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.40.82;]';
const INSTAGRAM_UA =
   'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0';

function Where() {
   const location = useLocation();
   return createElement('p', { 'data-testid': 'where' }, `${location.pathname}${location.search}`);
}

describe('pickInitialChannel', () => {
   const base = { smsEnabled: true, inPhilippines: false };
   it('last used phone/email wins, then the Philippines guess', () => {
      expect(pickInitialChannel({ ...base, lastUsed: 'phone' })).toBe('sms');
      expect(pickInitialChannel({ ...base, inPhilippines: true, lastUsed: 'email' })).toBe('email');
      expect(pickInitialChannel({ ...base, inPhilippines: true, lastUsed: 'google' })).toBe('email');
      expect(pickInitialChannel({ ...base, inPhilippines: true, lastUsed: 'telegram' })).toBe('sms');
      expect(pickInitialChannel({ ...base, inPhilippines: true })).toBe('sms');
      expect(pickInitialChannel(base)).toBe('email');
   });
   it('explicit choices beat the guesses; no SMS means email', () => {
      expect(pickInitialChannel({ ...base, method: 'phone', lastUsed: 'email' })).toBe('sms');
      expect(pickInitialChannel({ ...base, initialChannel: 'sms' })).toBe('sms');
      expect(pickInitialChannel({ ...base, initialEmail: 'a@b.co', lastUsed: 'phone' })).toBe('email');
      expect(pickInitialChannel({ smsEnabled: false, inPhilippines: true, lastUsed: 'phone' })).toBe('email');
   });
});

describe('PasswordlessAuthForm', () => {
   let container: HTMLDivElement;
   let root: Root;

   const render = async (props: { mode: 'signin' | 'signup'; ua?: string; initialChannel?: 'sms' | 'email' }) => {
      const inApp = detectInAppBrowser(props.ua ?? CHROME_UA);
      await act(async () => {
         root.render(
            createElement(
               MemoryRouter,
               { initialEntries: ['/sign-up'] },
               createElement(
                  Routes,
                  null,
                  createElement(Route, {
                     path: '/sign-up',
                     element: createElement(PasswordlessAuthForm, { mode: props.mode, inApp, initialChannel: props.initialChannel })
                  }),
                  createElement(Route, { path: '/auth/verify-code', element: createElement(Where) })
               )
            )
         );
      });
   };
   const input = () => container.querySelector('#otp-input') as HTMLInputElement;
   const type = async (value: string) => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      await act(async () => {
         setValue?.call(input(), value);
         input().dispatchEvent(new Event('input', { bubbles: true }));
      });
      await act(async () => {
         await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      });
   };
   const submit = async () => {
      await act(async () => {
         container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
   };
   const button = (text: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
   const where = () => container.querySelector('[data-testid="where"]')?.textContent;

   beforeEach(() => {
      vi.stubEnv('PROD', true);
      vi.stubEnv('VITE_SMS_LOGIN_ENABLED', 'true');
      h.capture.mockClear();
      h.requestOtpCode.mockClear();
      h.unwrap.mockReset();
      h.rpc.mockReset();
      h.inPh = true;
      localStorage.clear();
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
      vi.unstubAllEnvs();
      localStorage.clear();
      sessionStorage.clear();
   });

   it('in the Philippines: one phone field with the 📱 +63 pill, "0917 123 4567", no password, no tabs', async () => {
      await render({ mode: 'signup' });
      expect(input().type).toBe('tel');
      expect(input().placeholder).toBe('0917 123 4567');
      expect(container.textContent).toContain('📱');
      expect(container.textContent).toContain('+63');
      expect(container.textContent).toContain('Philippine numbers only.');
      expect(button('Use email instead')).toBeDefined();
      expect(container.querySelector('[role="tablist"]')).toBeNull();
      expect(container.querySelector('input[type="password"]')).toBeNull();
      expect(container.querySelector('button[type="submit"]')?.textContent).toBe('Continue');
   });

   it('the pill and the link switch between phone and email', async () => {
      await render({ mode: 'signup' });
      await act(async () => (container.querySelector('button[aria-label^="Using phone"]') as HTMLButtonElement).click());
      expect(input().type).toBe('email');
      expect(container.textContent).toContain('✉️');
      await act(async () => button('Use phone number instead')?.click());
      expect(input().type).toBe('tel');
   });

   it('typing a letter or @ in the phone field switches to email, keeping what was typed', async () => {
      await render({ mode: 'signup' });
      await type('maria');
      expect(input().type).toBe('email');
      expect(input().value).toBe('maria');
   });

   it('typing digits in the email field switches to phone', async () => {
      h.inPh = false;
      await render({ mode: 'signup' });
      expect(input().type).toBe('email');
      await type('0917');
      expect(input().type).toBe('tel');
      expect(input().value).toBe('0917');
   });

   it('in-app browsers get the plain helper lines and the Telegram/LINE way out', async () => {
      await render({ mode: 'signup', ua: FB_UA });
      expect(container.textContent).toContain("We'll text you a code. No password.");
      expect(container.textContent).toContain('Signed up with Telegram or LINE?');
      await act(async () => button('Use email instead')?.click());
      expect(container.textContent).toContain("Used Google before? Type your Gmail and we'll email you a code.");
   });

   it('no SMS yet: email only, no pill switch or phone link', async () => {
      vi.stubEnv('VITE_SMS_LOGIN_ENABLED', '');
      await render({ mode: 'signup' });
      expect(input().type).toBe('email');
      expect(button('Use phone number instead')).toBeUndefined();
      await type('0917');
      expect(input().type).toBe('email');
   });

   it('pasting a non-PH number says so, switches to email and focuses it (and stays on email)', async () => {
      await render({ mode: 'signup' });
      await type('+971 50 123 4567');
      expect(container.textContent).toContain('SMS codes work for Philippine numbers only. Use your email instead');
      expect(input().type).toBe('email');
      expect(document.activeElement).toBe(input());
      expect(h.capture).toHaveBeenCalledWith('sms_non_ph_redirected', { source: 'input', mode: 'signup', in_app_browser: null });
      await type('7');
      expect(input().type).toBe('email');
      expect(h.requestOtpCode).not.toHaveBeenCalled();
   });

   it('sign-up texts a code to the E.164 number (creating the account) and goes to the code screen', async () => {
      h.unwrap.mockResolvedValue({ channel: 'sms' });
      await render({ mode: 'signup', ua: FB_UA });
      await type('0917 123 4567');
      await submit();
      expect(h.requestOtpCode).toHaveBeenCalledWith({ channel: 'sms', phone: '+639171234567', mode: 'signup' });
      expect(where()).toBe('/auth/verify-code?phone=%2B639171234567');
      expect(JSON.parse(localStorage.getItem('moodeng:pending-code') ?? '{}')).toMatchObject({
         channel: 'sms',
         target: '+639171234567',
         mode: 'signup'
      });
      expect(h.capture).toHaveBeenCalledWith('otp_requested', {
         channel: 'sms',
         new_user: null,
         mode: 'signup',
         in_app_browser: 'Facebook'
      });
   });

   it('sign-in with a number that has no account offers Create account / Use email instead', async () => {
      h.unwrap.mockRejectedValueOnce({ message: 'Signups not allowed for otp', code: 'otp_disabled' });
      await render({ mode: 'signin' });
      await type('09171234567');
      await submit();
      expect(h.requestOtpCode).toHaveBeenLastCalledWith({ channel: 'sms', phone: '+639171234567', mode: 'signin' });
      expect(container.textContent).toContain('No Moodeng account uses this number.');
      expect(button('Use email instead')).toBeDefined();
      h.unwrap.mockResolvedValueOnce({ channel: 'sms' });
      await act(async () => button('Create account')?.click());
      expect(h.requestOtpCode).toHaveBeenLastCalledWith({ channel: 'sms', phone: '+639171234567', mode: 'signup' });
      expect(where()).toBe('/auth/verify-code?phone=%2B639171234567');
   });

   it('an incomplete number is not sent', async () => {
      await render({ mode: 'signup' });
      await type('0917 12');
      await submit();
      expect(h.requestOtpCode).not.toHaveBeenCalled();
      expect(container.textContent).toContain('Enter a Philippine mobile number, like 0917 123 4567.');
   });

   it('the hook refusing the number also moves them to email', async () => {
      h.unwrap.mockRejectedValue({ message: 'SMS codes work for Philippine numbers only. Use your email instead.', status: 400 });
      await render({ mode: 'signup' });
      await type('09171234567');
      await submit();
      expect(input().type).toBe('email');
      expect(h.capture).toHaveBeenCalledWith('sms_non_ph_redirected', { source: 'hook', mode: 'signup', in_app_browser: null });
   });

   it('emails a code (lower-cased), tracks new_user from email_exists, and goes to the code screen', async () => {
      h.inPh = false;
      h.unwrap.mockResolvedValue({ channel: 'email' });
      h.rpc.mockResolvedValue({ data: false, error: null });
      await render({ mode: 'signin', ua: INSTAGRAM_UA });
      await type(' Maria@Example.com ');
      await submit();
      expect(h.requestOtpCode).toHaveBeenCalledWith({ channel: 'email', email: 'maria@example.com', mode: 'signin' });
      expect(where()).toBe('/auth/verify-code?email=maria%40example.com');
      expect(h.rpc).toHaveBeenCalledWith('email_exists', { p_email: 'maria@example.com' });
      expect(h.capture).toHaveBeenCalledWith('otp_requested', {
         channel: 'email',
         new_user: true,
         mode: 'signin',
         in_app_browser: 'Instagram'
      });
   });

   it('starts with what they used last time', async () => {
      localStorage.setItem('moodeng:last-auth-method', 'email');
      await render({ mode: 'signin' });
      expect(input().type).toBe('email');
      expect(container.querySelector('button[type="submit"]')?.textContent).toBe('Email me a code');
   });

   it('sign-in buttons can open it on a given mode', async () => {
      h.inPh = false;
      await render({ mode: 'signin', initialChannel: 'sms' });
      expect(input().type).toBe('tel');
      expect(container.querySelector('button[type="submit"]')?.textContent).toBe('Text me a code');
   });
});
