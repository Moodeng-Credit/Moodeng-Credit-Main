import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// We never store a raw IP. This is a one-way salted hash used only to spot a
// borrower and a lender on the same loan signing in from the same place.
const hashIp = async (ip: string, salt: string) => {
   const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`));
   return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
};

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }
   if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
   }

   const salt = Deno.env.get('IP_HASH_SALT');
   // Fail safe: if no salt is configured, do nothing rather than store a weak hash.
   if (!salt) {
      return new Response(JSON.stringify({ ok: false, skipped: 'no-salt' }), { status: 200, headers: corsHeaders });
   }

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   // Identify the caller from their JWT — never trust a client-supplied user id.
   const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
   const { data: userData } = await supabase.auth.getUser(token);
   const userId = userData?.user?.id;
   if (!userId) {
      return new Response(JSON.stringify({ ok: false, skipped: 'unauthenticated' }), { status: 200, headers: corsHeaders });
   }

   // Supabase/edge proxies put the real client IP first in x-forwarded-for.
   const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
   if (!ip) {
      return new Response(JSON.stringify({ ok: false, skipped: 'no-ip' }), { status: 200, headers: corsHeaders });
   }

   const ipHash = await hashIp(ip, salt);
   const today = new Date().toISOString().slice(0, 10);

   const { error } = await supabase.from('auth_ip_log').upsert(
      { user_id: userId, ip_hash: ipHash, seen_on: today, last_seen_at: new Date().toISOString() },
      { onConflict: 'user_id,ip_hash,seen_on' }
   );

   if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 200, headers: corsHeaders });
   }

   return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
});
