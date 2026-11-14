import { describe, expect, it } from 'vitest';

import {
   FB_STEPS_CARD,
   FB_STEPS_TELEGRAM_KEYBOARD,
   fbStepsCatchUpReason,
   fbStepsSentForCall,
   fbStepsStaleBefore
} from '../../supabase/functions/_shared/facebookSteps';

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

   describe('catch-up when the automatic send was missed', () => {
      const during = Date.parse('2026-11-15T10:08:00.000Z');
      const base = { startsAt: call, sentAt: null, outcome: null, arrivedAt: null, joinedAt: null, sheetUpdatedAt: null };

      it('does nothing when nothing says the borrower is there', () => {
         expect(fbStepsCatchUpReason(base, during)).toBeNull();
      });

      it('sends when the host is filling in the call sheet (Cal Video has no arrival ping)', () => {
         expect(fbStepsCatchUpReason({ ...base, sheetUpdatedAt: '2026-11-15T10:05:00.000Z' }, during)).toBe('call_sheet');
         expect(fbStepsCatchUpReason({ ...base, sheetUpdatedAt: '2026-11-15T09:40:00.000Z' }, during)).toBeNull();
      });

      it('sends when Zoom saw someone or the host tapped Showed up', () => {
         expect(fbStepsCatchUpReason({ ...base, arrivedAt: '2026-11-15T09:59:00.000Z' }, during)).toBe('zoom');
         expect(fbStepsCatchUpReason({ ...base, outcome: 'attended' }, during)).toBe('showed_up');
      });

      it('never sends twice, to a no-show, from an old sighting, or long after the call', () => {
         expect(fbStepsCatchUpReason({ ...base, outcome: 'attended', sentAt: '2026-11-15T10:01:00.000Z' }, during)).toBeNull();
         expect(fbStepsCatchUpReason({ ...base, outcome: 'no_show', arrivedAt: '2026-11-15T10:01:00.000Z' }, during)).toBeNull();
         expect(fbStepsCatchUpReason({ ...base, arrivedAt: '2026-11-10T10:01:00.000Z' }, during)).toBeNull();
         expect(fbStepsCatchUpReason({ ...base, outcome: 'attended' }, Date.parse('2026-11-15T13:00:00.000Z'))).toBeNull();
      });
   });
});
