import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// The moment the bot confirms, the database pushes the change (Supabase Realtime) and onboarding moves
// straight on to the success screen — no waiting for the poll, no extra Continue tap.
const supa = vi.hoisted(() => {
   const live: { handler: ((payload: { new: Record<string, unknown> }) => void) | null } = { handler: null };
   return {
      live,
      rpc: vi.fn(async () => ({ data: 'MDNG-LIVE01', error: null })),
      maybeSingle: vi.fn(async () => ({ data: { whatsapp_verified_at: null, messenger_verified_at: null } }))
   };
});

const push = vi.hoisted(() => ({ state: { isSupported: false, permission: 'unsupported' as string, isSubscribed: false } }));

vi.mock('@/hooks/usePushNotifications', () => ({
   usePushNotifications: () => ({ ...push.state, isBusy: false, enable: vi.fn(async () => 'subscribed'), disable: async () => undefined })
}));

vi.mock('@/lib/supabase/client', () => ({
   getSupabaseBrowserClient: () => ({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: supa.maybeSingle }) }) }),
      rpc: supa.rpc,
      // check-geo (Indonesia's sign-up): no country here.
      functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
      channel: () => {
         const channel = {
            on: (_type: string, _filter: unknown, handler: (payload: { new: Record<string, unknown> }) => void) => {
               supa.live.handler = handler;
               return channel;
            },
            subscribe: () => channel
         };
         return channel;
      },
      removeChannel: vi.fn(async () => 'ok')
   })
}));

const { default: ContactsStep } = await import('@/views/dashboard/components/ContactsStep');

describe('ContactsStep — live confirmation in onboarding', () => {
   let container: HTMLDivElement;
   let root: Root;
   let onContinue: ReturnType<typeof vi.fn>;

   beforeEach(() => {
      vi.useFakeTimers();
      window.sessionStorage.clear();
      supa.live.handler = null;
      push.state.isSupported = false;
      push.state.permission = 'unsupported';
      push.state.isSubscribed = false;
      vi.stubGlobal('open', vi.fn());
      onContinue = vi.fn();
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
      vi.useRealTimers();
   });

   const startMessenger = async () => {
      await act(async () => {
         root.render(createElement(ContactsStep, { userId: 'user-1', source: 'connect', onBack: vi.fn(), onContinue }));
      });
      await act(async () => {
         await Promise.resolve();
      });
      const card = Array.from(container.querySelectorAll('button')).find((b) => (b.textContent ?? '').includes('Connect Messenger'));
      await act(async () => {
         card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
         await Promise.resolve();
      });
   };

   const botConfirms = async () => {
      await act(async () => {
         supa.live.handler?.({ new: { messenger_verified_at: '2026-10-12T05:00:00Z', whatsapp_verified_at: null } });
         await Promise.resolve();
      });
   };

   it('turns green the instant the database pushes the confirmation, then moves on by itself', async () => {
      await startMessenger();
      expect(supa.live.handler).toBeTruthy();

      await botConfirms();
      expect(container.textContent).toContain('Verified');
      expect(onContinue).not.toHaveBeenCalled();

      await act(async () => {
         await vi.advanceTimersByTimeAsync(1000);
      });
      expect(onContinue).toHaveBeenCalledTimes(1);
   });

   it('asks for the one tap left (reminders) instead of moving on when push is required', async () => {
      push.state.isSupported = true;
      push.state.permission = 'default';
      await startMessenger();
      await botConfirms();
      await act(async () => {
         await vi.advanceTimersByTimeAsync(2000);
      });
      expect(onContinue).not.toHaveBeenCalled();
      expect(container.textContent).toContain('One more tap');
   });

   it('does not auto-continue for a borrower whose Facebook was already verified earlier', async () => {
      supa.maybeSingle.mockResolvedValueOnce({ data: { whatsapp_verified_at: null, messenger_verified_at: '2026-10-01T00:00:00Z' } });
      await act(async () => {
         root.render(createElement(ContactsStep, { userId: 'user-1', source: 'connect', onBack: vi.fn(), onContinue }));
      });
      await act(async () => {
         await vi.advanceTimersByTimeAsync(2000);
      });
      expect(container.textContent).toContain('Verified');
      expect(onContinue).not.toHaveBeenCalled();
   });
});
