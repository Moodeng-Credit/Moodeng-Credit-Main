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
   vendor_data?: string;
   timestamp?: number;
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

      if (status !== 'Approved' || !vendorData) {
         console.log(`[didit-webhook] status="${status}" vendor_data="${vendorData}" — no action`);
         return jsonResponse({ success: true });
      }

      const adminSupabase = createClient(
         Deno.env.get('SUPABASE_URL') ?? '',
         Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
         { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const { error: updateError } = await adminSupabase
         .from('users')
         .update({ is_didit: 'ACTIVE' })
         .eq('id', vendorData);

      if (updateError) {
         console.error('[didit-webhook] Failed to update user:', updateError.message);
         return jsonResponse({ success: false, error: 'Database error' }, 500);
      }

      console.log(`[didit-webhook] User ${vendorData} verified via Didit (session ${payload.session_id ?? 'unknown'})`);
      return jsonResponse({ success: true });
   } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      console.error('[didit-webhook] Unhandled error:', message);
      return jsonResponse({ success: false, error: message }, 500);
   }
});
