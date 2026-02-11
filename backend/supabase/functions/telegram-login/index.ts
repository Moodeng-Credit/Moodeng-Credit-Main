import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "@supabase/supabase-js"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function verifyTelegramHash(authData: any, botToken: string): Promise<boolean> {
  const { hash, ...data } = authData;
  
  // 1. Create data-check-string
  const checkString = Object.keys(data)
    .sort()
    .map(key => `${key}=${data[key]}`)
    .join('\n');

  const encoder = new TextEncoder();
  
  // 2. secret_key = SHA256(bot_token)
  const botTokenHash = await crypto.subtle.digest("SHA-256", encoder.encode(botToken));
  
  // 3. Import the secret_key for HMAC
  const key = await crypto.subtle.importKey(
    "raw",
    botTokenHash,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  // 4. Compute HMAC-SHA256 signature
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(checkString)
  );
  
  // 5. Convert signature to hex
  const hexSignature = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
    
  return hexSignature === hash;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { authData } = await req.json()
    const botToken = Deno.env.get('TELEGRAM_API_TOKEN')

    if (!botToken) {
      throw new Error('TELEGRAM_API_TOKEN is not set in environment variables')
    }

    // 1. Verify Telegram Hash
    const isValid = await verifyTelegramHash(authData, botToken)
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid Telegram authentication hash' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // 2. Check auth_date (prevent replay attacks - 24h limit)
    const authDate = parseInt(authData.auth_date)
    const now = Math.floor(Date.now() / 1000)
    if (now - authDate > 86400) {
      return new Response(
        JSON.stringify({ error: 'Authentication data is outdated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      }
    )
    
    const telegramId = authData.id
    console.log(`Processing login for Telegram ID: ${telegramId}`)
    
    // 3. Check if user exists in public.users by telegram_id
    const { data: profile } = await supabase
      .from('users')
      .select('id, username, email')
      .eq('telegram_id', telegramId)
      .maybeSingle()
      
    let userId: string;
    let email: string;
    if (profile) {
      userId = profile.id
      email = profile.email || `telegram_${telegramId}@moodeng.credit`
    } else {
      // 4. Create new user if not exists
      // Use a placeholder email since Telegram doesn't provide one
      email = `telegram_${telegramId}@moodeng.credit`
      
      // Check if auth user already exists with this email (unlikely but possible)
      const { data: existingUser, error: lookupError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()
      
      if (lookupError) throw lookupError
      const foundUser = existingUser
      
      if (foundUser) {
        userId = foundUser.id
      } else {
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            username: authData.username || `user_${telegramId}`,
            full_name: `${authData.first_name} ${authData.last_name || ''}`.trim(),
            avatar_url: authData.photo_url,
            telegram_id: telegramId
          }
        })
        
        if (authError) throw authError
        userId = authUser.user.id
      }
      
      // 5. Create/Update profile in public.users
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({
          id: userId,
          username: authData.username || `user_${telegramId}`,
          email,
          telegram_id: telegramId,
          telegram_username: authData.username,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })
        
      if (upsertError) throw upsertError
    }
    
    console.log(`Generating magic link for email: ${email}`)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email
    })
    if (linkError) {
      console.error('Generate link error:', linkError)
      throw linkError
    }
    
    console.log('Link data properties:', JSON.stringify(linkData.properties, null, 2))
    
    // Try to find the token hash in different possible fields
    const tokenHash = linkData.properties.token_hash || linkData.properties.hashed_token;
    
    if (!tokenHash) {
      console.error('No token hash found in link data properties')
      throw new Error('Failed to generate a valid login token')
    }

    console.log('Verifying OTP with token hash...')
    const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink'
    })
    if (sessionError) {
      console.error('Verify OTP error:', sessionError)
      throw sessionError
    }
    
    console.log('Session created successfully')
    
    return new Response(
      JSON.stringify({ 
        session: sessionData.session, 
        user: sessionData.user,
        message: 'Telegram authentication successful' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Telegram login error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error)?.message || 'Telegram login failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
