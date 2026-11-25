import { describe, expect, it } from 'vitest';

import { aboutVsId } from '@/app/admin/user/userDossierModel';

const NOW = new Date('2026-11-25T00:00:00Z').getTime();
type Input = Parameters<typeof aboutVsId>[0];
const person = (about: Record<string, unknown>, kyc: Array<Record<string, unknown>> = []) =>
   ({ user: { about_gender: null, about_age: null, about_kids: null, ...about }, kyc }) as unknown as Input;

describe('aboutVsId (sign-up card vs Didit, made-up people)', () => {
   it('is null when they never answered', () => {
      expect(aboutVsId(person({}), NOW)).toBeNull();
   });

   it('matches when gender agrees and age is within 5 years', () => {
      const a = aboutVsId(
         person({ about_gender: 'female', about_age: 27, about_kids: 2 }, [{ gender: 'F', date_of_birth: '1997-06-01' }]),
         NOW
      )!;
      expect(a.said).toBe('Woman · 27 · 2 kids');
      expect(a.mismatches).toEqual([]);
      expect(a.checked).toBe(true);
   });

   it('flags a different gender and an age more than 5 years off', () => {
      const a = aboutVsId(
         person({ about_gender: 'female', about_age: 22, about_kids: 0 }, [{ gender: 'M', date_of_birth: '1980-01-01' }]),
         NOW
      )!;
      expect(a.mismatches).toEqual(['ID says man', 'ID says 46']);
   });

   it('uses the newest check that read something, and says when there is nothing to compare', () => {
      const blankThenRead = person({ about_gender: 'male', about_age: 30, about_kids: 5 }, [
         { gender: null, date_of_birth: null },
         { gender: 'MALE', date_of_birth: '1996-01-01' }
      ]);
      const a = aboutVsId(blankThenRead, NOW)!;
      expect(a.said).toBe('Man · 30 · 5+ kids');
      expect(a.mismatches).toEqual([]);
      expect(aboutVsId(person({ about_gender: 'male', about_age: 30, about_kids: 1 }), NOW)).toMatchObject({
         checked: false,
         said: 'Man · 30 · 1 kid'
      });
   });
});
