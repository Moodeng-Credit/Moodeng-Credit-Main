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
//   kind: 'cashout'  — the first-cash-out face gate (20260820100000_cashout_face_gate.sql).
//                      Same liveness + 1:N workflow again, but the verdict is a 1:1 match
//                      against the ORIGINAL KYC'er's portrait, not just "any approved face" —
//                      see resolveCashoutFaceOutcome in _shared/diditFaceSearch.ts. Fires only
//                      for a PH borrower's first-ever cash-out from an embedded wallet (see
//                      cashout_face_gate_required); requires destinationAddress + amount in the
//                      body so the resulting approval can be bound to that exact transfer.
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
//   DIDIT_CASHOUT_WORKFLOW_ID  — workflow for the cash-out face gate; falls back to the wallet
//                         workflow, then liveness — same underlying capture either way.
//   DIDIT_API_BASE      — defaults to https://verification.didit.me/v3
//   DIDIT_CALLBACK_URL  — frontend return URL after verification (e.g.
//                         https://app.example.com/verify). Required to send the user back
//                         into the app cleanly. `kind` and `returnTo` are appended as query params.
//   DIDIT_WALLET_CALLBACK_URL — return URL for kind: 'wallet'. Defaults to the wallet face-check
//                         route on DIDIT_CALLBACK_URL's origin, so no extra secret is needed.
//   DIDIT_CASHOUT_CALLBACK_URL — return URL for kind: 'cashout'. Defaults to the withdraw
//                         face-check route on DIDIT_CALLBACK_URL's origin.

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

type SessionKind = 'liveness' | 'id' | 'combined' | 'wallet' | 'cashout';

const SESSION_KINDS: ReadonlySet<string> = new Set<SessionKind>(['liveness', 'id', 'combined', 'wallet', 'cashout']);

/** The in-app route Didit returns to for the embedded-wallet face gate. */
const WALLET_CALLBACK_PATH = '/onboarding/wallet/face-check';

/** The in-app route Didit returns to for the first-cash-out face gate. */
const CASHOUT_CALLBACK_PATH = '/withdraw/face-check';

const resolveWorkflowId = (kind: SessionKind): string | undefined => {
   const liveness = Deno.env.get('DIDIT_LIVENESS_WORKFLOW_ID');
   const id = Deno.env.get('DIDIT_ID_WORKFLOW_ID');
   const combined = Deno.env.get('DIDIT_WORKFLOW_ID');
   const wallet = Deno.env.get('DIDIT_WALLET_WORKFLOW_ID') || liveness || combined;
   // 'combined' is the single Traditional-KYC workflow (liveness + ID + face match in one
   // hosted session). 'liveness' is the World ID pre-gate; 'id' is the legacy ID-only step.
   if (kind === 'combined') return combined;
   if (kind === 'liveness') return liveness || combined;
   // The wallet gate needs exactly what the liveness workflow already does — a live capture
   // plus a 1:N search of previously approved faces — so it reuses it unless overridden.
   if (kind === 'wallet') return wallet;
   // The cash-out gate needs the same capture; it differs only in HOW the webhook resolves the
   // verdict (1:1 against the caller's own KYC portrait, not "any approved face" — see
   // resolveCashoutFaceOutcome), so it reuses the wallet workflow unless overridden.
   if (kind === 'cashout') return Deno.env.get('DIDIT_CASHOUT_WORKFLOW_ID') || wallet;
   return id || combined;
};

/**
 * Where Didit sends the user back to. The wallet and cash-out gates return to their own screens
 * rather than /verify so the KYC flow's state machine is never entered by either scan. Derived
 * from DIDIT_CALLBACK_URL's origin so shipping this needs no new secret.
 */
const resolveCallbackBase = (kind: SessionKind, callbackBase: string | undefined): string | undefined => {
   if (kind !== 'wallet' && kind !== 'cashout') return callbackBase;

   const overrideEnvKey = kind === 'wallet' ? 'DIDIT_WALLET_CALLBACK_URL' : 'DIDIT_CASHOUT_CALLBACK_URL';
   const override = Deno.env.get(overrideEnvKey)?.trim();
   if (override) return override;
   if (!callbackBase) return undefined;

   try {
      return new URL(kind === 'wallet' ? WALLET_CALLBACK_PATH : CASHOUT_CALLBACK_PATH, callbackBase).toString();
   } catch {
      return undefined;
   }
};

