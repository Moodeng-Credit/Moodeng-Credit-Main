import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }));

// moodeng.app/fb/<code>: the phone page the desktop QR opens. iPhone gets the m.me link with the code;
// Android gets copy-and-paste into the app chat (m.me never reaches Messenger from Android Chrome).
const IPHONE_UA =
   'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';

describe('MessengerHandoff', () => {
   let container: HTMLDivElement;
   let root: Root;
   const originalUA = navigator.userAgent;

   beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });
   afterEach(() => {
      act(() => root.unmount());
      container.remove();
      Object.defineProperty(window.navigator, 'userAgent', { value: originalUA, configurable: true });
   });

   const renderAt = async (path: string, ua: string) => {
      Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
      const { default: MessengerHandoff } = await import('@/views/onboarding/MessengerHandoff');
      await act(async () => {
         root.render(
            createElement(
               MemoryRouter,
               { initialEntries: [path] },
               createElement(Routes, null, createElement(Route, { path: '/fb/:code', element: createElement(MessengerHandoff) }))
            )
         );
      });
   };

   it('iPhone: one tapped m.me link carrying the code', async () => {
      await renderAt('/fb/MDNG-ABC123', IPHONE_UA);
      const link = Array.from(container.querySelectorAll('a')).find((a) => a.textContent?.includes('Open Messenger'));
      expect(link?.getAttribute('href')).toContain('m.me/');
      expect(link?.getAttribute('href')).toContain('mdng_code=MDNG-ABC123');
   });

   it('Android: the code to copy and the Messenger app chat link', async () => {
      await renderAt('/fb/mdng-abc123', ANDROID_UA);
      expect(container.textContent).toContain('MDNG-ABC123');
      const link = Array.from(container.querySelectorAll('a')).find((a) => a.textContent?.includes('Copy code & open Messenger'));
      expect(link?.getAttribute('href')).toMatch(/^fb-messenger:\/\/user-thread\//);
   });

   it('rejects a malformed code instead of building a link from it', async () => {
      await renderAt('/fb/not-a-code', IPHONE_UA);
      expect(container.textContent).toContain('This link doesn');
      expect(container.querySelector('a')).toBeNull();
   });
});
