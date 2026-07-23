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
