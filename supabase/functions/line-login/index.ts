import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token'
const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify'

const cleanEnv = (key: string) => (Deno.env.get(key) ?? '').trim().replace(/^["']|["']$/g, '')

interface LineIdTokenPayload {
  sub: string
  name?: string
  picture?: string
  email?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { code, redirectUri } = body

    if (!code || !redirectUri) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization code or redirect URI.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const channelId = cleanEnv('LINE_CHANNEL_ID')
    const channelSecret = cleanEnv('LINE_CHANNEL_SECRET')
    if (!channelId || !channelSecret) {
      throw new Error('LINE_CHANNEL_ID / LINE_CHANNEL_SECRET are not configured.')
    }

    // 1. Exchange the authorization code for tokens.
    const tokenRes = await fetch(LINE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: channelId,
        client_secret: channelSecret,
      }),
    })

    const tokenJson = await tokenRes.json()
    if (!tokenRes.ok || !tokenJson.id_token) {
      return new Response(
        JSON.stringify({ error: tokenJson.error_description || 'LINE token exchange failed.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Verify the id_token with LINE (validates signature, audience and expiry
    //    server-side). This replaces Telegram's HMAC check.
    const verifyRes = await fetch(LINE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        id_token: tokenJson.id_token,
        client_id: channelId,
      }),
    })

    const payload: LineIdTokenPayload = await verifyRes.json()
    if (!verifyRes.ok || !payload.sub) {
      return new Response(
        JSON.stringify({ error: 'Invalid LINE id_token.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const lineId = payload.sub
    const lineName = payload.name ?? ''
    const linePicture = payload.picture ?? ''

    // 3. Mint / fetch a Supabase session via the service-role admin API.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('line_id', lineId)
      .maybeSingle()

    if (existingProfileError) {
      throw existingProfileError
    }

    // Prefer the verified LINE email if the user granted the `email` scope,
    // otherwise fall back to a synthetic, deterministic address.
    const email = existingProfile?.email ?? payload.email ?? `line_${lineId}@moodeng.app`
    const password = `line_${lineId}_${channelSecret.slice(0, 8)}`

    const lineMetadata = {
      line_id: lineId,
      name: lineName,
      photo_url: linePicture,
      provider: 'line',
    }

    const syncLineProfile = async (userId: string) => {
      const { error } = await supabaseAdmin
        .from('users')
        .update({ line_id: lineId })
        .eq('id', userId)
      if (error) throw error
    }

    if (existingProfile) {
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(existingProfile.id, {
        password,
        user_metadata: lineMetadata,
        email_confirm: true,
      })
      if (updateAuthError) {
        throw updateAuthError
      }
    }

    // Try to sign in first.
    const { data: signInData } = await supabaseAdmin.auth.signInWithPassword({ email, password })

    if (signInData?.session) {
      await supabaseAdmin.auth.admin.updateUserById(signInData.session.user.id, {
        user_metadata: lineMetadata,
      })
      await syncLineProfile(signInData.session.user.id)

      return new Response(
        JSON.stringify({ session: signInData.session }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // User doesn't exist yet — create them.
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: lineMetadata,
    })
    if (createError) {
      throw createError
    }

    const { data: newSignInData, error: newSignInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    })
    if (newSignInError) {
      throw newSignInError
    }

    if (newSignInData.session?.user.id) {
      await syncLineProfile(newSignInData.session.user.id)
    }

    return new Response(
      JSON.stringify({ session: newSignInData.session }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected LINE login error'

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
