import { IDKitErrorCodes } from '@worldcoin/idkit';

import type { ToastErrorType } from '@/components/ToastSystem/types';

/**
 * What to tell the borrower when World App reports a failed request. Every code used to fall
 * through to "Server Error! Please try again later", which is wrong for the most common case
 * (the person's World ID has no Orb or passport credential) and sent people into retry loops.
 *
 * `null` means "show nothing": the caller handles it (already-used modal) or it's a silent cancel.
 */
export type WorldIdFailureOutcome = { kind: 'already_used' } | { kind: 'toast'; toastKey: ToastErrorType } | { kind: 'silent' };

// The person's World App can't produce the credential we asked for: no Orb verification and no
// passport, or an app too old for World ID 4. Retrying never helps; verifying by ID does.
const CREDENTIAL_MISSING = new Set<string>([
   IDKitErrorCodes.CredentialUnavailable,
   IDKitErrorCodes.WorldId4NotAvailable,
   IDKitErrorCodes.WorldId3NotAvailable,
   IDKitErrorCodes.FeatureUnavailable
]);

// Transport-level problems between the browser, the World bridge and World App. Worth a retry.
const CONNECTION = new Set<string>([
   IDKitErrorCodes.ConnectionFailed,
   IDKitErrorCodes.Timeout,
   IDKitErrorCodes.UnexpectedResponse,
   IDKitErrorCodes.GenericError
]);

// The user backed out or declined inside World App.
const NOT_COMPLETED = new Set<string>([
   IDKitErrorCodes.UserRejected,
   IDKitErrorCodes.Cancelled,
   IDKitErrorCodes.VerificationRejected,
   IDKitErrorCodes.RpSignatureExpired,
   IDKitErrorCodes.UserPresenceFailed
]);

export const getWorldIdFailureOutcome = (
   errorCode: string,
   { alreadyUsed = false, isFinishingVerification = false }: { alreadyUsed?: boolean; isFinishingVerification?: boolean } = {}
): WorldIdFailureOutcome => {
   if (
      errorCode === IDKitErrorCodes.NullifierReplayed ||
      errorCode === IDKitErrorCodes.MaxVerificationsReached ||
      (errorCode === IDKitErrorCodes.FailedByHostApp && alreadyUsed)
   ) {
      return { kind: 'already_used' };
   }
   // FailedByHostApp = our own verify-worldid call rejected the proof; handleVerify already
   // showed the specific error for it.
   if (errorCode === IDKitErrorCodes.FailedByHostApp) return { kind: 'silent' };
   if (NOT_COMPLETED.has(errorCode)) {
      return isFinishingVerification ? { kind: 'silent' } : { kind: 'toast', toastKey: 'worldid_not_completed' };
   }
   if (CREDENTIAL_MISSING.has(errorCode)) return { kind: 'toast', toastKey: 'worldid_credential_missing' };
   if (errorCode === IDKitErrorCodes.InclusionProofPending) return { kind: 'toast', toastKey: 'worldid_credential_pending' };
   if (CONNECTION.has(errorCode)) return { kind: 'toast', toastKey: 'worldid_connection_failed' };
   // Everything else (invalid/unknown/inactive RP, malformed request, bad nonce or timestamp,
   // failed inclusion proof) is a problem with our World ID setup, not the borrower.
   return { kind: 'toast', toastKey: 'worldid_unavailable' };
};
