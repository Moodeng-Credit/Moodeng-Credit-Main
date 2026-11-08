import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ensureAuthUser, mintSession } from '../_shared/mintSession.ts'
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts'

// Two ways in, one account logic (signInTelegramUser):
//   • Telegram's website login widget/redirect: body = the signed authData (hash checked below).
//   • The Telegram APP (works inside Facebook's / TikTok's browser): body.action = 'app_start' →
//     a one-time code for t.me/<bot>?start=login_<code> + a 2-digit number shown on the page; the bot
//     (telegram-webhook) asks the person who pressed Start to tap that number, and only then claims the
//     code; body.action = 'app_poll' exchanges the claimed code for a session.
//     Migration 20261107180000_telegram_app_login.sql.
//   • Bot buttons are Telegram login_url buttons: Telegram signs them for whoever taps, so they arrive
//     here as the website login (hash check below) — a forwarded message can't sign anyone else in.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

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

const APP_LOGIN_TTL_MS = 10 * 60 * 1000
/** A claimed code must be collected soon after the number was tapped. */
const APP_CLAIM_MAX_AGE_MS = 5 * 60 * 1000
const APP_START_PER_IP_PER_10_MIN = 20

const sha256Hex = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** URL- and Telegram-start-safe random string ([A-Za-z0-9_-]). */
const randomToken = (bytes: number) => {
  const raw = new Uint8Array(bytes)
  crypto.getRandomValues(raw)
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** The client IP as the platform saw it (the first x-forwarded-for hop can be set by the client). */
const clientIp = (req: Request) => {
  const cf = req.headers.get('cf-connecting-ip')
  if (cf) return cf.trim()
  const hops = (req.headers.get('x-forwarded-for') ?? '').split(',').map((h) => h.trim()).filter(Boolean)
  return hops[hops.length - 1] ?? 'unknown'
}

/** "Android · Facebook" — shown in the Telegram prompt so a person can tell if it's their phone. */
const deviceLabel = (ua: string) => {
  const os = /android/i.test(ua) ? 'Android' : /iphone|ipad|ipod/i.test(ua) ? 'iPhone' : /windows/i.test(ua) ? 'Windows' : /mac os/i.test(ua) ? 'Mac' : 'Browser'
  const app = /FBAN|FBAV|FB_IAB|FB4A/.test(ua)
    ? 'Facebook'
    : /musical_ly|TikTok|BytedanceWebview/i.test(ua)
      ? 'TikTok'
      : /Instagram/i.test(ua)
        ? 'Instagram'
        : /Telegram/i.test(ua)
          ? 'Telegram'
          : /CriOS|Chrome/i.test(ua)
            ? 'Chrome'
            : /Safari/i.test(ua)
              ? 'Safari'
              : ''
  return app ? `${os} · ${app}` : os
}

/** 10–99, uniformly. */
const randomMatchNumber = () => {
  const buf = new Uint8Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < 180) return 10 + (buf[0] % 90)
  }
}

let cachedBotUsername: string | null = null
const getBotUsername = async (botToken: string): Promise<string | null> => {
  if (cachedBotUsername) return cachedBotUsername
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, { signal: AbortSignal.timeout(8000) })
    const body = await res.json()
    cachedBotUsername = typeof body?.result?.username === 'string' ? body.result.username : null
  } catch {
    cachedBotUsername = null
  }
  return cachedBotUsername ?? (Deno.env.get('TELEGRAM_BOT_USERNAME') ?? null)
}

type TelegramUser = {
  id: number | string
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  /** The bot may message them (website login: they ticked it; app login: they started the bot). */
  allowsWriteToPm: boolean
}

const adminClient = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

