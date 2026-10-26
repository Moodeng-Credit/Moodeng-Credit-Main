import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// TikTok Login Kit (web) -> Supabase session. Mirrors line-login:
//   1. exchange the authorization code for an access token (TikTok identifies the user: open_id),
//   2. read the public profile (display name, avatar) with that token,
//   3. mint / fetch the matching Supabase user and return a session.
//
// TikTok does not give us an email, so the account email is a deterministic synthetic address built from a
// hash of the open_id. The password is derived server-side with HMAC from TIKTOK_CLIENT_SECRET — it is
// never shown to or chosen by the user, and rotating the secret just triggers the reset path below.
//
// Secrets (set on the project): TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/'
const TIKTOK_USERINFO_URL = 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url'

const cleanEnv = (key: string) => (Deno.env.get(key) ?? '').trim().replace(/^["']|["']$/g, '')

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')

const sha256Hex = async (text: string) => toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))

const hmacHex = async (secret: string, message: string) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { code, redirectUri } = await req.json()
    if (!code || !redirectUri) return json({ error: 'Missing authorization code or redirect URI.' }, 400)

    const clientKey = cleanEnv('TIKTOK_CLIENT_KEY')
    const clientSecret = cleanEnv('TIKTOK_CLIENT_SECRET')
    if (!clientKey || !clientSecret) throw new Error('TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET are not configured.')

    // 1. Authorization code -> access token. TikTok returns the open_id with it.
    const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })
    const tokenJson = await tokenRes.json()
    const accessToken: string | undefined = tokenJson.access_token
    const openId: string | undefined = tokenJson.open_id
    if (!tokenRes.ok || !accessToken || !openId) {
      return json({ error: tokenJson.error_description || 'TikTok token exchange failed.' }, 401)
    }

    // 2. Public profile (best effort: a missing name/avatar must not block login).
    let displayName = ''
    let avatarUrl = ''
    try {
      const infoRes = await fetch(TIKTOK_USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
      const info = await infoRes.json()
      displayName = info?.data?.user?.display_name ?? ''
      avatarUrl = info?.data?.user?.avatar_url ?? ''
    } catch {
      // keep going with the open_id alone
    }

    // 3. Supabase user for this TikTok account.
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const email = `tiktok_${(await sha256Hex(`tiktok:${openId}`)).slice(0, 32)}@moodeng.app`
    const password = await hmacHex(clientSecret, `moodeng-tiktok-login:${openId}`)

    // user_metadata is user-editable; app_metadata is server-only, so the TikTok identity lives there.
    const userMetadata = { name: displayName, photo_url: avatarUrl, provider: 'tiktok' }
    const appMetadata = { tiktok_open_id: openId }

    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (existingProfileError) throw existingProfileError

    // Sign in first; only reset the password when that fails (first login after a secret rotation).
    // Setting a password via the admin API revokes every session the user has, so never do it per login.
    const signIn = () => supabaseAdmin.auth.signInWithPassword({ email, password })
    let { data: signInData } = await signIn()

    if (!signInData?.session && existingProfile) {
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(existingProfile.id, {
        password,
        user_metadata: userMetadata,
        app_metadata: appMetadata,
        email_confirm: true,
      })
      if (updateAuthError) throw updateAuthError
      ;({ data: signInData } = await signIn())
    }

    if (signInData?.session) {
      await supabaseAdmin.auth.admin.updateUserById(signInData.session.user.id, {
        user_metadata: userMetadata,
        app_metadata: appMetadata,
      })
      return json({ session: signInData.session })
    }

    // First time we see this TikTok account — create the user.
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
      app_metadata: appMetadata,
    })
    if (createError) throw createError

    const { data: newSignInData, error: newSignInError } = await supabaseAdmin.auth.signInWithPassword({ email, password })
    if (newSignInError) throw newSignInError

    return json({ session: newSignInData.session })
  } catch (error) {
    // Log the detail server-side; the client only gets a generic message so provider/DB internals do not leak.
    console.error('[tiktok-login]', error instanceof Error ? error.message : error)
    return json({ error: 'TikTok login failed. Please try again.' }, 500)
  }
})
