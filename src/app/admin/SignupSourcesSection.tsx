'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// One row per account from admin_signup_sources (supabase/migrations/20261016170000_signup_sources.sql).
export type SignupRow = {
   id: string;
   username: string | null;
   created_at: string;
   method: string | null;
   browser: string | null;
   os: string | null;
   source: string | null;
   referrer: string | null;
   campaign: string | null;
   facebook_connected: boolean;
   approved: boolean;
   id_verified: boolean;
   borrowed: boolean;
};

export type SignupGroup = {
   key: string;
   total: number;
   facebook: number;
   approved: number;
   verified: number;
   borrowed: number;
};

const RANGES = [
   { days: 7, label: '7 days' },
   { days: 30, label: '30 days' },
   { days: 90, label: '90 days' },
   { days: 3650, label: 'All time' }
];

// Browser tags started on 16 Oct 2026; older accounts were backfilled from PostHog where it had them.
export const NOT_TAGGED = 'Not tagged';

/** "fb-bonds-oct8" from ?src=, else the site they came from, else direct. */
export const sourceLabel = (row: Pick<SignupRow, 'source' | 'referrer'>) => row.source || row.referrer || 'Direct / unknown';

export function groupSignups(rows: SignupRow[], keyOf: (row: SignupRow) => string): SignupGroup[] {
   const groups = new Map<string, SignupGroup>();
   for (const row of rows) {
      const key = keyOf(row);
      const g = groups.get(key) ?? { key, total: 0, facebook: 0, approved: 0, verified: 0, borrowed: 0 };
      g.total += 1;
      if (row.facebook_connected) g.facebook += 1;
      if (row.approved) g.approved += 1;
      if (row.id_verified) g.verified += 1;
      if (row.borrowed) g.borrowed += 1;
      groups.set(key, g);
   }
   return [...groups.values()].sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
}

const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');

// Bangkok time, like the rest of the team's tools.
const bangkok = (iso: string) =>
   new Date(iso).toLocaleString('en-GB', {
      timeZone: 'Asia/Bangkok',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
   });

function Cell({ part, whole }: { part: number; whole: number }) {
   return (
      <td className="px-3 py-2 text-right tabular-nums">
         {part} <span className="text-xs text-[#a89bb8]">{pct(part, whole)}</span>
      </td>
   );
}

function GroupTable({ title, groups }: { title: string; groups: SignupGroup[] }) {
   return (
      <div className="overflow-x-auto rounded-2xl border border-[#2a1453] bg-[#1c0a3a]">
         <table className="w-full min-w-[560px] text-sm">
            <caption className="px-4 pt-4 text-left text-base font-bold text-white">{title}</caption>
            <thead>
               <tr className="text-left text-xs uppercase tracking-wide text-[#a89bb8]">
                  <th className="px-3 py-2 font-semibold"> </th>
                  <th className="px-3 py-2 text-right font-semibold">Sign-ups</th>
                  <th className="px-3 py-2 text-right font-semibold">Facebook</th>
                  <th className="px-3 py-2 text-right font-semibold">Approved</th>
                  <th className="px-3 py-2 text-right font-semibold">ID verified</th>
                  <th className="px-3 py-2 text-right font-semibold">Borrowed</th>
               </tr>
            </thead>
            <tbody>
               {groups.map((g) => (
                  <tr key={g.key} className="border-t border-[#2a1453]">
                     <td className="px-3 py-2 font-semibold text-white">{g.key}</td>
                     <td className="px-3 py-2 text-right font-bold tabular-nums text-white">{g.total}</td>
                     <Cell part={g.facebook} whole={g.total} />
                     <Cell part={g.approved} whole={g.total} />
                     <Cell part={g.verified} whole={g.total} />
                     <Cell part={g.borrowed} whole={g.total} />
                  </tr>
               ))}
               {groups.length === 0 ? (
                  <tr>
                     <td colSpan={6} className="px-3 py-4 text-[#a89bb8]">
                        No sign-ups in this range.
                     </td>
                  </tr>
               ) : null}
            </tbody>
         </table>
      </div>
   );
}

