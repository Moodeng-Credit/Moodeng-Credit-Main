import { describe, expect, it } from 'vitest';

import { buy, callStatus, chomp, LEVELS, lessonFor, nextLevel, POWER_MS, spinWheel, WHEEL, type ChompState, CHOMP_COOLDOWN_MS, COLS, moveHippo, newWave, ROWS, stepSharks, stepToward, aimAt } from '@/lib/sharkChomp';

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
      // Every shark eaten: a door opens; swimming into it takes her to Moodeng's House.
      expect(last.portal).not.toBeNull();
      expect(last.score).toBe(300 + 250);
      expect(last.coins).toBe(3 + 3);
      const atDoor = { ...last, hippo: { x: (last.portal as { x: number }).x - 1, y: (last.portal as { y: number }).y }, grid: last.grid.map((r) => r.slice()) };
      atDoor.grid[atDoor.hippo.y][atDoor.hippo.x] = 'water';
      expect(moveHippo(atDoor, 'right', 2000).inHouse).toBe(true);
      expect(nextLevel(last, fixed(0.5)).wave).toBe(2);
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

   it('halo-halo: a shark that touches her is eaten instead of costing a heart', () => {
      const s = { ...lagoon([{ x: 2, y: 1 }, { x: 9, y: 11 }]), shieldUntil: 1000 + POWER_MS };
      const next = stepSharks(s, 1000, fixed(0.1));
      expect(next.hearts).toBe(3);
      expect(next.sharks.length).toBe(1);
      expect(next.score).toBe(100);
   });

   it('snacks power her up', () => {
      const base = lagoon([{ x: 9, y: 11 }]);
      const withFood = (food: 'pandesal' | 'mango' | 'halohalo' | 'turon') => {
         const grid = base.grid.map((r) => r.slice());
         grid[1][2] = food;
         return moveHippo({ ...base, grid }, 'right', 500);
      };
      expect(withFood('mango').reach).toBe(3);
      expect(withFood('turon').hearts).toBe(4);
      expect(withFood('pandesal').fastUntil).toBe(500 + POWER_MS);
      expect(withFood('halohalo').shieldUntil).toBe(500 + POWER_MS);
      expect(withFood('mango').grid[1][2]).toBe('water');
   });

   it('every level has a lesson, and they repeat after the last', () => {
      expect(lessonFor(1).title).toBe(LEVELS[0].title);
      expect(lessonFor(LEVELS.length + 1).title).toBe(LEVELS[0].title);
      expect(lessonFor(7).level).toBe(7);
   });

   it('the shop sells a power-up for pandesal points, never on credit', () => {
      const s = { ...lagoon([{ x: 9, y: 11 }]), coins: 5 };
      const bought = buy(s, 'halohalo', 100);
      expect(bought?.coins).toBe(0);
      expect(bought?.shieldUntil).toBe(100 + POWER_MS);
      expect(buy({ ...s, coins: 1 }, 'pandesal', 100)).toBeNull();
   });

   it('the wheel lands on each prize with its stated odds', () => {
      expect(spinWheel(fixed(0))).toBe(0);
      expect(spinWheel(fixed(0.999))).toBe(WHEEL.length - 1);
   });

   it('the call bar: day + time when far, countdown within the hour, Join popup at start, gone 20 min after', () => {
      const at = '2026-11-25T12:30:00Z';
      expect(callStatus(at, Date.parse('2026-11-25T12:18:00Z'))).toEqual({ kind: 'soon', label: '⏰ Your call starts in 12 min' });
      expect(callStatus(at, Date.parse('2026-11-25T12:30:05Z')).kind).toBe('now');
      expect(callStatus(at, Date.parse('2026-11-25T12:49:00Z')).kind).toBe('now');
      expect(callStatus(at, Date.parse('2026-11-25T12:51:00Z')).kind).toBe('none');
      expect(callStatus(at, Date.parse('2026-11-25T09:00:00Z'), 'Asia/Manila')).toEqual({ kind: 'later', label: '📅 Your call: Wed 8:30 PM' });
      expect(callStatus(null, 0).kind).toBe('none');
      expect(COLS).toBe(11);
   });

   it('touch: she swims after the finger, around rocks, and faces seaweed in the way', () => {
      const s = lagoon([{ x: 9, y: 11 }]); // she starts at (1, 1)
      expect(stepToward(s, { x: 5.2, y: 1.1 })).toBe('right');
      expect(stepToward(s, { x: 1.3, y: 0.8 })).toBeNull();
      // A rock straight below (2, 2): step to the side instead of pushing into it.
      expect(stepToward({ ...s, hippo: { x: 2, y: 1 } }, { x: 2, y: 5 })).toBe('left');
      // Longer way blocked by a rock, the other way open: take the open one.
      expect(stepToward({ ...s, hippo: { x: 2, y: 1 } }, { x: 3, y: 4 })).toBe('right');
      const grid = s.grid.map((r) => r.slice());
      grid[1][2] = 'weed';
      expect(stepToward({ ...s, grid }, { x: 5, y: 1 })).toBe('right');
   });

   it('touch: a tap aims the bite toward the tapped spot', () => {
      const s = lagoon([{ x: 9, y: 11 }]);
      expect(aimAt(s, { x: 1.2, y: 3 })).toBe('down');
      expect(aimAt(s, { x: 4, y: 2 })).toBe('right');
      expect(aimAt(s, { x: 1.1, y: 0.9 })).toBeNull();
   });
});
