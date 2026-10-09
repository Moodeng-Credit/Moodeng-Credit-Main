// Pre-KYC gate (migration 20261009120000_pre_kyc_gate.sql): a borrower connects Messenger, books
// the intro call and is approved after it (users.loan_access_status = 'approved') before they can
// start a paid KYC session. The rule itself lives in SQL (needs_pre_kyc_gate) so every function and
// the app read the same thing.
//
// Fails open: if the check errors (e.g. the migration isn't applied yet), nobody is gated — the old
// flow carries on rather than locking every borrower out of KYC.

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export const needsPreKycGate = async (svc: SupabaseClient, userId: string): Promise<boolean> => {
   const { data, error } = await svc.rpc('needs_pre_kyc_gate', { p_user_id: userId });
   if (error) {
      console.error('preKycGate: needs_pre_kyc_gate failed, failing open', error.message);
      return false;
   }
   return data === true;
};

// Same identity check as src/lib/isUserVerified.ts — decides which copy a decision message uses.
export const isKycVerified = (u: { is_didit?: string | null; is_world_id?: string | null; is_world_id_passport?: string | null }) =>
   u.is_didit === 'ACTIVE' || u.is_world_id === 'ACTIVE' || u.is_world_id_passport === 'ACTIVE';

// ---- KYC tries (kyc_declines; 3 declines, then they message us — admin /kycretry gives 3 more) ----

export const KYC_TRIES = 3;

// A genuine liveness "Declined" from Didit (World ID path). ID/combined declines are recorded by the
// trg_record_kyc_decline trigger instead. One row per session, so webhook + sync never double-count.
export const recordLivenessDecline = async (svc: SupabaseClient, userId: string, sessionId: string | null) => {
   if (!sessionId) return;
   const { error } = await svc
      .from('kyc_declines')
      .upsert({ user_id: userId, didit_session_id: sessionId, kind: 'liveness' }, { onConflict: 'didit_session_id', ignoreDuplicates: true });
   if (error) console.error('preKycGate: recording liveness decline failed', error.message);
};

// Fails open, like the gate: an error never blocks a KYC attempt.
export const kycTriesLeft = async (svc: SupabaseClient, userId: string): Promise<number> => {
   const { data, error } = await svc.rpc('kyc_tries_left', { p_user_id: userId });
   if (error || typeof data !== 'number') {
      if (error) console.error('preKycGate: kyc_tries_left failed, failing open', error.message);
      return KYC_TRIES;
   }
   return data;
};
