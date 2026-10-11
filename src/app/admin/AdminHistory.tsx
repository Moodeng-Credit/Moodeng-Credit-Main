'use client';

import { useCallback, useEffect, useState } from 'react';

import { type AdminHistoryEvent, getBorrowerHistory, getRecentStateChanges } from '@/app/admin/adminLiveData';
import AdminStatusBadge from '@/app/admin/AdminStatusBadge';
import { useAdminLive, useAdminLiveReload } from '@/app/admin/useAdminLive';

// Read-only history views: the live "Recent changes" feed on the admin home and the per-borrower
// timeline in the Directory. Both refresh through the shared realtime channel.

const HISTORY_TABLES = ['users', 'loans', 'loan_access_requests', 'admin_audit_logs', 'account_status_audit_logs'] as const;

function timeAgo(iso: string): string {
   const diff = Date.now() - new Date(iso).getTime();
   if (Number.isNaN(diff)) return '';
   const min = Math.round(diff / 60000);
   if (min < 1) return 'just now';
   if (min < 60) return `${min}m ago`;
   const h = Math.round(min / 60);
   if (h < 48) return `${h}h ago`;
   return new Date(iso).toLocaleDateString();
}

function EventLine({ event, showUser }: { event: AdminHistoryEvent; showUser: boolean }) {
   return (
      <li className="flex flex-wrap items-center gap-2 border-b border-[#2a1453] py-2 last:border-b-0">
         {event.status ? <AdminStatusBadge status={event.status} /> : null}
         <span className="font-black text-white">{event.label}</span>
         {showUser && event.username ? <span className="font-bold text-[#c9a7ff]">@{event.username}</span> : null}
         {event.detail ? <span className="text-sm text-[#a89bb8]">{event.detail}</span> : null}
         <span className="ml-auto text-sm text-[#a89bb8]">
            {event.actorName ? `by @${event.actorName} · ` : ''}
            <time dateTime={event.at} title={new Date(event.at).toLocaleString()}>
               {timeAgo(event.at)}
            </time>
         </span>
      </li>
   );
}

export function RecentChangesFeed() {
   const [events, setEvents] = useState<AdminHistoryEvent[] | null>(null);
   const [error, setError] = useState<string | null>(null);
   const live = useAdminLive();

   const load = useCallback(async () => {
      try {
         setEvents(await getRecentStateChanges(20));
         setError(null);
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not load recent changes.');
      }
   }, []);

   useEffect(() => {
      void load();
   }, [load]);
   useAdminLiveReload([...HISTORY_TABLES], load);

   return (
      <section className="mb-5 rounded-3xl border border-[#2a1453] bg-[#1c0a3a] p-5">
         <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">Recent changes</h2>
            <span className={`text-xs font-black uppercase ${live?.connected ? 'text-emerald-300' : 'text-[#a89bb8]'}`}>
               {live?.connected ? '● Live' : '○ Refreshing every 30s'}
            </span>
         </div>
         {error ? <p className="mt-2 text-sm font-bold text-red-300">{error}</p> : null}
         {!events ? <p className="mt-2 text-sm text-[#a89bb8]">Loading…</p> : null}
         {events && !events.length ? <p className="mt-2 text-sm text-[#a89bb8]">Nothing yet.</p> : null}
         {events?.length ? (
            <ul className="mt-2 max-h-80 overflow-y-auto">
               {events.map((event) => (
                  <EventLine key={event.key} event={event} showUser />
               ))}
            </ul>
         ) : null}
      </section>
   );
}

export function BorrowerTimeline({ userId }: { userId: string }) {
   const [events, setEvents] = useState<AdminHistoryEvent[] | null>(null);

   const load = useCallback(async () => {
      try {
         setEvents(await getBorrowerHistory(userId));
      } catch {
         setEvents([]);
      }
   }, [userId]);

   useEffect(() => {
      void load();
   }, [load]);
   useAdminLiveReload([...HISTORY_TABLES], load);

   return (
      <div className="mt-5 rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5">
         <p className="text-sm font-black uppercase text-[#a89bb8]">History</p>
         {!events ? <p className="mt-2 text-sm text-[#a89bb8]">Loading…</p> : null}
         {events && !events.length ? <p className="mt-2 text-sm text-[#a89bb8]">No history yet.</p> : null}
         {events?.length ? (
            <ol className="mt-2">
               {events.map((event) => (
                  <EventLine key={event.key} event={event} showUser={false} />
               ))}
            </ol>
         ) : null}
      </div>
   );
}
