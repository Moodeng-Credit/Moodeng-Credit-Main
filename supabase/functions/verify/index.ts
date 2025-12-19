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

   try {
      const proof = await req.json();

      if (!proof.merkle_root || !proof.nullifier_hash || !proof.proof) {
         return new Response(JSON.stringify({ error: 'Invalid proof data' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      // Verify with World ID API
      const worldIdAppId = Deno.env.get('WORLD_ID_APP_ID');
      const worldIdActionId = Deno.env.get('WORLD_ID_ACTION_ID');

      const verifyRes = await fetch(`https://developer.worldcoin.org/api/v1/verify/${worldIdAppId}`, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json'
         },
         body: JSON.stringify({
            ...proof,
            action: worldIdActionId
         })
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
         return new Response(JSON.stringify({ error: 'World ID verification failed', details: verifyData }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

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
            is_world_id: 'active',
            nullifier_hash: proof.nullifier_hash
         })
         .eq('id', user.id);

      if (updateError) {
         return new Response(JSON.stringify({ error: 'Failed to update user', details: updateError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      return new Response(JSON.stringify({ success: true, message: 'World ID verification successful' }), {
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
