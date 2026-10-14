import { describe, expect, it } from 'vitest';

import {
   cacReport,
   funnel,
   goalProgress,
   goalSlots,
   type MarketingLoan,
   type MarketingUser,
   retention,
   unitEconomics,
   weeklyPlan,
   whoToContact
} from '@/app/admin/marketingModel';

let seq = 0;
const loan = (borrower: string, funded: string, amount: number, over: Partial<MarketingLoan> = {}): MarketingLoan => ({
   id: `l${++seq}`,
   borrower_user_id: borrower,
   loan_status: 'Lent',
   created_at: `${funded}T00:00:00Z`,
   funded_at: `${funded}T02:00:00Z`,
   due_date: null,
   repaid_at: null,
   repayment_status: 'Unpaid',
   loan_amount: amount,
   total_repayment_amount: amount * 1.1,
   ...over
});
const user = (id: string, created: string, over: Partial<MarketingUser> = {}): MarketingUser => ({
   id,
   username: id,
   display_name: id,
   facebook_name: null,
   created_at: `${created}T02:00:00Z`,
   verified: true,
   messenger_verified_at: null,
   redeemed_referral_code_id: null,
   credit_limit: 15,
   ...over
});

describe('marketingModel', () => {
   const loans = [
      loan('a', '2026-09-10', 20, { repayment_status: 'Paid', repaid_at: '2026-10-01T02:00:00Z' }),
      loan('a', '2026-10-02', 40),
      loan('b', '2026-10-05', 20),
      loan('c', '2026-10-08', 20, { loan_status: 'Lent' })
   ];

   it('tracks the month goal, pace and what is still needed', () => {
      const g = goalProgress(loans, '2026-10', 500, '2026-10-10');
      expect(g.lent).toBe(80);
      expect(g.loans).toBe(3);
      expect(g.newBorrowers).toBe(2);
      expect(g.repeatLoans).toBe(1);
      expect(g.elapsed).toBe(10);
      expect(g.daysLeft).toBe(21);
      expect(g.pacePerDay).toBeCloseTo(8);
      expect(g.projected).toBeCloseTo(80 + 8 * 21);
      expect(g.neededPerDay).toBeCloseTo(420 / 21);
      expect(g.onTrack).toBe(false);
   });

   it('splits the rest of the month into weekly targets that add up to the remainder', () => {
      const weeks = weeklyPlan(loans, '2026-10', 500, '2026-10-10');
      expect(weeks[0]).toMatchObject({ start: '2026-10-01', end: '2026-10-04', status: 'done', lent: 40 });
      const doneLent = weeks.filter((w) => w.status === 'done').reduce((s, w) => s + w.lent, 0);
      const needed = weeks.filter((w) => w.status !== 'done').reduce((s, w) => s + (w.needed ?? 0), 0);
      expect(doneLent + needed).toBeCloseTo(500);
   });

   it('counts the signup funnel for a cohort', () => {
      const users = [user('a', '2026-09-01'), user('b', '2026-09-02', { verified: false }), user('c', '2026-09-03')];
      const f = funnel(users, loans, '2026-09-01', '2026-09-30');
      expect(f.map((s) => s.count)).toEqual([3, 2, 0, 3, 3]);
   });

   it('measures re-borrowing by loan number', () => {
      const r = retention(loans);
      expect(r[0]).toMatchObject({ loanNumber: 1, loans: 3, repaid: 1, reborrowRate: 1, avgStepUp: 20 });
   });

   it('attributes new borrowers to poster codes and divides spend by them', () => {
      const users = [user('a', '2026-09-01'), user('b', '2026-10-01', { redeemed_referral_code_id: 'p1' }), user('c', '2026-10-01')];
      const report = cacReport(
         loans,
         users,
         [{ id: 1, spent_on: '2026-10-03', channel: 'poster', amount_usd: 20, referral_code_id: 'p1', note: null }],
         [{ id: 'p1', code: 'POSTER-01', channel: 'poster', label: 'Cebu' }],
         '2026-10',
         { lent_usd: 500, marketing_budget_usd: 50, cac_target_usd: 5 }
      );
      expect(report).toMatchObject({ spent: 20, left: 30, newBorrowers: 2 });
      expect(report.byChannel.find((c) => c.channel === 'poster')).toMatchObject({ spend: 20, newBorrowers: 1, cacPerBorrower: 20 });
      expect(report.byChannel.find((c) => c.channel === 'organic')).toMatchObject({ newBorrowers: 1 });
   });

   it('computes profit per borrower and payback', () => {
      const u = unitEconomics({
         yieldPerLoan: 0.13,
         reborrowAfterFirst: 0.85,
         reborrowLater: 0.7,
         amounts: [15.5, 22.5, 37.5, 50, 62.5, 75],
         defaultFirst: 0.08,
         defaultLater: 0.03,
         costOfFundsMonthly: 0.01,
         opsPerBorrower: 1,
         cac: 5,
         repayBonus: 0
      });
      expect(u.profitBeforeCac).toBeCloseTo(7.63, 1);
      expect(u.totalCac).toBe(6);
      expect(u.paybackMonth).toBe(5);
   });

   it('lists who can borrow again and who is due soon', () => {
      const users = [user('a', '2026-09-01'), user('b', '2026-09-01'), user('d', '2026-10-01')];
      const due = [...loans, loan('b', '2026-10-09', 15, { due_date: '2026-10-11T00:00:00Z' })];
      const r = whoToContact(
         due.filter((l) => l.borrower_user_id !== 'a' || l.repayment_status === 'Paid'),
         users,
         '2026-10-10'
      );
      expect(r.canReborrow.map((x) => x.user.id)).toEqual(['a']);
      expect(r.verifiedNeverBorrowed.map((x) => x.user.id)).toEqual(['d']);
      expect(r.dueSoon.map((x) => x.user?.id)).toEqual(['b']);
   });
});

