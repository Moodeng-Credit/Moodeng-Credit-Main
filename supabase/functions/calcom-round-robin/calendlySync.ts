// Daily copy of Emma's Calendly hours onto the Cal.com schedule her call event uses, so she only
// ever edits Calendly. Run by pg_cron (calcom-round-robin { action: 'sync_calendly_hours' }); pass
// dryRun to see the current and new schedule without changing anything.
import { CAL_BASE, hostApiKey, resolveEventTypeId } from '../_shared/calcomSlots.ts';
import { readCallSecret } from '../_shared/callSecrets.ts';
import { postDiscord } from '../_shared/discord.ts';
import { calendlyToCalSchedule, type CalendlyRule } from './lib.ts';

const CALENDLY_BASE = 'https://api.calendly.com';

type SyncResult = { ok: boolean; error?: string; scheduleId?: number; current?: unknown; next?: unknown };

const getJson = async (url: string, headers: Record<string, string>) => {
   const res = await fetch(url, { headers });
   return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
};

// deno-lint-ignore no-explicit-any
const run = async (svc: any, dryRun: boolean): Promise<SyncResult> => {
   const token = await readCallSecret(svc, 'CALENDLY_EMMA_TOKEN');
   const calKey = hostApiKey('emma');
   if (!token || !calKey) return { ok: false, error: 'not_configured' };

   const calendly = { Authorization: `Bearer ${token}` };
   const me = await getJson(`${CALENDLY_BASE}/users/me`, calendly);
   const userUri = me.body?.resource?.uri;
   if (!userUri) return { ok: false, error: `calendly_me_${me.status}` };
   const schedules = await getJson(`${CALENDLY_BASE}/user_availability_schedules?user=${encodeURIComponent(userUri)}`, calendly);
   const list = (schedules.body?.collection ?? []) as Array<{ default?: boolean; timezone?: string; rules?: CalendlyRule[] }>;
   const source = list.find((s) => s.default) ?? list[0];
   if (!source?.rules?.length) return { ok: false, error: `calendly_schedule_${schedules.status}` };

   // The schedule Emma's call event uses — its own, or her default when it has none.
   const eventTypeId = await resolveEventTypeId(calKey);
   if (!eventTypeId) {
      // Say why — a dead key here also means Emma's calls silently fall back to George's calendar.
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
export const syncEmmaCalendlyHours = async (svc: any, dryRun = false): Promise<SyncResult> => {
   let result: SyncResult;
   try {
      result = await run(svc, dryRun);
   } catch (err) {
      result = { ok: false, error: String(err) };
   }
   // A silently dead sync means borrowers book Emma when she's away — say so where the team looks.
   if (!result.ok && !dryRun) {
      console.error('calendlySync: failed', result.error);
      await postDiscord({ content: `⚠️ Emma's Calendly → Cal.com hours sync failed: ${result.error}` });
   }
   return result;
};
