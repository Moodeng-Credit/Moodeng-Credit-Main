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
      const { userId, username, email, isWorldId } = await req.json();

      if (!userId || !username || !email) {
         return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      // Create admin client with service role key
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

      // Check if user already exists
      const { data: existingUser } = await supabaseAdmin.from('users').select('id').eq('id', userId).maybeSingle();

      if (existingUser) {
         return new Response(JSON.stringify({ error: 'User already exists', data: existingUser }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      // Create user profile
      const { data, error } = await supabaseAdmin
         .from('users')
         .insert({
            id: userId,
            username,
            email,
            is_world_id: isWorldId || 'inactive'
         })
         .select('*')
         .single();

      if (error) {
         return new Response(JSON.stringify({ error: 'Failed to create user profile', details: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      return new Response(JSON.stringify({ success: true, data }), {
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
