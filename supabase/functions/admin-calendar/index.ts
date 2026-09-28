import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { isValidAvailability, isValidOverrides } from './lib.ts';

// Admin Calendar — the team's Cal.com availability and bookings, inside the admin panel.
//
// Reads each host's schedules and bookings with the same per-host Cal.com API keys the
// calcom-round-robin booking function uses (they never reach the browser), and lets an admin
// change a schedule's weekly hours and date overrides (days off / one-off hours). Whatever is
// saved here is what borrowers see as open slots in the video-call step.
//
// Two actions (POST JSON):
//   { action: 'overview', from, to }  → { hosts: [{ id, schedules, bookings, error? }] }
//   { action: 'update_schedule', host, scheduleId, availability, overrides, timeZone? } → { schedule }
// verify_jwt is on; the caller must also be an active admin (reads) or owner/admin (writes).

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const HOSTS = [
   { id: 'george', apiKey: Deno.env.get('CALCOM_API_KEY_GEORGE') ?? '' },
   { id: 'emma', apiKey: Deno.env.get('CALCOM_API_KEY_EMMA') ?? '' }
].filter((h) => h.apiKey);

const CAL_BASE = 'https://api.cal.com/v2';
const SCHEDULES_VERSION = '2024-06-11';
const BOOKINGS_VERSION = '2026-05-01';

const CORS = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const calFetch = async (apiKey: string, path: string, version: string, init: RequestInit = {}) => {
   const res = await fetch(`${CAL_BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${apiKey}`, 'cal-api-version': version, 'Content-Type': 'application/json' }
   });
   const body = await res.json().catch(() => ({}));
   if (!res.ok) {
      const message = String(body?.error?.message ?? body?.message ?? `Cal.com ${res.status}`);
      throw new Error(message);
   }
   return body;
};

type Booking = {
   uid: string;
   title: string;
   start: string;
   end: string;
   status: string;
   location: string | null;
   eventSlug: string | null;
   attendees: Array<{ name: string; email: string; timeZone: string | null }>;
};

const asUrl = (value: unknown) => (typeof value === 'string' && /^https?:\/\//.test(value) ? value : null);

// Bookings in [from, to), cancelled and rejected ones dropped. Cursor pagination per the
// 2026-05-01 bookings API; capped at 10 pages (1000 bookings) as a safety bound.
const fetchBookings = async (apiKey: string, from: string, to: string): Promise<Booking[]> => {
   const out: Booking[] = [];
   let cursor: string | null = null;
   for (let page = 0; page < 10; page++) {
      const qs = new URLSearchParams({ afterStart: from, beforeEnd: to, sortStart: 'asc', limit: '100' });
      if (cursor) qs.set('cursor', cursor);
      const body = await calFetch(apiKey, `/bookings?${qs}`, BOOKINGS_VERSION);
      const rows = Array.isArray(body?.data) ? body.data : [];
      for (const b of rows) {
         const status = String(b?.status ?? '').toLowerCase();
         if (status === 'cancelled' || status === 'rejected') continue;
         out.push({
            uid: String(b.uid),
            title: String(b.title ?? 'Booking'),
            start: String(b.start),
            end: String(b.end),
            status,
            location: asUrl(b.location) ?? asUrl(b.meetingUrl),
            eventSlug: b?.eventType?.slug ?? null,
            attendees: (Array.isArray(b.attendees) ? b.attendees : []).map((a: Record<string, unknown>) => ({
               name: String(a?.name ?? ''),
               email: String(a?.email ?? ''),
               timeZone: typeof a?.timeZone === 'string' ? a.timeZone : null
            }))
         });
      }
      cursor = typeof body?.pagination?.nextCursor === 'string' ? body.pagination.nextCursor : null;
      if (!cursor || body?.pagination?.hasMore === false || rows.length === 0) break;
   }
   return out;
};

const isIsoDate = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
   if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
   if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'not_configured' }, 500);

   const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

   // ---- Auth: caller must be an active admin ------------------------------------------------
   const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
   if (!token) return json({ error: 'Missing authorization token' }, 401);
   const { data: userData, error: userError } = await admin.auth.getUser(token);
   const callerId = userData?.user?.id;
   if (userError || !callerId) return json({ error: 'Invalid session' }, 401);

   const { data: adminRow } = await admin
      .from('admin_users')
      .select('role')
      .eq('user_id', callerId)
      .eq('active', true)
      .in('role', ['owner', 'admin', 'support'])
      .maybeSingle();
   if (!adminRow) return json({ error: 'Forbidden: admin account required' }, 403);

   const body = await req.json().catch(() => ({}) as Record<string, unknown>);

   // ---- overview ----------------------------------------------------------------------------
   if (body.action === 'overview') {
      if (!isIsoDate(body.from) || !isIsoDate(body.to)) return json({ error: 'from and to must be ISO dates' }, 400);
      const from = new Date(body.from).toISOString();
      const to = new Date(body.to).toISOString();

      const hosts = await Promise.all(
         HOSTS.map(async (host) => {
            try {
               const [schedules, bookings] = await Promise.all([
                  calFetch(host.apiKey, '/schedules', SCHEDULES_VERSION).then((b) => (Array.isArray(b?.data) ? b.data : [])),
                  fetchBookings(host.apiKey, from, to)
               ]);
               return { id: host.id, schedules, bookings };
            } catch (err) {
               console.error(`admin-calendar: overview failed for ${host.id}`, err);
               return { id: host.id, schedules: [], bookings: [], error: err instanceof Error ? err.message : 'Cal.com request failed' };
            }
         })
      );
      return json({ hosts });
   }

   // ---- update_schedule ---------------------------------------------------------------------
   if (body.action === 'update_schedule') {
      if (adminRow.role === 'support') return json({ error: 'Only owner/admin accounts can change the calendar' }, 403);

      const host = HOSTS.find((h) => h.id === body.host);
      if (!host) return json({ error: 'Unknown host' }, 400);
      const scheduleId = Number(body.scheduleId);
      if (!Number.isInteger(scheduleId) || scheduleId <= 0) return json({ error: 'scheduleId is required' }, 400);
      if (!isValidAvailability(body.availability)) return json({ error: 'Invalid weekly hours' }, 400);
      if (!isValidOverrides(body.overrides)) return json({ error: 'Invalid date overrides' }, 400);

      const patch: Record<string, unknown> = { availability: body.availability, overrides: body.overrides };
      if (typeof body.timeZone === 'string' && body.timeZone) patch.timeZone = body.timeZone;

      try {
         // Make sure the schedule belongs to this host's account before writing to it.
         const owned = await calFetch(host.apiKey, '/schedules', SCHEDULES_VERSION);
         if (!(owned?.data ?? []).some((s: { id: number }) => s.id === scheduleId)) return json({ error: 'Schedule not found' }, 404);

         const updated = await calFetch(host.apiKey, `/schedules/${scheduleId}`, SCHEDULES_VERSION, {
            method: 'PATCH',
            body: JSON.stringify(patch)
         });

         await admin.from('admin_audit_logs').insert({
            actor_user_id: callerId,
            action: 'calendar_schedule_update',
            target_table: 'calcom_schedule',
            metadata: { host: host.id, scheduleId, ...patch }
         });

         return json({ schedule: updated?.data ?? null });
      } catch (err) {
         console.error(`admin-calendar: update failed for ${host.id}`, err);
         return json({ error: err instanceof Error ? err.message : 'Cal.com update failed' }, 502);
      }
   }

   return json({ error: 'Unknown action' }, 400);
});
