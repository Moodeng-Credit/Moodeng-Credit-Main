import { describe, expect, it } from 'vitest';

import { buildFundingAlert, describeOverlapKinds, FundingOverlap } from '../../supabase/functions/_shared/fundingOverlap';

const base: FundingOverlap = {
   loan_id: '11111111-1111-1111-1111-111111111111',
   tracking_id: 'LN-2048',
   lender_user_id: 'aaaa',
   borrower_user_id: 'bbbb',
   overlaps: ['same_wallet']
};

describe('describeOverlapKinds', () => {
   it('maps known kinds to readable text', () => {
      expect(describeOverlapKinds(['same_wallet'])).toBe('the same wallet funded and received the loan');
   });

   it('joins multiple kinds with a semicolon', () => {
      const text = describeOverlapKinds(['shared_ip', 'same_canonical_email']);
      expect(text).toContain('share a login IP');
      expect(text).toContain('share an email');
      expect(text).toContain('; ');
   });

   it('passes through unknown kinds verbatim', () => {
      expect(describeOverlapKinds(['brand_new_signal'])).toBe('brand_new_signal');
   });
});

describe('buildFundingAlert', () => {
   it('uses the tracking id in the title when present', () => {
      const { title } = buildFundingAlert(base);
      expect(title).toBe('Loan LN-2048 funded with linked accounts (same_wallet)');
   });

   it('falls back to the loan id when tracking id is null', () => {
      const { title } = buildFundingAlert({ ...base, tracking_id: null });
      expect(title).toContain(base.loan_id);
   });

   it('lists every overlap kind in the title', () => {
      const { title } = buildFundingAlert({ ...base, overlaps: ['same_wallet', 'shared_ip'] });
      expect(title).toContain('same_wallet, shared_ip');
   });

   it('states plainly that the loan was not blocked (alert-only)', () => {
      const { body } = buildFundingAlert(base);
      expect(body).toContain('NOT blocked');
      expect(body).toContain(base.borrower_user_id);
      expect(body).toContain(base.lender_user_id);
   });
});
