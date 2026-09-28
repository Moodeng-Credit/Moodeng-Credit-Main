import { describe, expect, it } from 'vitest';

import { detectRegion, suggestLocaleForRegion } from '@/i18n/region';

describe('detectRegion', () => {
   it('prefers a region-tagged browser language over the time zone', () => {
      expect(detectRegion({ browserLocales: ['en-PH'], timeZone: 'Asia/Bangkok' })).toBe('PH');
      expect(detectRegion({ browserLocales: ['en-US', 'id-ID'], timeZone: 'Asia/Manila' })).toBe('ID');
   });

   it('falls back to the device time zone', () => {
      expect(detectRegion({ browserLocales: ['en-US'], timeZone: 'Asia/Jakarta' })).toBe('ID');
      expect(detectRegion({ browserLocales: ['en'], timeZone: 'Asia/Ho_Chi_Minh' })).toBe('VN');
      expect(detectRegion({ browserLocales: [], timeZone: 'Asia/Bangkok' })).toBe('TH');
   });

   it('returns null outside our markets', () => {
      expect(detectRegion({ browserLocales: ['en-US'], timeZone: 'America/New_York' })).toBeNull();
      expect(detectRegion({})).toBeNull();
   });
});

describe('suggestLocaleForRegion', () => {
   it('maps each market to its language', () => {
      expect(suggestLocaleForRegion('PH')).toBe('fil');
      expect(suggestLocaleForRegion('ID')).toBe('id');
      expect(suggestLocaleForRegion('TH')).toBe('th');
      expect(suggestLocaleForRegion('VN')).toBe('vi');
      expect(suggestLocaleForRegion(null)).toBeNull();
   });
});
