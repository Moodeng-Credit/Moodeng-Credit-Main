'use client';

// Admin → Growth → Audience: who our users are, in groups — to pick affiliate profiles and to spot areas
// where people sign up but nobody borrows yet (untapped markets). Data: SQL admin_audience_summary.
//
// Sources, most exact first: the ID check (Didit: age, gender, province), the loan application (job,
// income), and where they usually sign in from (IP lookup — approximate, but most users have it).
import { useEffect, useMemo, useState } from 'react';

import { type AudienceRow, type AudienceSummary, getAudienceSummary } from '@/app/admin/adminSupabase';

const cardClass = 'rounded-3xl border border-[#2a1453] bg-[#1c0a3a]';

// ISO-3 codes from ID documents → ISO-2 so the browser can name the country.
const ISO3_TO_2: Record<string, string> = { PHL: 'PH', IDN: 'ID', THA: 'TH', MYS: 'MY', VNM: 'VN', ESP: 'ES', USA: 'US', SGP: 'SG' };
const regionNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
const countryName = (code: string | null) => {
   if (!code || code === 'Unknown') return code ?? '';
   const iso2 = ISO3_TO_2[code] ?? code;
   try {
      return regionNames?.of(iso2) ?? code;
   } catch {
      return code;
   }
};

const WORK: Record<string, string> = { 'full-time': 'Full-time', 'part-time': 'Part-time', freelance: 'Freelance', none: 'No job' };
const bandLabel = (band: string) => {
   const range = band.match(/^(\d+)_(\d+)$/);
   if (range) return `$${range[1]}–${range[2]} / month`;
   const under = band.match(/^under_(\d+)$/);
   if (under) return `Under $${under[1]} / month`;
   const plus = band.match(/^(\d+)_plus$/);
   if (plus) return `$${plus[1]}+ / month`;
   return band;
};

const AGE_ORDER = ['Under 20', '20–24', '25–29', '30–39', '40+', 'Unknown'];
const byAge = (a: AudienceRow, b: AudienceRow) => AGE_ORDER.indexOf(a.key) - AGE_ORDER.indexOf(b.key);
const INCOME_ORDER = ['under_200', '200_400', '400_700', '700_plus', 'Unknown'];
const byIncome = (a: AudienceRow, b: AudienceRow) => INCOME_ORDER.indexOf(a.key) - INCOME_ORDER.indexOf(b.key);
const unknownLast = (rows: AudienceRow[]) => [...rows.filter((r) => r.key !== 'Unknown'), ...rows.filter((r) => r.key === 'Unknown')];

const keyLabel = (r: AudienceRow) => r.key;
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—');

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
   return (
      <div className={`${cardClass} p-4`}>
         <p className="text-xs font-black uppercase tracking-wide text-[#a89bb8]">{label}</p>
         <p className="mt-1 text-3xl font-black tabular-nums">{value}</p>
         {sub ? <p className="mt-0.5 text-xs text-[#a89bb8]">{sub}</p> : null}
      </div>
   );
}

