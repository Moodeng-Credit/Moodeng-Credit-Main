// Reusable KYC: copy a borrower's approved Moodeng (Didit) ID check into their Stableyard account, so
// they don't have to do a second ID check before a bank / GCash cash-out.
//
// Flow (docs: https://docs.stableyard.fi/concepts/individual-kyc):
//   1. GET  /v2/partners/kyc-reuse-policy        → enabled + receivingApplicationId + consentVersion
//   2. the UPA email must already be verified    → Stableyard answers 409 verify_account_email otherwise
//   3. the person ticks consent                  → we keep a receipt row (stableyard_kyc_imports)
//   4. we mint a Didit share token for their newest approved session, addressed to Stableyard's
//      receiving Didit app (our DIDIT_API_KEY never leaves us)
//   5. POST /v2/accounts/{id}/kyc/imports        → { shareToken, consent } + Idempotency-Key
//   6. GET  /v2/accounts/{id}/kyc/imports/{id}   → `imported` only means copied. Payouts wait for
//      verification.eligibility.status = eligible (review-first copies sit in requires_review).
//
// Stableyard's payout partners need first name, last name, date of birth and the document type
// (passport / national ID / driver's license); city is optional and the email comes from the verified UPA email. If our
// Didit record lacks any of these, the import would get stuck, so those people use Stableyard's own
// hosted ID check instead.
//
// The share token is a credential: it only ever goes into the import request body. Never logged,
// stored or returned to the browser.
import { shareDiditSession } from './diditShare.ts';
import { stableyard, type StableyardKycImportResponse, type StableyardKycReusePolicy } from './stableyard.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

/** What the person agrees to. Stored with the receipt; the UI shows the same words. */
export const KYC_CONSENT_TEXT =
   'I agree that Moodeng shares my ID check (name, date of birth, ID document, selfie and screening result) with Stableyard so I can cash out to my bank or e-wallet.';
const OUR_CONSENT_VERSION = 'moodeng-kyc-share-v1';

// Didit's document_type values payout partners take. Raj (Stableyard): passport / national ID, and on
// 2026-11-07 "driving license works for PHP" (bank payouts are PH-only). Tax Card isn't confirmed, so
// those people do the hosted check. AML isn't required for imports (Raj, 2026-11-07).
const ACCEPTED_DOCUMENT_TYPES = new Set([
   'passport',
   'identity card',
   'national id',
   'national identity card',
   "driver's license",
   'drivers license',
   'driving license'
]);

const MAX_IMPORT_ATTEMPTS = 3;
const SHARE_TTL_SECONDS = 600;
const SAFE_TOKEN = /^[A-Za-z0-9_.:-]{1,64}$/;

export type IdentityGap =
   | 'no_approved_kyc'
   | 'first_name'
   | 'last_name'
   | 'date_of_birth'
   | 'document_type'
   | 'document_type_not_accepted'
   | 'too_old';

type IdentityRow = {
   session_id: string;
   session_created_at: string | null;
   first_name: string | null;
   last_name: string | null;
   date_of_birth: string | null;
   document_type: string | null;
};

const filled = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

