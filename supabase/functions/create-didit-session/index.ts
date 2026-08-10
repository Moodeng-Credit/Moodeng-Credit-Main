import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Creates a Didit verification session for the authenticated caller and returns
// the hosted verification URL to redirect them to.
//
// Session kinds (see src/app/verify/page.tsx):
//   kind: 'combined' — Traditional KYC. A single hosted workflow runs liveness + ID +
//                      face match (incl. the "Duplicated face" 1:N dedup) end-to-end, so
//                      there's no intermediate screen between steps. Uses DIDIT_WORKFLOW_ID.
//   kind: 'liveness' — liveness + 1:N face-search pre-gate for the World ID path (World ID
//                      can't be merged into a Didit workflow). Uses a liveness-only workflow.
//   kind: 'id'       — legacy ID-only step (ID document + face match). Gated server-side:
//                      refused unless the caller's latest liveness is APPROVED.
//   kind: 'wallet'   — the embedded-wallet face gate. Same liveness + 1:N face-search workflow
//                      as 'liveness', but its verdict lands in users.wallet_face_* instead of
//                      the KYC liveness columns, so a wallet scan and a KYC attempt can never
//                      clobber one another. Fires only when minting a sponsored embedded wallet
//                      — connecting an external wallet never reaches here.
//
// vendor_data is set server-side to the authenticated user's id (never trusted
// from the client) so the didit-webhook can map the result back to the user.
//
// Required Supabase secrets:
//   DIDIT_API_KEY              — Didit API key (server-side only; never expose to client)
//   DIDIT_WORKFLOW_ID          — Workflow UUID for the combined Traditional-KYC workflow
//   DIDIT_LIVENESS_WORKFLOW_ID — Workflow UUID for the World ID liveness pre-gate
// Optional:
//   DIDIT_ID_WORKFLOW_ID — legacy ID-only workflow (kind: 'id'); falls back to DIDIT_WORKFLOW_ID.
//   DIDIT_WALLET_WORKFLOW_ID   — workflow for the wallet face gate; falls back to the liveness
//                         workflow, which already does liveness + 1:N face search.
//   DIDIT_API_BASE      — defaults to https://verification.didit.me/v3
//   DIDIT_CALLBACK_URL  — frontend return URL after verification (e.g.
//                         https://app.example.com/verify). Required to send the user back
//                         into the app cleanly. `kind` and `returnTo` are appended as query params.
//   DIDIT_WALLET_CALLBACK_URL — return URL for kind: 'wallet'. Defaults to the wallet face-check
//                         route on DIDIT_CALLBACK_URL's origin, so no extra secret is needed.

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

type SessionKind = 'liveness' | 'id' | 'combined' | 'wallet';

const SESSION_KINDS: ReadonlySet<string> = new Set<SessionKind>(['liveness', 'id', 'combined', 'wallet']);

/** The in-app route Didit returns to for the embedded-wallet face gate. */
const WALLET_CALLBACK_PATH = '/onboarding/wallet/face-check';

const resolveWorkflowId = (kind: SessionKind): string | undefined => {
   const liveness = Deno.env.get('DIDIT_LIVENESS_WORKFLOW_ID');
   const id = Deno.env.get('DIDIT_ID_WORKFLOW_ID');
   const combined = Deno.env.get('DIDIT_WORKFLOW_ID');
   // 'combined' is the single Traditional-KYC workflow (liveness + ID + face match in one
   // hosted session). 'liveness' is the World ID pre-gate; 'id' is the legacy ID-only step.
   if (kind === 'combined') return combined;
   if (kind === 'liveness') return liveness || combined;
   // The wallet gate needs exactly what the liveness workflow already does — a live capture
   // plus a 1:N search of previously approved faces — so it reuses it unless overridden.
   if (kind === 'wallet') return Deno.env.get('DIDIT_WALLET_WORKFLOW_ID') || liveness || combined;
   return id || combined;
};

/**
 * Where Didit sends the user back to. The wallet gate returns to its own screen rather than
 * /verify so the KYC flow's state machine is never entered by a wallet scan. Derived from
 * DIDIT_CALLBACK_URL's origin so shipping this needs no new secret.
 */
