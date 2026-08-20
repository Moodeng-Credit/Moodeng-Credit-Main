import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Mints a one-time Openfort Shield "encryption session" for AUTOMATIC (self-custodial,
// no-password) embedded-wallet recovery. This MUST run server-side: it holds the Shield
// SECRET and the project encryption share, neither of which may ever reach the browser.
//
// The client (src/lib/web3/openfort/shieldSession.ts) calls this with the borrower's Supabase
// JWT; we verify it, ask Shield for a session, and return only the opaque session id. The id is
// then passed to `embeddedWallet.configure({ recoveryParams: { AUTOMATIC, encryptionSession } })`.
// Moodeng never sees the wallet key — the borrower can still export it and leave for MetaMask.

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
   });

// Openfort Shield REST endpoint that registers an encryption session from the project's share.
const SHIELD_ENCRYPTION_SESSION_URL = 'https://shield.openfort.io/project/encryption-session';
const SHIELD_TIMEOUT_MS = 8000;

// Copy for each refusal from may_mint_embedded_wallet. The client routes on the CODE, not the
// text, but a user who hits this outside the normal flow still deserves a real sentence.
const GATE_MESSAGES: Record<string, string> = {
   FACE_REQUIRED: 'A quick face scan is needed before we can create your instant wallet.',
   FACE_PENDING: 'Your face scan is still being checked. This usually takes a few seconds.',
   FACE_DUPLICATE: 'This face is already linked to another Moodeng account. Each person can have one instant wallet.',
   FACE_MISMATCH: "This doesn't match the face used to verify this account. Please scan again as the account holder.",
   FACE_DECLINED: "We couldn't complete your face scan. Please try again in good lighting.",
   // The first-cash-out hold (20260820110000). Distinct code so the client routes to the
   // withdraw face check rather than the wallet-creation one.
   CASHOUT_FACE_REQUIRED: 'A quick face check is needed before you can move your loan out of your wallet.'
};

/**
 * Best-effort IP -> ISO country for the caller, same free service check-geo uses. Only feeds
 * cashout_gate_holds_wallet, which treats an unknown country as NOT held — so a failure here
 * degrades to "don't hold", never to "brick the wallet".
 */
