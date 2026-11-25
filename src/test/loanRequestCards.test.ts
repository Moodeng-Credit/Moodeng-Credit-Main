import { describe, expect, it } from 'vitest';

import { getLoanRulesView, money, pesos, shortDay } from '@/lib/loanRequestCards';

describe('loan request cards', () => {
   it('promises the next level only for a full-limit loan', () => {
      const full = getLoanRulesView({ amount: 15, creditLimit: 15, joinedAt: '2026-11-20T00:00:00Z', dueIso: '2026-12-25' });
      expect(full.levelUp).toEqual({ from: 15, to: 25 });
      expect(full.dueDay).toBe('Dec 25');

      const less = getLoanRulesView({ amount: 10, creditLimit: 15, joinedAt: '2026-11-20T00:00:00Z', dueIso: '2026-12-25' });
      expect(less.levelUp).toBeNull();
   });

   it('follows the old ladder for Track A borrowers', () => {
      const view = getLoanRulesView({ amount: 20, creditLimit: 20, joinedAt: '2026-09-01T00:00:00Z', dueIso: '2026-12-25' });
      expect(view.levelUp).toEqual({ from: 20, to: 40 });
   });

   it('promises nothing with no limit or at the top', () => {
      expect(getLoanRulesView({ amount: 0, creditLimit: 0, dueIso: '' }).levelUp).toBeNull();
      expect(getLoanRulesView({ amount: 135, creditLimit: 135, dueIso: '2026-12-25' }).levelUp).toBeNull();
   });

   it('formats money and pesos', () => {
      expect(money(15)).toBe('$15');
      expect(money(16.5)).toBe('$16.50');
      expect(pesos(16.5, 58)).toBe('₱957');
      expect(shortDay('nope')).toBe('');
   });
});
