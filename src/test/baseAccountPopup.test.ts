import { describe, expect, it, vi } from 'vitest';

import { getBaseAccountPopupFeatures, installBaseAccountPopupSizePatch } from '@/lib/baseAccountPopup';

describe('baseAccountPopup', () => {
   it('enlarges the Base Account popup features on desktop', () => {
      expect(
         getBaseAccountPopupFeatures('width=420, height=700, left=10, top=20', {
            innerWidth: 1440,
            innerHeight: 900,
            screen: { availWidth: 1440, availHeight: 900 }
         })
      ).toBe(
         'width=520, height=820, left=10, top=20'
      );
   });

   it('keeps the Base Account popup inside a narrow mobile-sized viewport', () => {
      expect(
         getBaseAccountPopupFeatures('width=420, height=700, left=10, top=20', {
            innerWidth: 390,
            innerHeight: 844,
            screen: { availWidth: 390, availHeight: 844 }
         })
      ).toBe('width=374, height=820, left=10, top=20');
   });

   it('only rewrites Base Account popup windows', () => {
      const open = vi.fn();
      const fakeWindow = {
         innerWidth: 1440,
         innerHeight: 900,
         location: { origin: 'https://home.moodeng.app' },
         open,
         screen: { availWidth: 1440, availHeight: 900 }
      } as unknown as Window & typeof globalThis;

      installBaseAccountPopupSizePatch(fakeWindow);
      fakeWindow.open('https://keys.coinbase.com/connect?sdkName=test', 'wallet_test', 'width=420, height=700');
      fakeWindow.open('https://example.com/connect', 'other', 'width=420, height=700');

      expect(open).toHaveBeenNthCalledWith(1, 'https://keys.coinbase.com/connect?sdkName=test', 'wallet_test', 'width=520, height=820');
      expect(open).toHaveBeenNthCalledWith(2, 'https://example.com/connect', 'other', 'width=420, height=700');
   });
});
