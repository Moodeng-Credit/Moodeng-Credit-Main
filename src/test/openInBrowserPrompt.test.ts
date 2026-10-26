import { describe, expect, it, vi } from 'vitest';

import { detectInAppBrowser } from '@/lib/inAppBrowser';
import { shouldShowOpenInBrowserPrompt, withArrivedTag, withoutArrivedTag } from '@/lib/openInBrowserPrompt';

const FB_ANDROID =
   'Mozilla/5.0 (Linux; Android 15; Pixel 7 Build/AP4A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/155.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/540.0.0.0;]';
const FB_IOS =
   'Mozilla/5.0 (iPhone; CPU iPhone OS 26_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23G83 [FBAN/FBIOS;FBAV/582.0.0.26.106;FBSN/iOS]';
const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36';
const TIKTOK_ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A515F; wv) AppleWebKit/537.36 Chrome/155 Mobile Safari/537.36 musical_ly_2023';

const base = { signedIn: false, continuedHere: false, enabled: true, pathname: '/sign-up' };

describe('the "open in Chrome / Safari" first screen', () => {
   it('shows inside Facebook / Messenger on Android and iPhone, before sign-up', () => {
      expect(shouldShowOpenInBrowserPrompt({ ...base, info: detectInAppBrowser(FB_ANDROID) })).toBe(true);
      expect(shouldShowOpenInBrowserPrompt({ ...base, info: detectInAppBrowser(FB_IOS), pathname: '/sign-in/' })).toBe(true);
   });

   it('never in a real browser, or in non-Meta apps', () => {
      expect(shouldShowOpenInBrowserPrompt({ ...base, info: detectInAppBrowser(CHROME_ANDROID) })).toBe(false);
      expect(shouldShowOpenInBrowserPrompt({ ...base, info: detectInAppBrowser(TIKTOK_ANDROID) })).toBe(false);
   });

   it('not for signed-in people (leaving would lose a guest), after "Continue here", when switched off, or on other pages', () => {
      const info = detectInAppBrowser(FB_ANDROID);
      expect(shouldShowOpenInBrowserPrompt({ ...base, info, signedIn: true })).toBe(false);
      expect(shouldShowOpenInBrowserPrompt({ ...base, info, continuedHere: true })).toBe(false);
      expect(shouldShowOpenInBrowserPrompt({ ...base, info, enabled: false })).toBe(false);
      expect(shouldShowOpenInBrowserPrompt({ ...base, info, pathname: '/onboarding/connect' })).toBe(false);
   });

   it('tags and untags the address for counting arrivals, keeping the rest', () => {
      expect(withArrivedTag('https://moodeng.app/sign-up?src=fb-post')).toBe('https://moodeng.app/sign-up?src=fb-post&ia=1');
      expect(withoutArrivedTag('https://moodeng.app/sign-up?src=fb-post&ia=1')).toBe('/sign-up?src=fb-post');
   });
});

describe('"Open in Safari" inside Facebook\'s iPhone browser', () => {
   it('copies the link and asks for the ⋯ steps instead of the dropped x-safari link', async () => {
      const { openInSafari, SAFARI_HELP_EVENT } = await import('@/lib/inAppBrowser');
      const exec = document.execCommand;
      document.execCommand = vi.fn(() => true);
      const shown = vi.fn();
      window.addEventListener(SAFARI_HELP_EVENT, shown);
      const before = window.location.href;
      expect(openInSafari('https://moodeng.app/sign-up', detectInAppBrowser(FB_IOS))).toBe(false);
      await Promise.resolve();
      await Promise.resolve();
      expect(document.execCommand).toHaveBeenCalledWith('copy');
      expect(shown).toHaveBeenCalledTimes(1);
      expect((shown.mock.calls[0][0] as CustomEvent).detail).toMatchObject({ url: 'https://moodeng.app/sign-up', copied: true });
      expect(window.location.href).toBe(before);
      window.removeEventListener(SAFARI_HELP_EVENT, shown);
      document.execCommand = exec;
   });
});
