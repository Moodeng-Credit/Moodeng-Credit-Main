import { describe, expect, it } from 'vitest';

import { currentVerdict, type FormCheck as SheetFormCheck, tallyCheck } from '@/app/admin/callFormCheck';

import { buildFormCheck, canonicalExchanges, describeMismatches } from '../../supabase/functions/_shared/callFormCheck';

const host = {
   fullName: 'Maria Santos',
   role: 'Sari-sari store owner',
   loanUse: 'Buy stock for my store',
   referral: '',
   exchanges: ['Coins.ph'],
   showedCashInOut: true,
   informedTerms: true,
   addedEmma: false
};

const aiReply = {
   answers: {
      fullName: 'Maria Santos',
      role: 'runs a small sari-sari store',
      loanUse: 'pay my rent this month',
      referral: 'friend Joy sent me the link',
      exchanges: ['coins ph', 'GCash'],
      showedCashInOut: true,
      informedTerms: false,
      addedEmma: true
   },
   same_meaning: { fullName: true, role: true, loanUse: false },
   evidence: { loanUse: 'I need it for the rent', informedTerms: '' },
   summary: 'Loan use differs and the default rules were not explained.'
};

describe('buildFormCheck (edge)', () => {
   const check = buildFormCheck(aiReply, host);

   it('grades text by meaning, blanks as heard-on-call', () => {
      expect(check.fields.fullName.verdict).toBe('match');
      expect(check.fields.role.verdict).toBe('match');
      expect(check.fields.loanUse.verdict).toBe('differs');
      expect(check.fields.referral.verdict).toBe('ai_only');
      expect(check.fields.facebookUrl.verdict).toBe('not_discussed');
   });

   it('flags a ticked must-cover box the call never covered', () => {
      expect(check.fields.showedCashInOut.verdict).toBe('match');
      expect(check.fields.informedTerms.verdict).toBe('not_in_call');
      expect(check.fields.addedEmma.verdict).toBe('ai_only');
   });

   it('maps exchange names onto the sheet chips and spots extras', () => {
      expect(check.fields.exchanges.ai).toEqual(['Coins.ph', 'GCash (GCrypto)']);
      expect(check.fields.exchanges.verdict).toBe('differs');
      expect(canonicalExchanges(['PayMaya', 'binance', 'some wallet'])).toEqual(['Maya', 'Binance', 'Other']);
   });

   it('keeps the host answers we sent, not the model echo, and counts mismatches', () => {
      expect(check.fields.loanUse.host).toBe('Buy stock for my store');
      expect(check.mismatches).toBe(3); // loan use, exchanges, repayment rules
      expect(describeMismatches(check)).toContain('Explained repayment & default rules: ticked on the sheet, but not heard on the call');
   });

   it('survives garbage from the model', () => {
      const bad = buildFormCheck('nope', host);
      expect(bad.mismatches).toBe(2); // two ticked boxes with no evidence
      expect(bad.fields.fullName.verdict).toBe('not_discussed');
   });
});

describe('currentVerdict (call sheet) agrees with the edge, then follows host edits', () => {
   const check = buildFormCheck(aiReply, host) as unknown as SheetFormCheck;

   it('matches the edge verdicts while the sheet is unchanged', () => {
      for (const f of Object.keys(check.fields) as Array<keyof SheetFormCheck['fields']>) {
         expect(currentVerdict(f, check.fields[f], host)).toBe(check.fields[f]!.verdict);
      }
   });

   it('re-grades boxes and exchanges, and marks edited text as stale', () => {
      const edited = { ...host, informedTerms: false, exchanges: ['Coins.ph', 'GCash (GCrypto)'], loanUse: 'Rent' };
      expect(currentVerdict('informedTerms', check.fields.informedTerms, edited)).toBe('not_discussed');
      expect(currentVerdict('exchanges', check.fields.exchanges, edited)).toBe('match');
      expect(currentVerdict('loanUse', check.fields.loanUse, edited)).toBe('stale');
      expect(tallyCheck(check, edited)).toMatchObject({ mismatch: 0, stale: 1 });
   });
});