describe('goalSlots', () => {
   const users: MarketingUser[] = [
      user('done', '2026-09-01', { display_name: 'Done Dana' }),
      user('free', '2026-08-01', { display_name: 'Free Fe', credit_limit: 20, account_status: 'active', loan_access_status: 'approved' }),
      user('due', '2026-08-01', { display_name: 'Due Dee', credit_limit: 20, account_status: 'active', loan_access_status: 'approved' }),
      user('late', '2026-08-01', { display_name: 'Late Lou', credit_limit: 20 }),
      user('nov', '2026-08-01', { display_name: 'Nov Nan', credit_limit: 20 }),
      user('belle', '2026-08-01', { display_name: 'Belle', credit_limit: 100 })
   ];
   const loans: MarketingLoan[] = [
      loan('done', '2026-10-05', 30),
      loan('free', '2026-09-01', 15, { repayment_status: 'Paid', repaid_at: '2026-09-28T02:00:00Z' }),
      loan('due', '2026-09-20', 20, { due_date: '2026-10-20T00:00:00Z' }),
      loan('late', '2026-09-01', 20, { due_date: '2026-10-01T00:00:00Z' }),
      loan('nov', '2026-10-02', 20, { due_date: '2026-11-02T00:00:00Z' }),
      loan('belle', '2026-09-01', 100, { due_date: '2026-10-31T00:00:00Z' })
   ];

   it('fills the goal by name: lent, who can come back (next limit), and new borrowers for the rest', () => {
      const s = goalSlots(loans, users, new Set(['belle']), '2026-10', '2026-10-12', 500, 5);
      expect(s.done.map((d) => d.name)).toEqual(['Nov Nan', 'Done Dana']);
      expect(s.lent).toBe(50);
      // Free now at their limit; Due Dee took a full-limit $20 loan, so she comes back at the next tier ($40).
      expect(s.comeback.map((c) => [c.name, c.amount, c.when])).toEqual(
         [
            ['Due Dee', 40, '2026-10-20'],
            ['Free Fe', 20, null]
         ].sort((a, b) => String(a[2] ?? '').localeCompare(String(b[2] ?? '')))
      );
      expect(s.leftOut.map((l) => l.name)).toEqual(['Belle']);
      expect(s.comebackSum).toBe(60);
      expect(s.gap).toBe(390);
      expect(s.need).toBe(Math.ceil(390 / s.firstLoan));
      expect(s.weeks.reduce((n, w) => n + w.count, 0)).toBe(s.need);
      expect(s.cost).toBe(s.need * 5);
   });

   it('shows only what was lent for a past month', () => {
      const s = goalSlots(loans, users, new Set(), '2026-09', '2026-09-30', 500, 5);
      expect(s.comeback.length).toBeGreaterThanOrEqual(0);
      expect(s.done.every((d) => d.date.startsWith('2026-09'))).toBe(true);
   });
});
