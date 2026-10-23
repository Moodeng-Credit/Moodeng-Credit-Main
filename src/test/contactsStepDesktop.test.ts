import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// Computers: the Messenger card shows a QR for the phone and the code to paste here, and never opens
// m.me in a new tab (on desktop the code never reached our bot that way).
const supa = vi.hoisted(() => ({
   rpc: vi.fn(async (fn: string) =>
      fn === 'start_contact_verification' ? { data: 'MDNG-DESK12', error: null } : { data: null, error: null }
   ),
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
      functions: { invoke: vi.fn() },
      // ContactsStep's live subscription (Supabase Realtime): a no-op channel here.
      channel: () => ({
         on(this: object) {
            return this;
         },
         subscribe(this: object) {
            return this;
         }
      }),
      removeChannel: vi.fn(async () => 'ok')
   })
}));

const WINDOWS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const IPHONE_UA =
   'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

const setDevice = (ua: string, finePointer: boolean, touchPoints = 0) => {
   Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
   Object.defineProperty(window.navigator, 'maxTouchPoints', { value: touchPoints, configurable: true });
   window.matchMedia = ((query: string) => ({
      matches: finePointer && query.includes('pointer: fine'),
      media: query
   })) as unknown as typeof window.matchMedia;
};

describe('isDesktopBrowser', () => {
   const originalUA = navigator.userAgent;
   const originalMatchMedia = window.matchMedia;
   afterEach(() => {
      Object.defineProperty(window.navigator, 'userAgent', { value: originalUA, configurable: true });
      Object.defineProperty(window.navigator, 'maxTouchPoints', { value: 0, configurable: true });
      window.matchMedia = originalMatchMedia;
   });

   it('is true for a Windows or Mac computer with a mouse/trackpad', async () => {
      const { isDesktopBrowser } = await import('@/config/contactVerification');
      setDevice(WINDOWS_UA, true);
      expect(isDesktopBrowser()).toBe(true);
      setDevice(MAC_UA, true);
      expect(isDesktopBrowser()).toBe(true);
   });

   it('is false for phones, iPads posing as Macs, and anything without a fine pointer', async () => {
      const { isDesktopBrowser } = await import('@/config/contactVerification');
      setDevice(IPHONE_UA, true);
      expect(isDesktopBrowser()).toBe(false);
      setDevice(ANDROID_UA, true);
      expect(isDesktopBrowser()).toBe(false);
      setDevice(MAC_UA, true, 5); // iPadOS Safari
      expect(isDesktopBrowser()).toBe(false);
      setDevice(WINDOWS_UA, false);
      expect(isDesktopBrowser()).toBe(false);
   });
});

describe('ContactsStep on a computer', () => {
   let container: HTMLDivElement;
   let root: Root;
   let openSpy: ReturnType<typeof vi.spyOn>;
   const originalUA = navigator.userAgent;
   const originalMatchMedia = window.matchMedia;

   beforeEach(() => {
      setDevice(WINDOWS_UA, true);
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
      window.matchMedia = originalMatchMedia;
   });

   it('shows a QR to the phone hand-off page and the code to paste, without opening a tab', async () => {
      const { default: ContactsStep } = await import('@/views/dashboard/components/ContactsStep');
      await act(async () => {
         root.render(createElement(ContactsStep, { userId: 'user-1', source: 'connect', onBack: vi.fn(), onContinue: vi.fn() }));
      });
      // No code is minted until they tap (the stuck-borrower alert keys off the tap). Reading the
      // WhatsApp-reminders switch is fine.
      expect(supa.rpc).not.toHaveBeenCalledWith('start_contact_verification', expect.anything());
      expect(supa.rpc).not.toHaveBeenCalledWith('start_whatsapp_verification');
      expect(container.textContent).toContain('Scan a code with your phone');

      const card = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Connect Messenger'));
      await act(async () => {
         card?.click();
         await Promise.resolve();
         await Promise.resolve();
      });

      expect(supa.rpc).toHaveBeenCalledWith('start_contact_verification', { p_channel: 'messenger' });
      expect(openSpy).not.toHaveBeenCalled();
      expect(container.querySelector('[data-testid="messenger-qr"] svg')).not.toBeNull();
      expect(container.textContent).toContain('Scan with your phone');
      expect(container.textContent).toContain('MDNG-DESK12');
      const chat = Array.from(container.querySelectorAll('a')).find((a) => a.textContent?.includes('Copy code & open our chat'));
      expect(chat?.getAttribute('href')).toContain('facebook.com/messages/t/');
      expect(chat?.getAttribute('target')).toBe('_blank');
   });
});
