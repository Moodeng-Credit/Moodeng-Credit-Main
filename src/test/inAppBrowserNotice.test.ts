import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// The "Open Moodeng in your browser" banner: George wants people kept inside Facebook's browser all
// the way to their loan request, so it only shows to signed-in people with an outside wallet.
const h = vi.hoisted(() => ({ user: null as { walletProvider?: string | null } | null }));
vi.mock('react-redux', () => ({ useSelector: (select: (state: unknown) => unknown) => select({ auth: { user: h.user } }) }));
vi.mock('@/components/support/AskSupportButton', () => ({ default: () => null }));
vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }));

const FB_ANDROID_UA =
   'Mozilla/5.0 (Linux; Android 13; SM-A145F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.40.82;]';

describe('InAppBrowserNotice', () => {
   let container: HTMLDivElement;
   let root: Root;
   const originalUA = navigator.userAgent;

   const render = async () => {
      Object.defineProperty(window.navigator, 'userAgent', { value: FB_ANDROID_UA, configurable: true });
      const { default: InAppBrowserNotice } = await import('@/components/InAppBrowserNotice');
      await act(async () => root.render(createElement(InAppBrowserNotice)));
      await act(async () => {});
   };

   beforeEach(() => {
      sessionStorage.clear();
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
      Object.defineProperty(window.navigator, 'userAgent', { value: originalUA, configurable: true });
   });

   it('stays hidden for signed-out visitors inside Facebook (they can sign in right there now)', async () => {
      h.user = null;
      await render();
      expect(container.textContent).not.toContain('Open Moodeng in your browser');
   });

   it('stays hidden for Instant Wallet users (it works inside Facebook)', async () => {
      h.user = { walletProvider: 'openfort' };
      await render();
      expect(container.textContent).not.toContain('Open Moodeng in your browser');
   });

   it('shows for an outside wallet, which does not work inside Facebook', async () => {
      h.user = { walletProvider: 'base_wallet' };
      await render();
      expect(container.textContent).toContain('Open Moodeng in your browser');
      expect(container.textContent).toContain("Your wallet doesn't work inside Facebook.");
   });
});
