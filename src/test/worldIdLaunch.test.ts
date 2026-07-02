import { afterEach, describe, expect, it } from 'vitest';

import {
   buildWorldIdReturnToUrl,
   getRequestUsableUntilMs,
   isAndroidDevice,
   isIOSDevice,
   isPreparedRequestStale,
   needsCurrentTabWorldAppLaunch,
   REQUEST_EXPIRY_SAFETY_MS
} from '@/components/worldId/worldIdLaunch';

const setUserAgent = (userAgent: string) => {
   Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
};

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

describe('worldIdLaunch request expiry', () => {
   it('derives the usable-until timestamp with the safety margin', () => {
      const expiresAtSec = 1_800_000_000;
      expect(getRequestUsableUntilMs(expiresAtSec)).toBe(expiresAtSec * 1000 - REQUEST_EXPIRY_SAFETY_MS);
   });

   it('treats a request as fresh before its usable-until timestamp', () => {
      expect(isPreparedRequestStale({ usableUntilMs: 10_000 }, 9_999)).toBe(false);
   });

   it('treats a request as stale at and after its usable-until timestamp', () => {
      expect(isPreparedRequestStale({ usableUntilMs: 10_000 }, 10_000)).toBe(true);
      expect(isPreparedRequestStale({ usableUntilMs: 10_000 }, 10_001)).toBe(true);
   });

   it('a request created with the backend 5-minute TTL is stale after ~4.5 minutes', () => {
      const nowMs = 1_800_000_000_000;
      const usableUntilMs = getRequestUsableUntilMs(nowMs / 1000 + 300);
      expect(isPreparedRequestStale({ usableUntilMs }, nowMs + 4 * 60 * 1000)).toBe(false);
      expect(isPreparedRequestStale({ usableUntilMs }, nowMs + 5 * 60 * 1000)).toBe(true);
   });
});

describe('buildWorldIdReturnToUrl', () => {
   it('appends the return marker fragment', () => {
      expect(buildWorldIdReturnToUrl('https://moodeng.app/verify')).toBe('https://moodeng.app/verify#worldid-return');
   });

   it('preserves the query string', () => {
      expect(buildWorldIdReturnToUrl('https://moodeng.app/verify?step=2')).toBe('https://moodeng.app/verify?step=2#worldid-return');
   });

   it('replaces an existing fragment', () => {
      expect(buildWorldIdReturnToUrl('https://moodeng.app/verify#other')).toBe('https://moodeng.app/verify#worldid-return');
   });

   it('returns the input untouched when it is not a valid URL', () => {
      expect(buildWorldIdReturnToUrl('not a url')).toBe('not a url');
   });
});

describe('device detection', () => {
   const originalUserAgent = window.navigator.userAgent;

   afterEach(() => {
      setUserAgent(originalUserAgent);
   });

   it('detects Android and requires a current-tab launch', () => {
      setUserAgent(ANDROID_UA);
      expect(isAndroidDevice()).toBe(true);
      expect(isIOSDevice()).toBe(false);
      expect(needsCurrentTabWorldAppLaunch()).toBe(true);
   });

   it('detects iPhone and requires a current-tab launch', () => {
      setUserAgent(IPHONE_UA);
      expect(isIOSDevice()).toBe(true);
      expect(isAndroidDevice()).toBe(false);
      expect(needsCurrentTabWorldAppLaunch()).toBe(true);
   });

   it('desktop keeps the new-tab launch', () => {
      setUserAgent(DESKTOP_UA);
      expect(isAndroidDevice()).toBe(false);
      expect(isIOSDevice()).toBe(false);
      expect(needsCurrentTabWorldAppLaunch()).toBe(false);
   });
});
