import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hmac } from 'https://esm.sh/@noble/hashes@1.8.0/hmac?target=deno';
import { sha256 } from 'https://esm.sh/@noble/hashes@1.8.0/sha2?target=deno';

import { claimDiditNotification, notifyAdmins, notifyUser } from '../_shared/diditNotifications.ts';
// The wallet face verdict is shared with check-didit-status so the push and pull paths can
// never disagree. It is deliberately NOT hasDuplicateFace() — see that module's header.
import { collectDuplicateUserIds, resolveWalletFaceVerdict } from '../_shared/walletFaceVerdict.ts';

// Didit webhook receiver.
// Verifies the HMAC-SHA256 signature over the raw request body (X-Signature),
// enforces a 5-minute timestamp window to block replays, and on an Approved
// status.updated event marks the corresponding user (vendor_data) as verified.
//
// Docs: https://docs.didit.me/integration/webhooks
// Configure in Didit console: Webhook URL = this function's URL, version v3.0,
// subscribed event = status.updated. Set the Supabase secret DIDIT_WEBHOOK_SECRET
// to the console's "Webhook Secret Key".

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'content-type, x-signature, x-signature-v2, x-signature-simple, x-timestamp',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const TIMESTAMP_TOLERANCE_SEC = 300;

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

// Constant-time comparison of two equal-length lowercase hex strings.
const timingSafeEqualHex = (a: string, b: string) => {
   if (a.length !== b.length) return false;
   let diff = 0;
   for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
   }
   return diff === 0;
};

// Reproduce Didit's canonical JSON for X-Signature-V2: recursively sort object
// keys (lexicographic) and compact-serialize. JS numbers already normalize whole
// floats (100.0 -> 100) and JSON.stringify preserves Unicode, matching Didit's
// shortenFloats + sortKeys + ensure_ascii=false.
const canonicalize = (value: unknown): unknown => {
   if (Array.isArray(value)) {
      return value.map(canonicalize);
   }
   if (value && typeof value === 'object') {
      const source = value as Record<string, unknown>;
      return Object.keys(source)
         .sort()
         .reduce<Record<string, unknown>>((acc, key) => {
            acc[key] = canonicalize(source[key]);
            return acc;
         }, {});
   }
   return value;
};

type DiditWebhookPayload = {
   webhook_type?: string;
   status?: string;
   session_id?: string;
   workflow_id?: string;
   vendor_data?: string;
   timestamp?: number;
   decision?: DiditDecision | null;
};

// Partial shape of Didit's decision object (only the fields we read). The 1:N dedup surfaces as
// the Face Match step's "Duplicated face" rule; depending on workflow/version it can appear under
// `face_match` or `face_search`, so we scan both defensively.
type DiditFeatureBlock = {
   status?: string;
   score?: number;
   warnings?: unknown;
   results?: unknown;
   matches?: unknown;
   detected_faces?: unknown;
   duplicated_faces?: unknown;
   duplicate_faces?: unknown;
} | null;

type DiditDecision = {
   face_match?: DiditFeatureBlock;
   face_search?: DiditFeatureBlock;
   liveness?: DiditFeatureBlock;
   warnings?: unknown;
};

// Didit similarity scores are 0-100; treat >= 80% as a match.
const FACE_MATCH_THRESHOLD = 80;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const readField = (obj: unknown, keys: string[]): unknown => {
   if (!obj || typeof obj !== 'object') return undefined;
   const record = obj as Record<string, unknown>;
   for (const key of keys) {
      if (record[key] !== undefined && record[key] !== null) return record[key];
   }
   return undefined;
};

// Any warning whose code/type/name mentions "duplicat" flags a duplicate face.
const warningsFlagDuplicate = (warnings: unknown): boolean =>
   asArray(warnings).some((w) => {
      const text = String(readField(w, ['code', 'type', 'name', 'risk', 'message']) ?? '').toLowerCase();
      return text.includes('duplicat');
   });

