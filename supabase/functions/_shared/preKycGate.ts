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
