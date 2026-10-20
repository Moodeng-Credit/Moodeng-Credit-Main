import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { stableyard } from '../_shared/stableyard.ts';

// Stableyard credential check — step 1 of their integration flow (GET /v2/partners/me).
// An active admin calls this to confirm STABLEYARD_APP_ID / STABLEYARD_APP_SECRET work against
// production. Returns Stableyard's partner profile on success; never returns the credentials.

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   // ---- Auth: caller must be an active admin ------------------------------------------------
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

   // ---- GET /v2/partners/me -----------------------------------------------------------------
   const result = await stableyard.partnersMe();
   if (!result.ok) {
      return json({ ok: false, stableyardStatus: result.status, error: result.error, details: result.data ?? null }, 502);
   }
   return json({ ok: true, stableyardStatus: result.status, partner: result.data });
});
