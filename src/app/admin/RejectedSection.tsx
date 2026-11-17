'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { type AdminCallApprovalRow, approveAdminUser } from '@/app/admin/adminSupabase';
import CallSheet from '@/app/admin/CallSheet';
import { useAdminLiveReload } from '@/app/admin/useAdminLive';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// People → Rejected: everyone whose loan access is 'rejected', newest first. Shows when and by whom,
// and whether it's for good or "for now" (users.loan_access_retry_at — an hourly job reopens them on
// that day). Approve after all = the same approve_user action as the Directory and the Telegram card.

interface RejectedRow {
   userId: string;
   name: string;
   username: string | null;
   facebookName: string | null;
   retryAt: string | null;
   rejectedAt: string | null;
   decidedBy: string | null;
   reason: string | null;
   callStartsAt: string | null;
}

type Row = Record<string, unknown>;
const str = (value: unknown) => (typeof value === 'string' && value ? value : null);

async function fetchRejected(): Promise<RejectedRow[]> {
   const supabase = getSupabaseBrowserClient();
   const { data: users, error } = await supabase
      .from('users')
      .select('id,username,display_name,facebook_name,loan_access_retry_at,updated_at,video_call_starts_at')
      .eq('loan_access_status', 'rejected')
      .limit(1000);
   if (error) throw new Error(error.message);
   const ids = (users ?? []).map((u) => (u as Row).id as string);
   const latest = new Map<string, Row>();
   for (let i = 0; i < ids.length; i += 200) {
      const { data: requests, error: reqError } = await supabase
         .from('loan_access_requests')
         .select('user_id,status,reason,display_name,decided_at,decided_by,created_at')
         .in('user_id', ids.slice(i, i + 200))
         .eq('status', 'rejected')
         .order('decided_at', { ascending: false, nullsFirst: false });
      if (reqError) throw new Error(reqError.message);
      for (const r of (requests ?? []) as Row[]) if (!latest.has(r.user_id as string)) latest.set(r.user_id as string, r);
   }
   const rows = ((users ?? []) as Row[]).map((u): RejectedRow => {
      const req = latest.get(u.id as string);
      return {
         userId: u.id as string,
         name: str(u.display_name) ?? str(req?.display_name) ?? str(u.facebook_name) ?? str(u.username) ?? 'Borrower',
         username: str(u.username),
         facebookName: str(u.facebook_name),
         retryAt: str(u.loan_access_retry_at),
         rejectedAt: str(req?.decided_at) ?? str(u.updated_at),
         decidedBy: str(req?.decided_by),
         reason: str(req?.reason),
         callStartsAt: str(u.video_call_starts_at)
      };
   });
   return rows.sort((a, b) => Date.parse(b.rejectedAt ?? '') - Date.parse(a.rejectedAt ?? '') || 0);
}

const formatDate = (iso: string | null) =>
   iso
      ? new Date(iso).toLocaleString('en-GB', {
           timeZone: 'Asia/Bangkok',
           day: 'numeric',
           month: 'short',
           hour: 'numeric',
           minute: '2-digit'
        })
      : '';

const asSheetRow = (row: RejectedRow): AdminCallApprovalRow => ({
   userId: row.userId,
   name: row.name,
   username: row.username,
   facebookName: row.facebookName,
   loanAccessStatus: 'rejected',
   callStartsAt: row.callStartsAt,
   host: null,
   joinUrl: null,
   attendance: null,
   outcome: null,
   outcomeAt: null,
   request: null
});