/** Newest approved Didit session for the user, and what it lacks for a payout partner. */
export const identityForReuse = async (admin: SupabaseClient, userId: string, policy: StableyardKycReusePolicy | null) => {
   const { data } = await admin
      .from('kyc_identities')
      .select('session_id, session_created_at, first_name, last_name, date_of_birth, document_type')
      .eq('user_id', userId)
      .ilike('session_status', 'approved')
      .order('session_created_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
   const row = data as IdentityRow | null;
   if (!row?.session_id) return { sessionId: null, documentType: null, gaps: ['no_approved_kyc'] as IdentityGap[] };

   const gaps: IdentityGap[] = [];
   if (!filled(row.first_name)) gaps.push('first_name');
   if (!filled(row.last_name)) gaps.push('last_name');
   if (!row.date_of_birth) gaps.push('date_of_birth');
   if (!filled(row.document_type)) gaps.push('document_type');
   else if (!ACCEPTED_DOCUMENT_TYPES.has(String(row.document_type).trim().toLowerCase())) gaps.push('document_type_not_accepted');
   const maxDays = Number(policy?.maxVerificationAgeDays ?? 0);
   if (maxDays > 0 && row.session_created_at) {
      const ageDays = (Date.now() - new Date(row.session_created_at).getTime()) / 86_400_000;
      if (ageDays > maxDays) gaps.push('too_old');
   }
   return { sessionId: row.session_id, documentType: row.document_type, gaps };
};

const latestImport = async (admin: SupabaseClient, userId: string, accountId: string) => {
   const { data } = await admin
      .from('stableyard_kyc_imports')
      .select('id, import_id, import_status, verification_status, eligibility_status, error, created_at')
      .eq('user_id', userId)
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
   return data as {
      id: string;
      import_id: string | null;
      import_status: string;
      verification_status: string | null;
      eligibility_status: string | null;
      error: string | null;
      created_at: string;
   } | null;
};

/** Read-only: can this person skip the hosted ID check? Used by setup and the Test lab. */
export const reuseStatus = async (admin: SupabaseClient, userId: string, accountId: string) => {
   const policyResult = await stableyard.getKycReusePolicy();
   const policy = policyResult.ok ? policyResult.data : null;
   const identity = await identityForReuse(admin, userId, policy);
   const last = await latestImport(admin, userId, accountId);
   const appId = policy?.receivingApplicationId || null;
   const reasons: string[] = [];
   if (!policyResult.ok) reasons.push(`policy_unreadable_${policyResult.status}${policyResult.code ? `_${policyResult.code}` : ''}`);
   else if (!policy?.enabled) reasons.push('policy_not_enabled');
   else if (!appId) reasons.push('no_receiving_app_id');
   reasons.push(...identity.gaps);
   const busy = last && ['sharing', 'submitting', 'imported', 'requires_reconciliation', 'uncertain'].includes(last.import_status);
   return {
      available: reasons.length === 0 && !busy,
      reasons,
      policy: policy
         ? {
              enabled: Boolean(policy.enabled),
              version: policy.version ?? null,
              receivingApplicationId: appId,
              trustReview: policy.trustReview ?? null,
              consentVersion: policy.consentVersion ?? null,
              maxVerificationAgeDays: policy.maxVerificationAgeDays ?? null,
              approvalExpiresAt: policy.approvalExpiresAt ?? null
           }
         : null,
      documentType: identity.documentType,
      lastImport: last
         ? {
              status: last.import_status,
              verificationStatus: last.verification_status,
              eligibilityStatus: last.eligibility_status,
              error: last.error,
              at: last.created_at
           }
         : null
   };
};

const recordResult = async (admin: SupabaseClient, rowId: string, data: StableyardKycImportResponse) =>
   admin
      .from('stableyard_kyc_imports')
      .update({
         import_id: data.import?.id ?? null,
         import_status: data.import?.status ?? 'submitting',
         verification_status: data.verification?.status ?? null,
         eligibility_status: data.verification?.eligibility?.status ?? null,
         error: null,
         updated_at: new Date().toISOString()
      })
      .eq('id', rowId);

type ImportOutcome =
   | {
        ok: true;
        status: number;
        import: StableyardKycImportResponse['import'];
        verification: StableyardKycImportResponse['verification'] | null;
     }
   | { ok: false; status: number; code: string; error: string; requestId?: string | null };

/** Consent was ticked in the app. Mint a Didit share token and import it into the Stableyard account. */
export const importKycToStableyard = async (admin: SupabaseClient, userId: string, accountId: string): Promise<ImportOutcome> => {
   const policyResult = await stableyard.getKycReusePolicy();
   if (!policyResult.ok)
      return { ok: false, status: 502, code: 'policy_unreadable', error: policyResult.error, requestId: policyResult.requestId };
   const policy = policyResult.data;
   const appId = policy?.receivingApplicationId;
   if (!policy?.enabled || !appId)
      return { ok: false, status: 409, code: 'reuse_not_enabled', error: "Stableyard hasn't turned on ID check sharing yet." };

   const identity = await identityForReuse(admin, userId, policy);
   if (!identity.sessionId || identity.gaps.length) {
      return {
         ok: false,
         status: 409,
         code: 'identity_incomplete',
         error: `Use the Stableyard ID check instead (${identity.gaps.join(', ')}).`
      };
   }

   const last = await latestImport(admin, userId, accountId);
   if (last && ['submitting', 'imported'].includes(last.import_status)) return refreshKycImport(admin, userId, accountId);
   if (last && ['sharing', 'requires_reconciliation', 'uncertain'].includes(last.import_status)) {
      return { ok: false, status: 409, code: 'needs_support', error: 'Your ID check is being sorted out by support. Please message us.' };
   }
   const { count } = await admin
      .from('stableyard_kyc_imports')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('account_id', accountId);
   if ((count ?? 0) >= MAX_IMPORT_ATTEMPTS) {
      return { ok: false, status: 409, code: 'too_many_attempts', error: 'Use the Stableyard ID check instead.' };
   }

   const consentVersion = SAFE_TOKEN.test(String(policy.consentVersion ?? '')) ? String(policy.consentVersion) : 'v1';
   const { data: receipt, error: receiptError } = await admin
      .from('stableyard_kyc_imports')
      .insert({
         user_id: userId,
         account_id: accountId,
         didit_session_id: identity.sessionId,
         receiving_application_id: appId,
         consent_text: KYC_CONSENT_TEXT,
         our_consent_version: OUR_CONSENT_VERSION,
         consent_version: consentVersion,
         policy_version: policy.version ?? null,
         import_status: 'sharing'
      })
      .select('id')
      .single();
   if (receiptError || !receipt?.id)
      return { ok: false, status: 500, code: 'receipt_failed', error: 'Could not save your consent. Try again.' };
   const rowId = String(receipt.id);
   const reference = `moodeng_consent_${rowId.replace(/-/g, '')}`;
   await admin.from('stableyard_kyc_imports').update({ consent_reference: reference }).eq('id', rowId);

   const fail = async (
      status: string,
      code: string,
      error: string,
      httpStatus: number,
      requestId?: string | null
   ): Promise<ImportOutcome> => {
      await admin
         .from('stableyard_kyc_imports')
         .update({ import_status: status, error: `${code}: ${error}`.slice(0, 500), updated_at: new Date().toISOString() })
         .eq('id', rowId);
      return { ok: false, status: httpStatus, code, error, requestId };
   };

   const shared = await shareDiditSession(identity.sessionId, appId, SHARE_TTL_SECONDS);
   const { data: shareRow } = await admin
      .from('stableyard_kyc_shares')
      .insert({
         user_id: userId,
         didit_session_id: identity.sessionId,
         for_application_id: appId,
         session_kind: shared.ok ? shared.sessionKind : null,
         ttl_seconds: SHARE_TTL_SECONDS,
         error: shared.ok ? null : `${shared.status} ${shared.error}`.slice(0, 500)
      })
      .select('id')
      .maybeSingle();
   if (!shared.ok) return fail('failed', 'didit_share_failed', shared.error, 502);

   const result = await stableyard.importKyc(
      accountId,
      { shareToken: shared.shareToken, consent: { accepted: true, version: consentVersion, reference } },
      `moodeng-kyc-import:${rowId}`
   );
   if (!result.ok) {
      // A clear 4xx means Stableyard didn't create anything, so a later try (new token + key) is safe.
      // 5xx / unreachable is uncertain: the docs say don't redeem another token, Stableyard ops reconcile.
      const definite = result.status >= 400 && result.status < 500 && result.status !== 408;
      const details = (result.data as { error?: { details?: { nextAction?: { type?: string } } } } | undefined)?.error?.details;
      const code = details?.nextAction?.type === 'verify_account_email' ? 'email_needed' : (result.code ?? 'import_failed');
      return fail(definite ? 'failed' : 'uncertain', code, result.error, definite ? 409 : 502, result.requestId);
   }
   if (shareRow?.id) await admin.from('stableyard_kyc_shares').update({ delivered_at: new Date().toISOString() }).eq('id', shareRow.id);
   await recordResult(admin, rowId, result.data);
   return { ok: true, status: 200, import: result.data.import, verification: result.data.verification ?? null };
};

/** Re-read the newest import (and the account KYC) and keep our row in step. */
export const refreshKycImport = async (admin: SupabaseClient, userId: string, accountId: string): Promise<ImportOutcome> => {
   const last = await latestImport(admin, userId, accountId);
   if (!last) return { ok: false, status: 404, code: 'no_import', error: 'No ID check share yet.' };
   if (!last.import_id) {
      // Never reached Stableyard, or the answer was lost: the account KYC is still the truth.
      const kyc = await stableyard.getKyc(accountId);
      const current = kyc.ok ? ((kyc.data as { current?: StableyardKycImportResponse['verification'] })?.current ?? null) : null;
      return {
         ok: true,
         status: 200,
         import: { id: '', status: last.import_status as StableyardKycImportResponse['import']['status'] },
         verification: current
      };
   }
   const result = await stableyard.getKycImport(accountId, last.import_id);
   if (!result.ok)
      return { ok: false, status: 502, code: result.code ?? 'import_unreadable', error: result.error, requestId: result.requestId };
   await recordResult(admin, last.id, result.data);
   return { ok: true, status: 200, import: result.data.import, verification: result.data.verification ?? null };
};
