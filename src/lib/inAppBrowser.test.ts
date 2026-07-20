import { describe, expect, it } from 'vitest';

import { buildAndroidIntentUrl, detectInAppBrowser } from '@/lib/inAppBrowser';

// Real-world user-agent strings captured from the various in-app browsers.
const UA = {
   messengerIos:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/449.0.0;FBBV/000;FBDV/iPhone14,2]',
   facebookIos:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.0;FBBV/000;FBDV/iPhone14,2]',
   facebookAndroid:
      'Mozilla/5.0 (Linux; Android 13; SM-G991B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.0;]',
   instagramAndroid:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 Instagram 300.0.0.0 Android',
   lineIos:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/13.5.0',
   safariIos:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
   chromeAndroid:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
   chromeDesktop:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

describe('detectInAppBrowser', () => {
   it('names Messenger on iOS and cannot force a break-out', () => {
      const info = detectInAppBrowser(UA.messengerIos);
      expect(info.isInApp).toBe(true);
      expect(info.appName).toBe('Messenger');
      expect(info.os).toBe('ios');
      expect(info.canBreakOut).toBe(false);
   });

   it('names Facebook (not Messenger) for the plain FB app', () => {
      expect(detectInAppBrowser(UA.facebookIos).appName).toBe('Facebook');
   });

   it('detects Facebook on Android and allows a break-out', () => {
      const info = detectInAppBrowser(UA.facebookAndroid);
      expect(info.isInApp).toBe(true);
      expect(info.appName).toBe('Facebook');
      expect(info.os).toBe('android');
      expect(info.canBreakOut).toBe(true);
   });

   it('detects Instagram', () => {
      expect(detectInAppBrowser(UA.instagramAndroid).appName).toBe('Instagram');
   });

   it('detects LINE', () => {
      expect(detectInAppBrowser(UA.lineIos).appName).toBe('LINE');
   });

   it('treats real Safari as a normal browser', () => {
      const info = detectInAppBrowser(UA.safariIos);
      expect(info.isInApp).toBe(false);
      expect(info.appName).toBeNull();
   });

   it('treats real Chrome (mobile and desktop) as a normal browser', () => {
      expect(detectInAppBrowser(UA.chromeAndroid).isInApp).toBe(false);
      expect(detectInAppBrowser(UA.chromeDesktop).isInApp).toBe(false);
   });
});

describe('buildAndroidIntentUrl', () => {
   it('wraps an https URL in a Chrome intent with an https fallback', () => {
      const intent = buildAndroidIntentUrl('https://moodeng.app/lend/loan/42?ref=fb');
      expect(intent).toContain('intent://moodeng.app/lend/loan/42?ref=fb#Intent;');
      expect(intent).toContain('scheme=https');
      expect(intent).toContain('package=com.android.chrome');
      expect(intent).toContain(`S.browser_fallback_url=${encodeURIComponent('https://moodeng.app/lend/loan/42?ref=fb')}`);
      expect(intent.endsWith(';end')).toBe(true);
   });
});
