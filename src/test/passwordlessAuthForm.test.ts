import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { detectInAppBrowser } from '@/lib/inAppBrowser';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// The passwordless form: phone tab (PH only, +63) for visitors in the Philippines, email always;
// a non-PH number moves them to email; requests go out as E.164 and are tracked in PostHog.
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

const { PasswordlessAuthForm } = await import('@/components/auth/PasswordlessAuthForm');

const CHROME_UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36';
const FB_UA =
   'Mozilla/5.0 (Linux; Android 13; SM-A145F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.40.82;]';

function Where() {
   const location = useLocation();
   return createElement('p', { 'data-testid': 'where' }, `${location.pathname}${location.search}`);
}

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
   const type = async (input: HTMLInputElement, value: string) => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      await act(async () => {
         setValue?.call(input, value);
         input.dispatchEvent(new Event('input', { bubbles: true }));
      });
   };
   const submit = async () => {
      await act(async () => {
         container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
   };
   const tab = (name: string) => Array.from(container.querySelectorAll('[role="tab"]')).find((t) => t.textContent?.includes(name));
   const where = () => container.querySelector('[data-testid="where"]')?.textContent;

   beforeEach(() => {
      vi.stubEnv('PROD', true);
      vi.stubEnv('VITE_SMS_LOGIN_ENABLED', 'true');
      h.capture.mockClear();
      h.requestOtpCode.mockClear();
      h.unwrap.mockReset();
      h.rpc.mockReset();
      h.inPh = true;
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

   it('opens on the phone tab in the Philippines, with the fixed +63 prefix and no password field', async () => {
      await render({ mode: 'signup' });
      expect(tab('Phone')?.getAttribute('aria-selected')).toBe('true');
      expect(container.textContent).toContain('🇵🇭 +63');
      expect(container.textContent).toContain('Philippine numbers only for now. Not in the Philippines?');
      expect(container.querySelector('input[type="password"]')).toBeNull();
      expect(container.querySelector('select')).toBeNull();
      expect(container.querySelector('button[type="submit"]')?.textContent).toBe('Continue');
   });

   it('opens on email outside the Philippines; email is always there', async () => {
      h.inPh = false;
      await render({ mode: 'signup' });
      expect(tab('Email')?.getAttribute('aria-selected')).toBe('true');
      expect(container.querySelector('input[type="email"]')).not.toBeNull();
   });

   it('no phone tab until SMS login is switched on', async () => {
      vi.stubEnv('VITE_SMS_LOGIN_ENABLED', '');
      await render({ mode: 'signup' });
      expect(container.querySelector('[role="tablist"]')).toBeNull();
      expect(container.querySelector('input[type="email"]')).not.toBeNull();
   });

   it('pasting a non-PH number says so, switches to email and focuses it', async () => {
      await render({ mode: 'signup' });
      await type(container.querySelector('#otp-phone') as HTMLInputElement, '+971 50 123 4567');
      expect(container.textContent).toContain('SMS codes work for Philippine numbers only. Use your email instead');
      expect(tab('Email')?.getAttribute('aria-selected')).toBe('true');
      expect(document.activeElement).toBe(container.querySelector('input[type="email"]'));
      expect(h.capture).toHaveBeenCalledWith('sms_non_ph_redirected', { source: 'input', mode: 'signup', in_app_browser: null });
      expect(h.requestOtpCode).not.toHaveBeenCalled();
   });

   it('texts a code to the E.164 number and goes to the code screen', async () => {
      h.unwrap.mockResolvedValue({ channel: 'sms' });
      await render({ mode: 'signup', ua: FB_UA });
      await type(container.querySelector('#otp-phone') as HTMLInputElement, '0917 123 4567');
      await submit();
      expect(h.requestOtpCode).toHaveBeenCalledWith({ channel: 'sms', phone: '+639171234567' });
      expect(where()).toBe('/auth/verify-code?phone=%2B639171234567');
      expect(h.capture).toHaveBeenCalledWith('otp_requested', {
         channel: 'sms',
         new_user: null,
         mode: 'signup',
         in_app_browser: 'Facebook'
      });
   });

   it('an incomplete number is not sent', async () => {
      await render({ mode: 'signup' });
      await type(container.querySelector('#otp-phone') as HTMLInputElement, '0917 12');
      await submit();
      expect(h.requestOtpCode).not.toHaveBeenCalled();
      expect(container.textContent).toContain('Enter a Philippine mobile number, like 0917 123 4567.');
   });

   it('the hook refusing the number also moves them to email', async () => {
      h.unwrap.mockRejectedValue({ message: 'SMS codes work for Philippine numbers only. Use your email instead.', status: 400 });
      await render({ mode: 'signup' });
      await type(container.querySelector('#otp-phone') as HTMLInputElement, '09171234567');
      await submit();
      expect(tab('Email')?.getAttribute('aria-selected')).toBe('true');
      expect(h.capture).toHaveBeenCalledWith('sms_non_ph_redirected', { source: 'hook', mode: 'signup', in_app_browser: null });
   });

   it('emails a code (lower-cased), tracks new_user from email_exists, and goes to the code screen', async () => {
      h.inPh = false;
      h.unwrap.mockResolvedValue({ channel: 'email' });
      h.rpc.mockResolvedValue({ data: false, error: null });
      await render({ mode: 'signin' });
      await type(container.querySelector('input[type="email"]') as HTMLInputElement, ' Maria@Example.com ');
      await submit();
      expect(h.requestOtpCode).toHaveBeenCalledWith({ channel: 'email', email: 'maria@example.com' });
      expect(where()).toBe('/auth/verify-code?email=maria%40example.com');
      expect(h.rpc).toHaveBeenCalledWith('email_exists', { p_email: 'maria@example.com' });
      expect(h.capture).toHaveBeenCalledWith('otp_requested', { channel: 'email', new_user: true, mode: 'signin', in_app_browser: null });
   });

   it('sign-in buttons can open it on a given tab', async () => {
      h.inPh = false;
      await render({ mode: 'signin', initialChannel: 'sms' });
      expect(tab('Phone')?.getAttribute('aria-selected')).toBe('true');
      expect(container.querySelector('button[type="submit"]')?.textContent).toBe('Text me a code');
   });
});
