import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ensureAuthUser, mintSession } from '../_shared/mintSession.ts'
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const getTelegramBotToken = () => {
  const rawToken = Deno.env.get('TELEGRAM_API_TOKEN') ?? Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
  return rawToken.trim().replace(/^["']|["']$/g, '')
}

const signedTelegramLoginFields = new Set([
  'id',
  'first_name',
  'last_name',
  'username',
  'photo_url',
  'auth_date'
])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const authData = body.authData ?? body
    const { id, first_name, last_name, username, photo_url, auth_date, hash, allows_write_to_pm } = authData

    // Verify Telegram auth
    const botToken = getTelegramBotToken()
    if (!botToken) {
      throw new Error('TELEGRAM_API_TOKEN is not configured.')
    }

    const secretKey = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(botToken)
    )

    const dataCheckString = Object.entries(authData)
      .filter(([key, value]) => signedTelegramLoginFields.has(key) && value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('\n')

    const hmacKey = await crypto.subtle.importKey(
      'raw',
      secretKey,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signature = await crypto.subtle.sign(
      'HMAC',
      hmacKey,
      new TextEncoder().encode(dataCheckString)
    )

    const expectedHash = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    if (expectedHash !== hash) {
      return new Response(
        JSON.stringify({ error: 'Invalid Telegram authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check auth_date is recent (within 24 hours)
    const authDate = new Date(auth_date * 1000)
    const now = new Date()
    const diffHours = (now.getTime() - authDate.getTime()) / (1000 * 60 * 60)

    if (diffHours > 24) {
      return new Response(
        JSON.stringify({ error: 'Telegram authentication expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('telegram_id', id)
      .maybeSingle()

    if (existingProfileError) {
      throw existingProfileError
    }

    // Prefer an existing Moodeng profile so older telegram_...@moodeng.credit
    // accounts are not stranded by the newer moodeng.app synthetic email. users.telegram_id is
    // client-writable, so only trust a profile that really is this Telegram user's login account:
    // otherwise someone could tag their own account with a victim's Telegram id and the victim's
    // first Telegram login would land in it.
    const ownTelegramEmails = [`telegram_${id}@moodeng.app`, `telegram_${id}@moodeng.credit`]
    const trustedProfile =
      existingProfile && ownTelegramEmails.includes(String(existingProfile.email ?? '').toLowerCase()) ? existingProfile : null
    const email = trustedProfile?.email ?? `telegram_${id}@moodeng.app`

    const telegramMetadata = {
      telegram_id: id,
      first_name,
      last_name,
      username,
      photo_url,
      allows_write_to_pm,
      provider: 'telegram',
    }

    const allowsWriteToPm = allows_write_to_pm === true || allows_write_to_pm === 1 || allows_write_to_pm === '1' || allows_write_to_pm === 'true'

    const syncTelegramProfile = async (userId: string) => {
      const updates = {
        telegram_id: id,
        ...(username ? { telegram_username: username } : {}),
        ...(allowsWriteToPm ? { chat_id: id } : {}),
      }

      const { error } = await supabaseAdmin
        .from('users')
        .update(updates)
        .eq('id', userId)

      if (error) throw error
    }

    // No password: the provider's signature was verified above, so mint the session server-side
    // (_shared/mintSession.ts). Passwords derived from the provider id were guessable.
    await ensureAuthUser(supabaseAdmin, email, telegramMetadata)
    const session = await mintSession(supabaseAdmin, email)
    // Always refresh metadata so the photo (and name changes) stay current
    await supabaseAdmin.auth.admin.updateUserById(session.user.id, { user_metadata: telegramMetadata })
    await syncTelegramProfile(session.user.id)

    return new Response(
      JSON.stringify({ session }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected Telegram login error'

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
