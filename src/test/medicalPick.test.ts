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
            future: 'monthly',
            futureAmount: 'Over ₱10,000 a month',
            payer: 'Me',
            detail: 'needs dialysis twice a week'
         })
      ).toBe(
         'My mother — Tummy: Kidneys / dialysis, Inside the body: Diabetes / sugar — since: a year or more — doctor: can’t afford it — medicine: yes, every month — more costs: every month, about over ₱10,000 a month, paid by me — needs dialysis twice a week'
      ));
   it('a few typed words work without tapping a problem', () =>
      expect(
         medicalAnswerText({ ...EMPTY_MEDICAL, who: 'me', parts: ['Back'], since: 'This week', future: 'done', detail: 'fell at work' })
      ).toBe('Me — Back — since: this week — more costs: no, done or already paid — fell at work'));
   it('needs the future-cost answer, and amount + payer when costs are coming', () => {
      const base = { ...EMPTY_MEDICAL, who: 'me' as const, parts: ['Back'], since: 'This week', detail: 'fell at work' };
      expect(medicalAnswerText(base)).toBe('');
      expect(medicalAnswerText({ ...base, future: 'once' })).toBe('');
      expect(medicalAnswerText({ ...base, future: 'once', futureAmount: '₱2,000–10,000', payer: 'PhilHealth / free program' })).toContain(
         'more costs: one more, about ₱2,000–10,000, paid by philhealth / free program'
      );
   });
});
