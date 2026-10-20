import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { isInternalRequest } from '../_shared/internalAuth.ts';
import { stableyard } from '../_shared/stableyard.ts';

// Stableyard credential check — step 1 of their integration flow (GET /v2/partners/config; the
// "/v2/partners/me" in their onboarding email doesn't exist). An active admin calls this to confirm
// STABLEYARD_APP_ID / STABLEYARD_APP_SECRET work against production, and to see which modules and
// deposit networks are live for our app. Never returns the credentials.

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-notification-secret',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   // ---- Auth: caller must be an active admin (or our own server / pg_net with the internal secret) --
   if (!(await isInternalRequest(admin, req))) {
      const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
      if (!token) return json({ error: 'Missing authorization token' }, 401);

      const { data: userData, error: userError } = await admin.auth.getUser(token);
      const callerId = userData?.user?.id;
      if (userError || !callerId) return json({ error: 'Invalid session' }, 401);

      const { data: adminRow } = await admin
         .from('admin_users')
         .select('user_id')
         .eq('user_id', callerId)
         .eq('active', true)
         .in('role', ['owner', 'admin'])
         .maybeSingle();
      if (!adminRow) return json({ error: 'Forbidden: admin account required' }, 403);
   }

   // ---- GET /v2/partners/config -------------------------------------------------------------
   const result = await stableyard.partnerConfig();
   if (!result.ok) {
      return json({ ok: false, stableyardStatus: result.status, error: result.error, code: result.code ?? null }, 502);
   }

   type Module = { id: string; available: boolean; disabledReason: string | null };
   type Network = { code: string; chainId: number; depositAddresses?: { operational?: boolean; disabledReason?: string | null } };
   const config = result.data as {
      appId?: string;
      apiVersion?: string;
      credentialType?: string;
      status?: string;
      modules?: Module[];
      networks?: Network[];
      fees?: { totalFeePercent?: number };
      compliance?: { partnerKyb?: { status?: string } };
      capabilities?: { webhooks?: { signatures?: unknown } };
   };
   return json({
      ok: true,
      stableyardStatus: result.status,
      partner: {
         appId: config.appId,
         apiVersion: config.apiVersion,
         credentialType: config.credentialType,
         status: config.status,
         partnerKyb: config.compliance?.partnerKyb?.status ?? null,
         totalFeePercent: config.fees?.totalFeePercent ?? null,
         modules: (config.modules ?? []).map((m) => ({ id: m.id, available: m.available, disabledReason: m.disabledReason })),
         depositNetworks: (config.networks ?? [])
            .filter((n) => n.depositAddresses)
            .map((n) => ({
               code: n.code,
               chainId: n.chainId,
               live: Boolean(n.depositAddresses?.operational),
               disabledReason: n.depositAddresses?.disabledReason ?? null
            })),
         webhookSignatures: config.capabilities?.webhooks?.signatures ?? null
      }
   });
});