export default function SignupSourcesSection() {
   const [days, setDays] = useState(30);
   const [rows, setRows] = useState<SignupRow[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);

   const load = useCallback(async (range: number) => {
      setLoading(true);
      setError(null);
      const { data, error: rpcError } = await getSupabaseBrowserClient().rpc('admin_signup_sources', { p_days: range });
      if (rpcError) setError(rpcError.message);
      else setRows((data ?? []) as SignupRow[]);
      setLoading(false);
   }, []);

   useEffect(() => {
      void load(days);
   }, [days, load]);

   const byBrowser = useMemo(() => groupSignups(rows, (r) => r.browser ?? NOT_TAGGED), [rows]);
   const byMethod = useMemo(() => groupSignups(rows, (r) => r.method ?? 'Unknown'), [rows]);
   const bySource = useMemo(() => groupSignups(rows, sourceLabel), [rows]);
   const byOs = useMemo(() => groupSignups(rows, (r) => r.os ?? NOT_TAGGED), [rows]);
   const tagged = rows.filter((r) => r.browser).length;
   const inFacebook = rows.filter((r) => r.browser === 'Facebook app' || r.browser === 'Messenger app').length;

   return (
      <div className="space-y-6">
         <div className="flex flex-wrap items-center gap-2">
            {RANGES.map((r) => (
               <button
                  key={r.days}
                  type="button"
                  onClick={() => setDays(r.days)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                     days === r.days ? 'bg-[#a06bff] text-white' : 'border border-[#2a1453] bg-[#1c0a3a] text-[#a89bb8]'
                  }`}
               >
                  {r.label}
               </button>
            ))}
            {loading ? <span className="text-sm text-[#a89bb8]">Loading…</span> : null}
         </div>

         {error ? <p className="rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{error}</p> : null}

         <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4">
               <p className="text-xs uppercase tracking-wide text-[#a89bb8]">Sign-ups</p>
               <p className="mt-1 text-2xl font-black text-white">{rows.length}</p>
            </div>
            <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4">
               <p className="text-xs uppercase tracking-wide text-[#a89bb8]">In Facebook / Messenger</p>
               <p className="mt-1 text-2xl font-black text-white">
                  {inFacebook} <span className="text-sm font-semibold text-[#a89bb8]">{pct(inFacebook, tagged)} of tagged</span>
               </p>
            </div>
            <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4">
               <p className="text-xs uppercase tracking-wide text-[#a89bb8]">Borrowed</p>
               <p className="mt-1 text-2xl font-black text-white">{rows.filter((r) => r.borrowed).length}</p>
            </div>
            <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4">
               <p className="text-xs uppercase tracking-wide text-[#a89bb8]">Browser tagged</p>
               <p className="mt-1 text-2xl font-black text-white">
                  {tagged} <span className="text-sm font-semibold text-[#a89bb8]">{pct(tagged, rows.length)}</span>
               </p>
            </div>
         </div>

         <GroupTable title="Browser or app they signed up in" groups={byBrowser} />
         <GroupTable title="How they signed up" groups={byMethod} />
         <GroupTable title="Where they came from (?src= link, else the site)" groups={bySource} />
         <GroupTable title="Phone" groups={byOs} />

         <div className="overflow-x-auto rounded-2xl border border-[#2a1453] bg-[#1c0a3a]">
            <table className="w-full min-w-[760px] text-sm">
               <caption className="px-4 pt-4 text-left text-base font-bold text-white">Latest sign-ups (Bangkok time)</caption>
               <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-[#a89bb8]">
                     <th className="px-3 py-2 font-semibold">When</th>
                     <th className="px-3 py-2 font-semibold">User</th>
                     <th className="px-3 py-2 font-semibold">How</th>
                     <th className="px-3 py-2 font-semibold">Browser / app</th>
                     <th className="px-3 py-2 font-semibold">Phone</th>
                     <th className="px-3 py-2 font-semibold">From</th>
                     <th className="px-3 py-2 font-semibold">Got to</th>
                  </tr>
               </thead>
               <tbody>
                  {rows.slice(0, 100).map((r) => (
                     <tr key={r.id} className="border-t border-[#2a1453] text-[#e8defa]">
                        <td className="whitespace-nowrap px-3 py-2">{bangkok(r.created_at)}</td>
                        <td className="px-3 py-2 font-semibold text-white">{r.username ?? '—'}</td>
                        <td className="px-3 py-2">{r.method ?? '—'}</td>
                        <td className="px-3 py-2">{r.browser ?? NOT_TAGGED}</td>
                        <td className="px-3 py-2">{r.os ?? '—'}</td>
                        <td className="px-3 py-2">{sourceLabel(r)}</td>
                        <td className="px-3 py-2">
                           {r.borrowed
                              ? 'Borrowed'
                              : r.id_verified
                                ? 'ID verified'
                                : r.approved
                                  ? 'Approved'
                                  : r.facebook_connected
                                    ? 'Facebook connected'
                                    : 'Signed up'}
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
   );
}
