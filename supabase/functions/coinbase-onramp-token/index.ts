import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SignJWT, importJWK, importPKCS8, base64url } from 'npm:jose@5';

// Mints a Coinbase Onramp **session token** (Secure Initialization) for the authenticated
// caller so the Coinbase buy widget can open as an in-app popup instead of a hosted URL.
//
// Why this exists: the CDP project has "Secure Initialization" enabled, which requires a
// short-lived session token signed server-side with the Secret API key. The browser must
// never see the secret, so the token is minted here and handed back to the client, which
// opens `https://pay.coinbase.com/buy/select-asset?sessionToken=<token>`.
//
// Auth: the caller must present a valid Supabase access token. This is what prevents
// arbitrary clients from minting session tokens (CDP application review asks for this).
//
// The CDP bearer JWT is generated inline (the @coinbase/cdp-sdk is too heavy to bundle in
// an edge function) — this mirrors the SDK's generateJwt exactly, supporting both EC
// (ES256, PKCS8 PEM) and Ed25519 (base64, 64-byte) Secret API keys.
//
// Required Supabase secrets:
//   CDP_API_KEY_ID     — Secret API key id (from CDP → API keys → Secret API keys)
//   CDP_API_KEY_SECRET — Secret API key private key (PEM EC key or base64 Ed25519 secret)
// Optional:
//   CDP_ONRAMP_HOST    — defaults to api.developer.coinbase.com

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const isEvmAddress = (value: unknown): value is string =>
   typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);

const hexNonce = (): string => {
   const bytes = new Uint8Array(16);
   crypto.getRandomValues(bytes);
   return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

const decodeBase64 = (b64: string): Uint8Array | null => {
   try {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
   } catch {
      return null;
   }
};

// Builds the Coinbase CDP bearer JWT for a single REST request. Mirrors
// @coinbase/cdp-sdk/auth generateJwt: claims { sub, iss:"cdp", uris:["METHOD host/path"] },
// header { alg, kid, typ, nonce }, 120s expiry.
async function generateCdpJwt(
   apiKeyId: string,
   apiKeySecret: string,
   method: string,
   host: string,
   path: string,
   expiresIn = 120
): Promise<string> {
   const now = Math.floor(Date.now() / 1000);
   const claims = {
      sub: apiKeyId,
      iss: 'cdp',
      uris: [`${method} ${host}${path}`]
   };
   const nonce = hexNonce();

   const decoded = decodeBase64(apiKeySecret);
   if (decoded && decoded.length === 64) {
      // Ed25519 key: 32-byte seed + 32-byte public key.
      const seed = decoded.subarray(0, 32);
      const publicKey = decoded.subarray(32);
      const jwk = {
         kty: 'OKP',
         crv: 'Ed25519',
         d: base64url.encode(seed),
         x: base64url.encode(publicKey)
      };
      const key = await importJWK(jwk, 'EdDSA');
      return await new SignJWT(claims)
         .setProtectedHeader({ alg: 'EdDSA', kid: apiKeyId, typ: 'JWT', nonce })
         .setIssuedAt(now)
         .setNotBefore(now)
         .setExpirationTime(now + expiresIn)
         .sign(key);
   }

   // EC key (ES256), PKCS8 PEM.
   const ecKey = await importPKCS8(apiKeySecret, 'ES256');
   return await new SignJWT(claims)
      .setProtectedHeader({ alg: 'ES256', kid: apiKeyId, typ: 'JWT', nonce })
      .setIssuedAt(now)
      .setNotBefore(now)
      .setExpirationTime(now + expiresIn)
      .sign(ecKey);
}

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }

   if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
   }

   try {
      const apiKeyId = Deno.env.get('CDP_API_KEY_ID');
      const apiKeySecret = Deno.env.get('CDP_API_KEY_SECRET');
      if (!apiKeyId || !apiKeySecret) {
         console.error('[coinbase-onramp-token] CDP_API_KEY_ID / CDP_API_KEY_SECRET not configured');
         return jsonResponse({ error: 'Server misconfigured' }, 500);
      }

      const accessToken = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
      if (!accessToken) {
         return jsonResponse({ error: 'Missing authorization token' }, 401);
      }

      const supabase = createClient(
         Deno.env.get('SUPABASE_URL') ?? '',
         Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
         { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const {
         data: { user },
         error: userError
      } = await supabase.auth.getUser(accessToken);

      if (userError || !user) {
         return jsonResponse({ error: 'Invalid authorization token' }, 401);
      }

      // Destination address: prefer the caller-supplied connected wallet (validated), else
      // fall back to the wallet stored on their profile. Never mint a token without one.
      let address: string | undefined;
      try {
         const body = (await req.json()) as { address?: unknown };
         if (isEvmAddress(body?.address)) address = body.address;
      } catch {
         // No/invalid body — fall through to the profile wallet.
      }

      if (!address) {
         const { data: profile } = await supabase
            .from('users')
            .select('wallet_address')
            .eq('id', user.id)
            .maybeSingle();
         const stored = (profile as { wallet_address?: string } | null)?.wallet_address;
         if (isEvmAddress(stored)) address = stored;
      }

      if (!address) {
         return jsonResponse({ error: 'No destination wallet address available', code: 'NO_WALLET' }, 400);
      }

      const host = (Deno.env.get('CDP_ONRAMP_HOST')?.trim() || 'api.developer.coinbase.com').replace(/^https?:\/\//, '');
      const requestPath = '/onramp/v1/token';

      const jwt = await generateCdpJwt(apiKeyId, apiKeySecret, 'POST', host, requestPath);

      const cdpResponse = await fetch(`https://${host}${requestPath}`, {
         method: 'POST',
         headers: {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
         },
         body: JSON.stringify({
            addresses: [{ address, blockchains: ['base'] }],
            assets: ['USDC']
         })
      });

      const cdpBody = (await cdpResponse.json().catch(() => null)) as
         | { token?: string; channelId?: string; channel_id?: string; [key: string]: unknown }
         | null;

      if (!cdpResponse.ok || !cdpBody?.token) {
         console.error('[coinbase-onramp-token] CDP token request failed:', cdpResponse.status, cdpBody);
         return jsonResponse({ error: 'Failed to create Coinbase session' }, 502);
      }

      return jsonResponse({ token: cdpBody.token });
   } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      console.error('[coinbase-onramp-token] Unhandled error:', message);
      return jsonResponse({ error: message }, 500);
   }
});
