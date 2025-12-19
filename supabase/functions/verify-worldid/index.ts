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
    const body = await req.json()
    const { userId, ...proof } = body
    const authHeader = req.headers.get('Authorization')

    let user: any = null;

    if (authHeader) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      )

      // Get user from token
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()
      if (userError || !authUser) {
        return new Response(JSON.stringify({ error: 'Invalid Authorization token' }), { status: 401, headers: corsHeaders })
      }
      user = authUser
    } else if (userId) {
      // If no auth header, we use the userId from body (less secure, but allowed if requested)
      user = { id: userId }
    } else {
      return new Response(JSON.stringify({ error: 'Missing Authorization header or userId in body' }), { status: 401, headers: corsHeaders })
    }

    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const app_id = Deno.env.get('WORLD_ID_APP_ID') || Deno.env.get('VITE_WORLD_ID_APP_ID')
    const action = Deno.env.get('WORLD_ID_ACTION_ID') || Deno.env.get('VITE_WORLD_ID_ACTION_ID')

    if (!app_id) {
        return new Response(JSON.stringify({ error: 'WORLD_ID_APP_ID not configured' }), { status: 500, headers: corsHeaders })
    }

    // Ensure app_id has the 'app_' prefix if it's missing
    const formattedAppId = app_id.startsWith('app_') ? app_id : `app_${app_id}`

    console.log(`Verifying World ID for app: ${formattedAppId}, action: ${action}`)

    // Verify the proof with World ID API (using v2 for IDKit v2)
    const verifyResponse = await fetch(`https://developer.worldcoin.org/api/v2/verify/${formattedAppId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...proof, action })
    })

    const responseText = await verifyResponse.text()
    console.log(`World ID API response status: ${verifyResponse.status}`)

    let verifyRes;
    try {
        verifyRes = JSON.parse(responseText)
    } catch (e) {
        return new Response(JSON.stringify({
            error: 'World ID API returned invalid JSON (likely a 404 or 500 HTML page)',
            status: verifyResponse.status,
            details: responseText.substring(0, 200)
        }), { status: 500, headers: corsHeaders })
    }

    if (verifyRes.success) {
      const nullifierHash = proof.nullifier_hash

      // Check if this nullifier hash is already used
      const { data: existingUser } = await adminSupabase
        .from('users')
        .select('id')
        .eq('nullifier_hash', nullifierHash)
        .neq('id', user.id)
        .single()

      if (existingUser) {
        return new Response(JSON.stringify({ error: 'World ID already used' }), { status: 400, headers: corsHeaders })
      }

      const { error: updateError } = await adminSupabase
        .from('users')
        .update({
          is_world_id: 'ACTIVE',
          nullifier_hash: nullifierHash
        })
        .eq('id', user.id)

      if (updateError) {
        return new Response(JSON.stringify({ error: 'Failed to update user' }), { status: 500, headers: corsHeaders })
      }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
    } else {
      return new Response(JSON.stringify({ error: 'World ID verification failed', details: verifyRes }), { status: 400, headers: corsHeaders })
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), { status: 500, headers: corsHeaders })
  }
})
