'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { Link, useParams } from 'react-router-dom';
import { Bar, BarChart, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { BorrowerTimeline } from '@/app/admin/AdminHistory';
import ProofHistory from '@/app/admin/ProofHistory';
import { AdminLiveProvider } from '@/app/admin/useAdminLive';
import {
   aboutVsId,
   bkkDate,
   bkkDateTime,
   daysEarly,
   type DiditSessionMedia,
   type Dossier,
   type DossierLoan,
   journey,
   loadDiditMedia,
   loadDossier,
   type LoanOutcome,
   loanOutcome,
   loanStats,
   photoEstimateText,
   usd
} from '@/app/admin/user/userDossierModel';

// Admin → Users → click a name: one person's whole account on one page, like a bank's customer view.
// Read-only; the actions (ban, watchlist, 2FA, notices) stay on the Users list under "Manage".

const OUTCOME: Record<LoanOutcome, { label: string; color: string; text: string }> = {
   on_time: { label: 'On time', color: '#2ecc71', text: 'text-emerald-300' },
   late: { label: 'Late', color: '#f5a524', text: 'text-amber-300' },
   overdue: { label: 'Overdue', color: '#ff4d5e', text: 'text-red-300' },
   open: { label: 'Open', color: '#a06bff', text: 'text-purple-300' },
   refunded: { label: 'Refunded', color: '#6f6385', text: 'text-[#a89bb8]' },
   requested: { label: 'Requested', color: '#6f6385', text: 'text-[#a89bb8]' }
};

function Card({ title, children, right, className = '' }: { title: string; children: ReactNode; right?: ReactNode; className?: string }) {
   return (
      <section className={`rounded-3xl border border-[#2a1453] bg-[#1c0a3a] p-5 ${className}`}>
         <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-white">{title}</h2>
            {right}
         </div>
         {children}
      </section>
   );
}

function Kpi({
   label,
   value,
   note,
   tone = 'default'
}: {
   label: string;
   value: ReactNode;
   note?: ReactNode;
   tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
   const color = { default: 'text-white', good: 'text-emerald-300', warn: 'text-amber-300', bad: 'text-red-300' }[tone];
   return (
      <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4">
         <p className="text-xs font-black uppercase tracking-wide text-[#a89bb8]">{label}</p>
         <p className={`mt-1 text-2xl font-black ${color}`}>{value}</p>
         {note ? <p className="mt-0.5 text-xs text-[#a89bb8]">{note}</p> : null}
      </div>
   );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
   if (children == null || children === '' || children === false) return null;
   return (
      <div className="flex gap-3 border-b border-[#2a1453] py-2 text-sm last:border-b-0">
         <span className="w-36 shrink-0 text-[#a89bb8]">{label}</span>
         <span className="min-w-0 flex-1 break-words font-bold text-white">{children}</span>
      </div>
   );
}

function Pill({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad' | 'gold' }) {
   const cls = {
      default: 'bg-[#34234f] text-[#d9c9f5]',
      good: 'bg-emerald-900/60 text-emerald-200',
      warn: 'bg-amber-900/60 text-amber-200',
      bad: 'bg-red-900/60 text-red-200',
      gold: 'bg-[#f5c542] text-black'
   }[tone];
   return <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${cls}`}>{children}</span>;
}

function Empty({ children }: { children: ReactNode }) {
   return <p className="text-sm text-[#6f6385]">{children}</p>;
}

function List({ items }: { items: string[] | null | undefined }) {
   if (!items?.length) return null;
   return (
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-[#d9c9f5]">
         {items.map((t, i) => (
            <li key={i}>{t}</li>
         ))}
      </ul>
   );
}

const age = (dob: string | null) => {
   if (!dob) return null;
   const ms = Date.now() - new Date(dob).getTime();
   return Number.isFinite(ms) ? Math.floor(ms / (365.25 * 86_400_000)) : null;
};

// Saved as a USD band slug ("200_400", "under_200", "700_plus") or, on old forms, a plain number.
const moneyBand = (v: unknown): string | null => {
   if (v == null || v === '') return null;
   const t = String(v);
   const range = t.match(/^(\d+)_(\d+)$/);
   if (range) return `$${range[1]}–${range[2]} / month`;
   const under = t.match(/^under_(\d+)$/);
   if (under) return `Under $${under[1]} / month`;
   const plus = t.match(/^(\d+)_plus$/);
   if (plus) return `$${plus[1]}+ / month`;
   const n = Number(t);
   return Number.isFinite(n) ? `$${n.toLocaleString()} / month` : t;
};

const riskTone = (band: string | null): 'good' | 'warn' | 'bad' | 'default' => {
   const b = (band ?? '').toLowerCase();
   return b === 'low' ? 'good' : b === 'medium' ? 'warn' : b === 'high' || b === 'critical' ? 'bad' : 'default';
};

const accessTone = (s: string | null) => (s === 'approved' ? 'good' : s === 'rejected' ? 'bad' : s === 'pending' ? 'warn' : 'default');

function Photo({ label, url }: { label: string; url: string }) {
   return (
      <a
         href={url}
         target="_blank"
         rel="noreferrer"
         className="group block overflow-hidden rounded-2xl border border-[#2a1453] bg-black/30"
      >
         <img src={url} alt={label} loading="lazy" className="h-40 w-full object-cover transition group-hover:opacity-80" />
         <p className="px-3 py-1.5 text-xs font-black uppercase text-[#a89bb8]">{label}</p>
      </a>
   );
}

function Header({ d, selfie }: { d: Dossier; selfie: string | null }) {
   const u = d.user;
   const kyc = d.kyc[0];
   const sheetName = d.call_screenings[0]?.answers?.fullName;
   const realName = kyc?.full_name ?? (typeof sheetName === 'string' ? sheetName : null);
   const verified = u.is_didit === 'ACTIVE' || u.is_world_id;
   const contacts: Array<{ label: string; href?: string; ok?: boolean }> = [
      u.email && !u.email.endsWith('.invalid') && !u.email.endsWith('@moodeng.app') ? { label: u.email, href: `mailto:${u.email}` } : null,
      u.facebook_name || u.facebook_profile_url
         ? {
              label: `Facebook: ${u.facebook_name ?? 'profile'}`,
              href: u.facebook_profile_url ?? undefined,
              ok: Boolean(u.messenger_verified_at)
           }
         : null,
      u.whatsapp_number
         ? {
              label: `WhatsApp ${u.whatsapp_number}`,
              href: `https://wa.me/${u.whatsapp_number.replace(/\D/g, '')}`,
              ok: Boolean(u.whatsapp_verified_at)
           }
         : null,
      u.viber_number ? { label: `Viber ${u.viber_number}` } : null,
      u.telegram_username
         ? { label: `Telegram @${u.telegram_username.replace(/^@/, '')}`, href: `https://t.me/${u.telegram_username.replace(/^@/, '')}` }
         : null,
      u.instagram_handle ? { label: `IG @${u.instagram_handle}`, href: `https://instagram.com/${u.instagram_handle}` } : null,
      u.tiktok_handle ? { label: `TikTok @${u.tiktok_handle}`, href: `https://tiktok.com/@${u.tiktok_handle}` } : null
   ].filter(Boolean) as Array<{ label: string; href?: string; ok?: boolean }>;

   return (
      <section className="rounded-3xl border border-[#2a1453] bg-gradient-to-br from-[#2a1060] to-[#1c0a3a] p-6">
         <div className="flex flex-wrap items-start gap-5">
            {selfie ? (
               <a href={selfie} target="_blank" rel="noreferrer">
                  <img src={selfie} alt="Selfie" className="h-24 w-24 rounded-full border-4 border-[#8336f0] object-cover" />
               </a>
            ) : (
               <div className="grid h-24 w-24 place-items-center rounded-full bg-[#8336f0] text-4xl font-black text-white">
                  {u.username.charAt(0).toUpperCase()}
               </div>
            )}
            <div className="min-w-0 flex-1">
               <h1 className="break-words text-3xl font-black text-white">{realName || u.display_name || u.username}</h1>
               <p className="mt-1 text-base text-[#a89bb8]">
                  @{u.username} · joined {bkkDate(u.created_at)}
                  {u.market ? ` · ${u.market.toUpperCase()}` : ''}
                  {kyc?.city || kyc?.province ? ` · ${[kyc.city, kyc.province].filter(Boolean).join(', ')}` : ''}
               </p>
               <div className="mt-3 flex flex-wrap gap-2">
                  <Pill tone={accessTone(u.loan_access_status)}>
                     {u.loan_access_status === 'approved'
                        ? `Approved ${bkkDate(u.loan_access_approved_at)}`
                        : u.loan_access_status === 'none'
                          ? 'Not approved yet'
                          : (u.loan_access_status ?? 'no access')}
                  </Pill>
                  <Pill tone={u.account_status === 'active' ? 'good' : 'bad'}>{u.account_status ?? 'unknown'}</Pill>
                  <Pill tone={verified ? 'good' : 'warn'}>
                     {verified ? (u.is_world_id ? 'World ID verified' : 'Didit verified') : 'ID not verified'}
                  </Pill>
                  {u.current_risk_band ? (
                     <Pill tone={riskTone(u.current_risk_band) === 'default' ? 'warn' : riskTone(u.current_risk_band)}>
                        {u.current_risk_band} risk
                     </Pill>
                  ) : null}
                  {u.ghosted_at ? <Pill tone="bad">Ghosted</Pill> : null}
                  {u.blocked_for_good_at ? <Pill tone="bad">Blocked for good</Pill> : null}
                  {u.wallet_suspended ? <Pill tone="bad">Wallet suspended</Pill> : null}
                  {u.is_test ? <Pill>Test account</Pill> : null}
                  {d.restriction ? <Pill tone="bad">Admin {d.restriction.status}</Pill> : null}
               </div>
               {contacts.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                     {contacts.map((c) =>
                        c.href ? (
                           <a
                              key={c.label}
                              href={c.href}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-xl border border-[#3d1f6e] bg-[#241044] px-3 py-1.5 text-sm font-bold text-[#d9c9f5] no-underline hover:border-[#8336f0]"
                           >
                              {c.ok ? '✅ ' : ''}
                              {c.label}
                           </a>
                        ) : (
                           <span
                              key={c.label}
                              className="rounded-xl border border-[#3d1f6e] bg-[#241044] px-3 py-1.5 text-sm font-bold text-[#d9c9f5]"
                           >
                              {c.label}
                           </span>
                        )
                     )}
                  </div>
               ) : null}
            </div>
            <div className="flex flex-col gap-2">
               <a
                  href={`/user/${encodeURIComponent(u.username)}`}
                  className="rounded-2xl bg-[#34234f] px-4 py-2 text-center text-sm font-black text-white no-underline"
               >
                  Public profile
               </a>
               <Link
                  to={`/admin?q=${encodeURIComponent(u.username)}&user=${u.id}`}
                  className="rounded-2xl bg-[#8336f0] px-4 py-2 text-center text-sm font-black text-white no-underline"
               >
                  Manage
               </Link>
            </div>
         </div>
      </section>
   );
}

function Journey({ d }: { d: Dossier }) {
   const steps = journey(d);
   return (
      <section className="overflow-x-auto rounded-3xl border border-[#2a1453] bg-[#1c0a3a] p-5">
         <ol className="flex min-w-[760px] items-start">
            {steps.map((s, i) => (
               <li key={s.label} className="relative flex-1 px-1 text-center">
                  {i > 0 ? <span className={`absolute left-0 right-1/2 top-3 h-0.5 ${s.done ? 'bg-[#8336f0]' : 'bg-[#2a1453]'}`} /> : null}
                  {i < steps.length - 1 ? (
                     <span className={`absolute left-1/2 right-0 top-3 h-0.5 ${steps[i + 1].done ? 'bg-[#8336f0]' : 'bg-[#2a1453]'}`} />
                  ) : null}
                  <span
                     className={`relative z-10 mx-auto grid h-6 w-6 place-items-center rounded-full text-xs font-black ${
                        s.done
                           ? s.label === 'Rejected'
                              ? 'bg-red-500 text-white'
                              : 'bg-[#8336f0] text-white'
                           : 'border border-[#3d1f6e] bg-[#120429] text-[#6f6385]'
                     }`}
                  >
                     {s.done ? (s.label === 'Rejected' ? '✕' : '✓') : i + 1}
                  </span>
                  <p className={`mt-2 text-sm font-black ${s.done ? 'text-white' : 'text-[#6f6385]'}`}>{s.label}</p>
                  <p className="text-xs text-[#a89bb8]">{s.at ? bkkDate(s.at) : s.done ? '' : '—'}</p>
                  {s.note ? (
                     <p className="mx-auto mt-0.5 max-w-[120px] truncate text-xs text-[#c9a7ff]" title={s.note}>
                        {s.note}
                     </p>
                  ) : null}
               </li>
            ))}
         </ol>
      </section>
   );
}

function Loans({ loans }: { loans: DossierLoan[] }) {
   const chart = useMemo(
      () =>
         [...loans]
            .filter((l) => l.loan_status !== 'Requested')
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((l) => ({
               name: bkkDate(l.funded_at ?? l.created_at).replace(/, \d{4}$/, ''),
               amount: Number(l.amount ?? 0),
               outcome: loanOutcome(l)
            })),
      [loans]
   );
   if (!loans.length)
      return (
         <Card title="Loans">
            <Empty>No loans yet.</Empty>
         </Card>
      );
   return (
      <Card title={`Loans (${loans.length})`}>
         {chart.length > 1 ? (
            <div className="mb-4 h-40">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart}>
                     <XAxis dataKey="name" tick={{ fill: '#a89bb8', fontSize: 11 }} axisLine={false} tickLine={false} />
                     <YAxis
                        tick={{ fill: '#a89bb8', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                        tickFormatter={(v) => `$${v}`}
                     />
                     <Tooltip
                        cursor={{ fill: '#ffffff10' }}
                        contentStyle={{ background: '#241044', border: '1px solid #3d1f6e', borderRadius: 12, color: '#fff' }}
                        formatter={(v, _n, p) => [`$${v} · ${OUTCOME[(p.payload as { outcome: LoanOutcome }).outcome].label}`, 'Loan']}
                     />
                     <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                        {chart.map((c, i) => (
                           <Cell key={i} fill={OUTCOME[c.outcome].color} />
                        ))}
                     </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>
         ) : null}
         <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
               <thead className="text-xs uppercase text-[#a89bb8]">
                  <tr>
                     <th className="py-2 pr-3">Funded</th>
                     <th className="pr-3">Amount</th>
                     <th className="pr-3">To repay</th>
                     <th className="pr-3">Due</th>
                     <th className="pr-3">Repaid</th>
                     <th className="pr-3">Result</th>
                     <th>Reason</th>
                  </tr>
               </thead>
               <tbody>
                  {loans.map((l) => {
                     const o = loanOutcome(l);
                     const early = daysEarly(l);
                     return (
                        <tr key={l.id} className="border-t border-[#2a1453] align-top">
                           <td className="py-2 pr-3 text-[#d9c9f5]">{bkkDate(l.funded_at ?? l.created_at)}</td>
                           <td className="pr-3 font-black text-white">{usd(l.amount)}</td>
                           <td className="pr-3 text-[#d9c9f5]">
                              {usd(l.total)}
                              {l.two_part ? <span className="ml-1 text-xs text-[#c9a7ff]">2 parts</span> : null}
                           </td>
                           <td className="pr-3 text-[#d9c9f5]">{bkkDate(l.due_date)}</td>
                           <td className="pr-3 text-[#d9c9f5]">
                              {l.repaid_at ? bkkDateTime(l.repaid_at) : Number(l.repaid ?? 0) > 0 ? `${usd(l.repaid)} so far` : '—'}
                           </td>
                           <td className={`pr-3 font-black ${OUTCOME[o].text}`}>
                              {OUTCOME[o].label}
                              {early != null && early !== 0 ? (
                                 <span className="block text-xs font-bold text-[#a89bb8]">
                                    {early > 0 ? `${early}d early` : `${-early}d late`}
                                 </span>
                              ) : null}
                           </td>
                           <td className="max-w-[260px] text-xs text-[#a89bb8]">{l.reason ?? ''}</td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         </div>
      </Card>
   );
}

/** What they tapped on the "About you" card, 🟡 when the ID disagrees (team-only, never graded). */
function AboutVsIdRow({ d }: { d: Dossier }) {
   const a = aboutVsId(d);
   if (!a) return null;
   return (
      <Row label="They said">
         <span className="inline-flex flex-wrap items-center gap-2">
            {a.said}
            {a.mismatches.length ? (
               <Pill tone="warn">🟡 {a.mismatches.join(' · ')}</Pill>
            ) : a.checked ? (
               <span className="text-xs font-semibold text-[#a89bb8]">matches ID</span>
            ) : null}
         </span>
      </Row>
   );
}

function Identity({ d, media, mediaError }: { d: Dossier; media: DiditSessionMedia[] | null; mediaError: string | null }) {
   const u = d.user;
   const kyc = d.kyc[0];
   const latest = media?.find((m) => !m.error) ?? null;
   // One of each kind (ID front, back, selfie…) from the newest check; repeat checks would show the same shots again.
   const photos = (media?.flatMap((m) => m.photos) ?? []).filter((p, i, all) => all.findIndex((q) => q.label === p.label) === i);
   const checks = media?.filter((m) => !m.error).length ?? 0;
   const warnings = Array.isArray(kyc?.warnings)
      ? (kyc.warnings as unknown[]).map((w) => (typeof w === 'string' ? w : JSON.stringify(w)))
      : [];
   return (
      <Card
         title="🪪 Identity (Didit)"
         right={latest?.status ? <Pill tone={latest.status === 'Approved' ? 'good' : 'warn'}>{latest.status}</Pill> : null}
      >
         {!kyc && !media?.length && u.is_didit !== 'ACTIVE' && !u.is_world_id ? <Empty>Not verified yet.</Empty> : null}
         <Row label="Verified with">
            {[
               u.is_world_id ? 'World ID' : null,
               u.is_didit === 'ACTIVE' ? 'Didit' : null,
               latest?.method
                  ? `${latest.method}${latest.features.length ? ` (${latest.features.join(', ').replace(/_/g, ' ').toLowerCase()})` : ''}`
                  : null
            ]
               .filter(Boolean)
               .join(' · ') || null}
         </Row>
         <Row label="Document">
            {[
               latest?.documentType ?? kyc?.document_type,
               latest?.issuingCountry ?? kyc?.issuing_state,
               kyc?.document_last4 ? `…${kyc.document_last4}` : null
            ]
               .filter(Boolean)
               .join(' · ') || null}
         </Row>
         <Row label="Name on ID">{kyc?.full_name}</Row>
         <Row label="Born">{kyc?.date_of_birth ? `${bkkDate(kyc.date_of_birth)} (${age(kyc.date_of_birth)})` : null}</Row>
         <Row label="Gender">{kyc?.gender}</Row>
         <Row label="Looks like">{photoEstimateText(d.photo_estimate)}</Row>
         <AboutVsIdRow d={d} />
         <Row label="Address on ID">{kyc?.formatted_address}</Row>
         <Row label="Face match">{latest?.faceMatchScore != null ? `${Math.round(latest.faceMatchScore)}%` : null}</Row>
         <Row label="Liveness">{latest?.livenessScore != null ? `${Math.round(latest.livenessScore)}%` : u.liveness_status}</Row>
         <Row label="Didit status">
            {u.didit_id_status ? `${u.didit_id_status}${u.didit_decline_reason ? ` — ${u.didit_decline_reason}` : ''}` : null}
         </Row>
         <Row label="Checked">
            {kyc?.session_created_at
               ? bkkDateTime(kyc.session_created_at)
               : u.didit_submitted_at
                 ? bkkDateTime(u.didit_submitted_at)
                 : null}
         </Row>
         <Row label="Cash-out face">{u.wallet_face_status}</Row>
         {d.kyc_declines.length ? (
            <Row label="Declines">
               {d.kyc_declines.map((k) => `${k.kind ?? 'declined'} ${bkkDate(k.declined_at)}${k.voided_at ? ' (voided)' : ''}`).join(' · ')}
            </Row>
         ) : null}
         {[...new Set([...warnings, ...(latest?.warnings ?? [])])].length ? (
            <div className="mt-2 rounded-xl bg-amber-950/40 p-3 text-sm text-amber-200">
               ⚠️ {[...new Set([...warnings, ...(latest?.warnings ?? [])])].join(' · ')}
            </div>
         ) : null}
         {media == null ? <p className="mt-3 text-sm text-[#a89bb8]">Loading Didit photos…</p> : null}
         {checks > 1 ? <p className="mt-3 text-xs text-[#a89bb8]">{checks} Didit checks · photos from the newest</p> : null}
         {photos.length ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
               {photos.map((p) => (
                  <Photo key={p.url} label={p.label} url={p.url} />
               ))}
            </div>
         ) : media && (kyc || u.is_didit === 'ACTIVE') ? (
            <p className="mt-3 text-sm text-[#6f6385]">No Didit photos{mediaError ? ` (${mediaError})` : ''}.</p>
         ) : null}
      </Card>
   );
}

function Income({ d }: { d: Dossier }) {
   const u = d.user;
   const payday =
      u.payday_type || u.payday_start
         ? `${u.payday_type ?? ''}${u.payday_start ? ` · day ${u.payday_start}${u.payday_end && u.payday_end !== u.payday_start ? `–${u.payday_end}` : ''}` : ''}`
         : null;
   const empty = !u.profession && !u.monthly_income && !u.income_type && !d.income_docs.length && !u.about_age;
   return (
      <Card title="💼 Work & income">
         {empty ? <Empty>Nothing filled in yet.</Empty> : null}
         <Row label="Job">
            {[...new Set([u.profession, d.call_screenings[0]?.answers?.role as string | undefined].filter(Boolean))].join(' · ') || null}
         </Row>
         <Row label="Income type">{u.income_type}</Row>
         <Row label="Monthly income">{moneyBand(u.monthly_income)}</Row>
         <Row label="Monthly costs">{moneyBand(u.monthly_expenses)}</Row>
         <Row label="Other income">{u.other_income}</Row>
         <Row label="Payday">{payday}</Row>
         <Row label="About them">{u.income_description}</Row>
         <Row label="Age / kids">
            {u.about_age || u.about_kids
               ? `${u.about_age ?? '?'} · ${u.about_kids ?? '?'} kids${u.about_gender ? ` · ${u.about_gender}` : ''}`
               : null}
         </Row>
         <Row label="Lives in">{u.location}</Row>
         {d.income_docs.map((doc, i) => (
            <div key={i} className="mt-3 rounded-2xl border border-[#2a1453] bg-[#14062b] p-3">
               <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-black text-white">📄 {doc.doc_type ?? 'Proof of income'}</span>
                  {doc.verdict ? <Pill tone={doc.verdict === 'looks_good' ? 'good' : 'warn'}>{doc.verdict.replace(/_/g, ' ')}</Pill> : null}
                  {doc.decision ? <Pill tone={doc.decision === 'approved' ? 'good' : 'bad'}>team: {doc.decision}</Pill> : null}
                  {doc.repay_chance != null ? <Pill>repay chance {doc.repay_chance}%</Pill> : null}
                  <span className="ml-auto text-xs text-[#a89bb8]">{bkkDate(doc.created_at)}</span>
               </div>
               {doc.ai_note ? <p className="mt-2 text-sm text-[#d9c9f5]">{doc.ai_note}</p> : null}
               {doc.memo ? <p className="mt-1 whitespace-pre-wrap text-xs text-[#a89bb8]">{doc.memo}</p> : null}
               <List items={doc.repay_reasons} />
               {doc.decision_reason ? <p className="mt-1 text-xs text-[#a89bb8]">Team: {doc.decision_reason}</p> : null}
            </div>
         ))}
      </Card>
   );
}

function TeamSummaries({ d }: { d: Dossier }) {
   const items: Array<{ key: string; title: string; at: string | null; body: ReactNode }> = [];
   for (const p of d.prescreens) {
      items.push({
         key: `ps-${p.created_at}`,
         title: `🎥 Pre-screening · ${p.score ?? p.overall ?? '–'} pts${p.repay_chance != null ? ` · repay chance ${p.repay_chance}%` : ''}`,
         at: p.created_at,
         body: (
            <>
               <div className="flex flex-wrap gap-2">
                  {p.verdict ? <Pill tone={p.verdict === 'good' ? 'good' : 'warn'}>AI: {p.verdict}</Pill> : null}
                  {p.team_decision ? (
                     <Pill tone={p.team_decision === 'good' ? 'good' : 'bad'}>
                        team: {p.team_decision}
                        {p.team_decided_at ? ` ${bkkDate(p.team_decided_at)}` : ''}
                     </Pill>
                  ) : null}
               </div>
               {p.summary ? <p className="mt-2 text-sm text-[#d9c9f5]">{p.summary}</p> : null}
               <List items={p.repay_reasons} />
               <List items={p.flags} />
               {p.team_reason ? <p className="mt-1 text-xs text-[#a89bb8]">Team: {p.team_reason}</p> : null}
            </>
         )
      });
   }
   for (const t of d.call_transcripts) {
      if (!t.summary) continue;
      items.push({
         key: `ct-${t.call_started_at}`,
         title: `📞 Call summary${t.risk_level ? ` · ${t.risk_level} risk` : ''}`,
         at: t.call_started_at,
         body: (
            <>
               {t.summary.summary ? <p className="text-sm text-[#d9c9f5]">{t.summary.summary}</p> : null}
               <Row label="Loan use">{t.summary.loan_use}</Row>
               <Row label="Repay plan">{t.summary.repayment_plan}</Row>
               <Row label="Work & income">{t.summary.income_and_work}</Row>
               <Row label="Matches bio">{t.summary.consistency_with_bio}</Row>
               <List items={t.summary.positives?.map((x) => `👍 ${x}`)} />
               <List items={t.summary.red_flags?.map((x) => `🚩 ${x}`)} />
            </>
         )
      });
   }
   for (const p of d.team_posts ?? []) {
      // Telegram HTML (<b>, <i>, links) shown as plain text; the first line is the title.
      const rest = p.body
         .replace(/<[^>]+>/g, '')
         .split('\n')
         .slice(1)
         .join('\n')
         .trim();
      items.push({
         key: `tp-${p.first_at}-${p.title}`,
         title: `💬 ${p.title}${p.times > 1 ? ` · ×${p.times}` : ''}`,
         at: p.last_at,
         body: (
            <>
               {rest ? <p className="whitespace-pre-wrap break-words text-sm text-[#d9c9f5]">{rest}</p> : null}
               <p className="mt-1 text-xs text-[#6f6385]">
                  Telegram{' '}
                  {p.times > 1 ? `· first ${bkkDateTime(p.first_at)} · last ${bkkDateTime(p.last_at)}` : `· ${bkkDateTime(p.last_at)}`}
                  {p.edited_at ? ' · updated' : ''}
               </p>
            </>
         )
      });
   }
   for (const a of d.risk_alerts) {
      items.push({
         key: `ra-${a.created_at}`,
         title: `🚨 Risk alert · ${a.severity ?? ''} ${a.signal ?? ''}`,
         at: a.created_at,
         body: <p className="text-sm text-[#d9c9f5]">{a.message}</p>
      });
   }
   if (d.linked_alert) {
      const detail = typeof d.linked_alert.detail === 'string' ? d.linked_alert.detail : JSON.stringify(d.linked_alert.detail, null, 1);
      items.push({
         key: 'linked',
         title: `🔗 Linked accounts${d.linked_alert.auto_rejected_at ? ' · auto-rejected' : ''}${d.linked_alert.team_cleared_at ? ' · cleared by team' : ''}`,
         at: d.linked_alert.alerted_at,
         body: <pre className="whitespace-pre-wrap break-words text-xs text-[#d9c9f5]">{detail}</pre>
      });
   }
   for (const b of d.bot_answers) {
      items.push({
         key: `bot-${b.created_at}`,
         title: `🤖 Booking bot · ${b.fit_verdict ?? b.kind ?? ''}`,
         at: b.created_at,
         body: b.fit_reason ? <p className="text-sm text-[#d9c9f5]">{b.fit_reason}</p> : null
      });
   }
   items.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
   return (
      <Card title="📝 What the team was told">
         <p className="mb-3 text-xs text-[#6f6385]">
            Team Telegram posts about this person (saved from Nov 25, 2026; repeats counted once), plus AI reads, call summaries and alerts.
         </p>
         {!items.length ? <Empty>No summaries yet.</Empty> : null}
         <div className="space-y-3">
            {items.map((it) => (
               <div key={it.key} className="rounded-2xl border border-[#2a1453] bg-[#14062b] p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                     <span className="text-sm font-black text-white">{it.title}</span>
                     <span className="shrink-0 text-xs text-[#a89bb8]">{bkkDate(it.at)}</span>
                  </div>
                  {it.body}
               </div>
            ))}
         </div>
      </Card>
   );
}

const ANSWER_LABELS: Record<string, string> = {
   fullName: 'Full name',
   role: 'Job',
   loanUse: 'Loan use',
   exchanges: 'Cash out with',
   referral: 'Referral',
   referredBy: 'Referred by',
   facebookUrl: 'Facebook',
   tiktokUrl: 'TikTok',
   showedCashInOut: 'Showed cash in/out',
   informedTerms: 'Told the terms',
   addedEmma: 'Added Emma'
};

function Call({ d }: { d: Dossier }) {
   const u = d.user;
   const [showTranscript, setShowTranscript] = useState(false);
   const transcript = d.call_transcripts.find((t) => t.transcript)?.transcript ?? null;
   const hadCall = u.video_call_starts_at || d.call_screenings.length || d.call_events.length || d.no_shows.length;
   const minutes =
      u.video_call_joined_at && u.video_call_left_at
         ? Math.round((new Date(u.video_call_left_at).getTime() - new Date(u.video_call_joined_at).getTime()) / 60000)
         : null;
   return (
      <Card
         title="📞 Call & call sheet"
         right={
            u.video_call_outcome ? (
               <Pill tone={u.video_call_outcome === 'attended' ? 'good' : 'bad'}>{u.video_call_outcome.replace('_', ' ')}</Pill>
            ) : null
         }
      >
         {!hadCall ? <Empty>No call booked.</Empty> : null}
         <Row label="Call time">{u.video_call_starts_at ? bkkDateTime(u.video_call_starts_at) : null}</Row>
         <Row label="Host">{u.video_call_host}</Row>
         <Row label="On the call">{minutes != null ? `${minutes} min (joined ${bkkDateTime(u.video_call_joined_at)})` : null}</Row>
         <Row label="No-shows">
            {d.no_shows.length ? d.no_shows.map((n) => `${bkkDate(n.recorded_at)}${n.active ? '' : ' (cleared)'}`).join(' · ') : null}
         </Row>
         <Row label="Moved">
            {d.call_events.some((e) => e.kind === 'moved' || e.kind === 'team_moved')
               ? `${d.call_events.filter((e) => e.kind === 'moved').length} by them · ${d.call_events.filter((e) => e.kind === 'team_moved').length} by team`
               : null}
         </Row>
         {d.call_screenings.map((s, i) => (
            <div key={i} className="mt-3 rounded-2xl border border-[#2a1453] bg-[#14062b] p-3">
               <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-white">🗒️ Call sheet{s.by ? ` · by ${s.by}` : ''}</span>
                  <span className="text-xs text-[#a89bb8]">{bkkDateTime(s.call_starts_at ?? s.created_at)}</span>
               </div>
               {s.score != null ? <Row label="Host score">{`${s.score} / 5`}</Row> : null}
               {Object.entries(s.answers ?? {}).map(([k, v]) =>
                  v == null || v === '' || (Array.isArray(v) && !v.length) ? null : (
                     <Row key={k} label={ANSWER_LABELS[k] ?? k}>
                        {Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}
                     </Row>
                  )
               )}
               <Row label="Notes">{s.notes}</Row>
               {s.red_flags ? <div className="mt-2 rounded-xl bg-red-950/40 p-2 text-sm text-red-200">🚩 {s.red_flags}</div> : null}
            </div>
         ))}
         {transcript ? (
            <div className="mt-3">
               <button type="button" onClick={() => setShowTranscript((v) => !v)} className="text-sm font-black text-[#c9a7ff] underline">
                  {showTranscript ? 'Hide transcript' : 'Show call transcript'}
               </button>
               {showTranscript ? (
                  <pre className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl bg-[#14062b] p-3 text-xs text-[#d9c9f5]">
                     {transcript}
                  </pre>
               ) : null}
            </div>
         ) : null}
      </Card>
   );
}

function Approval({ d }: { d: Dossier }) {
   const u = d.user;
   return (
      <Card title="✅ Approval">
         <Row label="Status">{u.loan_access_status}</Row>
         <Row label="Approved">{u.loan_access_approved_at ? bkkDateTime(u.loan_access_approved_at) : null}</Row>
         <Row label="Reject reason">{u.loan_access_reject_reason}</Row>
         <Row label="Credit limit">{u.cs != null ? `${usd(u.cs)}${u.credit_progression_paused ? ' (paused)' : ''}` : null}</Row>
         <Row label="Loan cap">{d.loan_cap ? `${usd(d.loan_cap.cap_usd)}${d.loan_cap.note ? ` — ${d.loan_cap.note}` : ''}` : null}</Row>
         <Row label="Requests blocked">{u.loan_requests_blocked ? 'Yes' : null}</Row>
         {d.access_requests.length ? (
            <div className="mt-2 space-y-2">
               {d.access_requests.map((r, i) => (
                  <div key={i} className="rounded-xl bg-[#14062b] p-3 text-sm">
                     <div className="flex flex-wrap items-center gap-2">
                        <Pill tone={accessTone(r.status)}>{r.status ?? '—'}</Pill>
                        <span className="font-bold text-white">{r.kind ?? 'request'}</span>
                        {r.channel ? <span className="text-[#a89bb8]">via {r.channel}</span> : null}
                        <span className="ml-auto text-xs text-[#a89bb8]">{bkkDateTime(r.created_at)}</span>
                     </div>
                     {r.reason ? <p className="mt-1 text-[#d9c9f5]">{r.reason}</p> : null}
                     {r.decided_at ? (
                        <p className="mt-1 text-xs text-[#a89bb8]">
                           Decided {bkkDateTime(r.decided_at)}
                           {r.decided_by ? ` by ${r.decided_by}` : ''}
                        </p>
                     ) : null}
                  </div>
               ))}
            </div>
         ) : null}
      </Card>
   );
}

function Risk({ d }: { d: Dossier }) {
   const u = d.user;
   const points = d.risk_scores.map((r) => ({ at: bkkDate(r.at), score: r.score }));
   return (
      <Card title="🛡️ Risk">
         <Row label="Risk score">
            {u.current_risk_score != null ? `${u.current_risk_score}${u.current_risk_band ? ` (${u.current_risk_band})` : ''}` : null}
         </Row>
         <Row label="Credit metrics">{`CS ${u.cs ?? 0} · MAL ${u.mal ?? 0} · NAL ${u.nal ?? 0}`}</Row>
         {points.length > 1 ? (
            <div className="my-2 h-28">
               <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points}>
                     <XAxis dataKey="at" hide />
                     <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                     <Tooltip contentStyle={{ background: '#241044', border: '1px solid #3d1f6e', borderRadius: 12, color: '#fff' }} />
                     <Line type="monotone" dataKey="score" stroke="#a06bff" strokeWidth={2} dot={false} />
                  </LineChart>
               </ResponsiveContainer>
            </div>
         ) : null}
         <Row label="Admin restriction">
            {d.restriction ? `${d.restriction.status}${d.restriction.admin_note ? ` — ${d.restriction.admin_note}` : ''}` : null}
         </Row>
         <Row label="Ghosted">{u.ghosted_at ? bkkDateTime(u.ghosted_at) : null}</Row>
         <Row label="Blocked for good">{u.blocked_for_good_at ? bkkDateTime(u.blocked_for_good_at) : null}</Row>
         <Row label="Cash-out face checks">
            {d.face_checks.length
               ? d.face_checks
                    .map(
                       (f) => `${f.status ?? '?'}${f.match_score != null ? ` ${Math.round(f.match_score)}%` : ''} ${bkkDate(f.created_at)}`
                    )
                    .join(' · ')
               : null}
         </Row>
         <Row label="Datacenter IP">{d.activity.hosting_ip ? '⚠️ Yes (VPN / hosting)' : null}</Row>
      </Card>
   );
}

function Activity({ d }: { d: Dossier }) {
   const a = d.activity;
   const u = d.user;
   return (
      <Card title="📱 Activity & devices">
         <Row label="Sign-ins">{`${a.sign_ins}${a.last_sign_in ? ` · last ${bkkDateTime(a.last_sign_in)}` : ''}`}</Row>
         <Row label="Days active">{`${a.days_seen}${a.last_seen ? ` · last seen ${bkkDateTime(a.last_seen)}` : ''}`}</Row>
         <Row label="Devices / IPs">{`${a.devices} devices · ${a.ips} IPs${a.push_devices ? ` · ${a.push_devices} with push` : ''}`}</Row>
         <Row label="Places">
            {a.places
               .filter((p) => p.city)
               .map((p) => `${p.city} (${p.days}d)`)
               .join(' · ') || null}
         </Row>
         <Row label="Messenger">
            {a.messenger_messages ? `${a.messenger_messages} messages · last ${bkkDate(a.messenger_last_seen)}` : null}
         </Row>
         <Row label="Repay reminders">{a.reminders_sent || null}</Row>
         <Row label="Signed up from">
            {[u.signup_source, u.signup_campaign, u.signup_browser, u.signup_os].filter(Boolean).join(' · ') || null}
         </Row>
         <Row label="Wallet">
            {u.wallet_address ? `${u.wallet_address.slice(0, 6)}…${u.wallet_address.slice(-4)} · ${u.wallet_provider ?? ''}` : null}
         </Row>
         <Row label="Lent to others">{d.lent_count ? `${d.lent_count} loans` : null}</Row>
      </Card>
   );
}

function Rewards({ d }: { d: Dossier }) {
   const r = d.rewards;
   const ref = d.referrals;
   return (
      <Card title="🎁 Rewards & referrals">
         <Row label="Invited by">
            {ref.invited_by ? (
               <Link to={`/admin/user/${ref.invited_by.id}`} className="text-[#c9a7ff] underline">
                  @{ref.invited_by.username}
                  {ref.invited_by.code ? ` (${ref.invited_by.code})` : ''}
               </Link>
            ) : null}
         </Row>
         <Row label="Their code">{ref.own_code}</Row>
         <Row label="Friends invited">
            {ref.invited.length ? (
               <span className="flex flex-wrap gap-x-2">
                  {ref.invited.map((f) => (
                     <Link key={f.id} to={`/admin/user/${f.id}`} className="text-[#c9a7ff] underline">
                        @{f.username}
                        {f.repaid ? ' ✅' : ''}
                     </Link>
                  ))}
               </span>
            ) : null}
         </Row>
         <Row label="Vouchers">
            {r.vouchers.length
               ? r.vouchers.map((v) => `₱${v.amount_php ?? '?'} ${v.brand ?? v.reward ?? ''} (${v.status ?? ''})`).join(' · ')
               : null}
         </Row>
         <Row label="Interest back">
            {r.interest_refunds.length ? r.interest_refunds.map((x) => `${usd(x.amount_usd)} ${x.status ?? ''}`).join(' · ') : null}
         </Row>
         <Row label="Spins">{r.spins || null}</Row>
         <Row label="Trust points">{r.trust_points ?? null}</Row>
         {!ref.invited_by && !ref.own_code && !ref.invited.length && !r.vouchers.length && !r.spins ? <Empty>Nothing yet.</Empty> : null}
      </Card>
   );
}

function DossierBody({ userId }: { userId: string }) {
   const [d, setD] = useState<Dossier | null | undefined>(undefined);
   const [error, setError] = useState<string | null>(null);
   const [media, setMedia] = useState<DiditSessionMedia[] | null>(null);
   const [mediaError, setMediaError] = useState<string | null>(null);

   const load = useCallback(async () => {
      setError(null);
      try {
         setD(await loadDossier(userId));
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not load this account.');
      }
   }, [userId]);

   useEffect(() => {
      setD(undefined);
      setMedia(null);
      void load();
      void loadDiditMedia(userId).then((r) => {
         setMedia(r.sessions);
         setMediaError(r.error ?? null);
      });
   }, [load, userId]);

   const stats = useMemo(() => (d ? loanStats(d.loans) : null), [d]);
   const selfie = media?.flatMap((m) => m.photos).find((p) => p.label === 'Selfie' || p.label === 'Liveness')?.url ?? null;

   if (error) return <p className="rounded-2xl bg-red-950/40 p-4 font-bold text-red-200">{error}</p>;
   if (d === undefined) return <p className="text-[#a89bb8]">Loading account…</p>;
   if (d === null || !stats) return <p className="text-[#a89bb8]">No account with this id.</p>;

   const u = d.user;
   return (
      <div className="space-y-5">
         <Header d={d} selfie={selfie} />
         <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <Kpi label="Credit limit" value={usd(u.cs)} note={d.loan_cap ? `cap ${usd(d.loan_cap.cap_usd)}` : undefined} />
            <Kpi label="Borrowed" value={usd(stats.borrowed)} note={`${stats.count} loans · biggest ${usd(stats.biggest)}`} />
            <Kpi label="Repaid" value={usd(stats.repaid)} tone={stats.repaid > 0 ? 'good' : 'default'} />
            <Kpi
               label="Owes now"
               value={usd(stats.outstanding)}
               tone={stats.overdue ? 'bad' : stats.outstanding > 0 ? 'warn' : 'good'}
               note={stats.overdue ? `${stats.overdue} overdue` : stats.open ? `${stats.open} open` : undefined}
            />
            <Kpi
               label="On time"
               value={stats.onTimeRate == null ? '—' : `${Math.round(stats.onTimeRate * 100)}%`}
               tone={stats.onTimeRate == null ? 'default' : stats.onTimeRate >= 0.8 ? 'good' : stats.onTimeRate >= 0.5 ? 'warn' : 'bad'}
               note={stats.onTime + stats.late ? `${stats.onTime} on time · ${stats.late} late` : undefined}
            />
            <Kpi
               label="Pays"
               value={
                  stats.avgDaysEarly == null
                     ? '—'
                     : stats.avgDaysEarly >= 0
                       ? `${stats.avgDaysEarly.toFixed(1)}d early`
                       : `${(-stats.avgDaysEarly).toFixed(1)}d late`
               }
               note="average vs due date"
            />
            <Kpi
               label="Risk score"
               value={u.current_risk_score ?? '—'}
               tone={riskTone(u.current_risk_band)}
               note={u.current_risk_band ?? undefined}
            />
         </div>
         <Journey d={d} />
         <div className="grid gap-5 xl:grid-cols-2">
            <div className="space-y-5">
               <Loans loans={d.loans} />
               <TeamSummaries d={d} />
               <Call d={d} />
            </div>
            <div className="space-y-5">
               <Identity d={d} media={media} mediaError={mediaError} />
               <Income d={d} />
               <Approval d={d} />
               <Risk d={d} />
               <Activity d={d} />
               <Rewards d={d} />
            </div>
         </div>
         <section>
            <h2 className="mb-2 text-lg font-black text-white">📸 Photos & proof they sent</h2>
            <ProofHistory userId={userId} />
         </section>
         <BorrowerTimeline userId={userId} />
      </div>
   );
}

export default function UserDossierPage() {
   const { userId = '' } = useParams<{ userId: string }>();
   return (
      <AdminLiveProvider>
         <main className="min-h-screen bg-[#120429] px-4 py-6 text-white sm:px-8">
            <div className="mx-auto max-w-[1400px]">
               <Link to="/admin" className="mb-4 inline-block text-sm font-black text-[#c9a7ff] no-underline">
                  ← All users
               </Link>
               <DossierBody key={userId} userId={userId} />
            </div>
         </main>
      </AdminLiveProvider>
   );
}