// Inspect one Didit feature block (face_match or face_search) for a 1:N match against a
// DIFFERENT user - i.e. this live face is already registered.
const blockHasDuplicate = (block: DiditFeatureBlock | undefined, currentUserId: string): boolean => {
   if (!block) return false;

   const matches = [
      ...asArray(block.results),
      ...asArray(block.matches),
      ...asArray(block.detected_faces),
      ...asArray(block.duplicated_faces),
      ...asArray(block.duplicate_faces)
   ];

   for (const match of matches) {
      const raw = Number(readField(match, ['score', 'similarity', 'confidence']) ?? 0);
      const score = raw > 0 && raw <= 1 ? raw * 100 : raw; // accept either 0-1 or 0-100 scales
      const matchedVendor = readField(match, ['vendor_data', 'external_user_id', 'user_id']);
      const vendorStr = typeof matchedVendor === 'string' ? matchedVendor : undefined;
      // A match to a different user is a duplicate. If no vendor is exposed, an above-threshold
      // match is still treated as a duplicate (the search only returns prior approved sessions).
      if (score >= FACE_MATCH_THRESHOLD && vendorStr !== currentUserId) {
         return true;
      }
   }

   if (warningsFlagDuplicate(block.warnings)) return true;

   // The "Duplicated face" rule set to Decline surfaces as a declined feature status with matches.
   const status = typeof block.status === 'string' ? block.status.toLowerCase() : '';
   if ((status === 'declined' || status === 'warning') && matches.length > 0) return true;

   return false;
};

// True when the live face matches a previously approved session (Didit's "Duplicated face" rule).
const hasDuplicateFace = (decision: DiditDecision | null | undefined, currentUserId: string): boolean => {
   if (!decision) return false;
   return (
      blockHasDuplicate(decision.face_match, currentUserId) ||
      blockHasDuplicate(decision.face_search, currentUserId) ||
      // Liveness exposes 1:N hits under Fraud Signals -> "Matches".
      blockHasDuplicate(decision.liveness, currentUserId) ||
      warningsFlagDuplicate(decision.warnings)
   );
};

// Duplicate detection for the combined Traditional-KYC workflow. Its Face Match step also
// performs the 1:1 selfie-vs-ID match, whose SUCCESS is a high-score match with no
// vendor_data — which the generic blockHasDuplicate would misread as a 1:N hit and wrongly
// flag every legitimate verification. So here we trust only explicit duplicate/blocklist
// signals: duplicate warnings anywhere, the dedicated face_search (1:N) block, and Face
// Match's duplicate-specific arrays — never face_match's 1:1 results/matches/score.
const hasCombinedDuplicate = (decision: DiditDecision | null | undefined, currentUserId: string): boolean => {
   if (!decision) return false;
   const faceMatchDuplicate =
      warningsFlagDuplicate(decision.face_match?.warnings) ||
      asArray(decision.face_match?.duplicated_faces).length > 0 ||
      asArray(decision.face_match?.duplicate_faces).length > 0;
   return (
      faceMatchDuplicate ||
      blockHasDuplicate(decision.face_search, currentUserId) ||
      warningsFlagDuplicate(decision.liveness?.warnings) ||
      warningsFlagDuplicate(decision.warnings)
   );
};

// Best-effort human-readable decline reason from Didit's decision payload. Didit
// attaches warnings to each feature block (id_verification, face_match, liveness, …)
// with short descriptions; collect the distinct ones so the user knows what to fix
// before retrying, instead of guessing from a generic error screen.
const extractDeclineReason = (decision: unknown): string | undefined => {
   if (!decision || typeof decision !== 'object') return undefined;
   const reasons = new Set<string>();
   const visit = (value: unknown, depth: number) => {
      if (!value || typeof value !== 'object' || depth > 4) return;
      const record = value as Record<string, unknown>;
      for (const w of asArray(record.warnings)) {
         const text = readField(w, ['short_description', 'message', 'description', 'risk', 'code']);
         if (typeof text === 'string' && text.trim()) reasons.add(text.trim().replace(/_/g, ' '));
      }
      for (const key of ['status_detail', 'reason', 'decline_reason']) {
         const v = record[key];
         if (typeof v === 'string' && v.trim()) reasons.add(v.trim().replace(/_/g, ' '));
      }
      for (const v of Object.values(record)) {
         if (v && typeof v === 'object' && !Array.isArray(v)) visit(v, depth + 1);
      }
   };
   visit(decision, 0);
   if (reasons.size === 0) return undefined;
   return Array.from(reasons).slice(0, 3).join('; ').slice(0, 300);
};

