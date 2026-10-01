import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// /verify for a borrower whose Didit ID check is in manual review: the Facebook step must come
// BEFORE "Manual review in progress", stay put while Facebook confirms, and never trap them.
const store = vi.hoisted(() => ({
   user: null as Record<string, unknown> | null,
   // What the next fetchUser() resolves to (the page refreshes the user on focus/status checks).
   nextUser: null as Record<string, unknown> | null
}));

vi.mock('react-redux', () => ({
   useSelector: (selector: (s: unknown) => unknown) => selector({ auth: { user: store.user } }),
   useDispatch: () => () => ({
      unwrap: async () => {
         if (store.nextUser) store.user = store.nextUser;
         return store.user;
      }
   })
}));
vi.mock('@/store/slices/authSlice', () => ({ fetchUser: () => ({ type: 'auth/fetchUser' }) }));
vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }));
vi.mock('@/lib/supabase/client', () => ({
   getSupabaseBrowserClient: () => ({ functions: { invoke: async () => ({ data: { status: 'In Review' }, error: null }) } })
}));
vi.mock('@/lib/verifyFlow', () => ({ readVerifyFlow: () => null, writeVerifyFlow: vi.fn(), clearVerifyFlow: vi.fn() }));
vi.mock('@/components/worldId/WorldIDVerification', () => ({ default: () => null }));
vi.mock('@/views/dashboard/components/connectKit', () => ({ CONNECT_HIPPOS: { hello: '' }, ConnectHero: () => null }));
// The real card is covered by contactsStep*.test.ts; here it's a stub exposing its two exits.
vi.mock('@/views/dashboard/components/ContactsStep', () => ({
   default: ({ backLabel, onBack, onContinue }: { backLabel?: string; onBack: () => void; onContinue: () => void }) =>
      createElement(
         'div',
         { 'data-testid': 'contacts-step' },
         createElement('button', { type: 'button', onClick: onContinue }, 'Continue'),
         createElement('button', { type: 'button', onClick: onBack }, backLabel ?? 'Back')
      )
}));

const { default: VerifyFlow } = await import('@/app/verify/page');

const reviewUser = (hasVerifiedContact: boolean) => ({
   id: 'user-1',
   isWorldId: 'INACTIVE',
   isDidit: 'INACTIVE',
   diditIdStatus: 'In Review',
   diditSubmittedAt: '2026-10-01T07:39:54Z',
   hasVerifiedContact
});

const button = (container: HTMLElement, text: string) =>
   Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);

describe('/verify manual review: Facebook first', () => {
   let container: HTMLDivElement;
   let root: Root;

   const render = async () => {
      await act(async () => {
         root.render(createElement(MemoryRouter, { initialEntries: ['/verify'] }, createElement(VerifyFlow)));
      });
      await act(async () => {
         await Promise.resolve();
      });
   };

   const click = async (el: HTMLButtonElement | undefined) => {
      expect(el).toBeTruthy();
      await act(async () => {
         el?.click();
         await Promise.resolve();
      });
   };

   beforeEach(() => {
      store.nextUser = null;
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
   });

   it('asks for Facebook before saying the review is manual', async () => {
      store.user = reviewUser(false);
      await render();
      expect(container.querySelector('[data-testid="contacts-step"]')).toBeTruthy();
      expect(container.textContent).not.toContain('Manual review in progress');
      expect(button(container, 'Skip for now')).toBeTruthy();
   });

   it('keeps the Facebook step up when Facebook confirms on return, until they tap Continue', async () => {
      store.user = reviewUser(false);
      await render();

      // Back from Messenger: focus re-checks the status and refreshes the user, now connected.
      store.nextUser = reviewUser(true);
      await act(async () => {
         window.dispatchEvent(new Event('focus'));
         await Promise.resolve();
         await Promise.resolve();
      });
      expect(container.querySelector('[data-testid="contacts-step"]')).toBeTruthy();

      await click(button(container, 'Continue'));
      expect(container.textContent).toContain('Manual review in progress');
      expect(container.textContent).toContain("We'll message you on Facebook");
      expect(button(container, 'Add Facebook')).toBeUndefined();
   });

   it('goes straight to the review screen when Facebook was connected before', async () => {
      store.user = reviewUser(true);
      await render();
      expect(container.querySelector('[data-testid="contacts-step"]')).toBeNull();
      expect(container.textContent).toContain('Manual review in progress');
      expect(container.textContent).toContain("We'll message you on Facebook");
   });

   it('never traps them: Skip shows the review screen, which offers Add Facebook again', async () => {
      store.user = reviewUser(false);
      await render();
      await click(button(container, 'Skip for now'));
      expect(container.textContent).toContain('Manual review in progress');
      expect(container.textContent).toContain('Add your Facebook');

      await click(button(container, 'Add Facebook'));
      expect(container.querySelector('[data-testid="contacts-step"]')).toBeTruthy();
      // From here the secondary button is a plain Back to the review screen.
      await click(button(container, 'Back'));
      expect(container.textContent).toContain('Manual review in progress');
   });
});
