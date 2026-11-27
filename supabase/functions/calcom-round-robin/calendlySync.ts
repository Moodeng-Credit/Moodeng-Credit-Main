// Daily copy of each host's Calendly hours onto the Cal.com schedule their call event uses, so they
// only ever edit Calendly (Emma since 2026-10-27). George keeps his hours in Cal.com itself since
// 2026-11-15 ("i want to keep my hours in cal"), so his schedule is never overwritten. Run by pg_cron (calcom-round-robin { action: 'sync_calendly_hours' }); pass
// dryRun to see the current and new schedule without changing anything.
import { CAL_BASE, hostApiKey, resolveEventTypeId } from '../_shared/calcomSlots.ts';
import { readCallSecret } from '../_shared/callSecrets.ts';
import { postDiscord } from '../_shared/discord.ts';
import { loadCallBlocks } from '../_shared/callBooking.ts';
import { blockedDays, calendlyToCalSchedule, clipToCallDay, type CalendlyRule } from './lib.ts';

const CALENDLY_BASE = 'https://api.calendly.com';

export type SyncHost = 'emma' | 'george';
const CALENDLY_TOKEN: Record<SyncHost, string> = { emma: 'CALENDLY_EMMA_TOKEN', george: 'CALENDLY_GEORGE_TOKEN' };
const NAME: Record<SyncHost, string> = { emma: 'Emma', george: 'George' };

type SyncResult = { ok: boolean; error?: string; scheduleId?: number; current?: unknown; next?: unknown };

const getJson = async (url: string, headers: Record<string, string>) => {
   const res = await fetch(url, { headers });
   return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
};

// deno-lint-ignore no-explicit-any
const run = async (svc: any, dryRun: boolean, host: SyncHost): Promise<SyncResult> => {
   const token = await readCallSecret(svc, CALENDLY_TOKEN[host]);
   const calKey = hostApiKey(host);
   if (!token || !calKey) return { ok: false, error: 'not_configured' };

   const calendly = { Authorization: `Bearer ${token}` };
   const me = await getJson(`${CALENDLY_BASE}/users/me`, calendly);
   const userUri = me.body?.resource?.uri;
   if (!userUri) return { ok: false, error: `calendly_me_${me.status}` };
   // The hours of the host's bookable call event (its own schedule when it has one — George's
   // "Video Interview" does), else their default schedule.
   const types = await getJson(`${CALENDLY_BASE}/event_types?active=true&user=${encodeURIComponent(userUri)}`, calendly);
   const typeList = (types.body?.collection ?? []) as Array<{ uri?: string; duration?: number }>;
   const callType = typeList.find((t) => Number(t.duration) === 15) ?? typeList[0];
   let source: { timezone?: string; rules?: CalendlyRule[] } | undefined;
   if (callType?.uri) {
      const own = await getJson(`${CALENDLY_BASE}/event_type_availability_schedules?event_type=${encodeURIComponent(callType.uri)}`, calendly);
      source = own.body?.collection?.[0]?.availability_rule;
   }
   if (!source?.rules?.length) {
      const schedules = await getJson(`${CALENDLY_BASE}/user_availability_schedules?user=${encodeURIComponent(userUri)}`, calendly);
      const list = (schedules.body?.collection ?? []) as Array<{ default?: boolean; timezone?: string; rules?: CalendlyRule[] }>;
      source = list.find((s) => s.default) ?? list[0];
      if (!source?.rules?.length) return { ok: false, error: `calendly_schedule_${schedules.status}` };
   }

   // The schedule the host's call event uses — its own, or their default when it has none.
   const eventTypeId = await resolveEventTypeId(calKey);
   if (!eventTypeId) {
      // Say why — a dead key here also means this host's slots silently disappear.
      const probe = await getJson(`${CAL_BASE}/me`, { Authorization: `Bearer ${calKey}` });
      return { ok: false, error: `cal_event_type (Cal.com /me ${probe.status}: ${String(probe.body?.error?.message ?? probe.body?.message ?? '').slice(0, 120)})` };
   }
   const cal = (version: string) => ({ Authorization: `Bearer ${calKey}`, 'cal-api-version': version });
   const eventType = await getJson(`${CAL_BASE}/event-types/${eventTypeId}`, cal('2024-06-14'));
   let scheduleId = eventType.body?.data?.scheduleId as number | null | undefined;
   if (!scheduleId) scheduleId = (await getJson(`${CAL_BASE}/schedules/default`, cal('2024-06-11'))).body?.data?.id;
   if (!scheduleId) return { ok: false, error: 'cal_schedule' };

   const today = new Date().toLocaleDateString('en-CA', { timeZone: source.timezone || 'Asia/Bangkok' });
   const next = calendlyToCalSchedule(source.rules, source.timezone || 'Asia/Bangkok', today);
   // Time off (call_blocks): whole days blocked for this host are closed on Cal.com too, so Cal.com's own
   // reschedule page can't put a call there (our slot list already hides them).
   const closed = blockedDays(await loadCallBlocks(svc), host, next.timeZone);
   if (closed.length) {
      next.overrides = [...next.overrides.filter((o) => !closed.includes(o.date)), ...closed.map((date) => ({ date, startTime: '00:00', endTime: '00:00' }))];
   }
   const current = (await getJson(`${CAL_BASE}/schedules/${scheduleId}`, cal('2024-06-11'))).body?.data;
   if (dryRun) return { ok: true, scheduleId, current, next };

   const res = await fetch(`${CAL_BASE}/schedules/${scheduleId}`, {
      method: 'PATCH',
      headers: { ...cal('2024-06-11'), 'Content-Type': 'application/json' },
      body: JSON.stringify(next)
   });
   if (!res.ok) return { ok: false, error: `cal_patch_${res.status}: ${(await res.text()).slice(0, 200)}` };
   return { ok: true, scheduleId, next };
};

