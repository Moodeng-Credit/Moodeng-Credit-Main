import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// moodeng.app/continue from the Messenger bot. On Android Messenger opens it in a browser that isn't
// signed in; the page used to say "go back to where you started", and a borrower gave up there
// (2026-11-23). Signed out, it now shows the code sign-in (mobile number first in the Philippines),
// and remembers /continue so signing in comes back here and on to their next step. Signed in, it
// sends them on with the pre-screening answer too, so pre-screening people go to /screen.
const auth = vi.hoisted(() => ({ user: null as null | { id: string; userRole: string } }));
const nav = vi.hoisted(() => ({ navigate: vi.fn() }));
const returnPath = vi.hoisted(() => ({ fn: vi.fn(async () => '/screen') }));
vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }));
vi.mock('@/lib/isLikelyPhilippines', () => ({ isLikelyPhilippines: () => true }));
vi.mock('react-redux', () => ({
   useDispatch: () => () => ({ unwrap: () => new Promise(() => {}) }),
   useSelector: (pick: (s: unknown) => unknown) =>
      pick({ auth: { user: auth.user, username: auth.user ? 'maria' : null, isAuthChecked: true, isLoading: false } })
}));
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => nav.navigate }));
vi.mock('@/store/slices/authSlice', () => ({ requestOtpCode: vi.fn(() => ({ type: 'requestOtpCode' })) }));
vi.mock('@/components/ToastSystem/hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn(), showToastByConfig: vi.fn() }) }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseBrowserClient: () => ({ rpc: vi.fn() }), isSupabaseBrowserConfigured: () => true }));
const prescreen = { on_path: true, status: 'none' as const };
vi.mock('@/hooks/usePreKycGate', () => ({ usePreKycGate: () => ({ isGated: true, isLoading: false, v2: null, prescreen }) }));
vi.mock('@/hooks/useSignedInRedirect', () => ({ getSignedInReturnPath: returnPath.fn }));

const { default: ContinuePage } = await import('@/views/onboarding/ContinuePage');
const { takeNextPath } = await import('@/lib/authNext');

describe('/continue', () => {
   let container: HTMLDivElement;
   let root: Root;

   const render = async (path = '/continue?via=bot') => {
      await act(async () => {
         root.render(createElement(MemoryRouter, { initialEntries: [path] }, createElement(ContinuePage)));
      });
   };

   beforeEach(() => {
      auth.user = null;
      nav.navigate.mockClear();
      returnPath.fn.mockClear();
      window.localStorage.clear();
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
   });

   it('signed out: the code sign-in is on the page, and signing in comes back to /continue', async () => {
      await render();
      expect(container.textContent).toContain('Sign in to continue');
      expect(container.querySelector('form input')).not.toBeNull();
      expect(container.textContent).toContain('Facebook');
      expect(container.textContent).not.toContain('Go back to where you started');
      expect(takeNextPath()).toBe('/continue?via=bot');
   });

   it('signed in: straight to their next step, with the pre-screening answer', async () => {
      auth.user = { id: 'u1', userRole: 'borrower' };
      await render();
      expect(returnPath.fn).toHaveBeenCalledWith(auth.user, true, null, prescreen);
      expect(nav.navigate).toHaveBeenCalledWith('/screen', { replace: true });
      expect(takeNextPath()).toBeNull();
   });
});
