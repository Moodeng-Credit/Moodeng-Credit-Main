import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// Same Supabase/push doubles as contactsStepVerification.test.ts; this file checks the PostHog
// trail (contact_verify_*) that lets us replay a stuck borrower's Messenger attempt.
const supa = vi.hoisted(() => {
   const state = {
      usersRow: { whatsapp_verified_at: null as string | null, messenger_verified_at: null as string | null },
      rpcResult: { data: 'MDNG-ABC123' as unknown, error: null as unknown }
   };
   return {
      state,
      rpc: vi.fn(async () => state.rpcResult),
      maybeSingle: vi.fn(async () => ({ data: { ...state.usersRow } }))
   };
});

const analytics = vi.hoisted(() => ({ capture: vi.fn() }));

vi.mock('posthog-js', () => ({ default: { capture: analytics.capture } }));

vi.mock('@/hooks/usePushNotifications', () => ({
   usePushNotifications: () => ({
      isSupported: false,
      permission: 'unsupported',
      isSubscribed: false,
      isBusy: false,
      enable: async () => 'subscribed',
      disable: async () => undefined
   })
}));

vi.mock('@/lib/supabase/client', () => ({
   getSupabaseBrowserClient: () => ({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: supa.maybeSingle }) }) }),
      rpc: supa.rpc
   })
}));

const { default: ContactsStep } = await import('@/views/dashboard/components/ContactsStep');

const events = () => analytics.capture.mock.calls.map(([name]) => name as string);
const eventProps = (name: string) => analytics.capture.mock.calls.find(([n]) => n === name)?.[1] as Record<string, unknown> | undefined;

const messengerCard = (container: HTMLElement) =>
   Array.from(container.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim().startsWith('Messenger'));

describe('ContactsStep analytics trail', () => {
   let container: HTMLDivElement;
   let root: Root;
   let onBack: ReturnType<typeof vi.fn>;

   const setVisibility = async (state: 'hidden' | 'visible') => {
      Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
      await act(async () => {
         document.dispatchEvent(new Event('visibilitychange'));
         await Promise.resolve();
         await Promise.resolve();
      });
   };

   const render = async (backLabel?: string) => {
      await act(async () => {
         root.render(createElement(ContactsStep, { userId: 'user-1', source: 'verify_review', onBack, onContinue: vi.fn(), backLabel }));
      });
      await act(async () => {
         await Promise.resolve();
      });
   };

   const tapMessenger = async () => {
      await act(async () => {
         messengerCard(container)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
         await Promise.resolve();
      });
   };

   beforeEach(() => {
      vi.useFakeTimers();
      supa.state.usersRow = { whatsapp_verified_at: null, messenger_verified_at: null };
      analytics.capture.mockClear();
      onBack = vi.fn();
      vi.stubGlobal('open', vi.fn());
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
      vi.useRealTimers();
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
   });

   it('logs a failed first try, the backup, the retry and the confirmation in order', async () => {
      await render();
      await tapMessenger();
      expect(eventProps('contact_verify_started')).toMatchObject({ source: 'verify_review', channel: 'messenger', attempt: 1 });

      // Off to Messenger, back unconfirmed, backups appear after the short grace.
      await setVisibility('hidden');
      await setVisibility('visible');
      await act(async () => {
         await vi.advanceTimersByTimeAsync(4_100);
      });
      expect(eventProps('contact_verify_left_app')).toMatchObject({ source: 'verify_review', attempt: 1 });
      expect(eventProps('contact_verify_returned')).toMatchObject({ confirmed: false, attempt: 1 });
      expect(eventProps('contact_verify_backup_shown')).toMatchObject({ reason: 'returned_unconfirmed' });

      // Second try from the backup works.
      const again = Array.from(container.querySelectorAll('button')).filter((b) => b.textContent?.trim() === 'Open Messenger again');
      await act(async () => {
         again[1].click();
      });
      expect(eventProps('contact_verify_reopen_tapped')).toMatchObject({ location: 'backup' });

      supa.state.usersRow.messenger_verified_at = '2026-10-01T07:57:40Z';
      await act(async () => {
         await vi.advanceTimersByTimeAsync(3_100);
      });
      expect(eventProps('contact_verify_confirmed')).toMatchObject({
         source: 'verify_review',
         channel: 'messenger',
         attempts: 1,
         left_app: true
      });

      expect(events()).toEqual([
         'contact_verify_started',
         'contact_verify_left_app',
         'contact_verify_returned',
         'contact_verify_backup_shown',
         'contact_verify_reopen_tapped',
         'contact_verify_confirmed'
      ]);
   });

   it('logs the backup only once, however many times it is triggered', async () => {
      await render();
      await tapMessenger();
      await setVisibility('hidden');
      await setVisibility('visible');
      await act(async () => {
         await vi.advanceTimersByTimeAsync(61_000);
      });
      expect(events().filter((e) => e === 'contact_verify_backup_shown')).toHaveLength(1);
   });

   it('does not log a confirmation for a line verified on an earlier application', async () => {
      supa.state.usersRow.messenger_verified_at = '2026-09-01T00:00:00Z';
      await render();
      expect(events()).not.toContain('contact_verify_confirmed');
   });

   it('uses the custom back label and logs the skip', async () => {
      await render('Skip for now');
      const skip = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Skip for now');
      expect(skip).toBeTruthy();
      await act(async () => {
         skip?.click();
      });
      expect(onBack).toHaveBeenCalledTimes(1);
      expect(eventProps('contact_verify_back')).toMatchObject({ source: 'verify_review', contact_verified: false, label: 'Skip for now' });
   });
});
