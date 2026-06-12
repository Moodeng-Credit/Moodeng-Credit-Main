import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Creates a Didit verification session for the authenticated caller and returns
// the hosted verification URL to redirect them to.
//
// vendor_data is set server-side to the authenticated user's id (never trusted
// from the client) so the didit-webhook can map the result back to the user.
//
// Required Supabase secrets:
//   DIDIT_API_KEY       — Didit API key (server-side only; never expose to client)
//   DIDIT_WORKFLOW_ID   — Workflow UUID from Didit console (Custom KYC workflow)
// Optional:
//   DIDIT_API_BASE      — defaults to https://verification.didit.me/v3
//   DIDIT_CALLBACK_URL  — frontend return URL after verification (e.g.
//                         https://app.example.com/verify-didit). Required to send
//                         the user back into the app cleanly.

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Short enum of in-app destinations the verify page understands. Only these are
// echoed into the callback URL, so an attacker can't turn this into an open redirect.
const ALLOWED_RETURN_TO = new Set([
   'loan-request',
   'account-settings',
   'repay',
   'milestones',
   'dashboard-credit-level'
]);

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }

   if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
   }

   try {
      const apiKey = Deno.env.get('DIDIT_API_KEY');
      const workflowId = Deno.env.get('DIDIT_WORKFLOW_ID');
      if (!apiKey || !workflowId) {
         console.error('[create-didit-session] DIDIT_API_KEY or DIDIT_WORKFLOW_ID not configured');
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

      let returnTo: string | undefined;
      try {
         const body = (await req.json()) as { returnTo?: unknown };
         if (typeof body?.returnTo === 'string' && ALLOWED_RETURN_TO.has(body.returnTo)) {
            returnTo = body.returnTo;
         }
      } catch {
         // No body / invalid JSON is fine — returnTo is optional.
      }

      const callbackBase = Deno.env.get('DIDIT_CALLBACK_URL')?.trim();
      const callback = callbackBase
         ? returnTo
            ? `${callbackBase}?returnTo=${encodeURIComponent(returnTo)}`
            : callbackBase
         : undefined;

      const apiBase = (Deno.env.get('DIDIT_API_BASE')?.trim() || 'https://verification.didit.me/v3').replace(/\/$/, '');

      const diditResponse = await fetch(`${apiBase}/session/`, {
         method: 'POST',
         headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json'
         },
         body: JSON.stringify({
            workflow_id: workflowId,
            vendor_data: user.id,
            ...(callback ? { callback } : {})
         })
      });

      const diditBody = (await diditResponse.json().catch(() => null)) as
         | { session_id?: string; url?: string; [key: string]: unknown }
         | null;

      if (!diditResponse.ok || !diditBody?.url) {
         console.error('[create-didit-session] Didit session creation failed:', diditResponse.status, diditBody);
         return jsonResponse({ error: 'Failed to create verification session' }, 502);
      }

      return jsonResponse({ url: diditBody.url, sessionId: diditBody.session_id ?? null });
   } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      console.error('[create-didit-session] Unhandled error:', message);
      return jsonResponse({ error: message }, 500);
   }
});
