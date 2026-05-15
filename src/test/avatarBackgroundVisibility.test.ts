import { describe, expect, it } from 'vitest';

import { hasVisibleAvatarBackgroundArea } from '@/lib/avatarBackgroundVisibility';

const makeImageData = (width: number, height: number, alphaForIndex: (index: number) => number) => {
   const data = new Uint8ClampedArray(width * height * 4);

   for (let pixel = 0; pixel < width * height; pixel += 1) {
      const offset = pixel * 4;
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = alphaForIndex(pixel);
   }

   return { data, height, width };
};

describe('avatarBackgroundVisibility', () => {
   it('hides background controls for fully opaque photos', () => {
      expect(hasVisibleAvatarBackgroundArea(makeImageData(10, 10, () => 255))).toBe(false);
   });

   it('shows background controls when the image has meaningful transparent space', () => {
      expect(hasVisibleAvatarBackgroundArea(makeImageData(10, 10, (index) => (index < 12 ? 0 : 255)))).toBe(true);
   });
});
