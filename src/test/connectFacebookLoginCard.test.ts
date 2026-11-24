import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// Dashboard "Next time, just tap Facebook": existing (phone/email/Google) accounts attach Facebook so
// "Continue with Facebook" opens THEIR account instead of making an empty one.
const h = vi.hoisted(() => ({
   identities: [{ provider: 'phone' }] as Array<{ provider: string }>,
   linkIdentity: vi.fn(async () => ({ data: {}, error: null as Error | null })),
   showToast: vi.fn(),
   inApp: { isInApp: false, appName: null as string | null, os: 'ios' }
}));
vi.mock('@/lib/supabase/client', () => ({
   getSupabaseBrowserClient: () => ({
      auth: {
         getUserIdentities: async () => ({ data: { identities: h.identities }, error: null }),
         linkIdentity: h.linkIdentity
      }
   })
}));
vi.mock('@/lib/authRedirect', () => ({ getAuthRedirectUrl: () => 'https://moodeng.app/auth/confirm' }));
vi.mock('@/lib/inAppBrowser', () => ({ detectInAppBrowser: () => h.inApp }));
vi.mock('react-redux', () => ({
   useSelector: (select: (state: unknown) => unknown) => select({ auth: { user: { id: 'u1' } } })
}));
vi.mock('@/components/ToastSystem/hooks/useToast', () => ({ useToast: () => ({ showToast: h.showToast }) }));

const { ConnectFacebookLoginCard } = await import('@/components/account/ConnectFacebookLoginCard');
const { markFacebookConnectPending, rememberFacebookConnectError, isFacebookTakenError } = await import('@/lib/facebookConnect');

let container: HTMLDivElement;
let root: Root;

async function render(language: 'en' | 'fil' = 'en') {
   await act(async () => root.render(createElement(ConnectFacebookLoginCard, { language })));
   await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
   });
}

const button = (label: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === label);

describe('ConnectFacebookLoginCard', () => {
   beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
      h.identities = [{ provider: 'phone' }];
      h.inApp = { isInApp: false, appName: null, os: 'ios' };
      h.linkIdentity.mockClear();
      h.showToast.mockClear();
      sessionStorage.clear();
      localStorage.clear();
   });
   afterEach(() => {
      act(() => root.unmount());
      container.remove();
   });

   it('phone account in a normal browser: one Connect button that links Facebook to this account', async () => {
      await render();
      expect(container.textContent).toContain('Next time, just tap Facebook');
      await act(async () => button('Connect')?.click());
      expect(h.linkIdentity).toHaveBeenCalledWith({
         provider: 'facebook',
         options: { redirectTo: 'https://moodeng.app/auth/confirm', scopes: 'email,public_profile' }
      });
   });

   it('hidden once Facebook is connected, for guests, and inside TikTok (Facebook blocks login there)', async () => {
      h.identities = [{ provider: 'phone' }, { provider: 'facebook' }];
      await render();
      expect(container.textContent).toBe('');
      h.identities = [];
      await render();
      expect(container.textContent).toBe('');
      h.identities = [{ provider: 'email' }];
      h.inApp = { isInApp: true, appName: 'TikTok', os: 'android' };
      await render();
      expect(container.textContent).toBe('');
   });

   it('shows inside Messenger, in Filipino when the dashboard is in Filipino', async () => {
      h.inApp = { isInApp: true, appName: 'Messenger', os: 'android' };
      await render('fil');
      expect(container.textContent).toContain('Sa susunod, i-tap lang ang Facebook');
   });

   it('back from Facebook and connected: a success toast, card gone', async () => {
      markFacebookConnectPending();
      h.identities = [{ provider: 'phone' }, { provider: 'facebook' }];
      await render();
      expect(h.showToast).toHaveBeenCalledWith('success', 'Facebook connected', 'Next time, tap Continue with Facebook.');
      expect(container.textContent).toBe('');
   });

   it('back from Facebook but it belongs to another account: says so instead of silently doing nothing', async () => {
      markFacebookConnectPending();
      rememberFacebookConnectError('Identity is already linked to another user');
      await render();
      expect(container.textContent).toContain('This Facebook is already on another Moodeng account');
      expect(sessionStorage.length).toBe(0);
   });

   it('link refused before leaving (e.g. manual linking off): error on the card, button usable again', async () => {
      h.linkIdentity.mockResolvedValueOnce({ data: {}, error: new Error('Manual linking is disabled') });
      await render();
      await act(async () => button('Connect')?.click());
      expect(container.textContent).toContain('Facebook didn’t connect. Please try again.');
      expect(button('Connect')).toBeTruthy();
      expect(sessionStorage.length).toBe(0);
   });

   it('"Not now" hides it for a week on this device', async () => {
      await render();
      await act(async () => (container.querySelector('button[aria-label="Not now"]') as HTMLButtonElement).click());
      expect(container.textContent).toBe('');
      await render();
      expect(container.textContent).toBe('');
   });

   it('only remembers a returned error while a connect is in flight', () => {
      rememberFacebookConnectError('access_denied');
      expect(sessionStorage.length).toBe(0);
      expect(isFacebookTakenError('Identity is already linked to another user')).toBe(true);
      expect(isFacebookTakenError('access_denied')).toBe(false);
   });
});
