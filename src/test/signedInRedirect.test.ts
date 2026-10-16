import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// /sign-in and /sign-up for someone already signed in. Oct 16 2026: a guest mid-onboarding came back
// to /sign-in after Facebook reloaded the page, typed her email, and lost her guest account.
type AuthState = {
   user: Record<string, unknown>;
   username: string | null;
   isAuthChecked: boolean;
   isLoading: boolean;
   isSigningOut?: boolean;
};
const h = vi.hoisted(() => ({
   auth: null as unknown as AuthState,
   gate: { isGated: true, isLoading: false },
   listeners: new Set<() => void>()
}));
vi.mock('react-redux', async () => {
   const { useSyncExternalStore } = await import('react');
   return {
      useSelector: (select: (state: unknown) => unknown) =>
         useSyncExternalStore(
            (cb) => {
               h.listeners.add(cb);
               return () => h.listeners.delete(cb);
            },
            () => select({ auth: h.auth })
         )
   };
});
vi.mock('@/hooks/usePreKycGate', () => ({ PRE_KYC_CONNECT_PATH: '/onboarding/connect', usePreKycGate: () => h.gate }));
vi.mock('@/lib/postSignInPath', () => ({ getPostSignInPath: async () => '/dashboard' }));

const { useSignedInRedirect } = await import('@/hooks/useSignedInRedirect');

const setAuth = (next: Partial<AuthState>) => {
   h.auth = { ...h.auth, ...next };
   h.listeners.forEach((cb) => cb());
};

// A guest borrower with a wallet who hasn't connected Messenger yet (the pre-KYC gate holds them).
const guest = {
   id: 'bf3535ba',
   username: 'emma',
   email: 'guest_bf3535ba@moodeng.app',
   userRole: 'borrower',
   walletAddress: '0x71c92A46A238AEeB8D4502aE43B709d7E75B9d42',
   isWorldId: 'INACTIVE',
   hasVerifiedContact: false
};

function SignInStub() {
   const redirecting = useSignedInRedirect();
   return createElement('p', null, redirecting ? 'redirecting' : 'sign-in form');
}

function Where() {
   const location = useLocation();
   return createElement('p', { 'data-testid': 'where' }, location.pathname);
}

let container: HTMLDivElement;
let root: Root;

const render = async (path = '/sign-in') => {
   await act(async () => {
      root.render(
         createElement(
            MemoryRouter,
            { initialEntries: [path] },
            createElement(
               Routes,
               null,
               createElement(Route, { path: '/sign-in', element: createElement(SignInStub) }),
               createElement(Route, { path: '/sign-up', element: createElement(SignInStub) }),
               createElement(Route, { path: '*', element: createElement(Where) })
            )
         )
      );
   });
};

const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
const text = () => container.textContent;

describe('useSignedInRedirect', () => {
   beforeEach(() => {
      h.auth = { user: { id: '' }, username: null, isAuthChecked: false, isLoading: false };
      h.gate = { isGated: true, isLoading: false };
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
   });

   it('a guest whose page reloaded onto /sign-in goes back to the Connect step', async () => {
      await render('/sign-in');
      // Supabase restores the session after the reload.
      await act(async () => setAuth({ user: guest, username: 'emma', isAuthChecked: true }));
      await flush();
      expect(text()).toBe('/onboarding/connect');
   });

   it('same on /sign-up', async () => {
      h.auth = { user: guest, username: 'emma', isAuthChecked: true, isLoading: false };
      await render('/sign-up');
      await flush();
      expect(text()).toBe('/onboarding/connect');
   });

   it('waits for the pre-KYC gate answer before choosing', async () => {
      h.auth = { user: guest, username: 'emma', isAuthChecked: true, isLoading: false };
      h.gate = { isGated: false, isLoading: true };
      await render();
      await flush();
      expect(text()).toBe('redirecting');
   });

   it('no wallet yet: the wallet step; no role yet: the role screen; otherwise their usual landing', async () => {
      h.auth = { user: { ...guest, walletAddress: '' }, username: 'emma', isAuthChecked: true, isLoading: false };
      await render();
      await flush();
      expect(text()).toBe('/onboarding/wallet');

      act(() => root.unmount());
      root = createRoot(container);
      h.auth = { user: { ...guest, userRole: undefined }, username: 'emma', isAuthChecked: true, isLoading: false };
      await render();
      await flush();
      expect(text()).toBe('/onboarding/role');

      act(() => root.unmount());
      root = createRoot(container);
      h.auth = { user: { ...guest, userRole: 'lender' }, username: 'emma', isAuthChecked: true, isLoading: false };
      await render();
      await flush();
      expect(text()).toBe('/dashboard');
   });

   it('signed out: the form stays', async () => {
      await render();
      await act(async () => setAuth({ isAuthChecked: true }));
      await flush();
      expect(text()).toBe('sign-in form');
   });

   it('signing in or up on the page itself is left to the page', async () => {
      h.auth = { user: { id: '' }, username: null, isAuthChecked: true, isLoading: false };
      await render('/sign-up');
      await flush();
      // startGuestSignup.fulfilled fills in the user while the form navigates on its own.
      await act(async () => setAuth({ user: guest, username: 'emma' }));
      await flush();
      expect(text()).toBe('sign-in form');
   });

   it('arriving mid sign-out (log out, then straight to /sign-in) keeps the form', async () => {
      h.auth = { user: guest, username: 'emma', isAuthChecked: true, isLoading: false, isSigningOut: true };
      await render();
      await flush();
      await act(async () => setAuth({ user: { id: '' }, username: null, isSigningOut: false }));
      await flush();
      expect(text()).toBe('sign-in form');
   });
});
