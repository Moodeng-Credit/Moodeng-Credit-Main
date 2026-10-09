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

type KycRow = {
   is_didit?: string | null;
   is_world_id?: string | null;
   is_world_id_passport?: string | null;
   didit_id_status?: string | null;
   didit_submitted_at?: string | null;
};

// Their ID check is already with Didit, no verdict yet (in review / processing) — same rule as
// getVerificationUiState in the app and the exemption in needs_pre_kyc_gate.
export const isKycWithDidit = (u: KycRow) => {
   const raw = (u.didit_id_status ?? '').toLowerCase();
   if (raw.includes('review')) return true;
   return Boolean(u.didit_submitted_at) && !['duplicate', 'declined', 'abandoned', 'expired', 'not started', 'in progress'].includes(raw);
};

// Whether the borrower still has an ID check to do — picks "next: verify your ID" copy over loan
// copy. Read from the whole row: is_world_id_passport isn't on every database, so it can't be named
// in a select list. On a failed read, the row passed in decides.
export const loadNeedsIdCheck = async (svc: SupabaseClient, userId: string, fallback: KycRow): Promise<boolean> => {
   const { data } = await svc.from('users').select('*').eq('id', userId).maybeSingle();
   const row = (data as KycRow | null) ?? fallback;
   return !isKycVerified(row) && !isKycWithDidit(row);
};

// ---- KYC tries (kyc_declines; 3 declines, then they message us — admin /kycretry gives 3 more) ----

export const KYC_TRIES = 3;

// A genuine liveness "Declined" from Didit (World ID path). ID/combined declines are recorded by the
// trg_record_kyc_decline trigger instead. One row per session, so webhook + sync never double-count.
export const recordLivenessDecline = async (svc: SupabaseClient, userId: string, sessionId: string | null) => {
   if (!sessionId) return;
   // Only the borrower's current liveness attempt counts — not a stale session, nor a wallet face
   // scan (same workflow) whose webhook strayed into the liveness branch.
   const { data: current } = await svc.from('users').select('liveness_session_id').eq('id', userId).maybeSingle();
   if ((current as { liveness_session_id?: string | null } | null)?.liveness_session_id !== sessionId) return;
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
