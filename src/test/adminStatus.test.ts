import { describe, expect, it } from 'vitest';

import { buildAccessRequestEvents, buildLoanEvents } from '@/app/admin/adminLiveData';
import { ADMIN_STATUS_META, deriveAccessRequestStatus, deriveBorrowerStatus, deriveLoanStatus } from '@/app/admin/adminStatus';

describe('deriveBorrowerStatus', () => {
   it('puts bans and watchlist ahead of everything else', () => {
      expect(deriveBorrowerStatus({ account_status: 'banned', is_didit: 'ACTIVE' })).toBe('banned');
      expect(deriveBorrowerStatus({ account_status: 'active', restriction: { status: 'banned' } })).toBe('banned');
      expect(deriveBorrowerStatus({ account_status: 'blocked' })).toBe('watchlist');
      expect(deriveBorrowerStatus({ restriction: { status: 'watchlist' }, is_didit: 'ACTIVE' })).toBe('watchlist');
   });

   it('uses getVerificationUiState for the KYC states', () => {
      expect(deriveBorrowerStatus({ is_didit: 'ACTIVE' })).toBe('verified');
      expect(deriveBorrowerStatus({ is_world_id: 'ACTIVE' })).toBe('verified');
      expect(deriveBorrowerStatus({ didit_id_status: 'Duplicate' })).toBe('duplicate');
      expect(deriveBorrowerStatus({ didit_id_status: 'In Review' })).toBe('in_review');
      expect(deriveBorrowerStatus({ didit_id_status: 'Declined' })).toBe('declined');
      expect(deriveBorrowerStatus({ didit_submitted_at: '2026-10-01T00:00:00Z' })).toBe('in_review');
   });

   it('walks the call → approval gate before KYC', () => {
      expect(deriveBorrowerStatus({})).toBe('new');
      expect(deriveBorrowerStatus({ loan_access_status: 'pending' })).toBe('pending_call');
      expect(deriveBorrowerStatus({ loan_access_status: 'pending', video_call_starts_at: '2026-10-12T01:00:00Z' })).toBe('call_booked');
      expect(
         deriveBorrowerStatus({
            loan_access_status: 'pending',
            video_call_starts_at: '2026-10-12T01:00:00Z',
            video_call_outcome: 'no_show'
         })
      ).toBe('pending_call');
      expect(deriveBorrowerStatus({ loan_access_status: 'approved', video_call_outcome: 'attended' })).toBe('approved');
      expect(deriveBorrowerStatus({ loan_access_status: 'rejected' })).toBe('declined');
   });
});

describe('deriveLoanStatus', () => {
   const now = new Date('2026-10-11T12:00:00Z');

   it('covers the loan lifecycle', () => {
      expect(deriveLoanStatus({ loan_status: 'Requested' }, now)).toBe('requested');
      expect(deriveLoanStatus({ loan_status: 'Lent', repayment_status: 'Unpaid', due_date: '2026-10-20' }, now)).toBe('funded');
      expect(deriveLoanStatus({ loan_status: 'Lent', repayment_status: 'Partial', due_date: '2026-10-01' }, now)).toBe('overdue');
      expect(deriveLoanStatus({ loan_status: 'Lent', repayment_status: 'Paid', due_date: '2026-10-01' }, now)).toBe('repaid');
      expect(deriveLoanStatus({ loan_status: 'Lent', repayment_status: 'Paid', refunded_at: '2026-10-02' }, now)).toBe('refunded');
      expect(deriveLoanStatus({ loan_status: null }, now)).toBe('expired');
   });

   it('is not overdue until the due day ends in the loan timezone', () => {
      // 2026-10-11 ends at 16:00Z in Manila; at 12:00Z it is still the due day.
      expect(deriveLoanStatus({ loan_status: 'Lent', due_date: '2026-10-11', due_timezone: 'Asia/Manila' }, now)).toBe('funded');
   });
});

describe('deriveAccessRequestStatus', () => {
   it('maps request rows', () => {
      const now = Date.parse('2026-10-11T00:00:00Z');
      expect(deriveAccessRequestStatus({ status: 'approved' }, now)).toBe('approved');
      expect(deriveAccessRequestStatus({ status: 'rejected' }, now)).toBe('declined');
      expect(deriveAccessRequestStatus({ status: 'pending', expires_at: '2026-10-01T00:00:00Z' }, now)).toBe('expired');
      expect(deriveAccessRequestStatus({ status: 'pending', expires_at: '2026-10-20T00:00:00Z' }, now)).toBe('pending_call');
   });
});

describe('history events', () => {
   it('records who decided an access request', () => {
      const events = buildAccessRequestEvents([
         {
            id: 'r1',
            user_id: 'u1',
            status: 'approved',
            created_at: '2026-10-01T00:00:00Z',
            decided_at: '2026-10-02T00:00:00Z',
            decided_by: 'a1'
         }
      ]);
      expect(events.map((e) => [e.label, e.actorId])).toEqual([
         ['Asked for access', null],
         ['Approved', 'a1']
      ]);
   });

   it('builds funded / repaid steps from loan timestamps', () => {
      const events = buildLoanEvents([
         {
            id: 'l1',
            borrower_user_id: 'u1',
            loan_amount: 20,
            loan_status: 'Lent',
            repayment_status: 'Paid',
            created_at: '2026-10-01T00:00:00Z',
            funded_at: '2026-10-01T02:00:00Z',
            repaid_at: '2026-10-08T00:00:00Z'
         }
      ]);
      expect(events.map((e) => e.status)).toEqual(['requested', 'funded', 'repaid']);
   });

   it('has a label for every status', () => {
      for (const meta of Object.values(ADMIN_STATUS_META)) expect(meta.label).toBeTruthy();
   });
});
