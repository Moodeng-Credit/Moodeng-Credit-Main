import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }

   // Only allow in development mode
   const devMode = Deno.env.get('DEV_MODE');
   if (devMode !== 'true') {
      return new Response(JSON.stringify({ error: 'This endpoint is only available in development mode' }), {
         status: 403,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
   }

   try {
      // Get the authenticated user from the authorization header
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
         return new Response(JSON.stringify({ error: 'Authorization required' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      const supabaseClient = createClient(
         Deno.env.get('SUPABASE_URL') ?? '',
         Deno.env.get('SUPABASE_ANON_KEY') ?? '',
         {
            global: {
               headers: { Authorization: authHeader }
            }
         }
      );

      const {
         data: { user }
      } = await supabaseClient.auth.getUser();

      if (!user) {
         return new Response(JSON.stringify({ error: 'User not found' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      // Update user's World ID status using admin client
      const supabaseAdmin = createClient(
         Deno.env.get('SUPABASE_URL') ?? '',
         Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
         {
            auth: {
               autoRefreshToken: false,
               persistSession: false
            }
         }
      );

      const { error: updateError } = await supabaseAdmin
         .from('users')
         .update({
            is_world_id: 'inactive',
            nullifier_hash: null
         })
         .eq('id', user.id);

      if (updateError) {
         return new Response(JSON.stringify({ error: 'Failed to unverify user', details: updateError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      return new Response(JSON.stringify({ success: true, message: 'User unverified successfully' }), {
         status: 200,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
   } catch (error) {
      return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
         status: 500,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
   }
});