const resolveCountryFromRequest = async (req: Request): Promise<string | null> => {
   try {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '';
      if (!ip) return null;
      const res = await fetch(`https://ipwho.is/${ip}`);
      if (!res.ok) return null;
      const geo = (await res.json().catch(() => null)) as { country_code?: string } | null;
      return typeof geo?.country_code === 'string' ? geo.country_code : null;
   } catch (err) {
      console.error('[openfort-shield-session] Geo lookup failed:', err instanceof Error ? err.message : err);
      return null;
   }
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

   try {
      // Authenticate the caller by their Supabase session so an anonymous request can't
      // spend the project's Shield quota (defense-in-depth on top of verify_jwt=true).
      const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
      const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
      if (!token) return jsonResponse({ error: 'Missing authorization token' }, 401);

      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user?.id) return jsonResponse({ error: 'Authentication required' }, 401);

      // ── The abuse gate ────────────────────────────────────────────────────────────────
      //
      // Wallet provisioning runs client-side (openfort.embeddedWallet.configure), so the
      // browser is not somewhere we can enforce anything. The one thing the client cannot do
      // without us is mint this Shield session — so this is the only chokepoint that actually
      // costs an attacker something, and every rule about who may hold a sponsored wallet
      // belongs here rather than in the UI.
      //
      // This was previously `user_role === 'borrower'`, on the reasoning that lenders bring
      // their own wallets. Lenders can now create an instant wallet too, and role was never
      // the real concern anyway. The real concern is cost: every embedded wallet is a smart
      // account whose gas our paymaster policy pays, so thirty accounts meant thirty
      // sponsored wallets. The gate is now per-PERSON, via a liveness + 1:N face scan
      // (20260811000000_embedded_wallet_face_gate.sql).
      //
      // may_mint_embedded_wallet covers both cases in one place:
      //   * already granted → allow unconditionally. This is RECOVERY, not creation: the SDK
      //     re-mints a Shield session on every page reload and before every send, so refusing
      //     here would brick every existing wallet and lock people out of their own money.
      //   * not yet granted → require an APPROVED, unspent face scan.
      //
      // Master switch: when WALLET_FACE_GATE_ENABLED is not 'true' the whole face gate is OFF
      // and we restore the pre-project rule — borrower-only, no scan — but STILL allow anyone
      // who already holds a grant (the 5 grandfathered wallets), so nobody loses access.
      // Both this and the frontend flag must be on for the gate to run.
      const gateEnabled = Deno.env.get('WALLET_FACE_GATE_ENABLED') === 'true';

      if (!gateEnabled) {
         const { data: grant } = await supabase
            .from('embedded_wallet_grants')
            .select('user_id')
            .eq('user_id', userData.user.id)
            .maybeSingle();
         if (!grant) {
            const { data: profile } = await supabase.from('users').select('user_role').eq('id', userData.user.id).maybeSingle();
            if (profile?.user_role !== 'borrower') {
               return jsonResponse({ error: 'Instant wallet is available to borrowers only.', code: 'BORROWER_ONLY' }, 403);
            }
         }
      } else {
         const { data: gate, error: gateError } = await supabase.rpc('may_mint_embedded_wallet', {
            p_user_id: userData.user.id
         });

         if (gateError) {
            console.error('[openfort-shield-session] Gate check failed', gateError.message);
            return jsonResponse({ error: 'Could not check your wallet eligibility. Please try again.' }, 500);
         }

         const verdict = (gate ?? {}) as { allowed?: boolean; reason?: string; already_granted?: boolean };
         if (!verdict.allowed) {
            const reason = verdict.reason ?? 'FACE_REQUIRED';
            // The client routes on this code: FACE_REQUIRED starts the scan, DUPLICATE/MISMATCH
            // are terminal and must explain themselves instead of looping the user through a retry.
            return jsonResponse({ error: GATE_MESSAGES[reason] ?? GATE_MESSAGES.FACE_REQUIRED, code: reason }, 403);
         }

         // Spend the approval BEFORE minting, so two racing taps can't turn one scan into two
         // wallets — the second claim finds no APPROVED row and returns false. If the mint then
         // fails downstream the grant row still exists, so the retry takes the already-granted
         // path rather than demanding a second scan.
         if (!verdict.already_granted) {
            const { error: claimError } = await supabase.rpc('claim_embedded_wallet_grant', {
               p_user_id: userData.user.id
            });
            if (claimError) {
               console.error('[openfort-shield-session] Grant claim failed', claimError.message);
               return jsonResponse({ error: 'Could not reserve your instant wallet. Please try again.' }, 500);
            }
         }
      }

      // ── The first-cash-out hold ───────────────────────────────────────────────────────
      //
      // Separate from, and checked AFTER, the mint gate above: that one asks "may this person
      // have a sponsored wallet at all", this one asks "may they use it right now". It applies
      // to an ALREADY-GRANTED wallet, which the mint gate deliberately waves through as
      // recovery — and recovery is exactly the path a stolen phone takes.
      //
      // Because every route to a usable signer goes through this mint (page reload, pre-send,
      // and the private-key export in ExportInstantWalletKey.tsx), holding here is what makes
      // the withdraw-flow face check a real boundary instead of a UI step. Scope is narrow —
      // funded PH borrower, first cash-out, no face check passed in 24h, not admin-exempt —
      // see cashout_gate_holds_wallet (20260820110000).
      //
      // Deliberately fails OPEN on an RPC error: this function is on the critical path for
      // every embedded wallet, and a broken hold check must not lock people out of their own
      // money. The withdraw-step gate (create-didit-session) still fails CLOSED, so the
      // money-moving action stays protected even if this degrades.
      if (Deno.env.get('CASHOUT_FACE_GATE_ENABLED') === 'true') {
         const countryIso = await resolveCountryFromRequest(req);
         const { data: hold, error: holdError } = await supabase.rpc('cashout_gate_holds_wallet', {
            p_user_id: userData.user.id,
            p_country_iso: countryIso
         });

         if (holdError) {
            console.error('[openfort-shield-session] Cash-out hold check failed (allowing):', holdError.message);
         } else if ((hold as { held?: boolean } | null)?.held) {
            console.log(`[openfort-shield-session] Cash-out face check required for ${userData.user.id} — wallet held`);
            return jsonResponse({ error: GATE_MESSAGES.CASHOUT_FACE_REQUIRED, code: 'CASHOUT_FACE_REQUIRED' }, 403);
         }
      }

      const shieldApiKey = Deno.env.get('OPENFORT_SHIELD_PUBLISHABLE_KEY') ?? '';
      const shieldSecret = Deno.env.get('OPENFORT_SHIELD_SECRET_KEY') ?? '';
      const encryptionShare = Deno.env.get('OPENFORT_SHIELD_ENCRYPTION_SHARE') ?? '';
      if (!shieldApiKey || !shieldSecret || !encryptionShare) {
         console.error('[openfort-shield-session] Missing Shield env vars');
         return jsonResponse({ error: 'Wallet service is not configured.' }, 500);
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SHIELD_TIMEOUT_MS);
      let shieldRes: Response;
      try {
         shieldRes = await fetch(SHIELD_ENCRYPTION_SESSION_URL, {
            method: 'POST',
            signal: controller.signal,
            headers: {
               'Content-Type': 'application/json',
               Accept: 'application/json',
               'x-api-key': shieldApiKey,
               'x-api-secret': shieldSecret
            },
            body: JSON.stringify({ encryption_part: encryptionShare })
         });
      } catch (err) {
         console.error('[openfort-shield-session] Shield request failed', err);
         return jsonResponse({ error: 'Could not reach the wallet recovery service.' }, 502);
      } finally {
         clearTimeout(timer);
      }

      if (!shieldRes.ok) {
         const detail = await shieldRes.text().catch(() => '');
         console.error('[openfort-shield-session] Shield error', shieldRes.status, detail);
         return jsonResponse({ error: 'Wallet recovery service rejected the request.' }, 502);
      }

      const data = (await shieldRes.json()) as { session_id?: string; sessionId?: string };
      const sessionId = data.session_id ?? data.sessionId;
      if (!sessionId) {
         console.error('[openfort-shield-session] No session id in Shield response');
         return jsonResponse({ error: 'Wallet recovery service returned no session.' }, 502);
      }

      return jsonResponse({ session_id: sessionId });
   } catch (err) {
      console.error('[openfort-shield-session] Unexpected error', err);
      return jsonResponse({ error: 'Unexpected error.' }, 500);
   }
});