/** Best-effort IP → ISO country lookup, same free service check-geo already uses. */
const resolveCountryFromRequest = async (req: Request): Promise<string | null> => {
   try {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '';
      if (!ip) return null;
      const res = await fetch(`https://ipwho.is/${ip}`);
      if (!res.ok) return null;
      const geo = (await res.json().catch(() => null)) as { country_code?: string } | null;
      return typeof geo?.country_code === 'string' ? geo.country_code : null;
   } catch (err) {
      console.error('[create-didit-session] Geo lookup failed:', err instanceof Error ? err.message : err);
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
      // kind: 'cashout' only — the exact transfer this scan's approval will be bound to.
      let cashoutDestination: string | undefined;
      let cashoutAmount: number | undefined;
      let cashoutLoanId: string | undefined;
      try {
         const body = (await req.json()) as {
            returnTo?: unknown;
            kind?: unknown;
            destinationAddress?: unknown;
            amount?: unknown;
            loanId?: unknown;
         };
         if (typeof body?.returnTo === 'string' && ALLOWED_RETURN_TO.has(body.returnTo)) {
            returnTo = body.returnTo;
         }
         if (typeof body?.kind === 'string' && SESSION_KINDS.has(body.kind)) {
            kind = body.kind as SessionKind;
         }
         if (typeof body?.destinationAddress === 'string' && body.destinationAddress.trim()) {
            cashoutDestination = body.destinationAddress.trim();
         }
         if (typeof body?.amount === 'number' && Number.isFinite(body.amount) && body.amount > 0) {
            cashoutAmount = body.amount;
         }
         if (typeof body?.loanId === 'string' && body.loanId.trim()) {
            cashoutLoanId = body.loanId.trim();
         }
      } catch {
         // No body / invalid JSON is fine — kind defaults to 'liveness', returnTo is optional.
      }

      if (kind === 'cashout' && (!cashoutDestination || !cashoutAmount)) {
         return jsonResponse({ error: 'destinationAddress and amount are required for a cash-out face check.' }, 400);
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

      // The first-cash-out face gate. Checked BEFORE spending a Didit credit: most cash-outs
      // (non-PH, external wallet, repeat borrower, or one already covered by a still-valid,
      // same-transfer approval) don't need a scan at all. cashout_face_gate_required is the one
      // place this rule lives (see migration 20260820100000) so it can't drift from the
      // withdraw-flow client's own copy of the same check.
      let cashoutCountryIso: string | null = null;
      if (kind === 'cashout') {
         cashoutCountryIso = await resolveCountryFromRequest(req);
         const { data: gate, error: gateError } = await supabase.rpc('cashout_face_gate_required', {
            p_user_id: user.id,
            p_destination: cashoutDestination,
            p_amount: cashoutAmount,
            p_country_iso: cashoutCountryIso
         });
         if (gateError) {
            console.error('[create-didit-session] Cash-out gate check failed:', gateError.message);
            return jsonResponse({ error: 'Could not check cash-out eligibility.' }, 500);
         }
         const verdict = (gate ?? {}) as { required?: boolean; reason?: string };
         if (!verdict.required) {
            // Not an error — the caller just doesn't need a scan (e.g. already has a valid,
            // same-transfer approval, or isn't in scope for the gate at all).
            return jsonResponse({ required: false, reason: verdict.reason ?? 'NOT_REQUIRED' });
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

      // Pin the WALLET face scan to this session — the linchpin of the whole gate. The webhook
      // and check-didit-status both identify a wallet scan by matching Didit's session_id
      // against users.wallet_face_session_id; without this write that match never happens, the
      // scan's result falls through to the KYC liveness branch (a wallet scan reuses the
      // liveness workflow, so classifyWorkflow reads it as 'liveness') and corrupts the caller's
      // liveness_status, while wallet_face_status never becomes APPROVED and the mint is refused
      // forever. Reset to PENDING so a fresh attempt can't inherit a prior DECLINED/DUPLICATE.
      if (kind === 'wallet' && diditBody.session_id) {
         const { error: walletResetError } = await supabase
            .from('users')
            .update({ wallet_face_status: 'PENDING', wallet_face_session_id: diditBody.session_id })
            .eq('id', user.id);
         if (walletResetError) {
            console.error('[create-didit-session] Failed to reset wallet face gate:', walletResetError.message);
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

      // The cash-out gate has no `users` column to pin to (a scan is per-attempt, bound to one
      // destination + amount, not a standing account attribute) — instead it's its own row.
      // didit-webhook and check-didit-status find it by matching Didit's session_id against
      // cashout_face_checks.didit_session_id, exactly the same pattern the wallet gate uses
      // against users.wallet_face_session_id.
      let cashoutCheckId: string | null = null;
      if (kind === 'cashout' && diditBody.session_id) {
         const { data: inserted, error: insertError } = await supabase
            .from('cashout_face_checks')
            .insert({
               user_id: user.id,
               loan_id: cashoutLoanId ?? null,
               didit_session_id: diditBody.session_id,
               status: 'PENDING',
               destination_address: cashoutDestination,
               amount: cashoutAmount,
               country_iso: cashoutCountryIso
            })
            .select('id')
            .single();
         if (insertError) {
            console.error('[create-didit-session] Failed to record cash-out face check:', insertError.message);
            return jsonResponse({ error: 'Database error' }, 500);
         }
         cashoutCheckId = inserted?.id ?? null;
      }

      return jsonResponse({
         url: diditBody.url,
         sessionId: diditBody.session_id ?? null,
         ...(kind === 'cashout' ? { checkId: cashoutCheckId } : {})
      });
   } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      console.error('[create-didit-session] Unhandled error:', message);
      return jsonResponse({ error: message }, 500);
   }
});
