import { describe, expect, it } from 'vitest';

import { classifyLogin, LOGIN_COLOR } from '../../supabase/functions/_shared/loginRisk';

describe('classifyLogin — login-feed risk levels', () => {
   it('is clean on a home/mobile network nobody else uses', () => {
      expect(classifyLogin(false, 0)).toEqual({ level: 'clean', flags: [] });
   });

   it('is caution (not risk) on a VPN, even when others share the VPN address', () => {
      const alone = classifyLogin(true, 0);
      expect(alone.level).toBe('caution');
      expect(alone.flags).toHaveLength(1);
      expect(alone.flags[0]).toContain('VPN / datacenter IP');

      const shared = classifyLogin(true, 2);
      expect(shared.level).toBe('caution');
      expect(shared.flags[1]).toContain('Same VPN address as 2 other accounts');
      expect(shared.flags[1]).toContain('weak signal');
   });

   it('is risk when another account shares the same real network', () => {
      const result = classifyLogin(false, 1);
      expect(result.level).toBe('risk');
      expect(result.flags[0]).toContain('Same home/mobile network as 1 other account ');
   });

   it('gives each level its own colour', () => {
      expect(new Set(Object.values(LOGIN_COLOR)).size).toBe(3);
   });
});
