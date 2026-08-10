import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { claimDiditNotification, notifyAdmins, notifyUser } from '../_shared/diditNotifications.ts';
import { collectDuplicateUserIds } from '../_shared/walletFaceVerdict.ts';

// On-demand Didit status sync for the authenticated caller.
//
// The didit-webhook is the primary way verification statuses reach our database — but
// webhooks can be lost, delayed, or simply never sent (Didit emits nothing while a
// session sits in "Not Started"/"In Progress" after the user closes the tab). Without
// this function, every "Check status" button only re-reads our own users row, which by
// definition hasn't changed — so a user whose webhook went missing is stuck forever.
//
// This function asks Didit's API for the session's current status and applies the same
// database transitions the webhook would have, then returns the fresh status so the
// frontend can route immediately. It also sends the same user/admin notifications the
// webhook would — deduplicated against the webhook via users.didit_notify_marker
// (claimDiditNotification), so a status only ever produces one notification no matter
// which path discovers it first. All writes are idempotent with the webhook's.
//
// Body: { kind: 'liveness' | 'id' | 'wallet' } — which of the caller's sessions to sync.
// 'wallet' is the embedded-wallet face gate (users.wallet_face_*), which is deliberately
// separate from the KYC liveness gate so the two can never overwrite each other.
// Response: { synced: boolean, status?: string } where status is Didit's raw session
// status ('Not Started', 'In Progress', 'In Review', 'Approved', 'Declined',
// 'Abandoned', 'Expired').
//
// NOTE: the duplicate-face detection helpers below are copied verbatim from
// supabase/functions/didit-webhook/index.ts — keep the two in sync (extracting them to
// _shared is the eventual cleanup, deferred to avoid redeploying the live webhook).

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// --- Duplicate-face detection (copied from didit-webhook — keep in sync) -------------

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
   status?: string;
};

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

const warningsFlagDuplicate = (warnings: unknown): boolean =>
   asArray(warnings).some((w) => {
      const text = String(readField(w, ['code', 'type', 'name', 'risk', 'message']) ?? '').toLowerCase();
      return text.includes('duplicat');
   });

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
      const score = raw > 0 && raw <= 1 ? raw * 100 : raw;
      const matchedVendor = readField(match, ['vendor_data', 'external_user_id', 'user_id']);
      const vendorStr = typeof matchedVendor === 'string' ? matchedVendor : undefined;
      if (score >= FACE_MATCH_THRESHOLD && vendorStr !== currentUserId) {
         return true;
      }
   }

   if (warningsFlagDuplicate(block.warnings)) return true;

   const status = typeof block.status === 'string' ? block.status.toLowerCase() : '';
   if ((status === 'declined' || status === 'warning') && matches.length > 0) return true;

   return false;
};

const hasDuplicateFace = (decision: DiditDecision | null | undefined, currentUserId: string): boolean => {
   if (!decision) return false;
   return (
      blockHasDuplicate(decision.face_match, currentUserId) ||
      blockHasDuplicate(decision.face_search, currentUserId) ||
      blockHasDuplicate(decision.liveness, currentUserId) ||
      warningsFlagDuplicate(decision.warnings)
   );
};

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

// --- Didit session status fetch -------------------------------------------------------

// The decision endpoint returns the session's current status plus the decision blocks
// once they exist. For sessions that haven't produced a decision yet, fall back to the
// plain session endpoint, which always carries `status`.
const fetchSessionState = async (
   sessionId: string,
   apiKey: string
): Promise<{ status: string; decision: DiditDecision | null } | null> => {
   const apiBase = (Deno.env.get('DIDIT_API_BASE')?.trim() || 'https://verification.didit.me/v3').replace(/\/$/, '');
   const headers = { 'x-api-key': apiKey, Accept: 'application/json' };

   for (const path of [`/session/${sessionId}/decision/`, `/session/${sessionId}/`]) {
      try {
         const res = await fetch(`${apiBase}${path}`, { method: 'GET', headers });
         if (!res.ok) {
            console.log(`[check-didit-status] GET ${path} -> ${res.status}`);
            continue;
         }
         const body = (await res.json().catch(() => null)) as (DiditDecision & { status?: string }) | null;
         if (body && typeof body.status === 'string') {
            return { status: body.status, decision: body };
         }
      } catch (error) {
         console.error(`[check-didit-status] GET ${path} error:`, error instanceof Error ? error.message : error);
      }
   }
   return null;
};

