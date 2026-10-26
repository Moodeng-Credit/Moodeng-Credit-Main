import { beforeEach, describe, expect, it, vi } from 'vitest';

import { trackNewAccount } from '@/lib/metaPixel';

const now = Date.parse('2026-10-22T12:00:00Z');
const minutesAgo = (m: number) => new Date(now - m * 60 * 1000).toISOString();

describe('metaPixel', () => {
   const fbq = vi.fn();

   beforeEach(() => {
      window.localStorage.clear();
      fbq.mockClear();
      (window as Window & { fbq?: unknown }).fbq = fbq;
   });

   it('sends CompleteRegistration once for an account created moments ago', () => {
      trackNewAccount('user-1', minutesAgo(2), now);
      trackNewAccount('user-1', minutesAgo(2), now);
      expect(fbq).toHaveBeenCalledTimes(1);
      expect(fbq).toHaveBeenCalledWith('track', 'CompleteRegistration', undefined);
   });

   it('skips existing accounts signing in again', () => {
      trackNewAccount('user-2', minutesAgo(60 * 24), now);
      trackNewAccount('user-3', '', now);
      expect(fbq).not.toHaveBeenCalled();
   });

   it('does nothing when the pixel is blocked', () => {
      delete (window as Window & { fbq?: unknown }).fbq;
      expect(() => trackNewAccount('user-4', minutesAgo(1), now)).not.toThrow();
   });
});
