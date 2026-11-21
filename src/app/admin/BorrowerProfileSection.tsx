'use client';

import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import {
   DIMENSIONS,
   type Dimension,
   type MapLayer,
   type ProfileRow,
   type Segment,
   UNKNOWN,
   bestSegments,
   hasIdData,
   isPhilippines,
   mapPoints,
   onTimeRate,
   segment
} from '@/app/admin/borrowerProfileModel';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const BorrowerProfileMap = lazy(() => import('@/app/admin/BorrowerProfileMap'));

type Who = 'all' | 'verified' | 'borrowers';
const WHO: Array<{ id: Who; label: string }> = [
   { id: 'all', label: 'Everyone' },
   { id: 'verified', label: 'ID checked (Didit)' },
   { id: 'borrowers', label: 'Borrowers' }
];

const PEOPLE = '#a06bff';
const BORROWERS = '#f5c542';

const pct = (rate: number | null) => (rate == null ? '—' : `${Math.round(rate * 100)}%`);
const share = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
   return (
      <button
         type="button"
         onClick={onClick}
         className={`rounded-full px-4 py-2 text-sm font-semibold ${
            active ? 'bg-[#a06bff] text-white' : 'border border-[#2a1453] bg-[#1c0a3a] text-[#a89bb8]'
         }`}
      >
         {children}
      </button>
   );
}