// Fetch the full decision when the webhook payload didn't embed it (needed for the dedup result).
const fetchDecision = async (sessionId: string): Promise<DiditDecision | null> => {
   const apiKey = Deno.env.get('DIDIT_API_KEY');
   if (!apiKey) {
      console.error('[didit-webhook] DIDIT_API_KEY not configured - cannot fetch decision for dedup');
      return null;
   }
   const apiBase = (Deno.env.get('DIDIT_API_BASE')?.trim() || 'https://verification.didit.me/v3').replace(/\/$/, '');
   try {
      const res = await fetch(`${apiBase}/session/${sessionId}/decision/`, {
         method: 'GET',
         headers: { 'x-api-key': apiKey, Accept: 'application/json' }
      });
      if (!res.ok) {
         console.error('[didit-webhook] Decision fetch failed:', res.status);
         return null;
      }
      return (await res.json().catch(() => null)) as DiditDecision | null;
   } catch (error) {
      console.error('[didit-webhook] Decision fetch error:', error instanceof Error ? error.message : error);
      return null;
   }
};

type WorkflowKind = 'liveness' | 'id' | 'legacy' | 'unknown';

const classifyWorkflow = (workflowId: string | undefined): WorkflowKind => {
   if (!workflowId) return 'unknown';
   if (workflowId === Deno.env.get('DIDIT_LIVENESS_WORKFLOW_ID')) return 'liveness';
   if (workflowId === Deno.env.get('DIDIT_ID_WORKFLOW_ID')) return 'id';
   if (workflowId === Deno.env.get('DIDIT_WORKFLOW_ID')) return 'legacy';
   return 'unknown';
};

/**
 * Log a refused wallet face scan that matched an existing account into the same
 * fraud_signal_alerts table the daily scan uses (20260629000000), so it lands in the
 * founder's existing review flow instead of a new one.
 *
 * Severity is about the roles involved: two accounts on the SAME side of the book is
 * multi-accounting, while a borrower and a lender being one person is self-dealing —
 * the thing wallet-level checks alone can never catch, because they'd be two different
 * wallets belonging to the same face.
 */
// deno-lint-ignore no-explicit-any
const recordWalletFaceCollision = async (
   adminSupabase: any,
   userId: string,
   userRole: string | null,
   matchedUserIds: string[],
   sessionId: string
): Promise<void> => {
   try {
      const { data: matched } = await adminSupabase
         .from('users')
         .select('id, user_role, email, username')
         .in('id', matchedUserIds);

      const matchedRows = (matched ?? []) as { id: string; user_role?: string | null }[];
      const crossRole = matchedRows.some((row) => row.user_role && userRole && row.user_role !== userRole);

      await adminSupabase.from('fraud_signal_alerts').insert({
         signal_type: 'embedded_wallet_face_collision',
         subject_key: `${userId}:${sessionId}`,
         details: {
            user_id: userId,
            user_role: userRole,
            session_id: sessionId,
            matched_accounts: matched ?? matchedUserIds.map((id) => ({ id })),
            borrower_and_lender: crossRole,
            severity: crossRole ? 'critical' : 'warning',
            outcome: 'wallet_creation_refused'
         }
      });
   } catch (error) {
      // Never fail the webhook over telemetry — the refusal itself is already persisted.
      console.error('[didit-webhook] Failed to record wallet face collision:', error instanceof Error ? error.message : error);
   }
};