const resolveCallbackBase = (kind: SessionKind, callbackBase: string | undefined): string | undefined => {
   if (kind !== 'wallet') return callbackBase;

   const override = Deno.env.get('DIDIT_WALLET_CALLBACK_URL')?.trim();
   if (override) return override;
   if (!callbackBase) return undefined;

   try {
      return new URL(WALLET_CALLBACK_PATH, callbackBase).toString();
   } catch {
      return undefined;
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
         console.error('[create-didit-session] DIDIT_API_KEY not configured');
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
      let kind: SessionKind = 'liveness';
      try {
         const body = (await req.json()) as { returnTo?: unknown; kind?: unknown };
         if (typeof body?.returnTo === 'string' && ALLOWED_RETURN_TO.has(body.returnTo)) {
            returnTo = body.returnTo;
         }
         if (typeof body?.kind === 'string' && SESSION_KINDS.has(body.kind)) {
            kind = body.kind as SessionKind;
         }
      } catch {
         // No body / invalid JSON is fine — kind defaults to 'liveness', returnTo is optional.
      }

      const workflowId = resolveWorkflowId(kind);
      if (!workflowId) {
         console.error(`[create-didit-session] No workflow id configured for kind="${kind}"`);
         return jsonResponse({ error: 'Server misconfigured' }, 500);
      }

      // Server-authoritative dedup gate: the ID step may only start once the caller has a
      // clean (non-duplicate) liveness pass. This is what prevents a duplicate face from ever
      // reaching is_didit = ACTIVE.
      if (kind === 'id') {
         const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('liveness_status')
            .eq('id', user.id)
            .maybeSingle();
         if (profileError) {
            console.error('[create-didit-session] Failed to read liveness gate:', profileError.message);
            return jsonResponse({ error: 'Database error' }, 500);
         }
         if ((profile as { liveness_status?: string } | null)?.liveness_status !== 'APPROVED') {
            return jsonResponse({ error: 'Liveness check required', code: 'LIVENESS_REQUIRED' }, 409);
         }
      }

      // A face scan is only worth paying Didit for when the caller could actually use it.
      // Someone who already holds an embedded wallet needs no scan (recovery is always
      // allowed), so refuse early rather than burning a session on a no-op.
      if (kind === 'wallet') {
         const { data: grant, error: grantError } = await supabase
            .from('embedded_wallet_grants')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle();
         if (grantError) {
            console.error('[create-didit-session] Failed to read wallet grant:', grantError.message);
            return jsonResponse({ error: 'Database error' }, 500);
         }
         if (grant) {
            return jsonResponse({ error: 'This account already has an instant wallet.', code: 'ALREADY_GRANTED' }, 409);
         }
      }

      const callbackBase = resolveCallbackBase(kind, Deno.env.get('DIDIT_CALLBACK_URL')?.trim());
      const callback = callbackBase
         ? (() => {
              const params = new URLSearchParams({ kind });
              if (returnTo) params.set('returnTo', returnTo);
              return `${callbackBase}?${params.toString()}`;
           })()
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

      // Pin the liveness attempt to this session and reset its status so the frontend polls
      // for a fresh result (fresh-each-attempt). The webhook resolves it to APPROVED / DUPLICATE /
      // DECLINED once Didit finishes.
      if (kind === 'liveness' && diditBody.session_id) {
         const { error: resetError } = await supabase
            .from('users')
            .update({ liveness_status: 'PENDING', liveness_session_id: diditBody.session_id })
            .eq('id', user.id);
         if (resetError) {
            console.error('[create-didit-session] Failed to reset liveness gate:', resetError.message);
            return jsonResponse({ error: 'Database error' }, 500);
         }
      }

      // Mark that the user started the document/verification step so the frontend can show
      // "Verification in progress" across the app even after they leave the polling screen.
      // Store the session id/url so an unfinished session can be resumed ("Continue
      // verification" on /verify), and clear any stale verdict from a previous attempt so
      // an old Declined/Abandoned status can't mask this fresh session.
      if (kind === 'id' || kind === 'combined') {
         await supabase
            .from('users')
            .update({
               didit_submitted_at: new Date().toISOString(),
               didit_session_id: diditBody.session_id ?? null,
               didit_session_url: diditBody.url,
               didit_id_status: null
            })
            .eq('id', user.id);
      }

      return jsonResponse({ url: diditBody.url, sessionId: diditBody.session_id ?? null });
   } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      console.error('[create-didit-session] Unhandled error:', message);
      return jsonResponse({ error: message }, 500);
   }
});
