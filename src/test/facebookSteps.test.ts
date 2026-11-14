import { describe, expect, it } from 'vitest';

import { FB_STEPS_CARD, FB_STEPS_TELEGRAM_KEYBOARD, fbStepsSentForCall, fbStepsStaleBefore } from '../../supabase/functions/_shared/facebookSteps';

describe('facebook steps on the call', () => {
   const call = '2026-11-15T10:00:00.000Z';

   it('keeps Messenger button titles within the 20-character cap', () => {
      for (const b of [FB_STEPS_CARD.button, ...FB_STEPS_CARD.moreButtons]) expect(b.title.length).toBeLessThanOrEqual(20);
      expect(FB_STEPS_CARD.title.length).toBeLessThanOrEqual(80);
      expect(FB_STEPS_CARD.subtitle.length).toBeLessThanOrEqual(80);
   });

   it('sends both links on both channels', () => {
      const messenger = [FB_STEPS_CARD.button.url, ...FB_STEPS_CARD.moreButtons.map((b) => b.url)];
      const telegram = FB_STEPS_TELEGRAM_KEYBOARD.flat().map((b) => b.url);
      expect(telegram).toEqual(messenger);
      expect(messenger).toHaveLength(2);
   });

   it('treats a send from an earlier booking as not sent for this call', () => {
      expect(fbStepsStaleBefore(call)).toBe('2026-11-14T22:00:00.000Z');
      expect(fbStepsSentForCall('2026-11-10T10:02:00.000Z', call)).toBe(false);
      expect(fbStepsSentForCall('2026-11-15T09:58:00.000Z', call)).toBe(true);
      expect(fbStepsSentForCall(null, call)).toBe(false);
   });
});
