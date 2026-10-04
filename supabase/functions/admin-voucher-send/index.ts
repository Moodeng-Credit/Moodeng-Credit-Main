// Admin Vouchers page → "Send code": approve a pending GrabFood voucher claim from the admin panel.
// Same action as ✅ Send code on the Telegram card: takes the next unused code of the claim's value
// from the pool (public.voucher_codes), emails it to the borrower and marks the claim sent.
//
// Body: { claimId: string }   Response: { ok, summary, retry? }
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendVoucherCode } from '../_shared/voucherClaims.ts';

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

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   // Same admin check as admin-loan-notify (mirrors app_private.is_moodeng_admin).
   const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
   if (!token) return json({ error: 'Missing authorization token' }, 401);
   const { data: userData, error: userError } = await supabase.auth.getUser(token);
   const callerId = userData?.user?.id;
   if (userError || !callerId) return json({ error: 'Invalid session' }, 401);

   const { data: adminRow } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', callerId)
      .eq('active', true)
      .in('role', ['owner', 'admin', 'support'])
      .maybeSingle();
   if (!adminRow) return json({ error: 'Forbidden: admin account required' }, 403);

   const body = await req.json().catch(() => ({}));
   const claimId = typeof body.claimId === 'string' ? body.claimId : '';
   if (!/^[0-9a-f-]{36}$/i.test(claimId)) return json({ error: 'Invalid claimId' }, 400);

   const { data: caller } = await supabase.from('users').select('username, email').eq('id', callerId).maybeSingle();
   const admin = caller?.username ? `@${caller.username}` : caller?.email ?? 'admin';

   try {
      return json(await sendVoucherCode(supabase, claimId, `${admin} (admin page)`));
   } catch (err) {
      console.error('admin-voucher-send failed', err instanceof Error ? err.message : err);
      return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
   }
});
