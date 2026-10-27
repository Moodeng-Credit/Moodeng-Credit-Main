import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/LineLoginButton', () => ({ default: () => createElement('div', { 'data-line': '1' }) }));
vi.mock('@/components/auth/TelegramLoginTile', () => ({ default: () => null }));
// Stand-in that shows which variant was rendered: the full-width bar or the small icon tile.
vi.mock('@/components/TikTokLoginButton', () => ({
   default: ({ iconOnly }: { iconOnly?: boolean }) => createElement('div', { 'data-tiktok': iconOnly ? 'tile' : 'full' })
}));
vi.mock('@/lib/tiktokAuth', () => ({ isTikTokButtonVisible: () => true }));

const TIKTOK_ANDROID_UA =
   'Mozilla/5.0 (Linux; Android 13; SM-A145F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36 musical_ly_2023405030 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/34.5.3 ByteLocale/en';
const TIKTOK_IOS_UA =
   'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_34.5.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/PH';
const FB_ANDROID_UA =
   'Mozilla/5.0 (Linux; Android 13; SM-A145F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.40.82;]';
const CHROME_ANDROID_UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36';

describe("TikTok tile inside TikTok's browser", () => {
   let container: HTMLDivElement;
   let root: Root;
   const originalUA = navigator.userAgent;

   const renderWith = async (ua: string) => {
      Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
      const { SocialAuthButtons } = await import('@/components/auth/SocialAuthButtons');
      await act(async () => {
         root.render(createElement(MemoryRouter, null, createElement(SocialAuthButtons, { isSignUp: true })));
      });
   };
   const fullTikTok = () => container.querySelector('[data-tiktok="full"]');
   const tikTokTile = () => container.querySelector('[data-tiktok="tile"]');

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

   it.each([
      ['Android', TIKTOK_ANDROID_UA],
      ['iPhone', TIKTOK_IOS_UA]
   ])('TikTok on %s: the small TikTok tile shows on its own (no Telegram/LINE)', async (_name, ua) => {
      await renderWith(ua);
      expect(fullTikTok()).toBeNull();
      expect(tikTokTile()?.closest('.hidden')).toBeNull();
      expect(container.querySelector('[data-line]')).toBeNull();
      expect(container.textContent).toContain('TikTok and email work here.');
   });

   it('Facebook browser: the tile row stays hidden', async () => {
      await renderWith(FB_ANDROID_UA);
      expect(tikTokTile()?.closest('.hidden')).not.toBeNull();
   });

   it('normal browser: TikTok stays a small tile', async () => {
      await renderWith(CHROME_ANDROID_UA);
      expect(fullTikTok()).toBeNull();
      expect(tikTokTile()?.closest('.hidden')).toBeNull();
      expect(container.querySelector('[data-line]')).not.toBeNull();
   });
});
