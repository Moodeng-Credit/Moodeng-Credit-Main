import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { bookCall, HOSTS, listCallSlots } from '../_shared/callBooking.ts';
import { CRON_TOKEN_HEADER } from '../_shared/cronAuth.ts';
import { syncEmmaCalendlyHours } from './calendlySync.ts';

// Free round-robin booking for the no-referral video call — the paid Cal.com Teams feature, built
// ourselves on the free API. The borrower sees one anonymous "Moodeng team" time list; we read each
// host's open slots, merge them, and when they pick a time we book whichever host is free behind
// the scenes (spread evenly). No host is ever shown, and it's $0.
//
// Two actions (POST JSON): { action: 'slots', timeZone } returns the merged available start times;
// { action: 'book', start, timeZone } books the slot and stamps users.video_call_scheduled_at.
// Calls are booked on CALL_HOST's calendar (Emma, 2026-10-14) with the other cofounder as a guest;
// optional { host: 'emma' | 'george' } on both pins a different host.
// verify_jwt is on, so only a signed-in borrower can call it; we take their identity from the JWT,
// never from the body, so nobody can book as someone else. The host Cal.com API keys live only in
// this function's env, never in the client.
// A third action, { action: 'sync_calendly_hours', dryRun? }, is the daily pg_cron job that copies
// Emma's Calendly hours onto her Cal.com schedule — X-Admin-Token only, never a borrower.
// { action: 'preview_slots', timeZone? } (X-Admin-Token only) returns the free times a fresh borrower would see.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
   if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
   if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || HOSTS.length === 0) {
      console.error('calcom-round-robin: missing env / no host API keys configured');
      return json({ error: 'not_configured' }, 500);
   }

   let payload: { action?: string; start?: string; timeZone?: string; host?: string; dryRun?: boolean };
   try {
      payload = await req.json();
   } catch {
      return json({ error: 'bad_request' }, 400);
   }

   if (payload.action === 'sync_calendly_hours' || payload.action === 'preview_slots') {
      // Fails closed (unlike checkCronAuth): no configured token, no sync.
      const expected = (Deno.env.get('ADMIN_API_TOKEN') ?? '').trim();
      if (!expected || (req.headers.get(CRON_TOKEN_HEADER) ?? '').trim() !== expected) return json({ error: 'unauthorized' }, 401);
      const adminSvc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      // Read-only: the free times a borrower with no call and no strikes would see right now (for
      // testing the Messenger booking bot against the real calendar). Books nothing.
      if (payload.action === 'preview_slots') {
         const result = await listCallSlots(adminSvc, { id: '00000000-0000-0000-0000-000000000000', email: null }, payload.timeZone || 'Asia/Manila', payload.host, true);
         return json(result.body, result.status);
      }
      const result = await syncEmmaCalendlyHours(adminSvc, payload.dryRun === true);
      return json(result, result.ok ? 200 : 502);
   }

   // Identity comes from the JWT, never the body.
   const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
   });
   const { data: auth } = await authClient.auth.getUser();
   const user = auth?.user;
   if (!user) return json({ error: 'unauthorized' }, 401);

   const timeZone = payload.timeZone || 'UTC';

   const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

   if (payload.action === 'slots') {
      const result = await listCallSlots(svc, { id: user.id, email: user.email }, timeZone, payload.host);
      return json(result.body, result.status);
   }

   if (payload.action === 'book') {
      const result = await bookCall(svc, { id: user.id, email: user.email }, payload.start, timeZone, payload.host);
      return json(result.body, result.status);
   }

   return json({ error: 'unknown_action' }, 400);
});
