import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { password, token } = await req.json()

    if (!password) {
      return new Response(
        JSON.stringify({ error: 'Password is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let userId: string;
    let userEmail: string;

    // If a token is provided, we verify it to get a user
    if (token) {
        // Use token_hash for recovery links (UUID-like tokens)
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'recovery'
        })

        if (verifyError || !data.user) {
            return new Response(
                JSON.stringify({ error: verifyError?.message || 'Invalid token' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            )
        }
        userId = data.user.id;
        userEmail = data.user.email!;
    } else {
        // If no token, we expect an Authorization header
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'No session or token provided' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            )
        }

        // Get user from auth header
        const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))

        if (userError || !user) {
            return new Response(
                JSON.stringify({ error: 'Invalid session' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            )
        }
        userId = user.id;
        userEmail = user.email!;
    }

    // 1. Update the password
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        { password: password, email_confirm: true }
    )

    if (updateError) {
        return new Response(
            JSON.stringify({ error: updateError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }

    // 2. Ensure the 'email' provider is in app_metadata
    const currentProviders = updatedUser.user.app_metadata?.providers || [];
    if (!currentProviders.includes('email')) {
        await supabase.auth.admin.updateUserById(userId, {
            app_metadata: {
                ...updatedUser.user.app_metadata,
                providers: [...currentProviders, 'email']
            }
        });
    }

    // 3. Manually ensure the identity exists in auth.identities
    // This is necessary for the user to be able to sign in with email/password
    try {
        // We use the RPC we created to ensure the email identity exists
        // This is more reliable than direct insertion from the Edge Function
        const { error: rpcError } = await supabase.rpc('ensure_email_identity', {
            user_id_input: userId,
            email_input: userEmail
        });

        if (rpcError) {
            console.error('Error calling ensure_email_identity RPC:', rpcError);
            return new Response(
                JSON.stringify({
                    error: 'Password was updated, but we could not finalize email sign-in setup. Please try again.'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
        }
    } catch (e) {
        console.error('Error ensuring identity via RPC:', e);
        return new Response(
            JSON.stringify({
                error: 'Password was updated, but we could not finalize email sign-in setup. Please try again.'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }

    return new Response(
      JSON.stringify({ message: 'Password updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
