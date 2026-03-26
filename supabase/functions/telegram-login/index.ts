import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { id, first_name, last_name, username, photo_url, auth_date, hash } = await req.json()

    // Verify Telegram auth
    const botToken = Deno.env.get('TELEGRAM_API_TOKEN')!
    const secretKey = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(botToken)
    )

    const dataCheckString = [
      `auth_date=${auth_date}`,
      first_name && `first_name=${first_name}`,
      id && `id=${id}`,
      last_name && `last_name=${last_name}`,
      photo_url && `photo_url=${photo_url}`,
      username && `username=${username}`,
    ]
      .filter(Boolean)
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

    // Use telegram ID as email (synthetic)
    const email = `telegram_${id}@moodeng.app`
    const password = `tg_${id}_${botToken.slice(0, 8)}`

    // Try to sign in first
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    })

    if (signInData?.session) {
      return new Response(
        JSON.stringify({ session: signInData.session }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // User doesn't exist, create them
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        telegram_id: id,
        first_name,
        last_name,
        username,
        photo_url,
        provider: 'telegram',
      },
    })

    if (createError) {
      throw createError
    }

    // Sign in the newly created user
    const { data: newSignInData, error: newSignInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    })

    if (newSignInError) {
      throw newSignInError
    }

    return new Response(
      JSON.stringify({ session: newSignInData.session }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
