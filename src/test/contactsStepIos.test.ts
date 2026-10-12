import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// iPhone: the Messenger card must be a real m.me link the borrower taps (iOS opens Messenger in place),
// never window.open from script, which leaves a new Safari tab they have to back out of.
const supa = vi.hoisted(() => ({
   rpc: vi.fn(async (fn: string) => (fn === 'start_contact_verification' ? { data: 'MDNG-IOS123', error: null } : { data: null, error: null })),
   maybeSingle: vi.fn(async () => ({ data: { whatsapp_verified_at: null, messenger_verified_at: null } }))
}));

vi.mock('@/hooks/usePushNotifications', () => ({
   usePushNotifications: () => ({
      isSupported: false,
      permission: 'unsupported',
      isSubscribed: false,
      isBusy: false,
      enable: async () => 'unsupported',
      disable: async () => undefined
   })
}));

vi.mock('@/lib/supabase/client', () => ({
   getSupabaseBrowserClient: () => ({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: supa.maybeSingle }) }) }),
      rpc: supa.rpc,
      functions: { invoke: vi.fn() }
   })
}));

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

describe('ContactsStep on iPhone', () => {
   let container: HTMLDivElement;
   let root: Root;
   let openSpy: ReturnType<typeof vi.spyOn>;
   const originalUA = navigator.userAgent;

   beforeEach(() => {
      Object.defineProperty(window.navigator, 'userAgent', { value: IPHONE_UA, configurable: true });
      window.sessionStorage.clear();
      supa.rpc.mockClear();
      openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
      openSpy.mockRestore();
      Object.defineProperty(window.navigator, 'userAgent', { value: originalUA, configurable: true });
   });

   it('prepares the code up front and opens Messenger from a tapped m.me link, not a new tab', async () => {
      const { default: ContactsStep } = await import('@/views/dashboard/components/ContactsStep');
      await act(async () => {
         root.render(createElement(ContactsStep, { userId: 'user-1', source: 'connect', onBack: vi.fn(), onContinue: vi.fn() }));
      });
      await act(async () => {
         await Promise.resolve();
         await Promise.resolve();
      });

      expect(supa.rpc).toHaveBeenCalledWith('start_contact_verification', { p_channel: 'messenger' });
      const link = Array.from(container.querySelectorAll('a')).find((a) => a.textContent?.includes('Connect Messenger'));
      expect(link?.getAttribute('href')).toContain('m.me/');
      expect(link?.getAttribute('href')).toContain('MDNG-IOS123');
      expect(link?.getAttribute('target')).toBeNull();

      await act(async () => {
         // jsdom doesn't navigate; the borrower's tap is what iOS hands to Messenger.
         link?.addEventListener('click', (e) => e.preventDefault(), { once: true });
         link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
         await Promise.resolve();
      });
      expect(openSpy).not.toHaveBeenCalled();
      expect(container.textContent).toContain('Confirming on Messenger');
      const again = Array.from(container.querySelectorAll('a')).find((a) => a.textContent === 'Open Messenger again');
      expect(again?.getAttribute('href')).toContain('MDNG-IOS123');
   });
});