function Tile({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
   return (
      <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4">
         <p className="text-xs uppercase tracking-wide text-[#a89bb8]">{label}</p>
         <p className="mt-1 text-2xl font-black text-white">{value}</p>
         {note ? <p className="mt-0.5 text-xs text-[#a89bb8]">{note}</p> : null}
      </div>
   );
}

function RateBadge({ s }: { s: Segment }) {
   const rate = onTimeRate(s);
   if (rate == null) return <span className="text-[#6f6385]">—</span>;
   const color = rate >= 0.8 ? 'text-[#2ecc71]' : rate >= 0.5 ? 'text-[#f5a524]' : 'text-[#ff4d5e]';
   return (
      <span className={`font-bold ${color}`}>
         {pct(rate)} <span className="text-xs font-normal text-[#a89bb8]">of {s.due}</span>
      </span>
   );
}

function SegmentCard({ dimension, rows }: { dimension: Dimension; rows: ProfileRow[] }) {
   const segments = useMemo(() => segment(rows, dimension.keyOf, dimension.order), [rows, dimension]);
   const known = segments.filter((s) => s.key !== UNKNOWN);
   const unknown = segments.find((s) => s.key === UNKNOWN)?.people ?? 0;
   return (
      <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4">
         <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-base font-bold text-white">{dimension.label}</h3>
            {unknown ? <span className="text-xs text-[#6f6385]">{unknown} not known</span> : null}
         </div>
         {known.length ? (
            <>
               <div className="mt-3" style={{ height: Math.max(140, known.length * 34 + 50) }}>
                  <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={known} layout="vertical" margin={{ left: 8, right: 16, top: 0, bottom: 0 }} barGap={2}>
                        <CartesianGrid horizontal={false} stroke="#2a1453" />
                        <XAxis type="number" allowDecimals={false} tick={{ fill: '#a89bb8', fontSize: 12 }} stroke="#2a1453" />
                        <YAxis type="category" dataKey="key" width={110} tick={{ fill: '#e7e0f2', fontSize: 12 }} stroke="#2a1453" />
                        <Tooltip
                           cursor={{ fill: 'rgba(160,107,255,0.08)' }}
                           contentStyle={{ background: '#160a2e', border: '1px solid #2a1453', borderRadius: 12, color: '#fff' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12, color: '#a89bb8' }} />
                        <Bar dataKey="people" name="People" fill={PEOPLE} radius={[0, 4, 4, 0]} />
                        <Bar dataKey="borrowers" name="Borrowed" fill={BORROWERS} radius={[0, 4, 4, 0]} />
                     </BarChart>
                  </ResponsiveContainer>
               </div>
               <table className="mt-3 w-full text-sm">
                  <thead>
                     <tr className="text-left text-xs uppercase tracking-wide text-[#a89bb8]">
                        <th className="py-1 font-semibold"> </th>
                        <th className="py-1 text-right font-semibold">People</th>
                        <th className="py-1 text-right font-semibold">Borrowed</th>
                        <th className="py-1 text-right font-semibold">Paid on time</th>
                     </tr>
                  </thead>
                  <tbody>
                     {known.map((s) => (
                        <tr key={s.key} className="border-t border-[#2a1453]">
                           <td className="py-1.5 font-semibold text-white">{s.key}</td>
                           <td className="py-1.5 text-right tabular-nums text-white">{s.people}</td>
                           <td className="py-1.5 text-right tabular-nums text-white">
                              {s.borrowers} <span className="text-xs text-[#a89bb8]">{share(s.borrowers, s.people)}</span>
                           </td>
                           <td className="py-1.5 text-right tabular-nums">
                              <RateBadge s={s} />
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </>
         ) : (
            <p className="mt-3 text-sm text-[#6f6385]">No data yet.</p>
         )}
      </div>
   );
}

export default function BorrowerProfileSection() {
   const [rows, setRows] = useState<ProfileRow[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   useEffect(() => {
      let active = true;
      void getSupabaseBrowserClient()
         .rpc('admin_borrower_profile')
         .then(({ data, error: rpcError }) => {
            if (!active) return;
            if (rpcError) setError(rpcError.message);
            else setRows((data ?? []) as ProfileRow[]);
            setLoading(false);
         });
      return () => {
         active = false;
      };
   }, []);

   return <BorrowerProfileView rows={rows} loading={loading} error={error} />;
}

/** The page itself, from rows already loaded (kept apart so it can be rendered in tests). */
export function BorrowerProfileView({ rows, loading = false, error = null }: { rows: ProfileRow[]; loading?: boolean; error?: string | null }) {
   const [who, setWho] = useState<Who>('verified');
   const [phOnly, setPhOnly] = useState(true);
   const [layer, setLayer] = useState<MapLayer>('home');
   const shown = useMemo(
      () =>
         rows.filter(
            (r) =>
               (!phOnly || isPhilippines(r)) &&
               (who === 'all' || (who === 'verified' ? hasIdData(r) : r.loans > 0))
         ),
      [rows, phOnly, who]
   );

   const total = useMemo(() => segment(shown, () => 'all')[0], [shown]);
   const best = useMemo(() => bestSegments(shown), [shown]);
   const points = useMemo(() => mapPoints(shown, layer), [shown, layer]);
   const ages = shown.map((r) => r.age).filter((a): a is number => a != null).sort((a, b) => a - b);
   const medianAge = ages.length ? ages[Math.floor(ages.length / 2)] : null;
   const women = shown.filter((r) => r.gender === 'Female').length;
   const gendered = shown.filter((r) => r.gender).length;
   const pointsMissing = shown.length - shown.filter((r) => (layer === 'home' ? r.home_lat : r.ip_lat) != null).length;

   return (
      <div className="space-y-6">
         <div className="flex flex-wrap items-center gap-2">
            {WHO.map((w) => (
               <Pill key={w.id} active={who === w.id} onClick={() => setWho(w.id)}>
                  {w.label}
               </Pill>
            ))}
            <span className="mx-1 h-6 w-px bg-[#2a1453]" />
            <Pill active={phOnly} onClick={() => setPhOnly(true)}>
               Philippines
            </Pill>
            <Pill active={!phOnly} onClick={() => setPhOnly(false)}>
               Everywhere
            </Pill>
            {loading ? <span className="text-sm text-[#a89bb8]">Loading…</span> : null}
         </div>

         {error ? <p className="rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{error}</p> : null}

         <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="People" value={shown.length} note={`${total?.borrowers ?? 0} borrowed`} />
            <Tile label="Typical age" value={medianAge ?? '—'} note={ages.length ? `middle of ${ages.length} IDs` : 'no IDs read yet'} />
            <Tile label="Women" value={share(women, gendered)} note={`of ${gendered} with gender on ID`} />
            <Tile
               label="Loans paid on time"
               value={total ? pct(onTimeRate(total)) : '—'}
               note={total?.due ? `${total.onTime} of ${total.due} due · ${total.overdue} still overdue` : 'no loans due yet'}
            />
         </div>

         <div className="rounded-2xl border border-[#3b2a12] bg-gradient-to-br from-[#2a1a05] to-[#1c0a3a] p-4">
            <h3 className="text-base font-bold text-[#f5c542]">Who repays best</h3>
            <p className="mt-0.5 text-xs text-[#a89bb8]">Groups with at least 4 loans due, best on-time rate first. Small numbers — treat as hints.</p>
            {best.length ? (
               <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {best.map((s) => (
                     <li key={`${s.dimension}:${s.key}`} className="rounded-xl border border-[#2a1453] bg-[#160a2e] px-3 py-2">
                        <p className="text-xs uppercase tracking-wide text-[#a89bb8]">{s.dimension}</p>
                        <p className="font-bold text-white">{s.key}</p>
                        <p className="text-sm text-[#e7e0f2]">
                           <span className="font-bold text-[#2ecc71]">{pct(s.rate)}</span> on time · {s.onTime} of {s.due} loans ·{' '}
                           {s.borrowers} borrower{s.borrowers === 1 ? '' : 's'}
                        </p>
                     </li>
                  ))}
               </ol>
            ) : (
               <p className="mt-3 text-sm text-[#6f6385]">Not enough loans due in this view yet.</p>
            )}
         </div>

         <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
               <div>
                  <h3 className="text-lg font-bold text-white">Where they are</h3>
                  <p className="text-xs text-[#a89bb8]">
                     Rounded to about 10 km. Bubble size = people; colour = paid on time (green ≥80%, amber 50–79%, red &lt;50%, grey = no loans due).
                     {pointsMissing ? ` ${pointsMissing} without a ${layer === 'home' ? 'home address' : 'login location'}.` : ''}
                  </p>
               </div>
               <div className="flex gap-2">
                  <Pill active={layer === 'home'} onClick={() => setLayer('home')}>
                     Home (ID address)
                  </Pill>
                  <Pill active={layer === 'ip'} onClick={() => setLayer('ip')}>
                     Logins (IP)
                  </Pill>
               </div>
            </div>
            <Suspense
               fallback={
                  <div className="flex h-[520px] items-center justify-center rounded-2xl border border-[#2a1453] bg-[#160a2e] text-[#a89bb8]">
                     Loading map…
                  </div>
               }
            >
               <BorrowerProfileMap points={points} />
            </Suspense>
         </div>

         <div className="grid gap-4 lg:grid-cols-2">
            {DIMENSIONS.map((d) => (
               <SegmentCard key={d.id} dimension={d} rows={shown} />
            ))}
         </div>

         <p className="text-xs text-[#6f6385]">
            Age, gender, marital status and home region come from the ID Didit read; income and work from what they told us at
            sign-up; login city from their IP. Test accounts are left out. &ldquo;Paid on time&rdquo; counts loans paid by the end of
            their due day, out of loans already due.
         </p>
      </div>
   );
}
