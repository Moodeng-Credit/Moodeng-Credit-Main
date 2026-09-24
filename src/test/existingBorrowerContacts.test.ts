import { describe, expect, it } from 'vitest';

import { buildBorrowerContactRows } from '@/app/admin/adminSupabase';
import { CONTACT_STEP_EXEMPT_USER_IDS, requestContactSteps } from '@/config/contactVerification';

const BELLE = [...CONTACT_STEP_EXEMPT_USER_IDS];

describe('end-of-request steps: who gets the Facebook card and who gets the video call', () => {
   it('brand-new borrower without a referral: Facebook card + video call', () => {
      expect(requestContactSteps({ userId: 'new', isExistingBorrower: false, hasAppliedReferral: false })).toEqual({ contacts: true, videoCall: true });
   });

   it('brand-new borrower with a referral code: Facebook card, no call', () => {
      expect(requestContactSteps({ userId: 'new', isExistingBorrower: false, hasAppliedReferral: true })).toEqual({ contacts: true, videoCall: false });
   });

   it('existing borrower (incl. late payers): Facebook card only — never a video call', () => {
      expect(requestContactSteps({ userId: 'old', isExistingBorrower: true, hasAppliedReferral: false })).toEqual({ contacts: true, videoCall: false });
   });

   it('both of Belle’s accounts skip everything', () => {
      expect(BELLE).toHaveLength(2);
      for (const userId of BELLE) {
         expect(requestContactSteps({ userId, isExistingBorrower: true, hasAppliedReferral: false })).toEqual({ contacts: false, videoCall: false });
         expect(requestContactSteps({ userId, isExistingBorrower: false, hasAppliedReferral: false })).toEqual({ contacts: false, videoCall: false });
      }
   });
});

describe('admin borrower contacts', () => {
   const now = Date.parse('2026-09-24T00:00:00Z');
   const users = [
      { id: 'u1', username: 'maria', display_name: ' Maria ', email: 'm@x.com', messenger_verified_at: null, facebook_contact: '', telegram_username: 'maria_t', line_id: null },
      { id: 'u2', username: 'jo', display_name: null, email: null, messenger_verified_at: '2026-09-20T00:00:00Z', facebook_contact: null, telegram_username: null, line_id: 'jo.line' }
   ];
   const loans = [
      // repaid two days late
      { borrower_user_id: 'u1', funded_at: '2026-08-01', due_date: '2026-08-15T00:00:00Z', repaid_at: '2026-08-17T00:00:00Z' },
      // overdue right now
      { borrower_user_id: 'u1', funded_at: '2026-09-01', due_date: '2026-09-10T00:00:00Z', repaid_at: null },
      // on time
      { borrower_user_id: 'u2', funded_at: '2026-08-01', due_date: '2026-08-15T00:00:00Z', repaid_at: '2026-08-14T00:00:00Z' },
      // test loans and never-funded requests don't count
      { borrower_user_id: 'u2', funded_at: '2026-09-01', due_date: '2026-09-02T00:00:00Z', repaid_at: null, is_test: true },
      { borrower_user_id: 'u2', funded_at: null, due_date: '2026-09-02T00:00:00Z', repaid_at: null }
   ];
   const kyc = [{ user_id: 'u1', full_name: 'Maria Santos' }];

   it('joins profile contacts, KYC name and the repayment record', () => {
      const [maria, jo] = buildBorrowerContactRows(users, loans, kyc, now);
      expect(maria).toMatchObject({
         kycName: 'Maria Santos',
         displayName: 'Maria',
         facebookContact: null,
         telegramUsername: 'maria_t',
         fundedLoanCount: 2,
         repaidLateCount: 1,
         overdueNowCount: 1
      });
      expect(jo).toMatchObject({ kycName: null, lineId: 'jo.line', messengerVerifiedAt: '2026-09-20T00:00:00Z', fundedLoanCount: 1, repaidLateCount: 0, overdueNowCount: 0 });
   });
});
