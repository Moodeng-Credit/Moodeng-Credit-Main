import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { SITE_URL } from '../_shared/loanAccess.ts';
import { isValidUnsubscribeToken } from '../_shared/unsubscribe.ts';

// Unsubscribe from Admin → Campaigns emails (marketing only; loan and account emails still go out).
// No Supabase session — the HMAC token in the link is the authentication (_shared/unsubscribe.ts).
//
//   GET  ?u=<user id>&t=<token>  → redirect to the app's /unsubscribe page, which asks "are you
//                                   sure?" (link scanners open GET links; they must not unsubscribe)
//   POST ?u=…&t=…  or  {u, t}     → unsubscribe. Also what a mail app sends for one-click
//                                   List-Unsubscribe (RFC 8058).
//   POST {u, t, resubscribe: true} → undo, from the same page.

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};
const json = (body: unknown, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const UUID = /^[0-9a-f-]{36}$/i;

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   const url = new URL(req.url);

   if (req.method === 'GET') {
      const params = new URLSearchParams({ u: url.searchParams.get('u') ?? '', t: url.searchParams.get('t') ?? '' });
      return new Response(null, { status: 302, headers: { Location: `${SITE_URL}/unsubscribe?${params.toString()}` } });
   }
   if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

   // One-click from a mail app posts form data with the ids in the URL; the app page posts JSON.
   const body = (req.headers.get('content-type') ?? '').includes('application/json')
      ? (((await req.json().catch(() => null)) ?? {}) as { u?: string; t?: string; resubscribe?: boolean })
      : {};
   const userId = (body.u ?? url.searchParams.get('u') ?? '').trim();
   const token = (body.t ?? url.searchParams.get('t') ?? '').trim();
   if (!UUID.test(userId) || !token || !(await isValidUnsubscribeToken(userId, token))) {
      return json({ ok: false, error: 'invalid_link' }, 400);
   }

   const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { autoRefreshToken: false, persistSession: false }
   });
   const resubscribe = body.resubscribe === true;
   const { error } = await svc
      .from('users')
      .update({ email_unsubscribed_at: resubscribe ? null : new Date().toISOString() })
      .eq('id', userId);
   if (error) {
      console.error('email-unsubscribe: update failed', error.message);
      return json({ ok: false, error: 'internal_error' }, 500);
   }
   return json({ ok: true, unsubscribed: !resubscribe });
});
