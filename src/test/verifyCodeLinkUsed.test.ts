import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// Tapping "Confirm Email" in the email (often in another browser) uses up the same one-time token,
// so the code then fails in the tab left behind. That tab must point to the password log-in instead
// of leaving a dead end.
const verifyOtp = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/client', () => ({
   getSupabaseBrowserClient: () => ({ auth: { verifyOtp } }),
   isSupabaseBrowserConfigured: () => true
}));
vi.mock('react-redux', () => ({ useDispatch: () => () => ({ unwrap: () => Promise.resolve(null) }) }));
vi.mock('@/components/ThemeToggle', () => ({ ThemeToggle: () => null }));

const { default: AuthVerifyCodePage } = await import('@/app/auth/verify-code/page');

describe('/auth/verify-code after the link was already used', () => {
   let container: HTMLDivElement;
   let root: Root;

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

   beforeEach(async () => {
      verifyOtp.mockReset();
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
      await act(async () => {
         root.render(
            createElement(MemoryRouter, { initialEntries: ['/auth/verify-code?email=new.user%40example.com'] }, createElement(AuthVerifyCodePage))
         );
      });
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
      sessionStorage.clear();
   });

   it('says either the code or the Confirm Email button works', () => {
      expect(container.textContent).toContain('Type the 8-digit code below, or tap Confirm Email in the latest Moodeng email.');
      expect(container.textContent).not.toContain('Already tapped Confirm Email');
   });

   it('a refused code offers the email + password log-in', async () => {
      verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid', code: 'otp_expired' } });
      await typeCode('12345678');
      await submit();
      expect(verifyOtp).toHaveBeenCalledWith({ email: 'new.user@example.com', token: '12345678', type: 'signup' });
      expect(container.textContent).toContain('Already tapped Confirm Email in the email? Your account is ready.');
      const link = Array.from(container.querySelectorAll('a')).find((a) => a.textContent === 'Log in with your email and password');
      expect(link?.getAttribute('href')).toBe('/sign-in');
   });
});
