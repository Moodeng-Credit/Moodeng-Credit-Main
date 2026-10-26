// Pure helpers for the free round-robin booking service, split out so they're unit-testable
// without the network/edge-runtime. The edge function reads each host's open slots from the
// Cal.com API and uses these to present ONE combined, anonymous "Moodeng team" time list and to
// decide which host to book — no paid Teams round-robin, no host shown to the borrower.

// Union of every host's available start times: unique, sorted ascending. Slots are ISO strings
// with an offset (e.g. 2026-09-22T19:00:00.000+07:00); we de-dupe by the actual instant so two
// hosts free at the same moment collapse to one entry regardless of string formatting.
export const mergeSlots = (perHost: string[][]): string[] => {
   const byInstant = new Map<number, string>();
   for (const slots of perHost) {
      for (const s of slots) {
         const t = Date.parse(s);
         if (!Number.isNaN(t) && !byInstant.has(t)) byInstant.set(t, s);
      }
   }
   return [...byInstant.entries()].sort((a, b) => a[0] - b[0]).map(([, s]) => s);
};

// Which hosts have `start` open, compared by instant (not string) so a re-fetch's formatting can't
// cause a false miss.
export const hostsFreeAt = (start: string, perHost: Record<string, string[]>): string[] => {
   const t = Date.parse(start);
   return Object.entries(perHost)
      .filter(([, slots]) => slots.some((s) => Date.parse(s) === t))
      .map(([id]) => id);
};

// Deterministic pick from the free hosts, seeded by borrower + slot so the spread is even across
// borrowers but stable for a given borrower/slot (no flip-flop on retry). Returns the hosts in the
// order to try — preferred first, then the rest as fallbacks if the first booking races and loses.
export const orderHostsToTry = (freeHosts: string[], seed: string): string[] => {
   if (freeHosts.length <= 1) return [...freeHosts];
   let hash = 0;
   for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
   const start = hash % freeHosts.length;
   return freeHosts.map((_, i) => freeHosts[(start + i) % freeHosts.length]);
};

// Everyone on the team who isn't hosting joins as a Cal.com guest, so the invite (with the join
// link) lands on every cofounder's calendar — not just the round-robin host's. Case-insensitive
// de-dupe; never the host themself or the borrower.
export const teamGuests = (hostId: string, emailsByHost: Record<string, string | null>, attendeeEmail: string): string[] => {
   const skip = new Set([attendeeEmail.toLowerCase(), (emailsByHost[hostId] ?? '').toLowerCase()]);
   const out: string[] = [];
   for (const [id, email] of Object.entries(emailsByHost)) {
      const e = email?.trim().toLowerCase();
      if (id === hostId || !e || skip.has(e)) continue;
      skip.add(e);
      out.push(e);
   }
   return out;
};

// Soonest-first slot offer. Calls booked inside ~a day get far fewer no-shows, and they're the only
// ones our Messenger reminders can reach (Messenger allows free messages for 24h after the
// borrower's last interaction, which is the verify tap just before booking). So when there are at
// least `minCount` open times within `windowHours`, offer only those; otherwise fall back to the
// full list so a quiet weekend never leaves a borrower with nothing to pick.
export const preferSoonSlots = (slots: string[], now: number, windowHours = 22, minCount = 3): string[] => {
   const cutoff = now + windowHours * 60 * 60 * 1000;
   const soon = slots.filter((s) => {
      const t = Date.parse(s);
      return !Number.isNaN(t) && t > now && t <= cutoff;
   });
   return soon.length >= minCount ? soon : slots;
};

// Date range for re-checking one slot right before booking. Cal.com reads date-only bounds in the
// borrower's time zone, so the slot's UTC date alone can miss it (7:00 AM Manila is the previous
// day in UTC). A day either side covers every zone on Earth (±14h).
export const recheckRange = (start: string): { from: string; to: string } => {
   const t = Date.parse(start);
   const day = 86400000;
   return { from: new Date(t - day).toISOString().slice(0, 10), to: new Date(t + 2 * day).toISOString().slice(0, 10) };
};

// Two strikes: after NO_SHOW_STRIKES recorded no-shows, a borrower can't book again until
// COOLDOWN_DAYS after the latest one (each further no-show restarts the wait). Returns the ISO time
// they can book again, or null when they can book now.
export const NO_SHOW_STRIKES = 2;
export const COOLDOWN_DAYS = 7;
export const bookingCooldownUntil = (noShowAtIsos: Array<string | null>, now: number): string | null => {
   const times = noShowAtIsos.map((iso) => (iso ? Date.parse(iso) : NaN)).filter((t) => !Number.isNaN(t));
   if (times.length < NO_SHOW_STRIKES) return null;
   const until = Math.max(...times) + COOLDOWN_DAYS * 86400000;
   return until > now ? new Date(until).toISOString() : null;
};

// Emma's Calendly is where she keeps her hours; Cal.com (which actually takes the bookings) gets a
// copy every day. Calendly's default availability schedule is a list of rules — 'wday' rules are the
// weekly hours, 'date' rules are one-off days (no intervals = off that day) — and this turns them
// into the body for Cal.com's PATCH /v2/schedules/{id}. Past one-off days are dropped.
export type CalendlyRule = { type: string; wday?: string; date?: string; intervals?: Array<{ from: string; to: string }> };
export type CalSchedule = {
   timeZone: string;
   availability: Array<{ days: string[]; startTime: string; endTime: string }>;
   overrides: Array<{ date: string; startTime: string; endTime: string }>;
};
const calTime = (hhmm: string) => (hhmm === '24:00' ? '23:59' : hhmm);
const capitalize = (day: string) => day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
export const calendlyToCalSchedule = (rules: CalendlyRule[], timeZone: string, today: string): CalSchedule => {
   const daysByWindow = new Map<string, string[]>();
   const overrides: CalSchedule['overrides'] = [];
   for (const rule of rules) {
      const intervals = rule.intervals ?? [];
      if (rule.type === 'wday' && rule.wday) {
         for (const iv of intervals) {
            const key = `${calTime(iv.from)}-${calTime(iv.to)}`;
            daysByWindow.set(key, [...(daysByWindow.get(key) ?? []), capitalize(rule.wday)]);
         }
      } else if (rule.type === 'date' && rule.date && rule.date >= today) {
         if (intervals.length === 0) overrides.push({ date: rule.date, startTime: '00:00', endTime: '00:00' });
         for (const iv of intervals) overrides.push({ date: rule.date, startTime: calTime(iv.from), endTime: calTime(iv.to) });
      }
   }
   const availability = [...daysByWindow.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, days]) => {
         const [startTime, endTime] = key.split('-');
         return { days, startTime, endTime };
      });
   return { timeZone, availability, overrides };
};

// George is invited to every call, so a slot that overlaps anything on his Google Calendar isn't offered.
export const dropBusySlots = (slots: string[], busy: Array<{ start: string; end: string }>, callMinutes: number): string[] =>
   slots.filter((s) => {
      const from = Date.parse(s);
      const to = from + callMinutes * 60000;
      return !busy.some((b) => from < Date.parse(b.end) && to > Date.parse(b.start));
   });
