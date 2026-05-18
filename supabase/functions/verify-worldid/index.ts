import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { signRequest } from "https://esm.sh/@worldcoin/idkit@4.1.5/signing?target=deno"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const WORLD_ID_ACTION_ID = 'verify-borrower'

type WorldIdRequestBody = {
  type?: 'rp-signature' | 'verify'
  action?: string
  proof?: Record<string, unknown>
}

const errorResponse = (error: string, status: number, errorCode = 'SERVER_ERROR', details?: unknown) => {
  return new Response(JSON.stringify({ success: false, error, errorCode, details }), { status, headers: corsHeaders })
}

const successResponse = (body: Record<string, unknown>, status = 200) => {
  return new Response(JSON.stringify({ success: true, ...body }), { status, headers: corsHeaders })
}

const getRequiredEnv = (name: string, errorCode = 'WORLDID_CONFIG_MISSING') => {
  const value = Deno.env.get(name)

  if (!value) {
    throw Object.assign(new Error(`${name} is not configured`), { status: 500, errorCode })
  }

  return value
}

const getAction = () => Deno.env.get('WORLD_ID_ACTION_ID') || Deno.env.get('VITE_WORLD_ID_ACTION_ID') || WORLD_ID_ACTION_ID

const getWorldIdEnvironment = () => {
  const environment = Deno.env.get('WORLD_ID_ENVIRONMENT') || Deno.env.get('VITE_WORLD_ID_ENVIRONMENT') || 'production'

  return environment === 'staging' ? 'staging' : 'production'
}

const getDeveloperPortalBaseUrl = () => {
  const configuredUrl = Deno.env.get('WORLD_ID_DEVELOPER_PORTAL_URL')

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '')
  }

  return getWorldIdEnvironment() === 'staging' ? 'https://staging-developer.worldcoin.org' : 'https://developer.world.org'
}

const getVerifyTarget = () => {
  return Deno.env.get('WORLD_ID_RP_ID') || Deno.env.get('WORLD_ID_APP_ID') || Deno.env.get('VITE_WORLD_ID_APP_ID')
}

const extractNullifier = (proof: Record<string, unknown>, verifyRes: Record<string, unknown>) => {
  if (typeof verifyRes.nullifier === 'string') {
    return verifyRes.nullifier
  }

  if (typeof proof.nullifier === 'string') {
    return proof.nullifier
  }

  if (typeof proof.nullifier_hash === 'string') {
    return proof.nullifier_hash
  }

  const responses = proof.responses
  if (Array.isArray(responses)) {
    const response = responses.find((item) => item && typeof item === 'object' && 'nullifier' in item) as Record<string, unknown> | undefined

    if (typeof response?.nullifier === 'string') {
      return response.nullifier
    }
  }

  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = (await req.json()) as WorldIdRequestBody
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      return errorResponse('Missing Authorization header', 401, 'AUTH_UNAUTHORIZED')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return errorResponse('Invalid Authorization token', 401, 'AUTH_TOKEN_INVALID')
    }

    const action = getAction()
    if (body.action && body.action !== action) {
      return errorResponse('World ID action does not match server configuration', 400, 'WORLDID_INVALID_PROOF')
    }

    if (body.type === 'rp-signature') {
      const signingKey = Deno.env.get('WORLD_ID_SIGNING_KEY') || Deno.env.get('RP_SIGNING_KEY')
      if (!signingKey) {
        return errorResponse('WORLD_ID_SIGNING_KEY is not configured', 500, 'WORLDID_CONFIG_MISSING')
      }

      const rpId = getRequiredEnv('WORLD_ID_RP_ID')
      const rpSignature = signRequest({ signingKeyHex: signingKey, action })

      return successResponse({
        rp_context: {
          rp_id: rpId,
          nonce: rpSignature.nonce,
          created_at: rpSignature.createdAt,
          expires_at: rpSignature.expiresAt,
          signature: rpSignature.sig,
        },
      })
    }

    const proof = (body.proof ?? body) as Record<string, unknown>
    const verifyTarget = getVerifyTarget()

    if (!verifyTarget) {
      return errorResponse('WORLD_ID_RP_ID or WORLD_ID_APP_ID is not configured', 500, 'WORLDID_CONFIG_MISSING')
    }

    if (!proof || Object.keys(proof).length === 0) {
      return errorResponse('World ID proof is required', 400, 'WORLDID_INVALID_PROOF')
    }

    const verifyResponse = await fetch(`${getDeveloperPortalBaseUrl()}/api/v4/verify/${verifyTarget}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'moodeng-credit-supabase-edge-function',
      },
      body: JSON.stringify(proof),
    })
    const verifyRes = (await verifyResponse.json().catch(() => null)) as Record<string, unknown> | null

    if (!verifyResponse.ok || !verifyRes?.success) {
      return errorResponse('World ID verification failed', 400, 'WORLDID_VERIFICATION_FAILED', verifyRes)
    }

    const nullifierHash = extractNullifier(proof, verifyRes)
    if (!nullifierHash) {
      return errorResponse('World ID proof did not include a nullifier', 400, 'WORLDID_INVALID_PROOF', verifyRes)
    }

    const adminSupabase = createClient(
      getRequiredEnv('SUPABASE_URL'),
      getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY', 'SERVER_ERROR')
    )

    const { data: existingUser, error: existingUserError } = await adminSupabase
      .from('users')
      .select('id')
      .eq('nullifier_hash', nullifierHash)
      .neq('id', user.id)
      .maybeSingle()

    if (existingUserError) {
      return errorResponse('Failed to check World ID usage', 500, 'DATABASE_ERROR', existingUserError)
    }

    if (existingUser) {
      return errorResponse('World ID already used', 400, 'WORLDID_ALREADY_USED')
    }

    const { error: updateError } = await adminSupabase
      .from('users')
      .update({
        is_world_id: 'ACTIVE',
        nullifier_hash: nullifierHash
      })
      .eq('id', user.id)

    if (updateError) {
      return errorResponse('Failed to update user', 500, 'USER_UPDATE_FAILED', updateError)
    }

    return successResponse({ nullifier_hash: nullifierHash })
  } catch (error) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500
    const errorCode = typeof error === 'object' && error !== null && 'errorCode' in error ? String(error.errorCode) : 'SERVER_ERROR'
    const message = error instanceof Error ? error.message : 'Internal server error'

    return errorResponse(message, status, errorCode)
  }
})
