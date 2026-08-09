import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Mints a Stripe **crypto onramp session** for the authenticated caller so the embedded
// Stripe onramp widget can be mounted inline in the app (no popup — Stripe is the merchant
// of record and owns KYC/3DS inside its own iframe, so unlike Coinbase it embeds cleanly).
//
// Why this exists: `POST /v1/crypto/onramp_sessions` requires the Stripe **secret** key. The
// browser only ever receives the returned `client_secret`, which drives exactly one session.
//
// Auth: the caller must present a valid Supabase access token. This is what stops arbitrary
// clients from minting sessions against the account's live key.
//
// Required Supabase secret:
//   STRIPE_SECRET_KEY — live/test secret key (sk_live_… / sk_test_…) from the Stripe Dashboard
//
// Note: the Onramp API is in public preview and gated on an approved onramp application
// (Dashboard → Crypto onramp). Until the account is approved, Stripe rejects session
// creation and the client falls back to the Coinbase card option.

const STRIPE_API = 'https://api.stripe.com/v1/crypto/onramp_sessions';

// Mirrors the Coinbase function's allowlist — Stripe also requires the domains hosting the
// onramp to be registered in the Dashboard, so keep these two lists in sync with that.
const ALLOWED_ORIGINS = new Set(
   [
      'http://localhost:3000',
      'https://staging.dashboard.moodeng.app',
      'https://dashboard.moodeng.app',
      'https://moodeng.app',
      'https://www.moodeng.app',
      Deno.env.get('STRIPE_EXTRA_ALLOWED_ORIGIN')?.trim()
   ].filter((origin): origin is string => Boolean(origin))
);

const corsHeadersFor = (origin: string | null): Record<string, string> => {
   const headers: Record<string, string> = {
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin'
   };
   if (origin && ALLOWED_ORIGINS.has(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
   }
   return headers;
};

const jsonResponse = (body: Record<string, unknown>, status = 200, cors: Record<string, string> = {}) =>
   new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const isEvmAddress = (value: unknown): value is string =>
   typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);

// The real end-user IP. Stripe uses `customer_ip_address` to decide supportability up front
// (US excl. Hawaii + EU), so sending the Supabase proxy's IP instead of the browser's would
// approve or reject the wrong person. Leftmost x-forwarded-for entry is the client.
const clientIpFrom = (req: Request): string | undefined => {
   const forwarded = req.headers.get('x-forwarded-for');
   if (forwarded) {
      const first = forwarded.split(',')[0]?.trim();
      if (first) return first;
   }
   return req.headers.get('x-real-ip')?.trim() || undefined;
};

// Stripe's API is form-encoded, including bracketed nested/array keys.
const buildSessionForm = (address: string, walletKey: string, clientIp?: string): URLSearchParams => {
   const form = new URLSearchParams();
   form.set(`wallet_addresses[${walletKey}]`, address);
   // Pin the whole flow to USDC-on-Base: the customer never sees a network/asset picker they
   // could get wrong, and funds can only land where the app can actually see them.
   form.set('destination_network', 'base');
   form.set('destination_currency', 'usdc');
   form.append('destination_networks[]', 'base');
   form.append('destination_currencies[]', 'usdc');
   form.set('source_currency', 'usd');
   // The destination is the customer's own custodial/connected wallet — locking it prevents
   // a purchase being redirected to an attacker-supplied address inside the widget.
   form.set('lock_wallet_address', 'true');
   if (clientIp) form.set('customer_ip_address', clientIp);
   return form;
};

interface StripeError {
   code?: string;
   message?: string;
   type?: string;
}

const createSession = async (
   secretKey: string,
   form: URLSearchParams
): Promise<{ ok: boolean; status: number; body: { client_secret?: string; error?: StripeError } | null }> => {
   const response = await fetch(STRIPE_API, {
      method: 'POST',
      headers: {
         Authorization: `Bearer ${secretKey}`,
         'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: form.toString()
   });
   const body = (await response.json().catch(() => null)) as
      | { client_secret?: string; error?: StripeError }
      | null;
   return { ok: response.ok, status: response.status, body };
};

// Stripe rejects the customer rather than the request for these — they mean "this person
// can't be served here", not "your integration is broken", so the UI shows a region message
// and points at Coinbase instead of a generic failure.
const UNSUPPORTED_CODES = new Set([
   'crypto_onramp_unsupported_country',
   'crypto_onramp_unsupportable_customer'
]);

serve(async (req) => {
   const cors = corsHeadersFor(req.headers.get('Origin'));

   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: cors });
   }

   if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, cors);
   }

   try {
      const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
      if (!secretKey) {
         console.error('[stripe-onramp-session] STRIPE_SECRET_KEY not configured');
         return jsonResponse({ error: 'Server misconfigured' }, 500, cors);
      }

      const accessToken = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
      if (!accessToken) {
         return jsonResponse({ error: 'Missing authorization token' }, 401, cors);
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
         return jsonResponse({ error: 'Invalid authorization token' }, 401, cors);
      }

      // Destination address: prefer the caller-supplied connected wallet (validated), else
      // the wallet stored on their profile. Never mint a session without one — with
      // lock_wallet_address set, a session with no address can't be completed.
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
         return jsonResponse({ error: 'No destination wallet address available', code: 'NO_WALLET' }, 400, cors);
      }

      const clientIp = clientIpFrom(req);
      if (!clientIp) {
         // Without it Stripe can't pre-check supportability, so an unsupported customer only
         // discovers the problem partway through KYC. Worth a log line.
         console.warn('[stripe-onramp-session] No client IP resolved from request headers');
      }

      // Base addresses are keyed `base_network` on the session object. Some API versions
      // accept only the generic `ethereum` key for EVM addresses, so fall back once rather
      // than hard-failing a customer on a key-name mismatch.
      let result = await createSession(secretKey, buildSessionForm(address, 'base_network', clientIp));
      const walletKeyRejected =
         !result.ok &&
         result.status === 400 &&
         /wallet_addresses/i.test(result.body?.error?.message ?? result.body?.error?.code ?? '');

      if (walletKeyRejected) {
         console.warn('[stripe-onramp-session] base_network wallet key rejected, retrying with ethereum key');
         result = await createSession(secretKey, buildSessionForm(address, 'ethereum', clientIp));
      }

      const clientSecret = result.body?.client_secret;

      if (!result.ok || !clientSecret) {
         const stripeCode = result.body?.error?.code;

         if (stripeCode && UNSUPPORTED_CODES.has(stripeCode)) {
            return jsonResponse(
               {
                  error: 'Stripe cannot serve this customer’s region',
                  code: 'UNSUPPORTED_REGION'
               },
               400,
               cors
            );
         }

         console.error('[stripe-onramp-session] Session creation failed:', result.status, result.body?.error);
         return jsonResponse({ error: 'Failed to create Stripe onramp session' }, 502, cors);
      }

      return jsonResponse({ clientSecret }, 200, cors);
   } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      console.error('[stripe-onramp-session] Unhandled error:', message);
      return jsonResponse({ error: message }, 500, cors);
   }
});
