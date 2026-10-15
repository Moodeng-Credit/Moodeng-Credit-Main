import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

const { default: AuthVerifyCodePage } = await import('@/app/auth/verify-code/page');

describe('/auth/verify-code', () => {
   let container: HTMLDivElement;
   let root: Root;

   const render = async (url: string) => {
      auth.verifyOtpCode.mockClear();
      auth.requestOtpCode.mockClear();
      auth.unwrap.mockReset();
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
      await act(async () => {
         root.render(createElement(MemoryRouter, { initialEntries: [url] }, createElement(AuthVerifyCodePage)));
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
   const submit = async () => {
      await act(async () => {
         container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
   };

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
      sessionStorage.clear();
      localStorage.clear();
   });

   it('email: says either the code or the Confirm Email button works', async () => {
      await render('/auth/verify-code?email=new.user%40example.com');
      expect(container.textContent).toContain('Check your email');
      expect(container.textContent).toContain('Type the 8-digit code below, or tap Confirm Email in the latest Moodeng email.');
      expect(container.textContent).toContain('Wrong email? Change it');
      expect(container.textContent).not.toContain('Already tapped Confirm Email');
   });

   it('email: checks the code as an email OTP; a refused code offers the log-in', async () => {
      await render('/auth/verify-code?email=new.user%40example.com');
      auth.unwrap.mockRejectedValue({ message: 'Token has expired or is invalid', code: 'otp_expired' });
      await typeCode('12345678');
      await submit();
      expect(auth.verifyOtpCode).toHaveBeenCalledWith({ channel: 'email', email: 'new.user@example.com', token: '12345678' });
      expect(container.textContent).toContain('Already tapped Confirm Email in the email? Your account is ready.');
      const link = Array.from(container.querySelectorAll('a')).find((a) => a.textContent === 'Log in');
      expect(link?.getAttribute('href')).toBe('/sign-in');
   });

   it('SMS: shows the number, checks the code as an SMS OTP', async () => {
      await render('/auth/verify-code?phone=%2B639171234567');
      expect(container.textContent).toContain('Check your texts');
      expect(container.textContent).toContain('+63 917 123 4567');
      expect(container.textContent).toContain('Wrong number? Change it');
      expect(container.querySelector('#verification-email')).toBeNull();

      auth.unwrap.mockResolvedValue({ user: { id: 'u1', userRole: null }, isNewUser: true });
      await typeCode('12345678');
      await submit();
      expect(auth.verifyOtpCode).toHaveBeenCalledWith({ channel: 'sms', phone: '+639171234567', token: '12345678' });
   });

   it('SMS: resend asks for a new text to the same number and locks for 60s', async () => {
      await render('/auth/verify-code?phone=%2B639171234567');
      auth.unwrap.mockResolvedValue({ channel: 'sms' });
      const resend = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Resend code'));
      await act(async () => resend?.click());
      expect(auth.requestOtpCode).toHaveBeenCalledWith({ channel: 'sms', phone: '+639171234567' });
      expect(container.textContent).toContain('New code sent. Use the latest text from Moodeng.');
      expect(container.textContent).toMatch(/Resend in \d+s/);
   });

   it('ignores a ?phone= that is not a PH mobile number (falls back to email)', async () => {
      await render('/auth/verify-code?phone=%2B971501234567');
      expect(container.textContent).toContain('Check your email');
      expect(container.querySelector('#verification-email')).not.toBeNull();
   });
});
