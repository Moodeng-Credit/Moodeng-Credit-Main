// Daily copy of each host's Calendly hours onto the Cal.com schedule their call event uses, so they
// only ever edit Calendly (Emma since 2026-10-27, George since 2026-10-29). Run by pg_cron (calcom-round-robin { action: 'sync_calendly_hours' }); pass
// dryRun to see the current and new schedule without changing anything.
import { CAL_BASE, hostApiKey, resolveEventTypeId } from '../_shared/calcomSlots.ts';
import { readCallSecret } from '../_shared/callSecrets.ts';
import { postDiscord } from '../_shared/discord.ts';
import { calendlyToCalSchedule, type CalendlyRule } from './lib.ts';

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

/** Both hosts, one after the other (the nightly pg_cron job). */
// deno-lint-ignore no-explicit-any
export const syncAllCalendlyHours = async (svc: any, dryRun = false) => {
   const emma = await syncCalendlyHours(svc, 'emma', dryRun);
   const george = await syncCalendlyHours(svc, 'george', dryRun);
   return { ok: emma.ok && george.ok, emma, george };
};
