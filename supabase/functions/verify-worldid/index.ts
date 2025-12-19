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
    const proof = await req.json()
    const authHeader = req.headers.get('Authorization')!

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const app_id = Deno.env.get('WORLD_ID_APP_ID')
    const action = Deno.env.get('WORLD_ID_ACTION_ID')

    // Verify the proof with World ID API
    const verifyRes = await fetch(`https://developer.worldcoin.org/api/v1/verify/${app_id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...proof, action })
    }).then(res => res.json())

    if (verifyRes.success) {
      const nullifierHash = proof.nullifier_hash

      // Check if this nullifier hash is already used
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('nullifier_hash', nullifierHash)
        .neq('id', user.id)
        .single()

      if (existingUser) {
        return new Response(JSON.stringify({ error: 'World ID already used' }), { status: 400, headers: corsHeaders })
      }

      const { error: updateError } = await supabase
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
