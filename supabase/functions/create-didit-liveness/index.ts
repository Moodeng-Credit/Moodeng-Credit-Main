import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// In-app passive-liveness check for the authenticated caller.
//
// Replaces the hosted Didit liveness page (which ended on a "You've been verified!"
// screen) with a direct call to the standalone Passive Liveness API. The frontend
// captures a selfie in-app and posts it here as a base64 data URL; we forward it to
// Didit server-side (the API key never reaches the browser) and return the resolved
// status inline — no redirect, no webhook, no polling.
//
// This is the shared liveness + 1:N dedup pre-gate that runs before BOTH the World ID
// and the Traditional-KYC paths. It writes liveness_status (APPROVED / DUPLICATE /
// DECLINED), which the ID step (create-didit-session, kind: 'id') reads as its gate.
//
// Required Supabase secrets:
//   DIDIT_API_KEY  — Didit API key (server-side only; never expose to client)
// Optional:
//   DIDIT_API_BASE — defaults to https://verification.didit.me/v3

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Didit liveness scores are 0-100; the Passive Liveness API decides Approved/Declined
// itself, so we only need to read its status and warnings.
type DiditWarning = { risk?: unknown; feature?: unknown; log_type?: unknown; name?: unknown; code?: unknown } | null;
type DiditLivenessResponse = {
   request_id?: string;
   liveness?: {
      status?: string;
      score?: number | null;
      warnings?: unknown;
   } | null;
   warnings?: unknown;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

// A duplicate/blocklist hit (1:N face search) surfaces as a warning whose risk/code/name
// mentions "duplicat" or "blocklist". Scan defensively across possible field names.
const warningsFlagDuplicate = (warnings: unknown): boolean =>
   asArray(warnings).some((w) => {
      const entry = w as DiditWarning;
      const text = [entry?.risk, entry?.code, entry?.name, entry?.feature]
         .map((v) => String(v ?? '').toLowerCase())
         .join(' ');
      return text.includes('duplicat') || text.includes('blocklist');
   });

// Decode a base64 data URL (or bare base64 string) into bytes + mime type.
const decodeImage = (input: string): { bytes: Uint8Array; mime: string } | null => {
   const match = /^data:([^;]+);base64,(.*)$/s.exec(input.trim());
   const mime = match ? match[1] : 'image/jpeg';
   const base64 = match ? match[2] : input.trim();
   try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return { bytes, mime };
   } catch {
      return null;
   }
};

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
         console.error('[create-didit-liveness] DIDIT_API_KEY not configured');
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

      let image: string | undefined;
      try {
         const body = (await req.json()) as { image?: unknown };
         if (typeof body?.image === 'string') image = body.image;
      } catch {
         // fall through to the missing-image error below
      }
      if (!image) {
         return jsonResponse({ error: 'Missing selfie image' }, 400);
      }

      const decoded = decodeImage(image);
      if (!decoded) {
         return jsonResponse({ error: 'Invalid image data' }, 400);
      }
      // Passive Liveness caps the upload at 5 MB.
      if (decoded.bytes.byteLength > 5 * 1024 * 1024) {
         return jsonResponse({ error: 'Image too large' }, 400);
      }

      const apiBase = (Deno.env.get('DIDIT_API_BASE')?.trim() || 'https://verification.didit.me/v3').replace(/\/$/, '');

      const form = new FormData();
      form.append('user_image', new Blob([decoded.bytes], { type: decoded.mime }), 'selfie.jpg');
      form.append('vendor_data', user.id);
      form.append('save_api_request', 'true');

      const diditResponse = await fetch(`${apiBase}/passive-liveness/`, {
         method: 'POST',
         headers: { 'x-api-key': apiKey, Accept: 'application/json' },
         body: form
      });

      const diditBody = (await diditResponse.json().catch(() => null)) as DiditLivenessResponse | null;

      if (!diditResponse.ok || !diditBody) {
         console.error('[create-didit-liveness] Passive liveness failed:', diditResponse.status, diditBody);
         // 400 from Didit usually means no face / unusable image — let the user retry.
         if (diditResponse.status === 400) {
            return jsonResponse({ error: "We couldn't read a clear face. Please try again." }, 400);
         }
         return jsonResponse({ error: 'Could not run the liveness check. Please try again.' }, 502);
      }

      const rawStatus = String(diditBody.liveness?.status ?? '').toLowerCase();
      const isDuplicate =
         warningsFlagDuplicate(diditBody.liveness?.warnings) || warningsFlagDuplicate(diditBody.warnings);

      let livenessStatus: 'APPROVED' | 'DUPLICATE' | 'DECLINED';
      if (isDuplicate) {
         livenessStatus = 'DUPLICATE';
      } else if (rawStatus === 'approved') {
         livenessStatus = 'APPROVED';
      } else {
         livenessStatus = 'DECLINED';
      }

      const { error: updateError } = await supabase
         .from('users')
         .update({ liveness_status: livenessStatus, liveness_session_id: diditBody.request_id ?? null })
         .eq('id', user.id);
      if (updateError) {
         console.error('[create-didit-liveness] Failed to update liveness gate:', updateError.message);
         return jsonResponse({ error: 'Database error' }, 500);
      }

      console.log(`[create-didit-liveness] Liveness ${livenessStatus} for user ${user.id} (request ${diditBody.request_id ?? 'unknown'})`);
      return jsonResponse({ status: livenessStatus });
   } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      console.error('[create-didit-liveness] Unhandled error:', message);
      return jsonResponse({ error: message }, 500);
   }
});
