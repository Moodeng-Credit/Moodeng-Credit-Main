import { beforeEach, describe, expect, it } from 'vitest';

import { consumeAuthReturnTo, isAllowedReturnPath, setAuthReturnTo } from '@/lib/authReturn';
import { consumeTikTokState, getTikTokRedirectUri, TIKTOK_OAUTH_STATE_KEY, writeTikTokState } from '@/lib/tiktokAuth';

describe('auth return path (/stocks round trip)', () => {
   beforeEach(() => localStorage.clear());

   it('only allows the money-lesson page', () => {
      expect(isAllowedReturnPath('/stocks')).toBe(true);
      for (const bad of ['/dashboard', 'https://evil.example', '//evil.example', '/stocks/../admin', '', null, undefined]) {
         expect(isAllowedReturnPath(bad as string | null | undefined)).toBe(false);
      }
   });

   it('round-trips an allowed path once, then clears it', () => {
      setAuthReturnTo('/stocks');
      expect(consumeAuthReturnTo()).toBe('/stocks');
      expect(consumeAuthReturnTo()).toBeNull();
   });

   it('ignores a path that is not on the allowlist', () => {
      setAuthReturnTo('https://evil.example');
      expect(consumeAuthReturnTo()).toBeNull();
   });

   it('expires a stale return path', () => {
      localStorage.setItem('moodeng:auth-return-to', JSON.stringify({ path: '/stocks', at: Date.now() - 16 * 60 * 1000 }));
      expect(consumeAuthReturnTo()).toBeNull();
   });

   it('refuses a tampered store that points somewhere else', () => {
      localStorage.setItem('moodeng:auth-return-to', JSON.stringify({ path: 'https://evil.example', at: Date.now() }));
      expect(consumeAuthReturnTo()).toBeNull();
   });
});

describe('TikTok OAuth state (CSRF)', () => {
   beforeEach(() => {
      localStorage.clear();
      sessionStorage.clear();
      // The state is also kept in a cookie, which jsdom shares across tests.
      document.cookie = `${TIKTOK_OAUTH_STATE_KEY}=; path=/; max-age=0`;
   });

   it('accepts a state this browser issued exactly once', () => {
      writeTikTokState('abc');
      expect(consumeTikTokState('abc')).toBe(true);
      expect(consumeTikTokState('abc')).toBe(false);
   });

   it('rejects a state it never issued, or an empty one', () => {
      writeTikTokState('abc');
      expect(consumeTikTokState('zzz')).toBe(false);
      expect(consumeTikTokState('')).toBe(false);
      expect(consumeTikTokState(null)).toBe(false);
   });

   it('keeps several in-flight logins independent', () => {
      writeTikTokState('one');
      writeTikTokState('two');
      expect(consumeTikTokState('one')).toBe(true);
      expect(consumeTikTokState('two')).toBe(true);
      expect(localStorage.getItem(TIKTOK_OAUTH_STATE_KEY)).toBeNull();
   });

   it('builds the redirect URI from the current origin', () => {
      expect(getTikTokRedirectUri()).toBe(`${window.location.origin}/auth/tiktok/callback`);
   });
});
