'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
   type AdminCalendarBooking,
   type AdminCalendarHost,
   getAdminCalendar,
   updateAdminCalendarSchedule
} from '@/app/admin/adminSupabase';
import {
   addDays,
   type CalSchedule,
   type DateOverrides,
   formatTime,
   fromDateOverrides,
   fromWeekHours,
   hoursOn,
   mondayOf,
   TIME_OPTIONS,
   type TimeRange,
   toDateOverrides,
   toMinutes,
   toWeekHours,
   weekDates,
   WEEKDAYS,
   type WeekHours,
   weekProblem,
   zonedParts
} from '@/app/admin/calendarModel';
import { CALCOM_EMBED_ORIGIN, VIDEO_CALL_HOSTS } from '@/config/contactVerification';

// Admin Calendar — see and change the team's Cal.com hours without leaving the admin panel.
// The week grid shows open hours (shaded) and booked calls; the editors below change the weekly
// hours and one-off dates, saved straight to Cal.com through the admin-calendar edge function.
// Whatever is saved here is exactly what borrowers can book in the video-call step.

const HOUR_PX = 44;
const BROWSER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

interface Draft {
   timeZone: string;
   week: WeekHours;
   overrides: DateOverrides;
}

const draftFrom = (schedule: CalSchedule): Draft => ({
   timeZone: schedule.timeZone,
   week: toWeekHours(schedule.availability),
   overrides: toDateOverrides(schedule.overrides)
});

const draftSignature = (draft: Draft) =>
   JSON.stringify({ tz: draft.timeZone, a: fromWeekHours(draft.week), o: fromDateOverrides(draft.overrides) });

const hostName = (id: string) => VIDEO_CALL_HOSTS[id as keyof typeof VIDEO_CALL_HOSTS]?.name ?? id;
const hostPhoto = (id: string) => VIDEO_CALL_HOSTS[id as keyof typeof VIDEO_CALL_HOSTS]?.photo;

const allTimeZones = (current: string): string[] => {
   const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
   return supported.includes(current) ? supported : [current, ...supported];
};

const formatDayHeader = (ymd: string) =>
   new Date(`${ymd}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', timeZone: 'UTC' });

const formatLongDate = (ymd: string) =>
   new Date(`${ymd}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });

const formatBookingTime = (iso: string, timeZone: string) =>
   new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone
   });

