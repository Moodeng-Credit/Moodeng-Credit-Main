import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// /auth/verify-code checks email codes (sign-up confirmation or passwordless sign-in) and SMS codes.
// Tapping "Confirm Email" in the email (often in another browser) uses up the same one-time token,
// so the code then fails in the tab left behind. That tab must point to the log-in instead of a dead end.
const auth = vi.hoisted(() => ({
   verifyOtpCode: vi.fn((args: unknown) => ({ type: 'verifyOtpCode', args })),
   requestOtpCode: vi.fn((args: unknown) => ({ type: 'requestOtpCode', args })),
   unwrap: vi.fn()
}));
vi.mock('@/store/slices/authSlice', () => ({ verifyOtpCode: auth.verifyOtpCode, requestOtpCode: auth.requestOtpCode }));
vi.mock('react-redux', () => ({ useDispatch: () => () => ({ unwrap: auth.unwrap }) }));
vi.mock('@/lib/supabase/client', () => ({ isSupabaseBrowserConfigured: () => true }));
vi.mock('@/lib/postSignInPath', () => ({ getPostSignInPath: vi.fn(async () => '/dashboard') }));
vi.mock('@/components/ThemeToggle', () => ({ ThemeToggle: () => null }));

const { default: AuthVerifyCodePage, describeRefusedCode } = await import('@/app/auth/verify-code/page');

function Where() {
   const location = useLocation();
   return createElement('p', { 'data-testid': 'where' }, `${location.pathname}${location.search}`);
}

describe('describeRefusedCode', () => {
   it('tells an expired code from a wrong one by when it was sent', () => {
      const sentAt = 1_000_000;
      expect(describeRefusedCode(true, sentAt, sentAt + 60_000)).toBe('That code is wrong. Check the latest text from Moodeng.');
      expect(describeRefusedCode(true, sentAt, sentAt + 11 * 60_000)).toBe('This code expired. Tap Resend for a new one.');
      expect(describeRefusedCode(false, sentAt, sentAt + 30 * 60_000)).toBe('That code is wrong. Check the latest email from Moodeng.');
      expect(describeRefusedCode(false, null)).toBe('That code is wrong. Check the latest email from Moodeng.');
   });
});

