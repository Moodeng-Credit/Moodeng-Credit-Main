import { describe, expect, it } from 'vitest';

import {
   buildChromeUrl,
   buildSafariUrl,
   detectInAppBrowser,
   isFacebookInApp
} from '@/lib/inAppBrowser';

const UA = {
   fbIos:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/420.0.0;FBBV/1;FBDV/iPhone14,2]',
   fbAndroid:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/420.0.0;]',
   messengerIos:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/MessengerForiOS;FBAV/420.0.0;]',
   instagramIos:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0.0 (iPhone14,2; iOS 16_5)',
   chromeAndroid:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
   safariIos:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
};

const REPAY = 'https://moodeng.app/repay';

describe('detectInAppBrowser', () => {
   it('flags Facebook on iOS and Android', () => {
      expect(detectInAppBrowser(UA.fbIos)).toMatchObject({ isInApp: true, os: 'ios', appName: 'Facebook' });
      expect(detectInAppBrowser(UA.fbAndroid)).toMatchObject({ isInApp: true, os: 'android', appName: 'Facebook', canBreakOut: true });
   });

   it('does not flag a normal mobile browser', () => {
      expect(detectInAppBrowser(UA.chromeAndroid).isInApp).toBe(false);
      expect(detectInAppBrowser(UA.safariIos).isInApp).toBe(false);
   });
});

describe('isFacebookInApp', () => {
   it('is true for Facebook and Messenger, false for Instagram / normal browsers', () => {
      expect(isFacebookInApp(detectInAppBrowser(UA.fbIos))).toBe(true);
      expect(isFacebookInApp(detectInAppBrowser(UA.messengerIos))).toBe(true);
      expect(isFacebookInApp(detectInAppBrowser(UA.instagramIos))).toBe(false);
      expect(isFacebookInApp(detectInAppBrowser(UA.chromeAndroid))).toBe(false);
   });
});

describe('buildChromeUrl', () => {
   it('builds an Android Chrome intent', () => {
      const url = buildChromeUrl(REPAY, detectInAppBrowser(UA.fbAndroid));
      expect(url).toMatch(/^intent:\/\/moodeng\.app\/repay#Intent;/);
      expect(url).toContain('package=com.android.chrome');
   });

   it('builds an iOS googlechromes scheme', () => {
      expect(buildChromeUrl(REPAY, detectInAppBrowser(UA.fbIos))).toBe('googlechromes://moodeng.app/repay');
   });
});

describe('buildSafariUrl', () => {
   it('builds an iOS x-safari link and nothing on Android', () => {
      expect(buildSafariUrl(REPAY, detectInAppBrowser(UA.fbIos))).toBe('x-safari-https://moodeng.app/repay');
      expect(buildSafariUrl(REPAY, detectInAppBrowser(UA.fbAndroid))).toBeNull();
   });
});
