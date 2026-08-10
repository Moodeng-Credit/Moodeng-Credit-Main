import { describe, expect, it } from 'vitest';

import {
   collectDuplicateUserIds,
   matchesOwnEnrollment,
   resolveWalletFaceVerdict
} from '../../supabase/functions/_shared/walletFaceVerdict';

const U = 'user-under-test';
const OTHER = 'someone-else';

const approve = (decision: unknown, hasPriorEnrollment = false) =>
   resolveWalletFaceVerdict({
      decision: decision as never,
      userId: U,
      status: 'Approved',
      hasPriorEnrollment
   });

describe('walletFaceVerdict', () => {
   describe('the re-scan regression', () => {
      // THE bug this module exists for. A verified borrower re-scanning matches their OWN
      // enrollment. If Didit returns that match without vendor_data, the KYC-era heuristic
      // (`vendorStr !== currentUserId` — undefined !== U is true) called it a duplicate and
      // permanently refused a wallet the borrower was entitled to.
      it('does not treat an anonymous match as another account', () => {
         const decision = { face_search: { status: 'approved', matches: [{ score: 97 }] } };
         expect(collectDuplicateUserIds(decision as never, U)).toEqual([]);
         expect(approve(decision, true).status).toBe('APPROVED');
      });

      it('does not treat the user matching themselves as a duplicate', () => {
         const decision = { face_search: { matches: [{ score: 99, vendor_data: U }] } };
         expect(approve(decision, true).status).toBe('APPROVED');
         expect(matchesOwnEnrollment(decision as never, U)).toBe(true);
      });

      // The KYC "Duplicated face" rule can decline the whole session with matches present.
      // On a re-scan those matches are expected to be the user's own, so a declined block
      // alone must not be read as "this face belongs to someone else".
      it('does not refuse on a declined block with only anonymous matches', () => {
         const decision = { face_search: { status: 'declined', matches: [{ score: 95 }] } };
         expect(collectDuplicateUserIds(decision as never, U)).toEqual([]);
      });
   });

   describe('what still gets refused', () => {
      it('refuses an identified match to a different account', () => {
         const decision = { face_search: { matches: [{ score: 93, vendor_data: OTHER }] } };
         const verdict = approve(decision, true);
         expect(verdict.status).toBe('DUPLICATE');
         expect(verdict.duplicateUserIds).toEqual([OTHER]);
      });

      it('reports every distinct colliding account once', () => {
         const decision = {
            face_search: {
               matches: [
                  { score: 91, vendor_data: OTHER },
                  { score: 88, vendor_data: OTHER },
                  { score: 96, vendor_data: 'third-account' }
               ]
            }
         };
         expect(collectDuplicateUserIds(decision as never, U).sort()).toEqual(['someone-else', 'third-account']);
      });

      it('ignores matches below the similarity threshold', () => {
         const decision = { face_search: { matches: [{ score: 60, vendor_data: OTHER }] } };
         expect(approve(decision).status).toBe('APPROVED');
      });

      it('accepts 0-1 scaled scores', () => {
         const decision = { face_search: { matches: [{ score: 0.94, vendor_data: OTHER }] } };
         expect(approve(decision).status).toBe('DUPLICATE');
      });

      it('declines an abandoned or expired session', () => {
         for (const status of ['Abandoned', 'Expired']) {
            expect(resolveWalletFaceVerdict({ decision: null, userId: U, status, hasPriorEnrollment: false }).status).toBe(
               'DECLINED'
            );
         }
      });

      it('declines a failed liveness', () => {
         expect(resolveWalletFaceVerdict({ decision: {}, userId: U, status: 'Declined', hasPriorEnrollment: false }).status).toBe(
            'DECLINED'
         );
      });

      // A duplicate outranks a decline: knowing whose face it is matters more than the
      // session outcome, both for the message shown and for the fraud signal recorded.
      it('prefers DUPLICATE over DECLINED when both apply', () => {
         const decision = { face_search: { matches: [{ score: 99, vendor_data: OTHER }] } };
         expect(
            resolveWalletFaceVerdict({ decision: decision as never, userId: U, status: 'Declined', hasPriorEnrollment: true })
               .status
         ).toBe('DUPLICATE');
      });
   });

   describe('the self-match review signal', () => {
      it('flags an approval it could not tie to the account holder', () => {
         const decision = { face_search: { matches: [{ score: 97 }] } };
         expect(approve(decision, true).unverifiedSelfMatch).toBe(true);
      });

      it('does not flag a confirmed self-match', () => {
         const decision = { face_search: { matches: [{ score: 97, vendor_data: U }] } };
         expect(approve(decision, true).unverifiedSelfMatch).toBe(false);
      });

      // A first-time user has nothing to match against, so silence is expected, not suspicious.
      it('does not flag an account with no prior enrollment', () => {
         expect(approve({}, false).unverifiedSelfMatch).toBe(false);
      });

      it('never turns the flag into a refusal', () => {
         expect(approve({ face_search: { matches: [{ score: 97 }] } }, true).status).toBe('APPROVED');
      });
   });

   describe('1:1 face_match is not an identity hit', () => {
      // The combined KYC workflow's face_match compares selfie vs document — a high score
      // with no vendor_data. Reading it as a 1:N hit would flag every legitimate scan.
      it('ignores face_match results and matches', () => {
         const decision = { face_match: { score: 99, results: [{ score: 99 }], matches: [{ score: 99 }] } };
         expect(collectDuplicateUserIds(decision as never, U)).toEqual([]);
         expect(approve(decision, true).status).toBe('APPROVED');
      });

      it('still reads face_match duplicate-specific arrays', () => {
         const decision = { face_match: { duplicated_faces: [{ score: 97, vendor_data: OTHER }] } };
         expect(collectDuplicateUserIds(decision as never, U)).toEqual([OTHER]);
      });
   });

   it('handles a missing decision without throwing', () => {
      expect(collectDuplicateUserIds(null, U)).toEqual([]);
      expect(approve(null).status).toBe('APPROVED');
   });
});
