// Stableyard webhook receiver. Served by stableyard-deposit-address (the project is at its
// edge-function cap, so this can't be its own function): any request carrying
// x-stableyard-signature is routed here.
//
// Setup: Stableyard Partner Dashboard → Developers → Webhooks → new endpoint
//   URL    = https://qplmmxynzxzkfxtayoqr.supabase.co/functions/v1/stableyard-deposit-address
//   Events = deposit.detected, deposit.settled, deposit.reversed, deposit.requires_intervention, deposit.failed
// The dashboard shows the signing secret (whsec_…) once: save it as the STABLEYARD_WEBHOOK_SECRET secret.
//
// Each delivery: verify the HMAC over the raw body, record the event id (at-least-once delivery →
// dedupe), then re-read the account's deposits from Stableyard and mirror them (events are prompts to
// read, never the state itself). 5xx makes Stableyard retry; 4xx (bad signature) is not retried.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { verifyStableyardWebhook } from './stableyard.ts';
import { syncDeposits } from './stableyardSync.ts';

const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const isStableyardWebhook = (req: Request) => req.headers.has('x-stableyard-signature');

export const handleStableyardWebhook = async (req: Request): Promise<Response> => {
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const secret = Deno.env.get('STABLEYARD_WEBHOOK_SECRET')?.trim();
   if (!secret) {
      console.error('[stableyard-webhook] STABLEYARD_WEBHOOK_SECRET is not set');
      // 503 so Stableyard retries once the secret is configured, instead of dropping the event.
      return json({ error: 'Not configured' }, 503);
   }

   const rawBody = await req.text();
   let verified;
   try {
      verified = await verifyStableyardWebhook(rawBody, req.headers, secret);
   } catch (err) {
      console.error('[stableyard-webhook] rejected delivery:', err instanceof Error ? err.message : err);
      return json({ error: 'Invalid signature' }, 401);
   }

   let event: { name?: string; payload?: Record<string, unknown> };
   try {
      event = JSON.parse(rawBody);
   } catch {
      return json({ error: 'Invalid JSON' }, 400);
   }
   const eventName = event.name ?? verified.eventName;
   const payload = event.payload ?? {};
   const accountId = String(payload.accountId ?? req.headers.get('x-stableyard-account-id') ?? '');

   const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   const { data: seen } = await admin
      .from('stableyard_webhook_events')
      .select('processed_at')
      .eq('event_id', verified.eventId)
      .maybeSingle();
   if (seen?.processed_at) return json({ ok: true, duplicate: true });
   if (!seen) {
      const { error } = await admin.from('stableyard_webhook_events').insert({
         event_id: verified.eventId,
         event_name: eventName,
         delivery_id: verified.deliveryId,
         account_id: accountId || null,
         payload: event
      });
      if (error && error.code !== '23505') {
         console.error('[stableyard-webhook] record event failed', error.message);
         return json({ error: 'Storage unavailable' }, 503);
      }
   }

   // Only deposit events matter to us today; unknown names are acknowledged and ignored.
   if (!eventName.startsWith('deposit.') || !accountId) {
      await admin.from('stableyard_webhook_events').update({ processed_at: new Date().toISOString() }).eq('event_id', verified.eventId);
      return json({ ok: true, ignored: true });
   }

   const { data: owner } = await admin.from('stableyard_accounts').select('user_id').eq('account_id', accountId).maybeSingle();
   if (!owner?.user_id) {
      await admin
         .from('stableyard_webhook_events')
         .update({ processed_at: new Date().toISOString(), error: 'unknown account' })
         .eq('event_id', verified.eventId);
      return json({ ok: true, ignored: true });
   }

   const synced = await syncDeposits(admin, owner.user_id, accountId);
   if (!synced.ok) {
      await admin.from('stableyard_webhook_events').update({ error: synced.error }).eq('event_id', verified.eventId);
      return json({ error: 'Sync failed' }, 503);
   }

   await admin
      .from('stableyard_webhook_events')
      .update({ processed_at: new Date().toISOString(), error: null })
      .eq('event_id', verified.eventId);
   return json({ ok: true });
};
