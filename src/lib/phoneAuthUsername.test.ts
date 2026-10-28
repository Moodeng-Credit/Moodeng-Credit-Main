import { describe, expect, it } from 'vitest';

import { hasGeneratedUsername, usernameCandidatesFromName } from '@/lib/phoneAuth';

describe('phone sign-up usernames', () => {
   it('spots the made-up handle', () => {
      expect(hasGeneratedUsername('moodeng-ab12cd')).toBe(true);
      expect(hasGeneratedUsername('maya23')).toBe(false);
      expect(hasGeneratedUsername(undefined)).toBe(false);
   });

   it('builds usernames from their name', () => {
      expect(usernameCandidatesFromName('María Santos', 3)).toEqual(['mariasantos', 'mariasantos2', 'mariasantos3']);
      expect(usernameCandidatesFromName("Jay-R O'Neil")[0]).toBe('jayroneil');
   });

   it('gives up on names with nothing usable', () => {
      expect(usernameCandidatesFromName('Jo')).toEqual([]);
      expect(usernameCandidatesFromName('김민수')).toEqual([]);
      expect(usernameCandidatesFromName('')).toEqual([]);
   });
});
