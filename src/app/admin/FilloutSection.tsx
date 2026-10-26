'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AdminCallApprovalRow } from '@/app/admin/adminSupabase';
import CallSheet from '@/app/admin/CallSheet';
import type { ScreeningAnswers } from '@/app/admin/callSheetData';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// Admin → People → Fillout (/admin/fillout): every Screening Questions form the hosts filled in on
// onboarding calls (call_screenings — the old Fillout form, now native). Click a row to open its call sheet.

type AnyRow = Record<string, any>;

interface FilloutRow {
   id: string;
   userId: string;
   name: string;
   username: string | null;
   callStartsAt: string | null;
   answers: ScreeningAnswers;
   notes: string;
   redFlags: string;
   score: number | null;
   updatedAt: string;
}

const when = (iso: string | null) =>
   iso ? new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

async function loadFillouts(): Promise<FilloutRow[]> {
   const supabase = getSupabaseBrowserClient();
   const { data, error } = await supabase
      .from('call_screenings')
      .select('id,user_id,call_starts_at,answers,notes,red_flags,score,updated_at')
      .order('updated_at', { ascending: false })
      .limit(500);
   if (error) throw error;
   const rows = (data ?? []) as AnyRow[];
   const ids = [...new Set(rows.map((r) => r.user_id as string))];
   const users = new Map<string, AnyRow>();
   if (ids.length) {
      const { data: u, error: uErr } = await supabase.from('users').select('id,username,display_name').in('id', ids);
      if (uErr) throw uErr;
      for (const row of (u ?? []) as AnyRow[]) users.set(row.id, row);
   }
   return rows.map((r) => {
      const u = users.get(r.user_id);
      const answers = (r.answers ?? {}) as ScreeningAnswers;
      return {
         id: r.id,
         userId: r.user_id,
         name: answers.fullName || u?.display_name || u?.username || r.user_id.slice(0, 8),
         username: u?.username ?? null,
         callStartsAt: r.call_starts_at ?? null,
         answers,
         notes: r.notes ?? '',
         redFlags: r.red_flags ?? '',
         score: r.score ?? null,
         updatedAt: r.updated_at
      };
   });
}

// The page link (/admin/fillout), or one form's (/admin/fillout?form=<id> opens its call sheet).
const filloutLink = (formId?: string) => `${window.location.origin}/admin/fillout${formId ? `?form=${formId}` : ''}`;

// Phone share sheet where there is one, else copy to the clipboard.
async function shareLink(url: string, title: string): Promise<'shared' | 'copied' | null> {
   if (typeof navigator.share === 'function') {
      try {
         await navigator.share({ title, url });
         return 'shared';
      } catch {
         return null;
      }
   }
   await navigator.clipboard.writeText(url);
   return 'copied';
}

function ShareIcon() {
   return (
      <svg
         aria-hidden
         className="size-4"
         fill="none"
         stroke="currentColor"
         strokeLinecap="round"
         strokeLinejoin="round"
         strokeWidth={2}
         viewBox="0 0 24 24"
      >
         <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
         <path d="M16 6l-4-4-4 4" />
         <path d="M12 2v13" />
      </svg>
   );
}

const toCallRow = (r: FilloutRow): AdminCallApprovalRow => ({
   userId: r.userId,
   name: r.name,
   username: r.username,
   loanAccessStatus: null,
   callStartsAt: r.callStartsAt,
   host: null,
   joinUrl: null,
   attendance: null,
   outcome: null,
   outcomeAt: null,
   request: null
});

