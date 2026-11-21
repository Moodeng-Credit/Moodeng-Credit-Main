import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

import { sendEmail } from '../_shared/email.ts'

// Two jobs (the project is at Supabase's edge-function limit, so related account-recovery work
// shares this function):
//   * { email }                        — legacy password-reset mail.
//   * { action: 'guest_code', email }  — a guest account (email-first sign-up in Facebook's browser)
//     is waiting on this email: mail an 8-digit code that signs into THAT account (the app checks it
//     with verifyOtp type 'email_change'), instead of the app creating a second, empty account.
//     Answers { guest: false } when no guest is waiting, so the app sends its normal sign-in code.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Same length as Supabase's email codes here (the app's code box expects 8 digits).
const newCode = () => {
  const n = new Uint32Array(1)
  crypto.getRandomValues(n)
  return String(n[0] % 100_000_000).padStart(8, '0')
}

const guestCodeEmail = (code: string) => ({
  subject: `Your Moodeng code: ${code}`,
  text: [
    'Here is your code to get back into your Moodeng account:',
    '',
    code,
    '',
    'Type it in the Moodeng app. It works for 1 hour.',
    "Didn't ask for it? You can ignore this email.",
  ].join('\n'),
  html: `<div style="font-family:Arial,sans-serif;font-size:16px;color:#2d1b4e">
<p>Here is your code to get back into your Moodeng account:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p>
<p>Type it in the Moodeng app. It works for 1 hour.</p>
<p style="color:#6b5b86">Didn't ask for it? You can ignore this email.</p>
</div>`,
})

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, action } = await req.json()

    if (!email || typeof email !== 'string') {
      return json({ error: 'Email is required' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (action === 'guest_code') {
      const address = email.trim().toLowerCase()
      const code = newCode()
      const { data, error } = await supabase.rpc('set_guest_email_code', { p_email: address, p_code: code })
      if (error) {
        console.error('forgot-password guest_code: rpc failed', error.message)
        return json({ error: 'lookup_failed' }, 500)
      }
      const result = (data ?? {}) as { user_id?: string | null; throttled?: boolean }
      if (!result.user_id) return json({ guest: false })
      // A code went out under a minute ago and is still the live one: don't replace it.
      if (result.throttled) return json({ guest: true, throttled: true })
      const mail = guestCodeEmail(code)
      await sendEmail(address, mail.subject, mail.text, mail.html)
      return json({ guest: true })
    }

    const redirectUrl = Deno.env.get('FORGOT_PASSWORD_REDIRECT_URL')

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    })

    if (resetError) {
      return json({ error: resetError.message }, 400)
    }

    return json({ message: 'Password reset email sent. Please check your inbox.' })
  } catch (error) {
    return json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }, 500)
  }
})
