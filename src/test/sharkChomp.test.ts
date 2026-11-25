import { describe, expect, it } from 'vitest';

import { callCountdownLabel, chomp, type ChompState, CHOMP_COOLDOWN_MS, COLS, moveHippo, newWave, ROWS, stepSharks } from '@/lib/sharkChomp';

// Deterministic rng: always the same value.
const fixed = (v: number) => () => v;

// An empty lagoon (rocks only) with the given sharks, for exact checks.
const lagoon = (sharks: Array<{ x: number; y: number }>): ChompState => {
   const s = newWave(1, fixed(0.99)); // 0.99 → no seaweed
   return { ...s, sharks: sharks.map((p, i) => ({ ...p, id: i + 1, dir: 'left' as const })) };
};

describe('Shark Chomp rules', () => {
   it('builds a walled lagoon with her corner clear and sharks away from her', () => {
      const s = newWave(1, Math.random);
      expect(s.grid.length).toBe(ROWS);
      expect(s.grid[0].every((t) => t === 'rock')).toBe(true);
      expect(s.grid[1][1]).toBe('water');
      expect(s.sharks.length).toBe(3);
      for (const k of s.sharks) expect(k.x + k.y).toBeGreaterThanOrEqual(9);
   });

   it('rocks block her, but she still turns to face that way', () => {
      const s = lagoon([{ x: 9, y: 11 }]);
      const next = moveHippo(s, 'up', 0);
      expect(next.hippo).toEqual({ x: 1, y: 1 });
      expect(next.facing).toBe('up');
   });

   it('a chomp eats sharks in a line up to her reach, then clears the wave when none are left', () => {
      const s = { ...lagoon([{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 9, y: 11 }]), facing: 'right' as const };
      const bitten = chomp(s, 1000, fixed(0.5));
      expect(bitten.sharks.map((k) => k.x)).toEqual([9]);
      expect(bitten.score).toBe(200);
      const last = chomp({ ...bitten, hippo: { x: 9, y: 9 }, facing: 'down', sharks: [{ x: 9, y: 10, id: 3, dir: 'up' }] }, 1000 + CHOMP_COOLDOWN_MS, fixed(0.5));
      expect(last.wave).toBe(2);
      expect(last.score).toBe(300 + 250);
   });

   it('a shark right next to her is eaten whichever way she faces (diagonals too)', () => {
      const s = { ...lagoon([{ x: 2, y: 2 }, { x: 9, y: 11 }]), hippo: { x: 1, y: 1 }, facing: 'up' as const };
      const bitten = chomp(s, 1000, fixed(0.5));
      expect(bitten.sharks.map((k) => k.x)).toEqual([9]);
      expect(bitten.score).toBe(100);
   });

   it('the chomp dashes her forward to where the bite lands', () => {
      const s = { ...lagoon([{ x: 9, y: 11 }]), facing: 'right' as const };
      const bitten = chomp(s, 1000, fixed(0.5));
      expect(bitten.hippo).toEqual({ x: 3, y: 1 });
      const blocked = chomp({ ...s, facing: 'up' }, 1000, fixed(0.5));
      expect(blocked.hippo).toEqual({ x: 1, y: 1 });
   });

   it('seaweed stops the bite', () => {
      const s = { ...lagoon([{ x: 4, y: 1 }]), facing: 'right' as const, reach: 3 };
      s.grid = s.grid.map((r) => r.slice());
      s.grid[1][2] = 'weed';
      const bitten = chomp(s, 1000, fixed(0.5));
      expect(bitten.grid[1][2]).toBe('water');
      expect(bitten.sharks.length).toBe(1);
   });

   it('a shark reaching her costs one heart, then a short grace', () => {
      const s = lagoon([{ x: 2, y: 1 }]);
      const hit = stepSharks(s, 1000, fixed(0.1));
      expect(hit.hearts).toBe(2);
      const again = stepSharks({ ...hit, sharks: [{ x: 1, y: 1, id: 1, dir: 'left' }] }, 1500, fixed(0.1));
      expect(again.hearts).toBe(2);
   });

   it('the call bar counts down, then says it is starting', () => {
      const at = '2026-11-25T12:30:00Z';
      expect(callCountdownLabel(at, Date.parse('2026-11-25T12:18:00Z'))).toBe('Your call starts in 12 min');
      expect(callCountdownLabel(at, Date.parse('2026-11-25T12:30:05Z'))).toBe('Your call is starting now!');
      expect(callCountdownLabel(null, 0)).toBeNull();
      expect(COLS).toBe(11);
   });
});