/**
 * An approved wallet scan on an account that already had a face enrolled, where we could not
 * confirm the two are the same person. Recorded for review, never used to refuse — the
 * ambiguity has innocent explanations we can't rule out from the payload.
 */
// deno-lint-ignore no-explicit-any
const recordUnverifiedSelfMatch = async (
   adminSupabase: any,
   userId: string,
   userRole: string | null,
   sessionId: string
): Promise<void> => {
   try {
      await adminSupabase.from('fraud_signal_alerts').insert({
         signal_type: 'wallet_face_unverified_self_match',
         subject_key: `${userId}:${sessionId}`,
         details: {
            user_id: userId,
            user_role: userRole,
            session_id: sessionId,
            severity: 'info',
            outcome: 'wallet_creation_allowed',
            note: 'Account had a prior face enrollment but the scan returned no confirmed self-match.'
         }
      });
   } catch (error) {
      console.error('[didit-webhook] Failed to record unverified self-match:', error instanceof Error ? error.message : error);
   }
};

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }

   if (req.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
   }

   try {
      const secret = Deno.env.get('DIDIT_WEBHOOK_SECRET');
      if (!secret) {
         console.error('[didit-webhook] DIDIT_WEBHOOK_SECRET not configured');
         return jsonResponse({ success: false, error: 'Server misconfigured' }, 500);
      }

      const rawBody = await req.text();
      const encoder = new TextEncoder();
      const sign = (message: string) => toHex(hmac(sha256, encoder.encode(secret), encoder.encode(message)));

      // 1) Replay protection: reject stale or missing timestamps.
      const timestampHeader = req.headers.get('x-timestamp');
      const timestamp = timestampHeader ? Number(timestampHeader) : NaN;
      if (!Number.isFinite(timestamp)) {
         console.error('[didit-webhook] Missing or invalid X-Timestamp');
         return jsonResponse({ success: false, error: 'Invalid timestamp' }, 401);
      }
      const nowSec = Math.floor(Date.now() / 1000);
      if (Math.abs(nowSec - timestamp) > TIMESTAMP_TOLERANCE_SEC) {
         console.error('[didit-webhook] Stale webhook rejected (timestamp out of tolerance)');
         return jsonResponse({ success: false, error: 'Stale request' }, 401);
      }

      // 2) Parse, then verify the HMAC-SHA256 signature.
      const payload = JSON.parse(rawBody) as DiditWebhookPayload;

      // Primary: X-Signature-V2 over canonical JSON (Didit's recommended method).
      // Fallback: X-Signature over the exact raw body bytes.
      const sigV2 = req.headers.get('x-signature-v2');
      const sigRaw = req.headers.get('x-signature');

      const v2Valid =
         !!sigV2 && timingSafeEqualHex(sign(JSON.stringify(canonicalize(payload))), sigV2.toLowerCase());
      const rawValid = !!sigRaw && timingSafeEqualHex(sign(rawBody), sigRaw.toLowerCase());

      if (!v2Valid && !rawValid) {
         console.error('[didit-webhook] Signature verification failed');
         return jsonResponse({ success: false, error: 'Invalid signature' }, 401);
      }

      // 3) Act.

      // Only session status changes matter for verification; ack everything else.
      if (payload.webhook_type && payload.webhook_type !== 'status.updated') {
         return jsonResponse({ success: true });
      }

      const status = payload.status;
      const vendorData = payload.vendor_data;
      const sessionId = payload.session_id;

      if (!vendorData) {
         console.log(`[didit-webhook] status="${status}" missing vendor_data - no action`);
         return jsonResponse({ success: true });
      }

      const kind = classifyWorkflow(payload.workflow_id);

      const adminSupabase = createClient(
         Deno.env.get('SUPABASE_URL') ?? '',
         Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
         { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // Embedded-wallet face gate. It runs on the SAME Didit workflow as the KYC liveness
      // pre-gate (both want liveness + 1:N face search), so workflow_id can't tell them apart.
      // The session id can: create-didit-session pins a wallet scan to wallet_face_session_id.
      // Checked before the liveness branch so a wallet scan never writes the KYC gate.
      if (sessionId && (kind === 'liveness' || kind === 'unknown')) {
         const { data: walletCandidate } = await adminSupabase
            .from('users')
            .select('id, user_role, is_didit, is_world_id, liveness_status')
            .eq('id', vendorData)
            .eq('wallet_face_session_id', sessionId)
            .maybeSingle();

         if (walletCandidate) {
            // Ignore non-terminal updates so we don't clobber PENDING mid-flow.
            if (status !== 'Approved' && status !== 'Declined' && status !== 'Abandoned' && status !== 'Expired') {
               return jsonResponse({ success: true });
            }

            const profile = walletCandidate as {
               user_role?: string | null;
               is_didit?: string | null;
               is_world_id?: string | null;
               liveness_status?: string | null;
            };

            // "Has a prior enrollment" is about whether a face was ever captured for this
            // account — NOT about which verification path captured it. Keying this on
            // is_didit alone silently excluded every World ID borrower, who enrolls at the
            // liveness pre-gate just the same.
            const hasPriorEnrollment =
               profile.is_didit === 'ACTIVE' || profile.is_world_id === 'ACTIVE' || profile.liveness_status === 'APPROVED';

            const decision =
               status === 'Abandoned' || status === 'Expired' ? null : (payload.decision ?? (await fetchDecision(sessionId)));

            const verdict = resolveWalletFaceVerdict({
               decision,
               userId: vendorData,
               status: status ?? '',
               hasPriorEnrollment
            });
            const walletFaceStatus = verdict.status;
            const duplicateUserIds = verdict.duplicateUserIds;

            const { error: walletFaceError } = await adminSupabase
               .from('users')
               .update({ wallet_face_status: walletFaceStatus, wallet_face_checked_at: new Date().toISOString() })
               .eq('id', vendorData)
               .eq('wallet_face_session_id', sessionId);

            if (walletFaceError) {
               console.error('[didit-webhook] Failed to update wallet face gate:', walletFaceError.message);
               return jsonResponse({ success: false, error: 'Database error' }, 500);
            }

            // A face that already belongs to another account is worth a look even though we
            // refused it — and if the two accounts sit on opposite sides of the book, it is the
            // self-dealing signal the fraud scan exists to surface.
            if (duplicateUserIds.length > 0) {
               await recordWalletFaceCollision(adminSupabase, vendorData, profile.user_role ?? null, duplicateUserIds, sessionId);
            }

            // Approved, but we could not confirm the enrolled face was this user's. Not a
            // refusal — see resolveWalletFaceVerdict for why blocking here is unsound — but
            // it is the signal that would matter if an account were ever taken over.
            if (verdict.unverifiedSelfMatch) {
               await recordUnverifiedSelfMatch(adminSupabase, vendorData, profile.user_role ?? null, sessionId);
            }

            console.log(
               `[didit-webhook] Wallet face ${walletFaceStatus} for user ${vendorData} (session ${sessionId})` +
                  (duplicateUserIds.length > 0 ? ` matched ${duplicateUserIds.length} other account(s)` : '')
            );
            return jsonResponse({ success: true });
         }
      }

      // Liveness pre-gate: resolve the attempt's status (incl. 1:N face-search dedup). Never
      // touches is_didit - verified status is granted only by the ID/legacy workflow below.
      if (kind === 'liveness') {
         // Ignore non-terminal updates so we don't clobber the PENDING state mid-flow.
         if (status !== 'Approved' && status !== 'Declined' && status !== 'Abandoned' && status !== 'Expired') {
            return jsonResponse({ success: true });
         }

         // Inspect the decision on both Approved and Declined: the "Duplicated face" rule may be
         // set to Decline (Didit blocks -> status Declined) or Approve (we block here from the
         // decision). Either way a detected duplicate maps to DUPLICATE for correct messaging.
         let livenessStatus: 'APPROVED' | 'DUPLICATE' | 'DECLINED';
         if (status === 'Approved' || status === 'Declined') {
            const decision = payload.decision ?? (sessionId ? await fetchDecision(sessionId) : null);
            if (hasDuplicateFace(decision, vendorData)) {
               livenessStatus = 'DUPLICATE';
            } else {
               livenessStatus = status === 'Approved' ? 'APPROVED' : 'DECLINED';
            }
         } else {
            // Abandoned / Expired.
            livenessStatus = 'DECLINED';
         }

         // Only resolve the attempt this webhook belongs to, so a late event from a previous
         // session can't overwrite a newer PENDING attempt.
         let query = adminSupabase.from('users').update({ liveness_status: livenessStatus }).eq('id', vendorData);
         if (sessionId) query = query.eq('liveness_session_id', sessionId);
         const { error: livenessError } = await query;
         if (livenessError) {
            console.error('[didit-webhook] Failed to update liveness gate:', livenessError.message);
            return jsonResponse({ success: false, error: 'Database error' }, 500);
         }

         console.log(`[didit-webhook] Liveness ${livenessStatus} for user ${vendorData} (session ${sessionId ?? 'unknown'})`);
         return jsonResponse({ success: true });
      }

      // ID (Traditional KYC) or legacy/combined workflow.
      if (kind === 'id' || kind === 'legacy') {
         if (!status) {
            console.log(`[didit-webhook] kind="${kind}" missing status - no action`);
            return jsonResponse({ success: true });
         }

         // Already-verified guard: once a user is is_didit=ACTIVE, a later non-approval
         // (Abandoned/Expired/Declined/Duplicate from a fresh session they never needed)
         // must not overwrite their clean status or nag them. Verification only ever
         // moves forward via 'Approved' below; everything else is a no-op for them.
         if (status !== 'Approved') {
            const { data: existing, error: lookupError } = await adminSupabase
               .from('users')
               .select('is_didit')
               .eq('id', vendorData)
               .maybeSingle();
            if (lookupError) {
               console.error('[didit-webhook] Failed to look up verification state:', lookupError.message);
               return jsonResponse({ success: false, error: 'Database error' }, 500);
            }
            if ((existing as { is_didit?: string } | null)?.is_didit === 'ACTIVE') {
               console.log(
                  `[didit-webhook] Ignoring status="${status}" for already-verified user ${vendorData} (${kind}, session ${sessionId ?? 'unknown'})`
               );
               return jsonResponse({ success: true });
            }
         }

         // Duplicate-face (1:N) gate — combined workflow only. Its Face Match "Duplicated
         // face" rule fires here; check on both terminal outcomes (if the rule Declines,
         // status is "Declined" with a duplicate signal; if it only flags, we must still
         // block before granting ACTIVE). Restricted to 'legacy' (the combined workflow):
         // the legacy 'id' step does a 1:1 face match whose success must NOT be read as a
         // duplicate, and that flow's dedup already happened at the separate liveness gate.
         let decision: DiditDecision | null = payload.decision ?? null;
         if (kind === 'legacy' && (status === 'Approved' || status === 'Declined')) {
            decision = decision ?? (sessionId ? await fetchDecision(sessionId) : null);
            if (hasCombinedDuplicate(decision, vendorData)) {
               // A duplicate is always a fresh account that was never ACTIVE, so we only
               // record the status — never flip is_didit here.
               const { error: dupError } = await adminSupabase
                  .from('users')
                  .update({ didit_id_status: 'DUPLICATE' })
                  .eq('id', vendorData);
               if (dupError) {
                  console.error('[didit-webhook] Failed to write duplicate status:', dupError.message);
                  return jsonResponse({ success: false, error: 'Database error' }, 500);
               }
               console.log(`[didit-webhook] Duplicate face for user ${vendorData} (${kind}, session ${sessionId ?? 'unknown'})`);
               if (await claimDiditNotification(adminSupabase, vendorData, 'duplicate', sessionId)) {
                  await notifyAdmins(adminSupabase, vendorData, '🚫 Duplicate face — blocked', sessionId);
               }
               return jsonResponse({ success: true });
            }
         }

         if (status === 'Approved') {
            // Approval: grant verified status and clear any intermediate status/reason.
            const { error: updateError } = await adminSupabase
               .from('users')
               .update({ is_didit: 'ACTIVE', didit_id_status: null, didit_decline_reason: null })
               .eq('id', vendorData);

            if (updateError) {
               console.error('[didit-webhook] Failed to update user:', updateError.message);
               return jsonResponse({ success: false, error: 'Database error' }, 500);
            }

            console.log(`[didit-webhook] User ${vendorData} verified via Didit (${kind}, session ${sessionId ?? 'unknown'})`);
            // The pull sync (check-didit-status) may have already told the user — the
            // marker claim ensures exactly one of the two paths sends.
            if (await claimDiditNotification(adminSupabase, vendorData, 'approved', sessionId)) {
               await notifyAdmins(adminSupabase, vendorData, '✅ Approved — user is now verified', sessionId);
               await notifyUser(adminSupabase, vendorData, 'approved');
            }
            return jsonResponse({ success: true });
         }

         // For every non-Approved status (In Review, Declined, Abandoned, Expired, etc.),
         // store the raw Didit status string so the frontend can surface it.
         // "In Review" means Didit flagged the session for human review — not a rejection.
         // "Declined" is a terminal rejection. Abandoned/Expired mean the user didn't finish.
         const normalized = status.toLowerCase();
         let declineReason: string | undefined;
         if (normalized === 'declined') {
            decision = decision ?? (sessionId ? await fetchDecision(sessionId) : null);
            declineReason = extractDeclineReason(decision);
         }

         const { error: statusError } = await adminSupabase
            .from('users')
            .update({
               didit_id_status: status,
               ...(normalized === 'declined' ? { didit_decline_reason: declineReason ?? null } : {})
            })
            .eq('id', vendorData);

         if (statusError) {
            console.error('[didit-webhook] Failed to write didit_id_status:', statusError.message);
            return jsonResponse({ success: false, error: 'Database error' }, 500);
         }

         console.log(`[didit-webhook] ID status="${status}" for user ${vendorData} (${kind}, session ${sessionId ?? 'unknown'})`);
         const outcome = normalized.includes('review')
            ? '👀 IN MANUAL REVIEW — check the Didit dashboard to expedite'
            : normalized === 'declined'
              ? `❌ Declined${declineReason ? ` — ${declineReason}` : ''}`
              : `⚠️ ${status}`; // Abandoned / Expired / anything else
         // One claim per (session, normalized status): the pull sync may already have
         // notified this outcome, and a later different status is a new claim key.
         const claimKey = normalized.includes('review') ? 'review' : normalized;
         if (await claimDiditNotification(adminSupabase, vendorData, claimKey, sessionId)) {
            await notifyAdmins(adminSupabase, vendorData, outcome, sessionId);

            if (normalized.includes('review')) {
               await notifyUser(adminSupabase, vendorData, 'review');
            } else if (normalized === 'declined') {
               await notifyUser(adminSupabase, vendorData, 'declined', declineReason);
            } else if (normalized === 'abandoned' || normalized === 'expired') {
               await notifyUser(adminSupabase, vendorData, 'abandoned');
            }
         }
         return jsonResponse({ success: true });
      }

      // Unknown workflow id - acknowledge without changing state.
      console.log(`[didit-webhook] Unrecognized workflow_id="${payload.workflow_id}" - no action`);
      return jsonResponse({ success: true });
   } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      console.error('[didit-webhook] Unhandled error:', message);
      return jsonResponse({ success: false, error: message }, 500);
   }
});