export default function RejectedSection({ onCountChange }: { onCountChange?: (count: number) => void }) {
   const [rows, setRows] = useState<RejectedRow[] | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [busyId, setBusyId] = useState<string | null>(null);
   const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
   const [sheetRow, setSheetRow] = useState<AdminCallApprovalRow | null>(null);
   const [query, setQuery] = useState('');
   const [filter, setFilter] = useState<'all' | 'for_good' | 'for_now'>('all');

   const load = useCallback(async () => {
      try {
         setRows(await fetchRejected());
         setError(null);
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not load rejected people.');
      }
   }, []);

   useEffect(() => {
      void load();
   }, [load]);
   useAdminLiveReload(['users', 'loan_access_requests'], () => load());

   useEffect(() => {
      if (rows) onCountChange?.(rows.length);
   }, [rows, onCountChange]);

   const shown = useMemo(() => {
      const q = query.trim().toLowerCase();
      return (rows ?? []).filter((r) => {
         if (filter === 'for_good' && r.retryAt) return false;
         if (filter === 'for_now' && !r.retryAt) return false;
         return !q || `${r.name} ${r.username ?? ''} ${r.facebookName ?? ''}`.toLowerCase().includes(q);
      });
   }, [rows, query, filter]);

   const forNowCount = (rows ?? []).filter((r) => r.retryAt).length;

   const approve = async (row: RejectedRow) => {
      if (!window.confirm(`Approve ${row.name} after all? They'll get the "You're approved" message.`)) return;
      setBusyId(row.userId);
      setNotice(null);
      try {
         const result = await approveAdminUser(row.userId);
         setNotice({ ok: result.ok, text: result.summary });
         await load();
      } catch (err) {
         setNotice({ ok: false, text: err instanceof Error ? err.message : 'Could not approve.' });
      } finally {
         setBusyId(null);
      }
   };

   const chip = (id: typeof filter, label: string) => (
      <button
         type="button"
         onClick={() => setFilter(id)}
         className={`rounded-full px-4 py-1.5 text-sm font-black ${filter === id ? 'bg-[#8336f0] text-white' : 'border border-[#3d1f6e] text-[#c9bde0] hover:bg-[#2a1453]'}`}
      >
         {label}
      </button>
   );

   return (
      <section className="space-y-6">
         {sheetRow ? <CallSheet onClose={() => setSheetRow(null)} row={sheetRow} /> : null}
         <div>
            <h2 className="break-words text-2xl font-black sm:text-3xl">
               Rejected {rows ? <span className="text-[#a89bb8]">{rows.length}</span> : null}
            </h2>
            <p className="mt-1.5 max-w-3xl text-base text-[#a89bb8]">
               Everyone we said no to, newest first. They can&apos;t book a call or ask again. “For now” people reopen by themselves on
               their date; “for good” stay closed unless you approve them here.
            </p>
         </div>
         {notice ? (
            <p
               className={`rounded-2xl border p-4 text-base font-bold ${notice.ok ? 'border-emerald-900 bg-emerald-950/60 text-emerald-300' : 'border-amber-900 bg-amber-950/60 text-amber-300'}`}
            >
               {notice.text}
            </p>
         ) : null}
         {error ? <p className="rounded-2xl border border-red-900 bg-red-950/60 p-4 text-base font-bold text-red-300">{error}</p> : null}
         {!rows && !error ? <p className="text-lg text-[#a89bb8]">Loading…</p> : null}
         <div className="flex flex-wrap items-center gap-3">
            <input
               type="search"
               value={query}
               onChange={(e) => setQuery(e.target.value)}
               placeholder="Search by name, username or Facebook name"
               className="w-full max-w-md rounded-xl border border-[#3d1f6e] bg-[#1c0a3a] px-4 py-2.5 text-base text-white placeholder:text-[#a89bb8]"
            />
            {chip('all', 'All')}
            {chip('for_good', `For good ${(rows?.length ?? 0) - forNowCount}`)}
            {chip('for_now', `For now ${forNowCount}`)}
         </div>
         {rows ? (
            shown.length ? (
               <ul className="space-y-3">
                  {shown.map((row) => (
                     <li key={row.userId} className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                           <div className="min-w-0">
                              <p className="break-words text-lg font-black text-white">{row.name}</p>
                              {row.username || row.facebookName ? (
                                 <p className="break-words text-sm text-[#c9bde0]">
                                    {[row.username ? `@${row.username}` : null, row.facebookName ? `FB: ${row.facebookName}` : null]
                                       .filter(Boolean)
                                       .join(' · ')}
                                 </p>
                              ) : null}
                              <p className="mt-0.5 text-sm font-bold text-red-300">
                                 Rejected {formatDate(row.rejectedAt)}
                                 {row.decidedBy ? ` · by ${row.decidedBy}` : ''}
                              </p>
                              <p className={`mt-0.5 text-sm font-black ${row.retryAt ? 'text-amber-300' : 'text-[#a89bb8]'}`}>
                                 {row.retryAt ? `⏳ For now — can ask again ${formatDate(row.retryAt)}` : '🚫 For good'}
                              </p>
                              {row.reason ? <p className="mt-1 break-words text-sm text-[#a89bb8]">“{row.reason}”</p> : null}
                           </div>
                           <div className="flex flex-wrap gap-2">
                              <button
                                 type="button"
                                 onClick={() => setSheetRow(asSheetRow(row))}
                                 className="rounded-xl border border-[#8336f0] px-4 py-2 text-sm font-black text-white hover:bg-[#2a1453]"
                              >
                                 📋 Call sheet
                              </button>
                              <button
                                 type="button"
                                 disabled={busyId === row.userId}
                                 onClick={() => approve(row)}
                                 className="rounded-xl border border-emerald-700 px-4 py-2 text-sm font-black text-emerald-300 hover:bg-emerald-950 disabled:opacity-50"
                              >
                                 ✅ Approve after all
                              </button>
                           </div>
                        </div>
                     </li>
                  ))}
               </ul>
            ) : (
               <p className="text-base text-[#a89bb8]">{query || filter !== 'all' ? 'No match.' : 'Nobody is rejected.'}</p>
            )
         ) : null}
      </section>
   );
}
