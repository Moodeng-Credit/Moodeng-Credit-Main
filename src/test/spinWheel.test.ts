import { describe, expect, it } from 'vitest';

import { parseSpinState, sliceAt, type SpinPrize, targetRotation, WHEEL_SLICES } from '@/lib/spinWheel';

describe('Moo-Spin wheel landing', () => {
   const prizes: SpinPrize[] = ['grab100', 'food50', 'locked50', 'extra', 'none'];

   it('always lands on a slice showing the drawn prize, turning forward', () => {
      for (const prize of prizes) {
         let rotation = 0;
         for (let i = 0; i < 200; i += 1) {
            const roll = (i * 0.618) % 1;
            const next = targetRotation(prize, rotation, roll);
            expect(next).toBeGreaterThan(rotation + 360 * 4);
            expect(WHEEL_SLICES[sliceAt(next)].prize).toBe(prize);
            rotation = next;
         }
      }
   });

   it('every prize has a slice', () => {
      for (const prize of prizes) expect(WHEEL_SLICES.some((slice) => slice.prize === prize)).toBe(true);
   });
});

describe('parseSpinState', () => {
   it('tolerates missing keys', () => {
      const state = parseSpinState({ ready: '2', prizes: [{ id: 'a', prize: 'bogus', amountPhp: '50', status: 'claimable' }] });
      expect(state.ready).toBe(2);
      expect(state.blocked).toBeNull();
      expect(state.segment).toBe('new');
      expect(state.prizes[0].prize).toBe('none');
      expect(state.potLeft.grab100).toBe(0);
   });
});
