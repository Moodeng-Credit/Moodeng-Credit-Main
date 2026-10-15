import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// After logging in: back to where they were; a killed Facebook page can resume the code; a new
// account in the Philippines is asked once whether they used Moodeng before.
const h = vi.hoisted(() => ({ inPh: true, signedIn: false, logout: vi.fn(() => ({ type: 'logout' })) }));
vi.mock('@/lib/isLikelyPhilippines', () => ({ isLikelyPhilippines: () => h.inPh }));
vi.mock('@/store/slices/authSlice', () => ({ logoutUser: h.logout }));
vi.mock('react-redux', () => ({
   useDispatch: () => () => Promise.resolve(),
   useSelector: (select: (state: unknown) => unknown) => select({ auth: { user: { id: h.signedIn ? 'u1' : '' } } })
}));
vi.mock('@/hooks/useAuthProvider', () => ({
   useAuthProvider: () => ({ canSetPassword: false, hasPassword: false, isLoading: false })
}));
vi.mock('@/components/ThemeToggle', () => ({ ThemeToggle: () => null }));
vi.mock('@/views/onboarding/OnboardingHeader', () => ({ OnboardingHeader: () => null }));

const { formatPhLocal } = await import('@/lib/phoneAuth');
const { rememberNextPath, safeNextPath, takeNextPath } = await import('@/lib/authNext');
const { clearPendingCode, readPendingCode, savePendingCode } = await import('@/lib/pendingCode');
const { PendingCodeBanner } = await import('@/components/auth/PendingCodeBanner');
const { default: AuthSuccessPage } = await import('@/app/auth-success/page');

function Where() {
   const location = useLocation();
   return createElement('p', { 'data-testid': 'where' }, `${location.pathname}${location.search}`);
}

describe('helpers', () => {
   afterEach(() => localStorage.clear());

   it('formats a PH number the way people write it', () => {
      expect(formatPhLocal('+639171234567')).toBe('0917 123 4567');
      expect(formatPhLocal('+971501234567')).toBe('+971501234567');
   });

   it('next path: only internal, non-auth pages; read once; expires after 30 minutes', () => {
      expect(safeNextPath('/request-board?highlight=1')).toBe('/request-board?highlight=1');
      expect(safeNextPath('https://evil.example')).toBeNull();
      expect(safeNextPath('//evil.example')).toBeNull();
      expect(safeNextPath('/sign-in')).toBeNull();
      expect(safeNextPath('/auth/verify-code')).toBeNull();
      rememberNextPath('/repay', 1000);
      expect(takeNextPath(2000)).toBe('/repay');
      expect(takeNextPath(3000)).toBeNull();
      rememberNextPath('/repay', 1000);
      expect(takeNextPath(1000 + 31 * 60_000)).toBeNull();
   });

   it('pending code: kept 10 minutes in localStorage', () => {
      savePendingCode({ channel: 'sms', target: '+639171234567', mode: 'signup' }, 1000);
      expect(readPendingCode(1000 + 9 * 60_000)).toMatchObject({ channel: 'sms', target: '+639171234567', mode: 'signup', resends: 0 });
      expect(readPendingCode(1000 + 11 * 60_000)).toBeNull();
      clearPendingCode();
      expect(readPendingCode(2000)).toBeNull();
   });
});

describe('screens', () => {
   let container: HTMLDivElement;
   let root: Root;

   const render = async (url: string, element: ReturnType<typeof createElement>) => {
      await act(async () => {
         root.render(
            createElement(
               MemoryRouter,
               { initialEntries: [url] },
               createElement(
                  Routes,
                  null,
                  createElement(Route, { path: '/auth-success', element }),
                  createElement(Route, { path: '/', element }),
                  createElement(Route, { path: '*', element: createElement(Where) })
               )
            )
         );
      });
   };
   const button = (text: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);

   beforeEach(() => {
      h.inPh = true;
      h.signedIn = false;
      h.logout.mockClear();
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
      localStorage.clear();
   });

   it('"Finish logging in" appears for a signed-out visitor with a pending code and leads to the code screen', async () => {
      savePendingCode({ channel: 'sms', target: '+639171234567', mode: 'signin' });
      await render('/', createElement(PendingCodeBanner));
      const link = Array.from(container.querySelectorAll('a')).find((a) => a.textContent?.includes('Finish logging in: enter your code'));
      expect(link?.getAttribute('href')).toBe('/auth/verify-code?phone=%2B639171234567');
   });

   it('no banner when signed in or with nothing pending', async () => {
      await render('/', createElement(PendingCodeBanner));
      expect(container.textContent).not.toContain('Finish logging in');
      savePendingCode({ channel: 'email', target: 'a@b.co', mode: 'signin' });
      h.signedIn = true;
      await render('/', createElement(PendingCodeBanner));
      expect(container.textContent).not.toContain('Finish logging in');
   });

   it('new account in the Philippines: asks once, "New to Moodeng" goes on to Account created', async () => {
      await render('/auth-success?type=created&new=1', createElement(AuthSuccessPage));
      expect(container.textContent).toContain('Have you used Moodeng before?');
      await act(async () => button('New to Moodeng')?.click());
      expect(container.textContent).toContain('Your account has been created');
   });

   it('"I\'ve used Moodeng before" explains and logs in the old way (signing this new account out)', async () => {
      await render('/auth-success?type=created&new=1', createElement(AuthSuccessPage));
      await act(async () => button("I've used Moodeng before")?.click());
      expect(container.textContent).toContain('Log in with the phone, email or Google you used before.');
      await act(async () => button('Log in with my email')?.click());
      expect(h.logout).toHaveBeenCalled();
      expect(container.querySelector('[data-testid="where"]')?.textContent).toBe('/sign-in?method=email');
   });

   it('not asked outside the Philippines, or for a returning account', async () => {
      h.inPh = false;
      await render('/auth-success?type=created&new=1', createElement(AuthSuccessPage));
      expect(container.textContent).toContain('Your account has been created');
      h.inPh = true;
      await render('/auth-success?type=created', createElement(AuthSuccessPage));
      expect(container.textContent).not.toContain('Have you used Moodeng before?');
   });
});