/** One grouping as a table: a single-hue bar for how many users, and plain numbers for the rest. */
function GroupTable({
   title,
   note,
   rows,
   label = keyLabel,
   sub,
   limit = 12
}: {
   title: string;
   note?: string;
   rows: AudienceRow[] | undefined;
   label?: (r: AudienceRow) => string;
   sub?: (r: AudienceRow) => string | null;
   limit?: number;
}) {
   const [showAll, setShowAll] = useState(false);
   const list = rows ?? [];
   const max = Math.max(1, ...list.filter((r) => r.key !== 'Unknown').map((r) => r.users));
   const shown = showAll ? list : list.slice(0, limit);
   return (
      <div className={`${cardClass} p-4`}>
         <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-lg font-black">{title}</h3>
            {note ? <p className="text-right text-[11px] text-[#a89bb8]">{note}</p> : null}
         </div>
         <table className="mt-3 w-full text-sm">
            <thead>
               <tr className="text-left text-[11px] font-black uppercase tracking-wide text-[#a89bb8]">
                  <th className="pb-2 font-black">Group</th>
                  <th className="w-[38%] pb-2 font-black">Users</th>
                  <th className="pb-2 text-right font-black" title="Got at least one loan">
                     Borrowed
                  </th>
                  <th className="pb-2 text-right font-black" title="Repaid at least one loan">
                     Repaid
                  </th>
                  <th className="pb-2 text-right font-black" title="Ever late (repaid late or overdue now)">
                     Late
                  </th>
                  <th className="pb-2 text-right font-black" title="Signed up in the last 30 days">
                     New
                  </th>
               </tr>
            </thead>
            <tbody>
               {shown.map((r) => {
                  const unknown = r.key === 'Unknown';
                  const tip = `${label(r)}: ${r.users} users · ${r.borrowers} borrowed (${pct(r.borrowers, r.users)}) · ${r.repaid} repaid · ${r.late} late · ${r.new30d} new in 30 days`;
                  return (
                     <tr
                        key={`${r.parent ?? ''}|${r.key}`}
                        title={tip}
                        className={`border-t border-[#2a1453] hover:bg-[#20103e] ${unknown ? 'opacity-55' : ''}`}
                     >
                        <td className="max-w-[180px] py-1.5 pr-2">
                           <span className="block truncate font-bold">{unknown ? 'Not known' : label(r)}</span>
                           {sub?.(r) ? <span className="block truncate text-[11px] text-[#a89bb8]">{sub(r)}</span> : null}
                        </td>
                        <td className="py-1.5 pr-3">
                           <div className="flex items-center gap-2">
                              <div className="h-2.5 flex-1 rounded-full bg-[#140726]">
                                 {!unknown ? (
                                    <div
                                       className="h-2.5 rounded-full bg-[#8336f0]"
                                       style={{ width: `${Math.max(4, (r.users / max) * 100)}%` }}
                                    />
                                 ) : null}
                              </div>
                              <span className="w-8 text-right font-black tabular-nums">{r.users}</span>
                           </div>
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                           {r.borrowers}
                           <span className="ml-1 text-[11px] text-[#a89bb8]">{pct(r.borrowers, r.users)}</span>
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{r.repaid}</td>
                        <td className={`py-1.5 text-right tabular-nums ${r.late ? 'font-bold text-red-300' : ''}`}>{r.late}</td>
                        <td className={`py-1.5 text-right tabular-nums ${r.new30d ? 'font-bold text-[#25D366]' : ''}`}>{r.new30d}</td>
                     </tr>
                  );
               })}
            </tbody>
         </table>
         {list.length > limit ? (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs font-black text-[#c9a4ff] hover:underline">
               {showAll ? 'Show fewer' : `Show all ${list.length}`}
            </button>
         ) : null}
      </div>
   );
}

export default function AudienceSection() {
   const [data, setData] = useState<AudienceSummary | null>(null);
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      getAudienceSummary()
         .then((d) => (d ? setData(d) : setError('Admins only.')))
         .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load the audience summary.'));
   }, []);

   // Places where people sign up but (almost) nobody has borrowed yet — candidates to push in.
   const untapped = useMemo(() => {
      const places = [...(data?.groups.ipCity ?? []), ...(data?.groups.province ?? [])].filter((r) => r.key !== 'Unknown');
      const seen = new Set<string>();
      return places
         .filter((r) => r.users >= 3 && r.borrowers / r.users <= 0.15)
         .filter((r) => {
            const k = r.key.toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
         })
         .sort((a, b) => b.users - a.users || b.new30d - a.new30d)
         .slice(0, 8);
   }, [data]);

   if (error) return <p className="font-bold text-red-300">{error}</p>;
   if (!data) return <p className="text-[#a89bb8]">Loading audience…</p>;

   const t = data.totals;
   const g = data.groups;

   return (
      <section className="space-y-6">
         <div>
            <h2 className="break-words text-2xl font-black sm:text-3xl">Audience</h2>
            <p className="mt-1.5 max-w-3xl text-base text-[#a89bb8]">
               Who our users are, by place, age, gender, job and income — with how many borrowed, repaid and were late. Lenders and test
               accounts are left out. Hover a row for the full numbers.
            </p>
         </div>

         <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Tile label="Users" value={t.users} sub={`${t.new30d} new in 30 days`} />
            <Tile label="Borrowed" value={t.borrowers} sub={`${pct(t.borrowers, t.users)} of users`} />
            <Tile label="Repaid" value={t.repaid} sub={`${pct(t.repaid, t.borrowers)} of borrowers`} />
            <Tile label="Ever late" value={t.late} sub={`${pct(t.late, t.borrowers)} of borrowers`} />
            <Tile label="ID checked" value={t.idChecked} sub={`${t.withAge} with age · ${t.withPlace} with address`} />
            <Tile label="Sign-in city known" value={t.withIpCity} sub="approximate, from IP" />
         </div>

         {untapped.length ? (
            <div className="rounded-3xl border border-amber-300/30 bg-amber-400/10 p-4">
               <h3 className="text-lg font-black text-amber-100">Sign-ups but few borrowers — places to push</h3>
               <p className="mt-0.5 text-xs text-amber-100/70">3+ users and at most 15% have borrowed.</p>
               <div className="mt-3 flex flex-wrap gap-2">
                  {untapped.map((r) => (
                     <span key={r.key} className="rounded-2xl bg-[#1c0a3a] px-3 py-2 text-sm">
                        <span className="font-black">{r.key}</span>
                        <span className="text-[#a89bb8]">{r.parent ? ` · ${countryName(r.parent)}` : ''}</span>
                        <span className="ml-2 font-bold">{r.users} users</span>
                        <span className="text-[#a89bb8]"> · {r.borrowers} borrowed</span>
                        {r.new30d ? <span className="text-[#25D366]"> · {r.new30d} new</span> : null}
                     </span>
                  ))}
               </div>
            </div>
         ) : null}

         <div className="grid gap-4 xl:grid-cols-2">
            <GroupTable
               title="Country"
               note="ID, else our market, phone code or sign-in"
               rows={unknownLast(g.country ?? [])}
               label={(r) => countryName(r.key)}
            />
            <GroupTable
               title="Sign-in city"
               note="approximate (IP) — most users have it"
               rows={unknownLast(g.ipCity ?? [])}
               sub={(r) => (r.parent ? countryName(r.parent) : null)}
            />
            <GroupTable
               title="Province / city (ID check)"
               note="exact, from their ID"
               rows={unknownLast(g.province ?? [])}
               sub={(r) => (r.parent && r.parent.length > 3 ? r.parent : r.parent ? countryName(r.parent) : null)}
            />
            <GroupTable
               title="Region (ID check)"
               rows={unknownLast(g.region ?? [])}
               sub={(r) => (r.parent ? countryName(r.parent) : null)}
            />
            <GroupTable title="Age group" note="from their ID" rows={[...(g.age ?? [])].sort(byAge)} />
            <GroupTable title="Gender" note="from their ID" rows={unknownLast(g.gender ?? [])} />
            <GroupTable
               title="Age × gender"
               note="people with both on their ID"
               rows={[...(g.ageGender ?? [])].sort(
                  (a, b) => byAge({ ...a, key: a.key.split(' · ')[0] }, { ...b, key: b.key.split(' · ')[0] }) || a.key.localeCompare(b.key)
               )}
               limit={14}
            />
            <GroupTable title="Work" note="from the application" rows={unknownLast(g.work ?? [])} label={(r) => WORK[r.key] ?? r.key} />
            <GroupTable
               title="Income"
               note="from the application"
               rows={[...(g.income ?? [])].sort(byIncome)}
               label={(r) => (r.key === 'Unknown' ? r.key : bandLabel(r.key))}
            />
         </div>
      </section>
   );
}