function TimeSelect({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
   return (
      <select
         aria-label={label}
         value={value}
         onChange={(event) => onChange(event.target.value)}
         className="h-9 rounded-lg border border-[#3d1f6e] bg-[#241044] px-2 text-sm font-bold text-white"
      >
         {(TIME_OPTIONS.includes(value) ? TIME_OPTIONS : [value, ...TIME_OPTIONS]).map((time) => (
            <option key={time} value={time}>
               {formatTime(time)}
            </option>
         ))}
      </select>
   );
}

function RangeRow({ range, onChange, onRemove }: { range: TimeRange; onChange: (range: TimeRange) => void; onRemove: () => void }) {
   return (
      <div className="flex items-center gap-2">
         <TimeSelect label="Start" value={range.start} onChange={(start) => onChange({ ...range, start })} />
         <span className="text-[#a89bb8]">–</span>
         <TimeSelect label="End" value={range.end} onChange={(end) => onChange({ ...range, end })} />
         <button
            type="button"
            onClick={onRemove}
            aria-label="Remove hours"
            className="grid h-9 w-9 place-items-center rounded-lg text-lg text-[#a89bb8] hover:bg-[#2a1453] hover:text-white"
         >
            ×
         </button>
      </div>
   );
}

export default function CalendarSection() {
   const [hosts, setHosts] = useState<AdminCalendarHost[] | null>(null);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [notice, setNotice] = useState<string | null>(null);
   const [saving, setSaving] = useState(false);

   const [hostId, setHostId] = useState<string>('');
   const [scheduleId, setScheduleId] = useState<number | null>(null);
   const [monday, setMonday] = useState(() => mondayOf(zonedParts(new Date(), BROWSER_TZ).ymd));
   const [draft, setDraft] = useState<Draft | null>(null);
   const [draftKey, setDraftKey] = useState('');
   const [selectedBooking, setSelectedBooking] = useState<AdminCalendarBooking | null>(null);

   const [newOverrideDate, setNewOverrideDate] = useState('');
   const [newOverrideOff, setNewOverrideOff] = useState(true);
   const [newOverrideRange, setNewOverrideRange] = useState<TimeRange>({ start: '09:00', end: '17:00' });

   const load = useCallback(async (weekMonday: string) => {
      setLoading(true);
      setError(null);
      try {
         // A day of padding either side so every time zone's view of the week is covered.
         const from = new Date(`${addDays(weekMonday, -1)}T00:00:00Z`);
         const to = new Date(`${addDays(weekMonday, 8)}T00:00:00Z`);
         setHosts(await getAdminCalendar(from, to));
      } catch (caught) {
         setError(caught instanceof Error ? caught.message : 'Could not load the calendar.');
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      void load(monday);
   }, [load, monday]);

   const host = hosts?.find((h) => h.id === hostId) ?? hosts?.[0] ?? null;
   const schedule =
      host?.schedules.find((s) => s.id === scheduleId) ?? host?.schedules.find((s) => s.isDefault) ?? host?.schedules[0] ?? null;

   // Reset the editor only when switching host/schedule — not on week navigation, so unsaved edits survive.
   const scheduleKey = host && schedule ? `${host.id}:${schedule.id}` : '';
   useEffect(() => {
      if (schedule && scheduleKey !== draftKey) {
         setDraft(draftFrom(schedule));
         setDraftKey(scheduleKey);
      }
   }, [schedule, scheduleKey, draftKey]);

   const timeZone = draft?.timeZone ?? schedule?.timeZone ?? BROWSER_TZ;
   const today = zonedParts(new Date(), timeZone).ymd;
   const days = useMemo(() => weekDates(monday), [monday]);
   const dirty = Boolean(draft && schedule && draftSignature(draft) !== draftSignature(draftFrom(schedule)));
   const problem = draft ? weekProblem(draft.week, draft.overrides) : null;

   // Bookings placed on this week's grid, in the schedule's time zone.
   const placedBookings = useMemo(() => {
      if (!host) return [];
      return host.bookings
         .map((booking) => {
            const start = zonedParts(booking.start, timeZone);
            const end = zonedParts(booking.end, timeZone);
            return { booking, ymd: start.ymd, startMin: start.minutes, endMin: end.ymd === start.ymd ? end.minutes : 24 * 60 };
         })
         .filter((b) => days.includes(b.ymd));
   }, [host, timeZone, days]);

   // Visible hours: 8am–8pm by default, stretched to fit any open hours or bookings this week.
   const [gridStart, gridEnd] = useMemo(() => {
      let lo = 8 * 60;
      let hi = 20 * 60;
      if (draft) {
         for (const ymd of days) {
            for (const r of hoursOn(ymd, draft.week, draft.overrides).ranges) {
               lo = Math.min(lo, toMinutes(r.start));
               hi = Math.max(hi, toMinutes(r.end));
            }
         }
      }
      for (const b of placedBookings) {
         lo = Math.min(lo, b.startMin);
         hi = Math.max(hi, b.endMin);
      }
      return [Math.floor(lo / 60), Math.min(24, Math.ceil(hi / 60))];
   }, [draft, days, placedBookings]);

   const updateWeek = (day: (typeof WEEKDAYS)[number], ranges: TimeRange[]) =>
      setDraft((current) => (current ? { ...current, week: { ...current.week, [day]: ranges } } : current));

   const updateOverride = (ymd: string, value: DateOverrides[string] | null) =>
      setDraft((current) => {
         if (!current) return current;
         const overrides = { ...current.overrides };
         if (value === null) delete overrides[ymd];
         else overrides[ymd] = value;
         return { ...current, overrides };
      });

   const addOverride = () => {
      if (!newOverrideDate) return;
      updateOverride(newOverrideDate, newOverrideOff ? 'off' : [newOverrideRange]);
      setNewOverrideDate('');
   };

   const save = async () => {
      if (!host || !schedule || !draft || problem) return;
      setSaving(true);
      setError(null);
      setNotice(null);
      try {
         await updateAdminCalendarSchedule({
            host: host.id,
            scheduleId: schedule.id,
            timeZone: draft.timeZone,
            availability: fromWeekHours(draft.week),
            overrides: fromDateOverrides(draft.overrides)
         });
         setDraftKey(''); // re-seed the editor from what Cal.com saved
         await load(monday);
         setNotice(`Saved to ${hostName(host.id)}'s Cal.com — borrowers now see these hours.`);
      } catch (caught) {
         setError(caught instanceof Error ? caught.message : 'Could not save to Cal.com.');
      } finally {
         setSaving(false);
      }
   };

   const upcomingOverrides = draft
      ? Object.keys(draft.overrides)
           .filter((d) => d >= today)
           .sort()
      : [];
   const pastOverrideCount = draft ? Object.keys(draft.overrides).length - upcomingOverrides.length : 0;
   const nowMinutes = zonedParts(new Date(), timeZone).minutes;

   return (
      <section className="space-y-6">
         <div>
            <h2 className="break-words text-4xl font-black sm:text-5xl">Calendar</h2>
            <p className="mt-3 max-w-3xl text-2xl text-[#a89bb8]">
               Your Cal.com hours and booked calls. Changes save straight to Cal.com and are what borrowers can book.
            </p>
         </div>

         {error ? <div className="rounded-2xl border border-red-900 bg-red-950/60 p-4 text-lg font-bold text-red-300">{error}</div> : null}
         {notice ? (
            <div className="rounded-2xl border border-emerald-900 bg-emerald-950/60 p-4 text-lg font-bold text-emerald-300">{notice}</div>
         ) : null}

         {!hosts && loading ? <p className="text-lg text-[#a89bb8]">Loading Cal.com…</p> : null}
         {hosts && hosts.length === 0 ? (
            <p className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5 text-lg text-[#a89bb8]">
               No Cal.com hosts are configured. Set CALCOM_API_KEY_GEORGE / CALCOM_API_KEY_EMMA on the edge functions.
            </p>
         ) : null}

         {host ? (
            <>
               {/* ---- Toolbar: host, schedule, week ---------------------------------------------------- */}
               <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-3">
                  <div className="flex overflow-hidden rounded-xl border border-[#3d1f6e]">
                     {hosts?.map((h) => (
                        <button
                           key={h.id}
                           type="button"
                           onClick={() => {
                              if (dirty && !window.confirm('Discard unsaved changes?')) return;
                              setHostId(h.id);
                              setScheduleId(null);
                              setSelectedBooking(null);
                           }}
                           className={`flex items-center gap-2 px-4 py-2 text-base font-black ${h.id === host.id ? 'bg-[#8336f0] text-white' : 'bg-[#241044] text-[#a89bb8] hover:text-white'}`}
                        >
                           {hostPhoto(h.id) ? <img src={hostPhoto(h.id)} alt="" className="h-6 w-6 rounded-full object-cover" /> : null}
                           {hostName(h.id)}
                        </button>
                     ))}
                  </div>

                  {host.schedules.length > 1 ? (
                     <select
                        aria-label="Schedule"
                        value={schedule?.id ?? ''}
                        onChange={(event) => {
                           if (dirty && !window.confirm('Discard unsaved changes?')) return;
                           setScheduleId(Number(event.target.value));
                        }}
                        className="h-10 rounded-xl border border-[#3d1f6e] bg-[#241044] px-3 text-base font-bold text-white"
                     >
                        {host.schedules.map((s) => (
                           <option key={s.id} value={s.id}>
                              {s.name}
                              {s.isDefault ? ' (default)' : ''}
                           </option>
                        ))}
                     </select>
                  ) : null}

                  <div className="ml-auto flex items-center gap-1">
                     <button
                        type="button"
                        onClick={() => setMonday(addDays(monday, -7))}
                        aria-label="Previous week"
                        className="grid h-10 w-10 place-items-center rounded-xl text-xl font-black text-[#a89bb8] hover:bg-[#2a1453] hover:text-white"
                     >
                        ‹
                     </button>
                     <button
                        type="button"
                        onClick={() => setMonday(mondayOf(today))}
                        className="h-10 rounded-xl border border-[#3d1f6e] px-4 text-sm font-black text-white hover:bg-[#2a1453]"
                     >
                        This week
                     </button>
                     <button
                        type="button"
                        onClick={() => setMonday(addDays(monday, 7))}
                        aria-label="Next week"
                        className="grid h-10 w-10 place-items-center rounded-xl text-xl font-black text-[#a89bb8] hover:bg-[#2a1453] hover:text-white"
                     >
                        ›
                     </button>
                     <span className="ml-2 hidden text-sm font-bold text-[#a89bb8] sm:inline">
                        {formatLongDate(days[0])} – {formatLongDate(days[6])}
                        {loading ? ' · loading…' : ''}
                     </span>
                  </div>
               </div>

               {host.error ? (
                  <div className="rounded-2xl border border-amber-900 bg-amber-950/60 p-4 text-lg font-bold text-amber-300">
                     Cal.com error for {hostName(host.id)}: {host.error}
                  </div>
               ) : null}

               {/* ---- Week grid ------------------------------------------------------------------------ */}
               {draft ? (
                  <div className="overflow-x-auto rounded-2xl border border-[#2a1453] bg-[#1c0a3a]">
                     <div className="min-w-[760px]">
                        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-[#2a1453]">
                           <div className="p-2 text-[10px] font-bold uppercase text-[#a89bb8]">
                              {timeZone.split('/').pop()?.replace(/_/g, ' ')}
                           </div>
                           {days.map((ymd) => {
                              const { overridden, off } = hoursOn(ymd, draft.week, draft.overrides);
                              const isPast = ymd < today;
                              return (
                                 <div key={ymd} className={`border-l border-[#2a1453] p-2 ${ymd === today ? 'bg-[#2a1453]' : ''}`}>
                                    <p className={`text-sm font-black ${isPast ? 'text-[#6f6288]' : 'text-white'}`}>
                                       {formatDayHeader(ymd)}
                                    </p>
                                    {!isPast ? (
                                       <button
                                          type="button"
                                          onClick={() => updateOverride(ymd, overridden ? null : 'off')}
                                          className={`mt-1 rounded-md px-2 py-0.5 text-[11px] font-black ${overridden ? 'bg-amber-900/60 text-amber-200 hover:bg-amber-900' : 'text-[#a89bb8] hover:bg-[#2a1453] hover:text-white'}`}
                                          title={overridden ? 'Go back to the usual weekly hours for this date' : 'Block this whole date'}
                                       >
                                          {off ? 'Day off · undo' : overridden ? 'Custom · reset' : 'Take day off'}
                                       </button>
                                    ) : null}
                                 </div>
                              );
                           })}
                        </div>

                        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
                           <div className="relative" style={{ height: (gridEnd - gridStart) * HOUR_PX }}>
                              {Array.from({ length: gridEnd - gridStart }, (_, i) => (
                                 <span
                                    key={i}
                                    className="absolute right-2 -translate-y-1/2 text-[10px] font-bold text-[#a89bb8]"
                                    style={{ top: i * HOUR_PX }}
                                 >
                                    {i === 0 ? '' : formatTime(`${String(gridStart + i).padStart(2, '0')}:00`)}
                                 </span>
                              ))}
                           </div>
                           {days.map((ymd) => {
                              const { ranges, off } = hoursOn(ymd, draft.week, draft.overrides);
                              const toY = (minutes: number) => ((minutes - gridStart * 60) / 60) * HOUR_PX;
                              return (
                                 <div
                                    key={ymd}
                                    className={`relative border-l border-[#2a1453] ${ymd < today ? 'opacity-50' : ''}`}
                                    style={{
                                       height: (gridEnd - gridStart) * HOUR_PX,
                                       backgroundImage: off
                                          ? 'repeating-linear-gradient(135deg, rgba(168,155,184,0.08) 0 8px, transparent 8px 16px)'
                                          : `repeating-linear-gradient(to bottom, rgba(61,31,110,0.5) 0 1px, transparent 1px ${HOUR_PX}px)`
                                    }}
                                 >
                                    {ranges.map((r) => (
                                       <div
                                          key={`${r.start}-${r.end}`}
                                          className="absolute inset-x-1 rounded-md border-l-2 border-[#8336f0] bg-[#8336f0]/15"
                                          style={{
                                             top: toY(toMinutes(r.start)),
                                             height: Math.max(4, toY(toMinutes(r.end)) - toY(toMinutes(r.start)))
                                          }}
                                       >
                                          <span className="block px-1.5 pt-0.5 text-[10px] font-bold text-[#c9a7ff]">
                                             {formatTime(r.start)}–{formatTime(r.end)}
                                          </span>
                                       </div>
                                    ))}
                                    {off ? (
                                       <span className="absolute inset-x-0 top-3 text-center text-xs font-black uppercase tracking-wide text-[#a89bb8]">
                                          Day off
                                       </span>
                                    ) : null}
                                    {placedBookings
                                       .filter((b) => b.ymd === ymd)
                                       .map(({ booking, startMin, endMin }) => (
                                          <button
                                             key={booking.uid}
                                             type="button"
                                             onClick={() => setSelectedBooking(booking)}
                                             className={`absolute inset-x-1.5 overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] font-bold leading-tight shadow ${selectedBooking?.uid === booking.uid ? 'bg-white text-[#120429]' : 'bg-[#8336f0] text-white hover:bg-[#9550ff]'}`}
                                             style={{ top: toY(startMin), height: Math.max(18, toY(endMin) - toY(startMin)) }}
                                          >
                                             {booking.attendees[0]?.name || booking.title}
                                          </button>
                                       ))}
                                    {ymd === today && nowMinutes >= gridStart * 60 && nowMinutes <= gridEnd * 60 ? (
                                       <div
                                          className="pointer-events-none absolute inset-x-0 h-0.5 bg-red-400"
                                          style={{ top: toY(nowMinutes) }}
                                       />
                                    ) : null}
                                 </div>
                              );
                           })}
                        </div>
                     </div>
                  </div>
               ) : null}

               {selectedBooking ? (
                  <div className="rounded-2xl border border-[#8336f0] bg-[#241044] p-5">
                     <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                           <p className="text-sm font-black uppercase tracking-wide text-[#c9a7ff]">
                              {formatBookingTime(selectedBooking.start, timeZone)}
                           </p>
                           <h3 className="mt-1 break-words text-2xl font-black">{selectedBooking.title}</h3>
                           {selectedBooking.attendees.map((a) => (
                              <p key={a.email} className="mt-1 break-words text-base text-[#a89bb8]">
                                 {a.name} · {a.email}
                                 {a.timeZone ? ` · ${a.timeZone}` : ''}
                              </p>
                           ))}
                           {selectedBooking.status && selectedBooking.status !== 'accepted' ? (
                              <p className="mt-1 text-sm font-black uppercase text-amber-300">{selectedBooking.status}</p>
                           ) : null}
                        </div>
                        <button
                           type="button"
                           onClick={() => setSelectedBooking(null)}
                           aria-label="Close"
                           className="text-2xl text-[#a89bb8] hover:text-white"
                        >
                           ×
                        </button>
                     </div>
                     <div className="mt-4 flex flex-wrap gap-2">
                        {selectedBooking.location ? (
                           <a
                              href={selectedBooking.location}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-xl bg-[#8336f0] px-4 py-2 text-sm font-black text-white no-underline hover:bg-[#9550ff]"
                           >
                              Join call
                           </a>
                        ) : null}
                        <a
                           href={`${CALCOM_EMBED_ORIGIN}/booking/${selectedBooking.uid}`}
                           target="_blank"
                           rel="noreferrer"
                           className="rounded-xl border border-[#3d1f6e] px-4 py-2 text-sm font-black text-white no-underline hover:bg-[#2a1453]"
                        >
                           Reschedule / cancel in Cal.com
                        </a>
                     </div>
                  </div>
               ) : null}

               {/* ---- Editors ----------------------------------------------------------------------------- */}
               {draft ? (
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                     <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                           <h3 className="text-xl font-black">Weekly hours</h3>
                           <label className="flex items-center gap-2 text-sm font-bold text-[#a89bb8]">
                              Time zone
                              <select
                                 value={draft.timeZone}
                                 onChange={(event) => setDraft({ ...draft, timeZone: event.target.value })}
                                 className="h-9 max-w-[220px] rounded-lg border border-[#3d1f6e] bg-[#241044] px-2 text-sm font-bold text-white"
                              >
                                 {allTimeZones(draft.timeZone).map((tz) => (
                                    <option key={tz} value={tz}>
                                       {tz}
                                    </option>
                                 ))}
                              </select>
                           </label>
                        </div>
                        <div className="mt-4 divide-y divide-[#2a1453]">
                           {WEEKDAYS.map((day) => {
                              const ranges = draft.week[day];
                              const enabled = ranges.length > 0;
                              return (
                                 <div key={day} className="flex flex-wrap items-start gap-4 py-3">
                                    <label className="flex w-36 shrink-0 items-center gap-3 pt-1.5 text-base font-black">
                                       <input
                                          type="checkbox"
                                          checked={enabled}
                                          onChange={() => updateWeek(day, enabled ? [] : [{ start: '09:00', end: '17:00' }])}
                                          className="h-5 w-5 accent-[#8336f0]"
                                       />
                                       {day}
                                    </label>
                                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                                       {enabled ? (
                                          ranges.map((range, index) => (
                                             <RangeRow
                                                key={index}
                                                range={range}
                                                onChange={(next) =>
                                                   updateWeek(
                                                      day,
                                                      ranges.map((r, i) => (i === index ? next : r))
                                                   )
                                                }
                                                onRemove={() =>
                                                   updateWeek(
                                                      day,
                                                      ranges.filter((_, i) => i !== index)
                                                   )
                                                }
                                             />
                                          ))
                                       ) : (
                                          <span className="pt-1.5 text-base text-[#6f6288]">Unavailable</span>
                                       )}
                                    </div>
                                    {enabled ? (
                                       <button
                                          type="button"
                                          onClick={() => {
                                             const last = ranges[ranges.length - 1];
                                             const start = last && last.end < '23:00' ? last.end : '09:00';
                                             const end =
                                                TIME_OPTIONS[Math.min(TIME_OPTIONS.length - 1, TIME_OPTIONS.indexOf(start) + 4)] ?? '23:59';
                                             updateWeek(day, [...ranges, { start, end }]);
                                          }}
                                          className="h-9 rounded-lg px-3 text-sm font-black text-[#c9a7ff] hover:bg-[#2a1453]"
                                       >
                                          + Add hours
                                       </button>
                                    ) : null}
                                 </div>
                              );
                           })}
                        </div>
                     </div>

                     <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5">
                        <h3 className="text-xl font-black">Date overrides</h3>
                        <p className="mt-1 text-sm text-[#a89bb8]">
                           Days off or one-off hours that replace the usual weekly hours for that date.
                        </p>

                        <div className="mt-4 space-y-3 rounded-xl border border-[#3d1f6e] bg-[#241044] p-3">
                           <input
                              type="date"
                              value={newOverrideDate}
                              min={today}
                              onChange={(event) => setNewOverrideDate(event.target.value)}
                              className="h-10 w-full rounded-lg border border-[#3d1f6e] bg-[#1c0a3a] px-3 text-base font-bold text-white [color-scheme:dark]"
                           />
                           <div className="flex overflow-hidden rounded-lg border border-[#3d1f6e] text-sm font-black">
                              <button
                                 type="button"
                                 onClick={() => setNewOverrideOff(true)}
                                 className={`flex-1 py-2 ${newOverrideOff ? 'bg-[#8336f0] text-white' : 'text-[#a89bb8]'}`}
                              >
                                 Off all day
                              </button>
                              <button
                                 type="button"
                                 onClick={() => setNewOverrideOff(false)}
                                 className={`flex-1 py-2 ${!newOverrideOff ? 'bg-[#8336f0] text-white' : 'text-[#a89bb8]'}`}
                              >
                                 Custom hours
                              </button>
                           </div>
                           {!newOverrideOff ? (
                              <RangeRow range={newOverrideRange} onChange={setNewOverrideRange} onRemove={() => setNewOverrideOff(true)} />
                           ) : null}
                           <button
                              type="button"
                              onClick={addOverride}
                              disabled={!newOverrideDate}
                              className="h-10 w-full rounded-lg bg-[#8336f0] text-sm font-black text-white disabled:opacity-40"
                           >
                              Add override
                           </button>
                        </div>

                        <ul className="mt-4 divide-y divide-[#2a1453]">
                           {upcomingOverrides.length === 0 ? (
                              <li className="py-3 text-base text-[#6f6288]">No upcoming overrides.</li>
                           ) : null}
                           {upcomingOverrides.map((ymd) => {
                              const value = draft.overrides[ymd];
                              return (
                                 <li key={ymd} className="py-3">
                                    <div className="flex items-center justify-between gap-3">
                                       <span className="text-base font-black">{formatLongDate(ymd)}</span>
                                       <button
                                          type="button"
                                          onClick={() => updateOverride(ymd, null)}
                                          className="text-sm font-black text-[#a89bb8] hover:text-white"
                                       >
                                          Remove
                                       </button>
                                    </div>
                                    {value === 'off' ? (
                                       <p className="mt-1 text-sm font-bold text-amber-300">Off all day</p>
                                    ) : (
                                       <div className="mt-2 flex flex-col gap-2">
                                          {value.map((range, index) => (
                                             <RangeRow
                                                key={index}
                                                range={range}
                                                onChange={(next) =>
                                                   updateOverride(
                                                      ymd,
                                                      value.map((r, i) => (i === index ? next : r))
                                                   )
                                                }
                                                onRemove={() =>
                                                   updateOverride(ymd, value.length > 1 ? value.filter((_, i) => i !== index) : 'off')
                                                }
                                             />
                                          ))}
                                       </div>
                                    )}
                                 </li>
                              );
                           })}
                        </ul>
                        {pastOverrideCount > 0 ? (
                           <p className="mt-2 text-xs text-[#6f6288]">
                              {pastOverrideCount} past override{pastOverrideCount === 1 ? '' : 's'} kept as-is.
                           </p>
                        ) : null}
                     </div>
                  </div>
               ) : null}

               {/* ---- Save bar ---------------------------------------------------------------------------- */}
               {dirty ? (
                  <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-[#8336f0] bg-[#241044]/95 p-4 shadow-2xl backdrop-blur">
                     <p className="min-w-0 flex-1 text-base font-bold">
                        {problem ? <span className="text-red-300">{problem}</span> : `Unsaved changes to ${hostName(host.id)}'s hours`}
                     </p>
                     <button
                        type="button"
                        onClick={() => schedule && setDraft(draftFrom(schedule))}
                        disabled={saving}
                        className="h-11 rounded-xl border border-[#3d1f6e] px-5 text-base font-black text-white hover:bg-[#2a1453]"
                     >
                        Discard
                     </button>
                     <button
                        type="button"
                        onClick={() => void save()}
                        disabled={saving || Boolean(problem)}
                        className="h-11 rounded-xl bg-[#8336f0] px-6 text-base font-black text-white hover:bg-[#9550ff] disabled:opacity-40"
                     >
                        {saving ? 'Saving…' : 'Save to Cal.com'}
                     </button>
                  </div>
               ) : null}

               <p className="text-sm text-[#6f6288]">
                  Times are shown in the schedule&apos;s time zone ({timeZone}). Borrower video calls book against these hours.
               </p>
            </>
         ) : null}
      </section>
   );
}
