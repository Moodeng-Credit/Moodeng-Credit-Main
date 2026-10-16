import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// Guests (email-first sign-up) confirm their email once only KYC is left: approved after the call,
// a lender, or — with the pre-KYC gate off — once Facebook is connected. Never while gated.
const h = vi.hoisted(() => ({
   user: null as Record<string, unknown> | null,
   gate: { isGated: false, isLoading: false },
   inApp: false,
   needsPassword: false
}));
vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }));
vi.mock('react-redux', () => ({
   useDispatch: () => () => ({ unwrap: () => Promise.resolve() }),
   useSelector: (fn: (s: unknown) => unknown) => fn({ auth: { user: h.user } })
}));
vi.mock('@/hooks/usePreKycGate', () => ({ usePreKycGate: () => h.gate }));
vi.mock('@/lib/inAppBrowser', () => ({ detectInAppBrowser: () => ({ isInApp: h.inApp, os: 'android', appName: 'Facebook' }) }));
vi.mock('@/store/slices/authSlice', () => ({
   confirmEmailChange: vi.fn(),
   convertedGuestNeedsPassword: () => Promise.resolve(h.needsPassword),
   fetchUser: vi.fn(),
   getGuestPendingEmail: () => Promise.resolve('juan@example.com'),
   GuestEmailTakenError: class GuestEmailTakenError extends Error {
      name = 'GuestEmailTakenError';
   },
   resendGuestEmail: vi.fn(),
   setGuestPassword: vi.fn()
}));

const { GuestAccountGate } = await import('@/components/GuestAccountGate');

const GUEST = 'guest_abc123@moodeng.app';

describe('GuestAccountGate', () => {
   let container: HTMLDivElement;
   let root: Root;

   const render = async () => {
      await act(async () => {
         root.render(createElement(GuestAccountGate));
      });
      await act(async () => {
         await Promise.resolve();
      });
   };

   beforeEach(() => {
      h.gate = { isGated: false, isLoading: false };
      h.inApp = false;
      h.needsPassword = false;
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
   });

   it('hidden while the pre-KYC gate still holds them, even with Facebook connected', async () => {
      h.user = { id: 'u1', email: GUEST, hasVerifiedContact: true, loanAccessStatus: 'pending' };
      h.gate = { isGated: true, isLoading: false };
      await render();
      expect(container.textContent).toBe('');
   });

   it('approved after the call: asks to confirm, and in Facebook says to tap the emailed button', async () => {
      h.user = { id: 'u1', email: GUEST, hasVerifiedContact: true, loanAccessStatus: 'approved' };
      h.inApp = true;
      await render();
      expect(container.textContent).toContain("You're approved");
      expect(container.textContent).toContain('Moodeng opens in Chrome, already signed in');
      expect(container.textContent).toContain('juan@example.com');
   });

   it('pre-KYC gate off: asks once Facebook is connected', async () => {
      h.user = { id: 'u1', email: GUEST, hasVerifiedContact: true, loanAccessStatus: 'none' };
      await render();
      expect(container.textContent).toContain('Confirm your email');
   });

   it('confirmed by the link in another browser, no password yet: asks for one', async () => {
      h.user = { id: 'u1', email: 'juan@example.com', hasVerifiedContact: true, loanAccessStatus: 'approved' };
      h.needsPassword = true;
      await render();
      expect(container.textContent).toContain('Email confirmed');
      expect(container.querySelector('#guest-password')).not.toBeNull();
   });

   it('a normal account: nothing', async () => {
      h.user = { id: 'u1', email: 'juan@example.com', hasVerifiedContact: true, loanAccessStatus: 'approved' };
      await render();
      expect(container.textContent).toBe('');
   });
});
