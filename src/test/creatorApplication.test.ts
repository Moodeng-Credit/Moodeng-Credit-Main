import { describe, expect, it } from 'vitest';

import { EMPTY_CREATOR_FORM, safeHttpUrl, suggestCreatorCode, validateCreatorForm } from '@/lib/creatorApplication';

describe('creator application', () => {
   it('needs name, address, phone, email, one channel and consent', () => {
      expect(Object.keys(validateCreatorForm(EMPTY_CREATOR_FORM)).sort()).toEqual([
         'address',
         'consent',
         'email',
         'full_name',
         'phone',
         'socials'
      ]);
      const ok = {
         ...EMPTY_CREATOR_FORM,
         full_name: 'Test Creator',
         address: '1 Test St, Manila',
         phone: '+63 900 000 0000',
         email: 'creator@example.com',
         tiktok_url: 'https://tiktok.com/@test',
         consent: true
      };
      expect(validateCreatorForm(ok)).toEqual({});
   });

   it('suggests a code from the first name', () => {
      expect(suggestCreatorCode('Maya Santos')).toBe('MAYA');
      expect(suggestCreatorCode('Jo')).toBe('JOMOO');
   });

   it('only allows http(s) links', () => {
      expect(safeHttpUrl('tiktok.com/@x')).toBe('https://tiktok.com/@x');
      expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
      expect(safeHttpUrl('')).toBeNull();
   });
});
