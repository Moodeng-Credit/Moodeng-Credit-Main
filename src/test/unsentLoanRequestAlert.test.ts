import { describe, expect, it } from 'vitest';

import { LOAN_REQUEST_STOP_STEP_LABEL } from '@/lib/loanRequestDraftSync';
import { buildUnsentRequestMessage, stopStepLabel } from '../../supabase/functions/_shared/unsentLoanRequests';

const draft = {
   amount: 100,
   repay: '115',
   reason: 'School fees before payday',
   due_date: '2026-12-01',
   stopped_at: 'left_for_documents',
   started_at: '2026-11-15T06:00:00Z',
   updated_at: '2026-11-15T06:30:00Z',
   user: { username: 'sample_user', display_name: 'Sample Person' }
};

describe('buildUnsentRequestMessage', () => {
   it('shows who, terms, reason, step and Bangkok times', () => {
      const text = buildUnsentRequestMessage(draft);
      expect(text).toContain('Sample Person (@sample_user)');
      expect(text).toContain('$100 → repay $115 · due Dec 1');
      expect(text).toContain('Reason: “School fees before payday”');
      expect(text).toContain('Stopped at: Left to send proof of income');
      expect(text).toContain('Last change Nov 15, 1:30 PM · started Nov 15, 1:00 PM (Bangkok)');
   });

   it('copes with blanks and a missing account', () => {
      const text = buildUnsentRequestMessage({ ...draft, amount: null, repay: null, reason: null, due_date: null, stopped_at: null, user: null });
      expect(text).toContain('Unknown borrower');
      expect(text).toContain('— → repay — · due —');
      expect(text).not.toContain('Reason:');
      expect(text).toContain('Stopped at: Unknown');
   });
});

describe('stop step labels', () => {
   it('match the app labels for every step', () => {
      for (const [key, label] of Object.entries(LOAN_REQUEST_STOP_STEP_LABEL)) expect(stopStepLabel(key)).toBe(label);
   });
});
