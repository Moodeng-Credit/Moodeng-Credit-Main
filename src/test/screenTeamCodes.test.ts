import { describe, expect, it } from 'vitest';

import { isPersonalInviteCode } from '@/lib/preScreening';

describe('pre-screening link codes', () => {
   it('personal invite codes go through /invite, team codes (any case) do not', () => {
      expect(isPersonalInviteCode('MMYMTN27537')).toBe(true);
      expect(isPersonalInviteCode('mmymtn27537')).toBe(true);
      expect(isPersonalInviteCode('MAHJID')).toBe(false);
      expect(isPersonalInviteCode('irish')).toBe(false);
      expect(isPersonalInviteCode('IRISH2026')).toBe(false);
   });
});
