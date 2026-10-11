// Stamps the Telegram cards and Discord posts about a state change with its outcome.
// Called by the dispatch_state_event trigger on public.state_events (service key as bearer) with
// { eventId }. The row is read from the DB (never trusted from the body) and claimed by setting
// dispatched_at, so a retried call does nothing. If a decision function already stamped the cards
// (it claims the refs), this finds nothing to edit — fine.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { stampDecisionCards } from '../_shared/adminCards.ts';
import { type StateEvent, stateEventStamp } from '../_shared/stateEvents.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

const json = (body: unknown, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const isAuthorized = async (supabase: SupabaseClient, req: Request) => {
   const authorization = req.headers.get('Authorization') ?? '';
   const secret = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : req.headers.get('x-notification-secret');
   if (!secret) return false;
   const expected = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('TELEGRAM_NOTIFICATION_SECRET');
   if (expected && secret === expected) return true;
   const { data } = await supabase.rpc('verify_internal_notification_secret', { candidate: secret });
   return data === true;
};

serve(async (req) => {
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
   if (!(await isAuthorized(supabase, req))) return json({ error: 'Unauthorized' }, 401);

   try {
      const { eventId } = (await req.json().catch(() => ({}))) as { eventId?: number | string };
      if (!eventId) return json({ error: 'eventId is required' }, 400);

      // Claim: only the first call for an event gets the row back.
      const { data, error } = await supabase
         .from('state_events')
         .update({ dispatched_at: new Date().toISOString() })
         .eq('id', eventId)
         .is('dispatched_at', null)
         .select('id, kind, ref_id, user_id, from_state, to_state, actor, meta, created_at')
         .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return json({ ok: true, skipped: 'already dispatched or missing' });

      const event = data as StateEvent;
      const stamp = stateEventStamp(event);
      if (!stamp) return json({ ok: true, stamped: 0 });

      const stamped = await stampDecisionCards(supabase, stamp.cardKind, stamp.refId, stamp.header, {
         detail: stamp.detail,
         by: stamp.by,
         verb: stamp.verb,
         at: event.created_at ? new Date(event.created_at) : new Date(),
         final: stamp.final
      });
      return json({ ok: true, stamped, header: stamp.header });
   } catch (err) {
      console.error('state-events-dispatch failed:', err instanceof Error ? err.message : err);
      return json({ error: 'dispatch failed' }, 500);
   }
});
