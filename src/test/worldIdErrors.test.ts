import { IDKitErrorCodes } from '@worldcoin/idkit';
import { describe, expect, it } from 'vitest';

import { getWorldIdFailureOutcome } from '@/components/worldId/worldIdErrors';

describe('getWorldIdFailureOutcome', () => {
   it('tells people without an Orb or passport credential to verify another way, not "server error"', () => {
      for (const code of [
         IDKitErrorCodes.CredentialUnavailable,
         IDKitErrorCodes.WorldId4NotAvailable,
         IDKitErrorCodes.WorldId3NotAvailable,
         IDKitErrorCodes.FeatureUnavailable
      ]) {
         expect(getWorldIdFailureOutcome(code)).toEqual({ kind: 'toast', toastKey: 'worldid_credential_missing' });
      }
   });

   it('maps a pending inclusion proof to its own message', () => {
      expect(getWorldIdFailureOutcome(IDKitErrorCodes.InclusionProofPending)).toEqual({
         kind: 'toast',
         toastKey: 'worldid_credential_pending'
      });
   });

   it('treats transport failures as retryable connection problems', () => {
      for (const code of [IDKitErrorCodes.ConnectionFailed, IDKitErrorCodes.Timeout, IDKitErrorCodes.GenericError]) {
         expect(getWorldIdFailureOutcome(code)).toEqual({ kind: 'toast', toastKey: 'worldid_connection_failed' });
      }
   });

   it('reports setup problems on our side as World ID unavailable', () => {
      for (const code of [IDKitErrorCodes.InvalidRpSignature, IDKitErrorCodes.UnknownRp, IDKitErrorCodes.MalformedRequest]) {
         expect(getWorldIdFailureOutcome(code)).toEqual({ kind: 'toast', toastKey: 'worldid_unavailable' });
      }
   });

   it('shows the already-used modal for replayed nullifiers', () => {
      expect(getWorldIdFailureOutcome(IDKitErrorCodes.NullifierReplayed)).toEqual({ kind: 'already_used' });
      expect(getWorldIdFailureOutcome(IDKitErrorCodes.FailedByHostApp, { alreadyUsed: true })).toEqual({ kind: 'already_used' });
   });

   it('stays quiet when our own backend already reported the failure', () => {
      expect(getWorldIdFailureOutcome(IDKitErrorCodes.FailedByHostApp)).toEqual({ kind: 'silent' });
   });

   it('only nags about cancelling when verification is not already finishing', () => {
      expect(getWorldIdFailureOutcome(IDKitErrorCodes.UserRejected)).toEqual({ kind: 'toast', toastKey: 'worldid_not_completed' });
      expect(getWorldIdFailureOutcome(IDKitErrorCodes.Cancelled, { isFinishingVerification: true })).toEqual({ kind: 'silent' });
   });
});
