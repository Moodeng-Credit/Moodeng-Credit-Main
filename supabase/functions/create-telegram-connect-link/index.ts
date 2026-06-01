import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

const getBotUsername = () => (Deno.env.get('TELEGRAM_BOT_USERNAME') ?? 'moodengnewbranchbot').trim().replace(/^@/, '');

const createToken = () => {
   const bytes = new Uint8Array(16);
   crypto.getRandomValues(bytes);
   return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }

   if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
   }

   const accessToken = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
   if (!accessToken) {
      return jsonResponse({ error: 'Missing authorization token' }, 401);
   }

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { autoRefreshToken: false, persistSession: false }
   });

   const {
      data: { user },
      error: userError
   } = await supabase.auth.getUser(accessToken);

   if (userError || !user) {
      return jsonResponse({ error: 'Invalid authorization token' }, 401);
   }

   const token = createToken();
   const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

   const { error } = await supabase.from('telegram_connect_tokens').insert({
      user_id: user.id,
      token,
      expires_at: expiresAt
   });

   if (error) {
      return jsonResponse({ error: error.message }, 500);
   }

   const botUsername = getBotUsername();
   const startPayload = `connect_${token}`;

   return jsonResponse({
      url: `https://t.me/${botUsername}?start=${encodeURIComponent(startPayload)}`,
      expiresAt
   });
});
