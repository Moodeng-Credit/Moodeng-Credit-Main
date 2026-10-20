import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// The "open in Chrome / Safari, or continue here" first screen (George, 2026-10-18).
const h = vi.hoisted(() => ({ auth: { user: null as null | { id: string }, isAuthChecked: true }, enabled: true }));
vi.mock('react-redux', () => ({ useSelector: (select: (state: unknown) => unknown) => select({ auth: h.auth }) }));
vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }));
vi.mock('@/lib/supabase/client', () => ({
   getSupabaseBrowserClient: () => ({ rpc: async () => ({ data: h.enabled, error: null }) })
}));

import OpenInBrowserPrompt from '@/components/OpenInBrowserPrompt';

const FB_ANDROID =
   'Mozilla/5.0 (Linux; Android 15; Pixel 7 Build/AP4A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/155.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/540.0.0.0;]';
const FB_IOS =
   'Mozilla/5.0 (iPhone; CPU iPhone OS 26_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23G83 [FBAN/FBIOS;FBAV/582.0.0.26.106;FBSN/iOS]';

describe('OpenInBrowserPrompt', () => {
   let container: HTMLDivElement;
   let root: Root;
   const originalUserAgent = navigator.userAgent;

   const render = async (ua: string, path = '/sign-up') => {
      Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
      window.history.replaceState(null, '', path);
      await act(async () => {
         root.render(createElement(MemoryRouter, { initialEntries: [path] }, createElement(OpenInBrowserPrompt)));
      });
      await act(async () => {
         await Promise.resolve();
      });
   };

   beforeEach(() => {
      window.localStorage.clear();
      h.auth = { user: null, isAuthChecked: true };
      h.enabled = true;
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
      Object.defineProperty(navigator, 'userAgent', { value: originalUserAgent, configurable: true });
   });

   it('Android in Facebook: Chrome hippo and button both hand off to Chrome, address tagged for arrivals', async () => {
      await render(FB_ANDROID);
      expect(container.textContent).toContain('open Moodeng in Chrome');
      const links = Array.from(container.querySelectorAll('a'));
      const button = links.find((a) => a.textContent?.includes('Open in Chrome'));
      const hippo = links.find((a) => a.querySelector('img[src="/hippos/hippo-chrome.png"]'));
      expect(button?.getAttribute('href')).toMatch(/^intent:\/\/.*package=com\.android\.chrome/);
      expect(hippo?.getAttribute('href')).toBe(button?.getAttribute('href'));
      expect(new URL(window.location.href).searchParams.get('ia')).toBe('1');
   });

   it('iPhone in Facebook: Safari hippo, Open in Safari points at ⋯, and "Continue here" closes it and is remembered', async () => {
      await render(FB_IOS);
      expect(container.textContent).toContain('open Moodeng in Safari');
      expect(container.querySelector('img[src="/hippos/hippo-safari.png"]')).not.toBeNull();
      // Just two buttons; the ⋯ steps appear when they tap Open in Safari.
      expect(container.textContent).not.toContain('Open in external browser');
      const openSafari = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Open in Safari');
      await act(async () => {
         openSafari?.click();
      });
      expect(container.textContent).toContain('Open in external browser');
      const gotIt = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Got it');
      await act(async () => {
         gotIt?.click();
      });
      expect(container.textContent).not.toContain('Open in external browser');
      const cont = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Continue here');
      await act(async () => {
         cont?.click();
      });
      expect(container.textContent).not.toContain('open Moodeng in Safari');
      expect(window.localStorage.getItem('md_iab_continue')).not.toBeNull();
      expect(new URL(window.location.href).searchParams.get('ia')).toBeNull();
   });

   const buttonNamed = (name: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === name);
   const setExecCopy = (ok: boolean) => {
      Object.defineProperty(document, 'execCommand', { value: vi.fn(() => ok), configurable: true });
   };

   it('iPhone: when the link copies, the button says so and the guide says paste it if needed', async () => {
      setExecCopy(true);
      await render(FB_IOS);
      await act(async () => {
         buttonNamed('Open in Safari')?.click();
      });
      expect(buttonNamed('Link copied ✓')).toBeDefined();
      expect(container.textContent).toContain('📋 Link copied. If Safari opens without Moodeng, paste it in the address bar.');
      expect(buttonNamed('Copy link')).toBeUndefined();
   });

   it('iPhone: when the copy is refused, the guide shows the link with Copy link, and says if that fails too', async () => {
      setExecCopy(false);
      await render(FB_IOS);
      await act(async () => {
         buttonNamed('Open in Safari')?.click();
      });
      expect(buttonNamed('Open in Safari')).toBeDefined();
      expect(container.textContent).not.toContain('📋 Link copied');
      expect(container.textContent).toContain('📋 Copy the link first, in case Safari opens without Moodeng.');
      expect(container.textContent).toContain('/sign-up?ia=1');
      // Their own tap still can't copy: say so, and the guide stays open.
      await act(async () => {
         buttonNamed('Copy link')?.click();
      });
      expect(container.textContent).toContain("Couldn't copy. Press and hold the link, then tap Copy.");
      expect(container.textContent).toContain('Open in external browser');
      // Now it works.
      setExecCopy(true);
      await act(async () => {
         buttonNamed('Copy link')?.click();
      });
      expect(container.textContent).toContain('📋 Link copied. If Safari opens without Moodeng, paste it in the address bar.');
      expect(buttonNamed('Copy link')).toBeUndefined();
   });

   it('not shown when signed in (leaving would lose a guest)', async () => {
      h.auth = { user: { id: 'u1' }, isAuthChecked: true };
      await render(FB_ANDROID);
      expect(container.textContent).toBe('');
   });

   it('not shown when switched off', async () => {
      h.enabled = false;
      await render(FB_ANDROID);
      expect(container.textContent).toBe('');
   });

   it('not shown outside sign-in / sign-up', async () => {
      await render(FB_ANDROID, '/onboarding/connect');
      expect(container.textContent).toBe('');
   });
});
