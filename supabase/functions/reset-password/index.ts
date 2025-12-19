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
      const { token, password } = await req.json();

      if (!token || !password) {
         return new Response(JSON.stringify({ error: 'Token and password are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      if (password.length < 6) {
         return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

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

      // Verify the token and get user
      const {
         data: { user },
         error: verifyError
      } = await supabaseAdmin.auth.getUser(token);

      if (verifyError || !user) {
         return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      // Update the password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
         password
      });

      if (updateError) {
         return new Response(JSON.stringify({ error: 'Failed to update password', details: updateError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      return new Response(JSON.stringify({ success: true, message: 'Password reset successful' }), {
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
