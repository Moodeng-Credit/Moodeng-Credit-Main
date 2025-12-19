import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email } = await req.json()

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const redirectUrl = Deno.env.get('REDIRECT_URL') || 'http://localhost:5173/reset-password'

    const { error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: { redirectTo: redirectUrl }
    })

    // Note: generateLink is one way, but resetPasswordForEmail is easier if we don't need to send the email ourselves.
    // However, the original code used resetPasswordForEmail with admin client.

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    })

    if (resetError) {
      return new Response(JSON.stringify({ error: resetError.message }), { status: 400, headers: corsHeaders })
    }

    return new Response(
      JSON.stringify({ message: 'Password reset email sent. Please check your inbox.' }),
      { status: 200, headers: corsHeaders }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), { status: 500, headers: corsHeaders })
  }
})