// --- Handler --------------------------------------------------------------------------

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }

   if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
   }

   try {
      const apiKey = Deno.env.get('DIDIT_API_KEY');
      if (!apiKey) {
         console.error('[check-didit-status] DIDIT_API_KEY not configured');
         return jsonResponse({ error: 'Server misconfigured' }, 500);
      }

      const accessToken = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
      if (!accessToken) {
         return jsonResponse({ error: 'Missing authorization token' }, 401);
      }

      const supabase = createClient(
         Deno.env.get('SUPABASE_URL') ?? '',
         Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
         { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const {
         data: { user },
         error: userError
      } = await supabase.auth.getUser(accessToken);

      if (userError || !user) {
         return jsonResponse({ error: 'Invalid authorization token' }, 401);
      }

      let kind: 'liveness' | 'id' | 'wallet' = 'id';
      try {
         const body = (await req.json()) as { kind?: unknown };
         if (body?.kind === 'liveness' || body?.kind === 'id' || body?.kind === 'wallet') kind = body.kind;
      } catch {
         // Missing body defaults to 'id'.
      }

      const { data: profile, error: profileError } = await supabase
         .from('users')
         .select(
            'liveness_session_id, liveness_status, didit_session_id, didit_id_status, is_didit, wallet_face_session_id, wallet_face_status, user_role'
         )
         .eq('id', user.id)
         .maybeSingle();

      if (profileError || !profile) {
         console.error('[check-didit-status] Failed to read user row:', profileError?.message);
         return jsonResponse({ error: 'Database error' }, 500);
      }

      const row = profile as {
         liveness_session_id?: string | null;
         liveness_status?: string | null;
         didit_session_id?: string | null;
         didit_id_status?: string | null;
         is_didit?: string | null;
         wallet_face_session_id?: string | null;
         wallet_face_status?: string | null;
         user_role?: string | null;
      };

      const sessionId =
         kind === 'liveness' ? row.liveness_session_id : kind === 'wallet' ? row.wallet_face_session_id : row.didit_session_id;
      if (!sessionId) {
         return jsonResponse({ synced: false, reason: 'no-session' });
      }

      // Already terminal in our DB — nothing to sync (also keeps this endpoint cheap when
      // the webhook already did its job).
      if (kind === 'id' && row.is_didit === 'ACTIVE') {
         return jsonResponse({ synced: true, status: 'Approved' });
      }

      const state = await fetchSessionState(sessionId, apiKey);
      if (!state) {
         return jsonResponse({ synced: false, reason: 'didit-unreachable' });
      }

      const status = state.status;
      const normalized = status.toLowerCase();

      if (kind === 'wallet') {
         // MUST match didit-webhook's resolveWalletFaceVerdict exactly. This is the pull
         // path for the same scan, so any divergence means the answer depends on whether a
         // webhook happened to arrive — the worst kind of intermittent bug.
         //
         // Critically: do NOT use hasDuplicateFace() here. It treats a match with no
         // vendor_data as somebody else's, which is right on a first scan and wrong here,
         // where the user's OWN enrollment is expected to match. See the long note in
         // didit-webhook above collectFaceSearchMatches.
         let walletFaceStatus: 'APPROVED' | 'DUPLICATE' | 'DECLINED' | null = null;

         if (status === 'Approved' || status === 'Declined') {
            const duplicateUserIds = collectDuplicateUserIds(state.decision, user.id);
            if (duplicateUserIds.length > 0) {
               walletFaceStatus = 'DUPLICATE';
            } else if (status === 'Declined') {
               walletFaceStatus = 'DECLINED';
            } else {
               walletFaceStatus = 'APPROVED';
            }
         } else if (status === 'Abandoned' || status === 'Expired') {
            walletFaceStatus = 'DECLINED';
         }

         // Never downgrade an approval the webhook already spent: once CONSUMED the wallet
         // has been minted, and re-writing the column would strand a working wallet.
         if (walletFaceStatus && row.wallet_face_status !== walletFaceStatus && row.wallet_face_status !== 'CONSUMED') {
            const { error: updateError } = await supabase
               .from('users')
               .update({ wallet_face_status: walletFaceStatus, wallet_face_checked_at: new Date().toISOString() })
               .eq('id', user.id)
               .eq('wallet_face_session_id', sessionId);
            if (updateError) {
               console.error('[check-didit-status] Failed to update wallet face gate:', updateError.message);
               return jsonResponse({ error: 'Database error' }, 500);
            }
            console.log(`[check-didit-status] Wallet face ${walletFaceStatus} for user ${user.id} (session ${sessionId})`);
         }

         return jsonResponse({ synced: true, status });
      }

      if (kind === 'liveness') {
         // Same transitions as the webhook's liveness branch. Non-terminal statuses are
         // reported but not written — PENDING already means "in progress".
         let livenessStatus: 'APPROVED' | 'DUPLICATE' | 'DECLINED' | null = null;
         if (status === 'Approved' || status === 'Declined') {
            livenessStatus = hasDuplicateFace(state.decision, user.id)
               ? 'DUPLICATE'
               : status === 'Approved'
                 ? 'APPROVED'
                 : 'DECLINED';
         } else if (status === 'Abandoned' || status === 'Expired') {
            livenessStatus = 'DECLINED';
         }

         if (livenessStatus && row.liveness_status !== livenessStatus) {
            // Guard on the session id so a sync for an old attempt can't overwrite a newer one.
            const { error: updateError } = await supabase
               .from('users')
               .update({ liveness_status: livenessStatus })
               .eq('id', user.id)
               .eq('liveness_session_id', sessionId);
            if (updateError) {
               console.error('[check-didit-status] Failed to update liveness gate:', updateError.message);
               return jsonResponse({ error: 'Database error' }, 500);
            }
            console.log(`[check-didit-status] Liveness ${livenessStatus} for user ${user.id} (session ${sessionId})`);
         }

         return jsonResponse({ synced: true, status });
      }

      // kind === 'id' (combined Traditional-KYC workflow).
      if (status === 'Approved') {
         if (hasCombinedDuplicate(state.decision, user.id)) {
            const { error: dupError } = await supabase
               .from('users')
               .update({ didit_id_status: 'DUPLICATE' })
               .eq('id', user.id)
               .eq('didit_session_id', sessionId);
            if (dupError) {
               console.error('[check-didit-status] Failed to write duplicate status:', dupError.message);
               return jsonResponse({ error: 'Database error' }, 500);
            }
            console.log(`[check-didit-status] Duplicate face for user ${user.id} (session ${sessionId})`);
            if (await claimDiditNotification(supabase, user.id, 'duplicate', sessionId)) {
               await notifyAdmins(supabase, user.id, '🚫 Duplicate face — blocked', sessionId);
            }
            return jsonResponse({ synced: true, status: 'Declined' });
         }

         const { error: updateError } = await supabase
            .from('users')
            .update({ is_didit: 'ACTIVE', didit_id_status: null, didit_decline_reason: null })
            .eq('id', user.id)
            .eq('didit_session_id', sessionId);
         if (updateError) {
            console.error('[check-didit-status] Failed to grant verified status:', updateError.message);
            return jsonResponse({ error: 'Database error' }, 500);
         }
         console.log(`[check-didit-status] User ${user.id} verified via status sync (session ${sessionId})`);
         if (await claimDiditNotification(supabase, user.id, 'approved', sessionId)) {
            await notifyAdmins(supabase, user.id, '✅ Approved — user is now verified', sessionId);
            await notifyUser(supabase, user.id, 'approved');
         }
         return jsonResponse({ synced: true, status });
      }

      // Every non-Approved status: store the raw string (same as the webhook) so the
      // frontend's status-aware routing can surface review/declined/unfinished states.
      let declineReason: string | undefined;
      if (normalized === 'declined') {
         declineReason = extractDeclineReason(state.decision);
      }

      if (row.didit_id_status !== status) {
         const { error: statusError } = await supabase
            .from('users')
            .update({
               didit_id_status: status,
               ...(normalized === 'declined' ? { didit_decline_reason: declineReason ?? null } : {})
            })
            .eq('id', user.id)
            .eq('didit_session_id', sessionId);
         if (statusError) {
            console.error('[check-didit-status] Failed to write didit_id_status:', statusError.message);
            return jsonResponse({ error: 'Database error' }, 500);
         }
         console.log(`[check-didit-status] ID status="${status}" for user ${user.id} (session ${sessionId})`);
      }

      // Mirror the webhook's notifications for outcomes the user should hear about.
      // "Not Started"/"In Progress" are deliberately silent — the user is in-app looking
      // at the unfinished screen, and nagging them mid-flow would be noise.
      const isNotifiable =
         normalized.includes('review') || normalized === 'declined' || normalized === 'abandoned' || normalized === 'expired';
      if (isNotifiable) {
         const claimKey = normalized.includes('review') ? 'review' : normalized;
         if (await claimDiditNotification(supabase, user.id, claimKey, sessionId)) {
            const adminOutcome = normalized.includes('review')
               ? '👀 IN MANUAL REVIEW — check the Didit dashboard to expedite'
               : normalized === 'declined'
                 ? `❌ Declined${declineReason ? ` — ${declineReason}` : ''}`
                 : `⚠️ ${status}`;
            await notifyAdmins(supabase, user.id, adminOutcome, sessionId);

            if (normalized.includes('review')) {
               await notifyUser(supabase, user.id, 'review');
            } else if (normalized === 'declined') {
               await notifyUser(supabase, user.id, 'declined', declineReason);
            } else {
               await notifyUser(supabase, user.id, 'abandoned');
            }
         }
      }

      return jsonResponse({ synced: true, status });
   } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      console.error('[check-didit-status] Unhandled error:', message);
      return jsonResponse({ error: message }, 500);
   }
});
