import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hmac } from 'https://esm.sh/@noble/hashes@1.8.0/hmac?target=deno';
import { sha256 } from 'https://esm.sh/@noble/hashes@1.8.0/sha2?target=deno';

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

// Partial shape of Didit's decision object (only the fields we read). Face Search 1:N results
// can surface under a few key names depending on workflow config, so we scan defensively.
type DiditDecision = {
   face_search?: {
      status?: string;
      results?: unknown;
      detected_faces?: unknown;
      matches?: unknown;
   } | null;
};

const FACE_MATCH_THRESHOLD = 0.8;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const readField = (obj: unknown, keys: string[]): unknown => {
   if (!obj || typeof obj !== 'object') return undefined;
   const record = obj as Record<string, unknown>;
   for (const key of keys) {
      if (record[key] !== undefined && record[key] !== null) return record[key];
   }
   return undefined;
};

// True when face search found a match belonging to a DIFFERENT user (i.e. this live face is
// already registered). Didit declines the face_search feature when a 1:N match exists; we also
// scan the match arrays for an above-threshold score tied to another user's vendor_data.
const hasDuplicateFace = (decision: DiditDecision | null | undefined, currentUserId: string): boolean => {
   const faceSearch = decision?.face_search;
   if (!faceSearch) return false;

   const matches = [
      ...asArray(faceSearch.results),
      ...asArray(faceSearch.detected_faces),
      ...asArray(faceSearch.matches)
   ];

   for (const match of matches) {
      const score = Number(readField(match, ['score', 'similarity', 'confidence']) ?? 0);
      const matchedVendor = readField(match, ['vendor_data', 'external_user_id', 'user_id']);
      const vendorStr = typeof matchedVendor === 'string' ? matchedVendor : undefined;
      if (score >= FACE_MATCH_THRESHOLD && vendorStr && vendorStr !== currentUserId) {
         return true;
      }
   }

   // Fallback: an explicit Declined face_search status with any matches present.
   if (typeof faceSearch.status === 'string' && faceSearch.status.toLowerCase() === 'declined' && matches.length > 0) {
      return true;
   }

   return false;
};

// Fetch the full decision when the webhook payload didn't embed it (needed for face-search results).
const fetchDecision = async (sessionId: string): Promise<DiditDecision | null> => {
   const apiKey = Deno.env.get('DIDIT_API_KEY');
   if (!apiKey) {
      console.error('[didit-webhook] DIDIT_API_KEY not configured — cannot fetch decision for dedup');
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
         console.log(`[didit-webhook] status="${status}" missing vendor_data — no action`);
         return jsonResponse({ success: true });
      }

      const kind = classifyWorkflow(payload.workflow_id);

      const adminSupabase = createClient(
         Deno.env.get('SUPABASE_URL') ?? '',
         Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
         { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // Liveness pre-gate: resolve the attempt's status (incl. 1:N face-search dedup). Never
      // touches is_didit — verified status is granted only by the ID/legacy workflow below.
      if (kind === 'liveness') {
         // Ignore non-terminal updates so we don't clobber the PENDING state mid-flow.
         if (status !== 'Approved' && status !== 'Declined' && status !== 'Abandoned' && status !== 'Expired') {
            return jsonResponse({ success: true });
         }

         let livenessStatus: 'APPROVED' | 'DUPLICATE' | 'DECLINED';
         if (status === 'Approved') {
            const decision = payload.decision ?? (sessionId ? await fetchDecision(sessionId) : null);
            livenessStatus = hasDuplicateFace(decision, vendorData) ? 'DUPLICATE' : 'APPROVED';
         } else {
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

      // ID (Traditional KYC) or legacy combined workflow: an approval grants verified status.
      if (kind === 'id' || kind === 'legacy') {
         if (status !== 'Approved') {
            console.log(`[didit-webhook] kind="${kind}" status="${status}" — no action`);
            return jsonResponse({ success: true });
         }

         const { error: updateError } = await adminSupabase
            .from('users')
            .update({ is_didit: 'ACTIVE' })
            .eq('id', vendorData);

         if (updateError) {
            console.error('[didit-webhook] Failed to update user:', updateError.message);
            return jsonResponse({ success: false, error: 'Database error' }, 500);
         }

         console.log(`[didit-webhook] User ${vendorData} verified via Didit (${kind}, session ${sessionId ?? 'unknown'})`);
         return jsonResponse({ success: true });
      }

      // Unknown workflow id — acknowledge without changing state.
      console.log(`[didit-webhook] Unrecognized workflow_id="${payload.workflow_id}" — no action`);
      return jsonResponse({ success: true });
   } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      console.error('[didit-webhook] Unhandled error:', message);
      return jsonResponse({ success: false, error: message }, 500);
   }
});
