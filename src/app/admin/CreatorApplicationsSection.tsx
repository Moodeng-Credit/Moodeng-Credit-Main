'use client';

import { useCallback, useEffect, useState } from 'react';

import {
   type AdminCreatorApplication,
   decideCreatorApplication,
   fetchAdminCreatorApplications,
   safeHttpUrl,
   suggestCreatorCode
} from '@/lib/creatorApplication';

/** Admin → Affiliates: applications from moodeng.app/creator. Approve = code + one-time /partner link emailed. */
export default function CreatorApplicationsSection() {
   const [rows, setRows] = useState<AdminCreatorApplication[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [showDone, setShowDone] = useState(false);

   const load = useCallback(async () => {
      try {
         setRows(await fetchAdminCreatorApplications());
         setError(null);
      } catch (err) {
         setError((err as Error)?.message || 'Could not load applications.');
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      void load();
   }, [load]);

   const pending = rows.filter((r) => r.status === 'pending');
   const decided = rows.filter((r) => r.status !== 'pending');

   return (
      <section className="space-y-4">
         <div>
            <h2 className="break-words text-2xl font-black sm:text-3xl">Creator applications</h2>
            <p className="mt-1.5 max-w-3xl text-base text-[#a89bb8]">
               From{' '}
               <a href="https://moodeng.app/creator" target="_blank" rel="noreferrer" className="underline">
                  moodeng.app/creator
               </a>
               . Approve gives them a code and emails a one-time partner sign-up link ($5 per friend; change it in Referral codes). Reject
               sends a polite no.
            </p>
         </div>
         {loading ? <p className="text-[#a89bb8]">Loading…</p> : null}
         {error ? <p className="text-red-300">{error}</p> : null}
         {!loading && !error && !pending.length ? <p className="text-lg font-bold text-white">No new applications ✓</p> : null}
         <div className="grid gap-4 lg:grid-cols-2">
            {pending.map((r) => (
               <ApplicationCard key={r.id} app={r} onDone={load} />
            ))}
         </div>
         {decided.length ? (
            <div>
               <button type="button" onClick={() => setShowDone((v) => !v)} className="text-sm text-[#b99cff] underline">
                  {showDone ? 'Hide' : 'Show'} decided ({decided.length})
               </button>
               {showDone ? (
                  <ul className="mt-2 max-w-3xl divide-y divide-white/10 rounded-xl bg-[#241044]">
                     {decided.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm text-white">
                           <span>
                              <b>{r.app_number}</b> · {r.full_name} · {r.email}
                              {r.referral_code ? <span className="text-[#a89bb8]"> · code {r.referral_code}</span> : null}
                           </span>
                           <span
                              className={
                                 r.status === 'approved'
                                    ? 'rounded-full bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300'
                                    : 'rounded-full bg-red-500/20 px-2 py-0.5 font-bold text-red-300'
                              }
                           >
                              {r.status === 'approved' ? 'Approved' : 'Rejected'}
                           </span>
                        </li>
                     ))}
                  </ul>
               ) : null}
            </div>
         ) : null}
      </section>
   );
}

function ApplicationCard({ app, onDone }: { app: AdminCreatorApplication; onDone: () => void }) {
   const [code, setCode] = useState(() => suggestCreatorCode(app.full_name));
   const [busy, setBusy] = useState<'approved' | 'rejected' | null>(null);
   const [msg, setMsg] = useState<string | null>(null);

   const decide = async (decision: 'approved' | 'rejected') => {
      if (decision === 'rejected' && !window.confirm(`Reject ${app.full_name}? They get an email.`)) return;
      setBusy(decision);
      setMsg(null);
      try {
         await decideCreatorApplication(app.id, decision, decision === 'approved' ? code : undefined);
         onDone();
      } catch (err) {
         setMsg((err as Error)?.message || 'Failed.');
      } finally {
         setBusy(null);
      }
   };

   const links = (
      [
         ['Facebook', app.facebook_url],
         ['TikTok', app.tiktok_url],
         ['YouTube', app.youtube_url],
         ['Instagram', app.instagram_url]
      ] as const
   ).filter(([, u]) => u);

   return (
      <div className="space-y-3 rounded-2xl bg-[#241044] p-4 text-white">
         <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-bold">{app.full_name}</h3>
            <span className="text-xs text-[#a89bb8]">
               {app.app_number}
               {app.verified_at
                  ? ` · ${new Date(app.verified_at).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                  : ''}
            </span>
         </div>
         <p className="text-sm text-[#d9cfe6]">
            {app.phone} · {app.email}
            <br />
            {app.address}
         </p>
         <div className="flex flex-wrap gap-2 text-sm">
            {links.length ? (
               links.map(([label, url]) => {
                  const href = safeHttpUrl(url);
                  return href ? (
                     <a key={label} href={href} target="_blank" rel="noreferrer" className="rounded-full bg-white/10 px-3 py-1 underline">
                        {label}
                     </a>
                  ) : (
                     <span key={label} className="rounded-full bg-white/10 px-3 py-1">
                        {label}: {url}
                     </span>
                  );
               })
            ) : (
               <span className="text-[#a89bb8]">No social links</span>
            )}
         </div>
         <p className="text-sm">
            Fintech before: <b>{app.prior_fintech ? 'YES' : 'no'}</b>
            {app.prior_fintech_details ? <span className="text-[#a89bb8]"> ({app.prior_fintech_details})</span> : null}
            {' · '}Conflict: <b className={app.conflict ? 'text-amber-300' : undefined}>{app.conflict ? 'YES' : 'no'}</b>
            {app.conflict_details ? <span className="text-[#a89bb8]"> ({app.conflict_details})</span> : null}
         </p>
         {app.pitch ? <p className="whitespace-pre-wrap rounded-xl bg-black/20 p-3 text-sm text-[#d9cfe6]">“{app.pitch}”</p> : null}
         <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
               value={code}
               onChange={(e) =>
                  setCode(
                     e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, '')
                        .slice(0, 20)
                  )
               }
               aria-label="Their code"
               className="w-36 rounded-xl bg-[#100d17] px-3 py-2 font-bold tracking-wider text-white"
            />
            <button
               type="button"
               disabled={Boolean(busy) || code.length < 3}
               onClick={() => decide('approved')}
               className="rounded-xl bg-emerald-500 px-4 py-2 font-bold text-white disabled:opacity-50"
            >
               {busy === 'approved' ? 'Approving…' : '✅ Approve'}
            </button>
            <button
               type="button"
               disabled={Boolean(busy)}
               onClick={() => decide('rejected')}
               className="rounded-xl bg-white/10 px-4 py-2 font-bold text-white disabled:opacity-50"
            >
               {busy === 'rejected' ? 'Rejecting…' : 'Reject'}
            </button>
         </div>
         {msg ? <p className="text-sm text-red-300">{msg}</p> : null}
      </div>
   );
}
