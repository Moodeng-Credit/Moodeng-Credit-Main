import { describe, expect, it } from 'vitest';

import { askFor, EARN_TYPES, kindsFor, sendNote } from '@/app/documents/incomeDocKinds';

const earn = (id: string) => EARN_TYPES.find((e) => e.id === id)!;

describe('proof-of-income documents by how you earn', () => {
   it('every way of earning has at least one document that can show months', () => {
      for (const e of EARN_TYPES) {
         expect(kindsFor(e, 0).length).toBeGreaterThan(0);
         expect(kindsFor(e, 2).length).toBeGreaterThan(0);
      }
   });

   it('leaves out documents that cannot show months when months are needed', () => {
      expect(kindsFor(earn('store'), 0).map((k) => k.id)).toContain('business_permit');
      expect(kindsFor(earn('store'), 2).map((k) => k.id)).not.toContain('business_permit');
   });

   it('asks for months only when the loan needs them', () => {
      const payslip = earn('job').kinds.find((k) => k.id === 'payslip')!;
      expect(askFor(payslip, 0)).toMatch(/latest payslip/);
      expect(askFor(payslip, 2)).toMatch(/2–3 payslips/);
   });

   it('every example has three things to show and three rows', () => {
      for (const k of EARN_TYPES.flatMap((e) => e.kinds)) {
         expect(k.example.rows).toHaveLength(3);
         expect(k.mustShow ?? ['a', 'b', 'c']).toHaveLength(3);
      }
   });

   it('writes the note the team sees, within the limit', () => {
      const rider = earn('rider');
      expect(sendNote(rider, rider.kinds[0], '  paid weekly ')).toBe('I drive or deliver · Earnings screen — paid weekly');
      expect(sendNote(rider, rider.kinds[0], '')).toBe('I drive or deliver · Earnings screen');
      expect(sendNote(rider, rider.kinds[0], 'x'.repeat(400)).length).toBe(300);
   });
});