export default function FilloutSection() {
   const [rows, setRows] = useState<FilloutRow[] | null>(null);
   const [error, setError] = useState('');
   const [query, setQuery] = useState('');
   const [open, setOpen] = useState<FilloutRow | null>(null);
   const [toast, setToast] = useState('');
   const formParamHandled = useRef(false);

   const share = async (url: string, title: string) => {
      const result = await shareLink(url, title).catch(() => null);
      if (result === 'copied') {
         setToast('Link copied');
         setTimeout(() => setToast(''), 2000);
      }
   };

   const load = useCallback(async () => {
      try {
         setRows(await loadFillouts());
         setError('');
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not load forms.');
      }
   }, []);

   useEffect(() => {
      void load();
   }, [load]);

   // A shared form link (?form=<id>) opens that form's call sheet once the list loads.
   useEffect(() => {
      if (formParamHandled.current || !rows) return;
      formParamHandled.current = true;
      const id = new URLSearchParams(window.location.search).get('form');
      const row = id ? rows.find((r) => r.id === id) : undefined;
      if (row) setOpen(row);
   }, [rows]);

   const shown = useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!rows || !q) return rows ?? [];
      return rows.filter((r) =>
         [r.name, r.username, r.answers.role, r.answers.referral, r.answers.loanUse, r.notes, r.redFlags]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))
      );
   }, [rows, query]);

   return (
      <section className="space-y-4">
         {open ? (
            <CallSheet
               onClose={() => {
                  setOpen(null);
                  void load();
               }}
               row={toCallRow(open)}
            />
         ) : null}
         <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
               <h2 className="text-lg font-semibold text-[#1f1f1f]">Fillout — Screening Questions</h2>
               <p className="text-sm text-[#7a7a7a]">
                  Every screening form filled in on an onboarding call. Click a row to open the call sheet.
               </p>
            </div>
            <div className="flex items-center gap-2">
               {toast ? <span className="text-xs font-medium text-[#1f7a3d]">{toast}</span> : null}
               <button
                  aria-label="Share link to this page"
                  className="flex items-center gap-1.5 rounded-md border border-[#e3e3e3] bg-white px-2.5 py-1.5 text-sm text-[#37352f] hover:bg-[#f7f5ff]"
                  onClick={() => void share(filloutLink(), 'Moodeng — Screening forms')}
                  title="Share link"
                  type="button"
               >
                  <ShareIcon />
                  Share
               </button>
               <input
                  className="w-64 rounded-md border border-[#e3e3e3] px-2.5 py-1.5 text-sm focus:border-[#6b55f7] focus:outline-none"
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, role, notes…"
                  value={query}
               />
            </div>
         </div>
         {error ? <p className="text-sm text-red-600">{error}</p> : null}
         {!rows ? (
            <p className="text-sm text-[#7a7a7a]">Loading…</p>
         ) : shown.length === 0 ? (
            <p className="text-sm text-[#7a7a7a]">No forms yet.</p>
         ) : (
            <div className="overflow-x-auto rounded-lg border border-[#e3e3e3] bg-white">
               <table className="w-full text-left text-sm">
                  <thead className="bg-[#fafafa] text-xs text-[#7a7a7a]">
                     <tr>
                        <th className="px-3 py-2">Borrower</th>
                        <th className="px-3 py-2">Call</th>
                        <th className="px-3 py-2">Role</th>
                        <th className="px-3 py-2">Loan use</th>
                        <th className="px-3 py-2">Covered</th>
                        <th className="px-3 py-2">Score</th>
                        <th className="px-3 py-2">Red flags</th>
                        <th className="px-3 py-2">Updated</th>
                        <th className="px-3 py-2" />
                     </tr>
                  </thead>
                  <tbody>
                     {shown.map((r) => {
                        const covered = [r.answers.showedCashInOut, r.answers.informedTerms, r.answers.addedEmma].filter(Boolean).length;
                        return (
                           <tr
                              className="cursor-pointer border-t border-[#f0f0f0] hover:bg-[#f7f5ff]"
                              key={r.id}
                              onClick={() => setOpen(r)}
                           >
                              <td className="px-3 py-2">
                                 <div className="font-medium text-[#1f1f1f]">{r.name}</div>
                                 {r.username ? <div className="text-xs text-[#9a9a9a]">@{r.username}</div> : null}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2">{when(r.callStartsAt)}</td>
                              <td className="px-3 py-2">{r.answers.role || '—'}</td>
                              <td className="max-w-[240px] truncate px-3 py-2">{r.answers.loanUse || '—'}</td>
                              <td className="px-3 py-2">{covered}/3</td>
                              <td className="px-3 py-2">{r.score ?? '—'}</td>
                              <td className="max-w-[200px] truncate px-3 py-2 text-red-700">{r.redFlags || ''}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-[#7a7a7a]">{when(r.updatedAt)}</td>
                              <td className="px-2 py-2">
                                 <button
                                    aria-label={`Share ${r.name}'s form`}
                                    className="rounded p-1.5 text-[#7a7a7a] hover:bg-[#ece8ff] hover:text-[#6b55f7]"
                                    onClick={(e) => {
                                       e.stopPropagation();
                                       void share(filloutLink(r.id), `Screening form — ${r.name}`);
                                    }}
                                    title="Share link to this form"
                                    type="button"
                                 >
                                    <ShareIcon />
                                 </button>
                              </td>
                           </tr>
                        );
                     })}
                  </tbody>
               </table>
            </div>
         )}
      </section>
   );
}