describe('/auth/verify-code', () => {
   let container: HTMLDivElement;
   let root: Root;

   const render = async (url: string) => {
      await act(async () => {
         root.render(
            createElement(
               MemoryRouter,
               { initialEntries: [url] },
               createElement(
                  Routes,
                  null,
                  createElement(Route, { path: '/auth/verify-code', element: createElement(AuthVerifyCodePage) }),
                  createElement(Route, { path: '*', element: createElement(Where) })
               )
            )
         );
      });
   };
   const typeCode = async (value: string) => {
      const input = container.querySelector('#verification-code') as HTMLInputElement;
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      await act(async () => {
         setValue?.call(input, value);
         input.dispatchEvent(new Event('input', { bubbles: true }));
      });
   };
   const where = () => container.querySelector('[data-testid="where"]')?.textContent;

   beforeEach(() => {
      auth.verifyOtpCode.mockClear();
      auth.requestOtpCode.mockClear();
      auth.unwrap.mockReset();
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
      sessionStorage.clear();
      localStorage.clear();
      vi.useRealTimers();
   });

   it('email: shows the address big with Change, and says the code or the button works', async () => {
      await render('/auth/verify-code?email=new.user%40example.com');
      expect(container.textContent).toContain('Check your email');
      expect(container.textContent).toContain('new.user@example.com');
      expect(container.textContent).toContain('Change');
      expect(container.textContent).toContain('Type the 8-digit code below, or tap Confirm Email in the latest Moodeng email.');
      expect((container.querySelector('#verification-code') as HTMLInputElement).placeholder).toBe('00000000');
      expect(container.textContent).not.toContain('Already tapped Confirm Email');
   });

   it('email: the 8th digit checks the code by itself; a refused code says wrong and offers the log-in', async () => {
      await render('/auth/verify-code?email=new.user%40example.com');
      auth.unwrap.mockRejectedValue({ message: 'Token has expired or is invalid', code: 'otp_expired' });
      await typeCode('12345678');
      expect(auth.verifyOtpCode).toHaveBeenCalledTimes(1);
      expect(auth.verifyOtpCode).toHaveBeenCalledWith({ channel: 'email', email: 'new.user@example.com', token: '12345678' });
      expect(container.textContent).toContain('That code is wrong. Check the latest email from Moodeng.');
      expect(container.textContent).toContain('Already tapped Confirm Email in the email? Your account is ready.');
      const link = Array.from(container.querySelectorAll('a')).find((a) => a.textContent === 'Log in');
      expect(link?.getAttribute('href')).toBe('/sign-in');
   });

   it('SMS: the number big in local format, the sender line, a 6-digit box that submits itself', async () => {
      await render('/auth/verify-code?phone=%2B639171234567');
      expect(container.textContent).toContain('Check your texts');
      expect(container.textContent).toContain('0917 123 4567');
      expect(container.textContent).toContain('Look for a text from Unisoft.');
      expect(container.textContent).toContain('Never share it with anyone.');
      expect(container.textContent).toContain('Usually under a minute.');
      expect(container.querySelector('#verification-email')).toBeNull();
      expect((container.querySelector('#verification-code') as HTMLInputElement).placeholder).toBe('000000');

      auth.unwrap.mockResolvedValue({ user: { id: 'u1', userRole: null }, isNewUser: true });
      await typeCode('123456');
      expect(auth.verifyOtpCode).toHaveBeenCalledWith({ channel: 'sms', phone: '+639171234567', token: '123456' });
      expect(where()).toBe('/auth-success?type=created&new=1');
   });

   it('an existing account with no role goes to the role screen, not "Account created"', async () => {
      await render('/auth/verify-code?phone=%2B639171234567');
      auth.unwrap.mockResolvedValue({ user: { id: 'u1', userRole: null }, isNewUser: false });
      await typeCode('123456');
      expect(where()).toBe('/onboarding/role');
   });

   it('SMS: resend asks for a new text to the same number (same mode) and locks for 60s', async () => {
      localStorage.setItem(
         'moodeng:pending-code',
         JSON.stringify({
            channel: 'sms',
            target: '+639171234567',
            mode: 'signup',
            sentAt: Date.now(),
            expiresAt: Date.now() + 600_000,
            resends: 0
         })
      );
      await render('/auth/verify-code?phone=%2B639171234567');
      auth.unwrap.mockResolvedValue({ channel: 'sms' });
      const resend = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Resend code'));
      await act(async () => resend?.click());
      expect(auth.requestOtpCode).toHaveBeenCalledWith({ channel: 'sms', phone: '+639171234567', mode: 'signup' });
      expect(container.textContent).toContain('New code sent. Use the latest text from Moodeng.');
      expect(container.textContent).toMatch(/Resend in \d+s/);
      expect(JSON.parse(localStorage.getItem('moodeng:pending-code') ?? '{}').resends).toBe(1);
   });

   it('waiting help: tips after 30s; after two resends, email instead or Messenger', async () => {
      const sentAt = Date.now() - 45_000;
      localStorage.setItem(
         'moodeng:pending-code',
         JSON.stringify({ channel: 'sms', target: '+639171234567', mode: 'signin', sentAt, expiresAt: sentAt + 600_000, resends: 2 })
      );
      await render('/auth/verify-code?phone=%2B639171234567');
      expect(container.textContent).toContain('Not here yet? Look for a text from Unisoft, check your signal and Messages › Spam.');
      expect(container.textContent).toContain('Get the code by email instead');
      expect(container.textContent).toContain('Message us on Messenger');
   });

   it('a killed page comes back: no URL params, the saved code target is used', async () => {
      localStorage.setItem(
         'moodeng:pending-code',
         JSON.stringify({
            channel: 'sms',
            target: '+639171234567',
            mode: 'signin',
            sentAt: Date.now(),
            expiresAt: Date.now() + 600_000,
            resends: 0
         })
      );
      await render('/auth/verify-code');
      expect(container.textContent).toContain('Check your texts');
      expect(container.textContent).toContain('0917 123 4567');
   });

   it('ignores a ?phone= that is not a PH mobile number (falls back to email)', async () => {
      await render('/auth/verify-code?phone=%2B971501234567');
      expect(container.textContent).toContain('Check your email');
      expect(container.querySelector('#verification-email')).not.toBeNull();
   });
});
