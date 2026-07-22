import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Minimal OIDC issuer for Alchemy Smart Wallets "Bring Your Own Auth".
//
// Alchemy's BYOA can't consume Supabase session tokens directly: it requires
// `aud` = an Alchemy-assigned audience ID and `nonce` = SHA-256 of the signer's
// per-session target public key — claims Supabase will never emit. So this
// function is a tiny token exchange: the app proves who the user is with their
// normal Supabase session, and we mint a purpose-built RS256 JWT that Alchemy
// verifies against the JWKS we host right here. Nothing else ever accepts these
// tokens, and they expire in minutes.
//
// Routes (issuer = <SUPABASE_URL>/functions/v1/alchemy-oidc):
//   GET  /.well-known/openid-configuration  — OIDC discovery (public)
//   GET  /jwks.json                         — public signing key (public)
//   POST /token                             — mint a wallet-auth JWT (Supabase session required)
//
// Secrets:
//   ALCHEMY_OIDC_PRIVATE_KEY — RSA private key, PKCS#8 PEM (2048+)
//   ALCHEMY_BYOA_AUDIENCE    — audience ID from the Alchemy dashboard (Smart Wallets settings)

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
   new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra }
   });

// Discovery/JWKS responses are static per deploy — let intermediaries cache them.
const CACHEABLE = { 'Cache-Control': 'public, max-age=3600' };

const TOKEN_TTL_SECONDS = 5 * 60;

const b64url = (bytes: Uint8Array) =>
   btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const b64urlJson = (value: unknown) => b64url(new TextEncoder().encode(JSON.stringify(value)));

const pemToPkcs8 = (pem: string) => {
   const body = pem
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s+/g, '');
   return Uint8Array.from(atob(body), (c) => c.charCodeAt(0)).buffer;
};

// Import once per isolate; also derive the public JWK + a stable kid from it.
let signingKeyPromise: Promise<{ privateKey: CryptoKey; publicJwk: JsonWebKey & { kid: string } }> | null = null;
const getSigningKey = () => {
   signingKeyPromise ??= (async () => {
      const pem = Deno.env.get('ALCHEMY_OIDC_PRIVATE_KEY');
      if (!pem) throw new Error('ALCHEMY_OIDC_PRIVATE_KEY is not set');
      const algo = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } as const;
      const privateKey = await crypto.subtle.importKey('pkcs8', pemToPkcs8(pem), algo, true, ['sign']);
      // Export the private JWK and strip the private components to publish the public half.
      const { n, e } = (await crypto.subtle.exportKey('jwk', privateKey)) as JsonWebKey;
      if (!n || !e) throw new Error('Could not derive public JWK from private key');
      // kid = hash of the modulus, so key rotation naturally changes it.
      const kidBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(n)));
      const kid = b64url(kidBytes).slice(0, 16);
      return { privateKey, publicJwk: { kty: 'RSA', use: 'sig', alg: 'RS256', n, e, kid } };
   })();
   return signingKeyPromise;
};

const sha256Hex = async (input: string) => {
   const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
   return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
};

const getIssuer = () => `${Deno.env.get('SUPABASE_URL')}/functions/v1/alchemy-oidc`;

const handleDiscovery = () => {
   const issuer = getIssuer();
   return json(
      {
         issuer,
         jwks_uri: `${issuer}/jwks.json`,
         id_token_signing_alg_values_supported: ['RS256'],
         subject_types_supported: ['public'],
         response_types_supported: ['id_token']
      },
      200,
      CACHEABLE
   );
};

const handleJwks = async () => {
   const { publicJwk } = await getSigningKey();
   return json({ keys: [publicJwk] }, 200, CACHEABLE);
};

const handleToken = async (req: Request) => {
   // The caller proves identity with their normal Supabase session token.
   const authHeader = req.headers.get('Authorization') ?? '';
   const accessToken = authHeader.replace(/^Bearer\s+/i, '');
   if (!accessToken) return json({ error: 'Missing Authorization header' }, 401);

   const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
   const { data, error } = await supabase.auth.getUser(accessToken);
   if (error || !data?.user) return json({ error: 'Invalid session' }, 401);

   const audience = Deno.env.get('ALCHEMY_BYOA_AUDIENCE');
   if (!audience) return json({ error: 'ALCHEMY_BYOA_AUDIENCE is not configured' }, 500);

   let targetPublicKey: unknown;
   try {
      ({ targetPublicKey } = await req.json());
   } catch {
      return json({ error: 'Invalid JSON body' }, 400);
   }
   if (typeof targetPublicKey !== 'string' || !/^(0x)?[0-9a-fA-F]{64,260}$/.test(targetPublicKey)) {
      return json({ error: 'targetPublicKey must be a hex string' }, 400);
   }

   // Alchemy expects nonce = SHA-256 of the target public key without the 0x prefix.
   const nonce = await sha256Hex(targetPublicKey.replace(/^0x/, ''));

   const { privateKey, publicJwk } = await getSigningKey();
   const now = Math.floor(Date.now() / 1000);
   const header = { alg: 'RS256', typ: 'JWT', kid: publicJwk.kid };
   const payload = {
      iss: getIssuer(),
      sub: data.user.id,
      aud: audience,
      nonce,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS
   };
   const signingInput = `${b64urlJson(header)}.${b64urlJson(payload)}`;
   const signature = new Uint8Array(
      await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(signingInput))
   );

   return json({ token: `${signingInput}.${b64url(signature)}`, expiresIn: TOKEN_TTL_SECONDS });
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

   const path = new URL(req.url).pathname.replace(/^.*\/alchemy-oidc/, '') || '/';
   try {
      if (req.method === 'GET' && path === '/.well-known/openid-configuration') return handleDiscovery();
      if (req.method === 'GET' && path === '/jwks.json') return handleJwks();
      if (req.method === 'POST' && (path === '/token' || path === '/')) return handleToken(req);
      return json({ error: 'Not found' }, 404);
   } catch (err) {
      console.error('[alchemy-oidc]', err);
      return json({ error: 'Internal error' }, 500);
   }
});