/** Finds or creates this Telegram user's Moodeng login and mints a session. */
const signInTelegramUser = async (supabaseAdmin: SupabaseClient, tg: TelegramUser): Promise<Response> => {
  const id = tg.id
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
  let trustedProfile =
    existingProfile && ownTelegramEmails.includes(String(existingProfile.email ?? '').toLowerCase()) ? existingProfile : null
  // Also their own account if the login function recorded this Telegram id on it (app_metadata is
  // server-set, unlike users.telegram_id), e.g. after they changed their email in settings.
  let trustedEmail: string | null = trustedProfile?.email ?? null
  if (existingProfile && !trustedProfile) {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(existingProfile.id)
    if (authUser?.user?.app_metadata?.telegram_id === String(id) && authUser.user.email) {
      trustedProfile = existingProfile
      trustedEmail = authUser.user.email
    }
  }
  const email = trustedEmail ?? `telegram_${id}@moodeng.app`
  // The Telegram id is already on an account that signs in some other way (email, Google): don't
  // create a second, empty account for it. Tell them how to get in.
  if (existingProfile && !trustedProfile) {
    // 200 so the login page shows this message (functions.invoke hides the body of a non-2xx).
    return json({
      error: 'This Telegram account is linked to a Moodeng account that signs in with email. Log in with your email instead.',
      code: 'LINKED_TO_EMAIL_ACCOUNT',
    })
  }

  const telegramMetadata = {
    telegram_id: id,
    first_name: tg.first_name,
    last_name: tg.last_name,
    username: tg.username,
    photo_url: tg.photo_url,
    allows_write_to_pm: tg.allowsWriteToPm,
    provider: 'telegram',
  }

  const syncTelegramProfile = async (userId: string) => {
    const updates = {
      telegram_id: id,
      ...(tg.username ? { telegram_username: tg.username } : {}),
      ...(tg.allowsWriteToPm ? { chat_id: id } : {}),
    }

    const { error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', userId)

    if (error) throw error
  }

  // No password: Telegram vouched for this person (signed widget data, or a /start message from
  // their account), so mint the session server-side (_shared/mintSession.ts).
  const created = await ensureAuthUser(supabaseAdmin, email, telegramMetadata)
  // An account that already existed must be this Telegram user's, or it gets locked down first.
  const session = await mintSession(supabaseAdmin, email, created ? undefined : { key: 'telegram_id', value: String(id) })
  // Always refresh metadata so the photo (and name changes) stay current
  await supabaseAdmin.auth.admin.updateUserById(session.user.id, {
    user_metadata: telegramMetadata,
    // Server-set record of who this login belongs to: trusted by this function (above) and by the
    // database when the app first creates the profile row (check_provider_ids_on_insert).
    app_metadata: { ...(session.user.app_metadata ?? {}), telegram_id: String(id) },
  })
  await syncTelegramProfile(session.user.id)

  return json({ session })
}

// ── Telegram app login ──────────────────────────────────────────────────────────────────────────
const appStart = async (req: Request, body: Record<string, unknown>) => {
  const botToken = getTelegramBotToken()
  if (!botToken) throw new Error('TELEGRAM_API_TOKEN is not configured.')
  const botUsername = await getBotUsername(botToken)
  if (!botUsername) return json({ error: 'Telegram bot is not available right now.' }, 503)

  const supabaseAdmin = adminClient()
  const ipHash = await sha256Hex(`telegram-app-login:${clientIp(req)}`)
  const { count } = await supabaseAdmin
    .from('telegram_app_logins')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', new Date(Date.now() - APP_LOGIN_TTL_MS).toISOString())
  if ((count ?? 0) >= APP_START_PER_IP_PER_10_MIN) return json({ error: 'Too many tries. Wait a few minutes.' }, 429)

  // /start payloads allow [A-Za-z0-9_-], max 64 chars: "login_" + 32.
  const code = randomToken(24)
  const pollSecret = randomToken(24)
  const expiresAt = new Date(Date.now() + APP_LOGIN_TTL_MS).toISOString()
  const matchNumber = randomMatchNumber()
  const { error } = await supabaseAdmin.from('telegram_app_logins').insert({
    code_hash: await sha256Hex(code),
    poll_secret_hash: await sha256Hex(pollSecret),
    intent: body.intent === 'id' ? 'id' : null,
    match_number: matchNumber,
    device_label: deviceLabel(req.headers.get('user-agent') ?? ''),
    // Set by the edge network, not the browser (a scammer can fake the device, not this).
    location_label: (req.headers.get('cf-ipcountry') ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || null,
    ip_hash: ipHash,
    expires_at: expiresAt,
  })
  if (error) throw error
  // Old rows are useless after they expire: tidy a few on the way.
  await supabaseAdmin.from('telegram_app_logins').delete().lt('expires_at', new Date(Date.now() - 24 * 3600_000).toISOString())

  return json({ code, pollSecret, botUsername, startParam: `login_${code}`, expiresAt, matchNumber })
}

const appPoll = async (body: Record<string, unknown>) => {
  const code = typeof body.code === 'string' ? body.code : ''
  const pollSecret = typeof body.pollSecret === 'string' ? body.pollSecret : ''
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(code) || !/^[A-Za-z0-9_-]{16,64}$/.test(pollSecret)) {
    return json({ status: 'invalid' })
  }
  const supabaseAdmin = adminClient()
  const { data: row, error } = await supabaseAdmin
    .from('telegram_app_logins')
    .select('id, poll_secret_hash, expires_at, telegram_id, telegram_username, first_name, last_name, claimed_at, consumed_at')
    // Only page logins ('id' or plain); nothing else lives in this table now, but stay strict.
    .or('intent.is.null,intent.eq.id')
    .eq('code_hash', await sha256Hex(code))
    .maybeSingle()
  if (error) throw error
  // Only the page that started it (holds the poll secret) can collect the session.
  if (!row || row.poll_secret_hash !== (await sha256Hex(pollSecret))) return json({ status: 'invalid' })
  if (row.consumed_at) return json({ status: 'used' })
  if (!row.claimed_at || !row.telegram_id) {
    return json({ status: new Date(row.expires_at).getTime() < Date.now() ? 'expired' : 'waiting' })
  }
  if (Date.now() - new Date(row.claimed_at).getTime() > APP_CLAIM_MAX_AGE_MS) return json({ status: 'expired' })
  // Consume exactly once (two polls racing: only one gets the session).
  const { data: consumed } = await supabaseAdmin
    .from('telegram_app_logins')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', row.id)
    .is('consumed_at', null)
    .select('id')
    .maybeSingle()
  if (!consumed) return json({ status: 'used' })

  return await signInTelegramUser(supabaseAdmin, {
    id: row.telegram_id,
    first_name: row.first_name ?? undefined,
    last_name: row.last_name ?? undefined,
    username: row.telegram_username ?? undefined,
    // They pressed Start on our bot, so it can message them.
    allowsWriteToPm: true,
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    if (body?.action === 'app_start') return await appStart(req, body)
    if (body?.action === 'app_poll') return await appPoll(body)

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
      return json({ error: 'Invalid Telegram authentication' }, 401)
    }

    // Check auth_date is recent (within 24 hours)
    const authDate = new Date(auth_date * 1000)
    const now = new Date()
    const diffHours = (now.getTime() - authDate.getTime()) / (1000 * 60 * 60)

    // Fresh only: the redirect / login_url tap happens seconds before this call. (Was 24 h — a leaked
    // callback URL could be replayed all day.)
    if (diffHours > 0.25) {
      return json({ error: 'Telegram authentication expired' }, 401)
    }

    // And once only: the same signed data can't sign in twice (telegram_login_hashes, 20261107180000).
    const replayAdmin = adminClient()
    const { error: replayError } = await replayAdmin.from('telegram_login_hashes').insert({ hash_sha256: await sha256Hex(String(hash)) })
    if (replayError) {
      if (/duplicate|unique/i.test(replayError.message ?? '')) return json({ error: 'This Telegram sign-in was already used. Try again.' }, 401)
      throw replayError
    }
    await replayAdmin.from('telegram_login_hashes').delete().lt('used_at', new Date(Date.now() - 24 * 3600_000).toISOString())

    const allowsWriteToPm = allows_write_to_pm === true || allows_write_to_pm === 1 || allows_write_to_pm === '1' || allows_write_to_pm === 'true'

    return await signInTelegramUser(adminClient(), {
      id,
      first_name,
      last_name,
      username,
      photo_url,
      allowsWriteToPm,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected Telegram login error'
    return json({ error: message }, 500)
  }
})
