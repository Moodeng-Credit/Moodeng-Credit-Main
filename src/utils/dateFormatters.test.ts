import { afterEach, describe, expect, it } from 'vitest';

import { currentDateLocale, formatDate, getDateFormatterLocale } from '@/utils/dateFormatters';

describe('date formatting follows the app language', () => {
   afterEach(() => {
      document.documentElement.lang = 'en';
   });

   it('keeps the English format unchanged', () => {
      document.documentElement.lang = 'en';
      expect(currentDateLocale()).toBe('en-US');
      expect(formatDate('2024-01-15T00:00:00Z')).toBe('January 15, 2024');
   });

   it('uses the chosen language for other locales', () => {
      document.documentElement.lang = 'vi';
      expect(currentDateLocale()).toBe('vi-VN');
      expect(formatDate('2024-01-15')).not.toContain('January');
   });

   it('keeps the Gregorian year for Thai', () => {
      document.documentElement.lang = 'th';
      expect(getDateFormatterLocale('th')).toBe('th-TH-u-ca-gregory');
      expect(formatDate('2026-06-09')).toContain('2026');
   });
});
