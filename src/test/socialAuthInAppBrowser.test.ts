import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/LineLoginButton', () => ({ default: () => null }));
vi.mock('@/components/TikTokLoginButton', () => ({ default: () => null }));
vi.mock('@/components/auth/TelegramLoginTile', () => ({ default: () => null }));

const FB_ANDROID_UA =
   'Mozilla/5.0 (Linux; Android 13; SM-A145F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.40.82;]';
const FB_IOS_UA =
   'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.82;]';
const CHROME_ANDROID_UA =
   'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36';

describe('Google sign-in inside an app browser', () => {
   let container: HTMLDivElement;
   let root: Root;
   const originalUA = navigator.userAgent;

   const renderWith = async (ua: string) => {
      Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
      const { SocialAuthButtons } = await import('@/components/auth/SocialAuthButtons');
      await act(async () => {
         root.render(createElement(MemoryRouter, null, createElement(SocialAuthButtons, { isSignUp: true, onTelegramAuth: vi.fn() })));
      });
   };

   beforeEach(() => {
      vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
      vi.unstubAllEnvs();
      Object.defineProperty(window.navigator, 'userAgent', { value: originalUA, configurable: true });
   });

   it("Facebook on Android: the Google button opens the page in Chrome and says email works here", async () => {
      await renderWith(FB_ANDROID_UA);
      const link = Array.from(container.querySelectorAll('a')).find((a) => a.textContent?.includes('Google: open in Chrome'));
      expect(link?.getAttribute('href')).toMatch(/^intent:\/\/.*package=com\.android\.chrome/);
      expect(container.textContent).toContain('Google sign-in doesn’t work inside Facebook'.replace('’', "'"));
      expect(container.textContent).not.toContain('Sign Up with Google');
   });

   it('Facebook on iPhone: the Google button points to Safari', async () => {
      await renderWith(FB_IOS_UA);
      expect(container.textContent).toContain('Google: open in Safari');
   });

   it('a real browser keeps the normal Google button', async () => {
      await renderWith(CHROME_ANDROID_UA);
      expect(container.textContent).toContain('Sign Up with Google');
      expect(container.textContent).not.toContain('open in Chrome');
   });
});