// deno-lint-ignore no-explicit-any
export const syncCalendlyHours = async (svc: any, host: SyncHost, dryRun = false): Promise<SyncResult> => {
   let result: SyncResult;
   try {
      result = await run(svc, dryRun, host);
   } catch (err) {
      result = { ok: false, error: String(err) };
   }
   // A silently dead sync means borrowers book a host when they're away — say so where the team looks.
   if (!result.ok && !dryRun) {
      console.error(`calendlySync (${host}): failed`, result.error);
      await postDiscord({ content: `⚠️ ${NAME[host]}'s Calendly → Cal.com hours sync failed: ${result.error}` });
   }
   return result;
};

/** Emma only (the nightly pg_cron job). George sets his hours directly in Cal.com. */
// deno-lint-ignore no-explicit-any
export const syncAllCalendlyHours = async (svc: any, dryRun = false) => {
   const emma = await syncCalendlyHours(svc, 'emma', dryRun);
   return { ok: emma.ok, emma, george: { ok: true, skipped: 'hours kept in Cal.com' } };
};


/**
 * One-off date overrides on a host's Cal.com schedule (admin: { action: 'cal_overrides', host,
 * overrides: [{date:'YYYY-MM-DD', startTime:'HH:MM', endTime:'HH:MM'}], dryRun }). Replaces any
 * override on the same dates; '00:00'–'00:00' = closed all day. Use for George (Emma's schedule is
 * rewritten nightly from Calendly — block her with call_blocks instead).
 */
