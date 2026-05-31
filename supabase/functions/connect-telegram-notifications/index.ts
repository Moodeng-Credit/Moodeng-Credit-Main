import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const isWriteAllowed = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true';
const TELEGRAM_ACCOUNT_CONFLICT_MESSAGE =
   'This Telegram account is already connected to another active Moodeng account. Sign in with that Telegram account, or contact support if you need help moving alerts.';

const verifyTelegramAuth = async (authData: Record<string, unknown>) => {
   const botToken = Deno.env.get('TELEGRAM_API_TOKEN');
   if (!botToken) {
      throw new Error('TELEGRAM_API_TOKEN is not configured.');
   }

   const hash = authData.hash;
   if (typeof hash !== 'string') {
      return false;
   }

   const secretKey = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(botToken));
   const dataCheckString = Object.entries(authData)
      .filter(([key, value]) => key !== 'hash' && value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('\n');

   const hmacKey = await crypto.subtle.importKey('raw', secretKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
   const signature = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(dataCheckString));
   const expectedHash = Array.from(new Uint8Array(signature))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

   return expectedHash === hash;
};

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }

   if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
   }

   try {
      const authorization = req.headers.get('authorization') ?? '';
      const accessToken = authorization.replace(/^Bearer\s+/i, '').trim();

      if (!accessToken) {
         return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      const body = await req.json().catch(() => ({}));
      const authData = (body.authData ?? body) as Record<string, unknown>;
      const telegramId = Number(authData.id);
      const telegramUsername = typeof authData.username === 'string' ? authData.username : null;
      const authDate = Number(authData.auth_date);

      if (!Number.isSafeInteger(telegramId) || !Number.isFinite(authDate)) {
         return new Response(JSON.stringify({ error: 'Invalid Telegram payload' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      const diffHours = (Date.now() - authDate * 1000) / (1000 * 60 * 60);
      if (diffHours > 24) {
         return new Response(JSON.stringify({ error: 'Telegram authentication expired' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      if (!(await verifyTelegramAuth(authData))) {
         return new Response(JSON.stringify({ error: 'Invalid Telegram authentication' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      if (!isWriteAllowed(authData.allows_write_to_pm)) {
         return new Response(JSON.stringify({ error: 'Telegram alerts permission was not granted' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
         auth: { autoRefreshToken: false, persistSession: false }
      });
      const {
         data: { user },
         error: userError
      } = await supabase.auth.getUser(accessToken);

      if (userError || !user) {
         return new Response(JSON.stringify({ error: 'Invalid authorization token' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      const { data: existingTelegramUser, error: existingTelegramUserError } = await supabase
         .from('users')
         .select('id, username, account_status')
         .or(`telegram_id.eq.${telegramId},chat_id.eq.${telegramId}`)
         .neq('id', user.id)
         .eq('account_status', 'active')
         .limit(1)
         .maybeSingle();

      if (existingTelegramUserError) {
         throw existingTelegramUserError;
      }

      if (existingTelegramUser) {
         return new Response(
            JSON.stringify({
               error: TELEGRAM_ACCOUNT_CONFLICT_MESSAGE,
               code: 'telegram_account_already_connected'
            }),
            {
               status: 409,
               headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
         );
      }

      const updates = {
         telegram_id: telegramId,
         chat_id: telegramId,
         ...(telegramUsername ? { telegram_username: telegramUsername } : {})
      };

      const { error: updateError } = await supabase.from('users').update(updates).eq('id', user.id);

      if (updateError) {
         throw updateError;
      }

      return new Response(JSON.stringify({ connected: true, telegramUsername }), {
         status: 200,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
   } catch (error) {
      return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
         status: 500,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
   }
});
