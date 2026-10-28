import { describe, expect, it } from 'vitest';

import { cleanUsernameInput, hasGeneratedUsername, suggestUsername, usernameProblem } from '@/lib/phoneAuth';

describe('phone sign-up usernames', () => {
   it('spots the made-up handle', () => {
      expect(hasGeneratedUsername('moodeng-ab12cd')).toBe(true);
      expect(hasGeneratedUsername('maya23')).toBe(false);
      expect(hasGeneratedUsername(undefined)).toBe(false);
   });

   it('keeps only URL-safe characters as they type', () => {
      expect(cleanUsernameInput('Maya Cruz!')).toBe('maya-cruz');
      expect(cleanUsernameInput('a'.repeat(30))).toHaveLength(20);
   });

   it('suggests from their name', () => {
      expect(suggestUsername('María Santos')).toBe('mariasantos');
      expect(suggestUsername('Jo')).toBe('');
      expect(suggestUsername('')).toBe('');
   });

   it('explains what is wrong', () => {
      expect(usernameProblem('ma')).toMatch(/at least 3/);
      expect(usernameProblem('-maya')).toMatch(/Start and end/);
      expect(usernameProblem('maya_')).toMatch(/Start and end/);
      expect(usernameProblem('moodeng-zzzzzz')).toMatch(/your own/);
      expect(usernameProblem('maya23')).toBeNull();
   });
});