// deno-lint-ignore no-explicit-any
export const setHostDateOverrides = async (host: SyncHost, overrides: Array<{ date: string; startTime: string; endTime: string }>, dryRun = false) => {
   const calKey = hostApiKey(host);
   if (!calKey) return { ok: false, error: 'not_configured' };
   const eventTypeId = await resolveEventTypeId(calKey);
   if (!eventTypeId) return { ok: false, error: 'cal_event_type' };
   const cal = (version: string) => ({ Authorization: `Bearer ${calKey}`, 'cal-api-version': version });
   const eventType = await getJson(`${CAL_BASE}/event-types/${eventTypeId}`, cal('2024-06-14'));
   let scheduleId = eventType.body?.data?.scheduleId as number | null | undefined;
   if (!scheduleId) scheduleId = (await getJson(`${CAL_BASE}/schedules/default`, cal('2024-06-11'))).body?.data?.id;
   if (!scheduleId) return { ok: false, error: 'cal_schedule' };
   const current = (await getJson(`${CAL_BASE}/schedules/${scheduleId}`, cal('2024-06-11'))).body?.data;
   const dates = new Set(overrides.map((o) => o.date));
   const kept = ((current?.overrides ?? []) as Array<{ date: string; startTime: string; endTime: string }>).filter((o) => !dates.has(o.date));
   const next = [...kept, ...overrides].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
   if (dryRun) return { ok: true, scheduleId, timeZone: current?.timeZone, current: current?.overrides, next };
   const res = await fetch(`${CAL_BASE}/schedules/${scheduleId}`, {
      method: 'PATCH',
      headers: { ...cal('2024-06-11'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides: next })
   });
   if (!res.ok) return { ok: false, error: `cal_patch_${res.status}: ${(await res.text()).slice(0, 200)}` };
   const after = (await getJson(`${CAL_BASE}/schedules/${scheduleId}`, cal('2024-06-11'))).body?.data;
   return { ok: true, scheduleId, timeZone: after?.timeZone, overrides: after?.overrides };
};


const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * George's WEEKLY hours on his Cal.com schedule (admin: { action: 'cal_weekly', host: 'george',
 * availability: [{days:['Monday',…], startTime:'HH:MM', endTime:'HH:MM'}], dryRun }). Replaces the whole
 * weekly list, keeps date overrides. Times are clipped to the 11 AM–11 PM call day. Not for Emma: her
 * schedule is rewritten nightly from Calendly.
 */
export const setHostWeeklyHours = async (host: SyncHost, availability: Array<{ days: string[]; startTime: string; endTime: string }>, dryRun = false) => {
   if (host !== 'george') return { ok: false, error: 'george_only' };
   const clean: Array<{ days: string[]; startTime: string; endTime: string }> = [];
   for (const a of availability) {
      const days = (Array.isArray(a?.days) ? a.days : []).filter((d) => WEEKDAYS.includes(d));
      const ok = /^\d\d:\d\d$/.test(String(a?.startTime)) && /^\d\d:\d\d$/.test(String(a?.endTime));
      const window = ok ? clipToCallDay(a.startTime, a.endTime) : null;
      if (!days.length || !window) return { ok: false, error: `bad_window ${JSON.stringify(a)}` };
      clean.push({ days, ...window });
   }
   if (!clean.length) return { ok: false, error: 'empty' };
   const calKey = hostApiKey(host);
   if (!calKey) return { ok: false, error: 'not_configured' };
   const eventTypeId = await resolveEventTypeId(calKey);
   if (!eventTypeId) return { ok: false, error: 'cal_event_type' };
   const cal = (version: string) => ({ Authorization: `Bearer ${calKey}`, 'cal-api-version': version });
   const eventType = await getJson(`${CAL_BASE}/event-types/${eventTypeId}`, cal('2024-06-14'));
   let scheduleId = eventType.body?.data?.scheduleId as number | null | undefined;
   if (!scheduleId) scheduleId = (await getJson(`${CAL_BASE}/schedules/default`, cal('2024-06-11'))).body?.data?.id;
   if (!scheduleId) return { ok: false, error: 'cal_schedule' };
   const current = (await getJson(`${CAL_BASE}/schedules/${scheduleId}`, cal('2024-06-11'))).body?.data;
   if (dryRun) return { ok: true, scheduleId, timeZone: current?.timeZone, current: current?.availability, next: clean };
   const res = await fetch(`${CAL_BASE}/schedules/${scheduleId}`, {
      method: 'PATCH',
      headers: { ...cal('2024-06-11'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ availability: clean })
   });
   if (!res.ok) return { ok: false, error: `cal_patch_${res.status}: ${(await res.text()).slice(0, 200)}` };
   const after = (await getJson(`${CAL_BASE}/schedules/${scheduleId}`, cal('2024-06-11'))).body?.data;
   return { ok: true, scheduleId, timeZone: after?.timeZone, availability: after?.availability, overrides: after?.overrides };
};
