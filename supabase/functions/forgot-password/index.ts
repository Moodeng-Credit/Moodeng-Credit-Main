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
      const { email } = await req.json();

      if (!email) {
         return new Response(JSON.stringify({ error: 'Email is required' }), {
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

      const redirectUrl = Deno.env.get('REDIRECT_URL') || 'http://localhost:3000/reset-password';

      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
         redirectTo: redirectUrl
      });

      if (error) {
         return new Response(JSON.stringify({ error: 'Failed to send reset email', details: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      return new Response(JSON.stringify({ success: true, message: 'Password reset email sent' }), {
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
