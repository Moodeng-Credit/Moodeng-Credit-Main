import type { ToastErrorType } from '@/components/ToastSystem/types';

// Error codes are written as their string values, not IDKitErrorCodes members: the pinned IDKit
// (4.1.5) lacks some newer members, which read as `undefined` and silently matched the wrong group.

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
   'credential_unavailable',
   'world_id_4_not_available',
   'world_id_3_not_available',
   'feature_unavailable'
]);

// Transport-level problems between the browser, the World bridge and World App. Worth a retry.
const CONNECTION = new Set<string>(['connection_failed', 'timeout', 'unexpected_response', 'generic_error']);

// The user backed out or declined inside World App.
const NOT_COMPLETED = new Set<string>([
   'user_rejected',
   'cancelled',
   'verification_rejected',
   'rp_signature_expired',
   'user_presence_failed'
]);

export const getWorldIdFailureOutcome = (
   errorCode: string,
   { alreadyUsed = false, isFinishingVerification = false }: { alreadyUsed?: boolean; isFinishingVerification?: boolean } = {}
): WorldIdFailureOutcome => {
   if (
      errorCode === 'nullifier_replayed' ||
      errorCode === 'max_verifications_reached' ||
      (errorCode === 'failed_by_host_app' && alreadyUsed)
   ) {
      return { kind: 'already_used' };
   }
   // FailedByHostApp = our own verify-worldid call rejected the proof; handleVerify already
   // showed the specific error for it.
   if (errorCode === 'failed_by_host_app') return { kind: 'silent' };
   if (NOT_COMPLETED.has(errorCode)) {
      return isFinishingVerification ? { kind: 'silent' } : { kind: 'toast', toastKey: 'worldid_not_completed' };
   }
   if (CREDENTIAL_MISSING.has(errorCode)) return { kind: 'toast', toastKey: 'worldid_credential_missing' };
   if (errorCode === 'inclusion_proof_pending') return { kind: 'toast', toastKey: 'worldid_credential_pending' };
   if (CONNECTION.has(errorCode)) return { kind: 'toast', toastKey: 'worldid_connection_failed' };
   // Everything else (invalid/unknown/inactive RP, malformed request, bad nonce or timestamp,
   // failed inclusion proof) is a problem with our World ID setup, not the borrower.
   return { kind: 'toast', toastKey: 'worldid_unavailable' };
};
