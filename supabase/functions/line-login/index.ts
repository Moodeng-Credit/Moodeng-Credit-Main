import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ensureAuthUser, mintSession } from '../_shared/mintSession.ts'

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
    // users.line_id is client-writable, so only trust a profile that really is this LINE user's
    // login account (their verified LINE email or the synthetic one); otherwise someone could tag their
    // own account with a victim's LINE id and the victim's first LINE login would land in it.
    const ownLineEmails = [`line_${lineId}@moodeng.app`, ...(payload.email ? [String(payload.email).toLowerCase()] : [])]
    const trustedProfile =
      existingProfile && ownLineEmails.includes(String(existingProfile.email ?? '').toLowerCase()) ? existingProfile : null
    const email = trustedProfile?.email ?? payload.email ?? `line_${lineId}@moodeng.app`
    // The LINE id is already on an account that signs in some other way (email, Google): don't
    // create a second, empty account for it. Tell them how to get in.
    if (existingProfile && !trustedProfile) {
      return new Response(
        JSON.stringify({
          error: 'This LINE account is linked to a Moodeng account that signs in with email. Log in with your email instead.',
          code: 'LINKED_TO_EMAIL_ACCOUNT',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    // No password: the provider's signature was verified above, so mint the session server-side
    // (_shared/mintSession.ts). Passwords derived from the provider id were guessable.
    await ensureAuthUser(supabaseAdmin, email, lineMetadata)
    const session = await mintSession(supabaseAdmin, email)
    // Always refresh metadata so the photo (and name changes) stay current
    await supabaseAdmin.auth.admin.updateUserById(session.user.id, { user_metadata: lineMetadata })
    await syncLineProfile(session.user.id)

    return new Response(
      JSON.stringify({ session }),
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
