import { describe, expect, it } from 'vitest';

import { EMPTY_MEDICAL, medicalAnswerText } from '@/lib/medicalPick';

describe('medicalAnswerText', () => {
   it('says no', () => expect(medicalAnswerText({ ...EMPTY_MEDICAL, who: 'no' })).toBe('no'));
   it('waits until who, where, what and since are in', () => {
      expect(medicalAnswerText({ ...EMPTY_MEDICAL, who: 'family', relation: 'Mother', parts: ['Tummy'] })).toBe('');
      expect(
         medicalAnswerText({ ...EMPTY_MEDICAL, who: 'family', relation: 'Mother', parts: ['Tummy'], conditions: ['Tummy: Liver'] })
      ).toBe('');
   });
   it('builds the plain answer the server grades', () =>
      expect(
         medicalAnswerText({
            ...EMPTY_MEDICAL,
            who: 'family',
            relation: 'Mother',
            parts: ['Tummy', 'Inside the body'],
            conditions: ['Tummy: Kidneys / dialysis', 'Inside the body: Diabetes / sugar'],
            since: 'A year or more',
            doctor: 'Can’t afford it',
            medicine: 'Yes, every month',
            detail: 'needs dialysis twice a week'
         })
      ).toBe(
         'My mother — Tummy: Kidneys / dialysis, Inside the body: Diabetes / sugar — since: a year or more — doctor: can’t afford it — medicine: yes, every month — needs dialysis twice a week'
      ));
   it('a few typed words work without tapping a problem', () =>
      expect(medicalAnswerText({ ...EMPTY_MEDICAL, who: 'me', parts: ['Back'], since: 'This week', detail: 'fell at work' })).toBe(
         'Me — Back — since: this week — fell at work'
      ));
});
