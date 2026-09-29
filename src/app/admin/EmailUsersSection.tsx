'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type AdminEmailResult, type EmailableUserRow, listEmailableUsers, sendAdminEmail } from '@/app/admin/adminSupabase';

// Write one email, tick the people, send. Each person gets their own copy with {first_name} filled
// from their ID (or whatever name the admin types next to them). Sent from support@moodeng.app, so
// replies land in the support inbox. Every send is logged in admin_audit_logs.

type Filter = 'all' | 'borrowers' | 'lenders' | 'verified' | 'unverified';

const MAX_PER_SEND = 200;
const PLACEHOLDER = '{first_name}';

const FILTERS: Array<{ id: Filter; label: string }> = [
   { id: 'all', label: 'Everyone' },
   { id: 'borrowers', label: 'Borrowers' },
   { id: 'lenders', label: 'Lenders' },
   { id: 'verified', label: 'Verified' },
   { id: 'unverified', label: 'Not verified' }
];

const REASONS: Record<string, string> = {
   already_sent: 'already sent this one',
   no_email: 'no email on file',
   user_not_found: 'account not found'
};

const matchesFilter = (r: EmailableUserRow, filter: Filter) => {
   if (filter === 'borrowers') return r.role === 'borrower';
   if (filter === 'lenders') return r.role === 'lender';
   if (filter === 'verified') return r.verified;
   if (filter === 'unverified') return !r.verified;
   return true;
};

const shortDate = (iso: string | null) =>
   iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

const fill = (template: string, name: string) => template.replace(/\{\s*first_name\s*\}/gi, name);

const newBatchKey = () =>
   typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export default function EmailUsersSection() {
   const [rows, setRows] = useState<EmailableUserRow[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [filter, setFilter] = useState<Filter>('all');
   const [search, setSearch] = useState('');
   const [since, setSince] = useState('');
   const [selected, setSelected] = useState<Set<string>>(new Set());
   const [names, setNames] = useState<Record<string, string>>({});
   const [subject, setSubject] = useState('');
   const [message, setMessage] = useState('');
   const [sending, setSending] = useState(false);
   const [sendError, setSendError] = useState<string | null>(null);
   const [results, setResults] = useState<AdminEmailResult[] | null>(null);
   // One key per batch: a retry after a partial failure skips whoever already got it.
   const batchKey = useRef(newBatchKey());
   const messageRef = useRef<HTMLTextAreaElement>(null);

   const load = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
         setRows(await listEmailableUsers());
      } catch (err) {
         setError((err as { message?: string } | null)?.message || 'Could not load users.');
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      void load();
   }, [load]);

   const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

   const visible = useMemo(() => {
      const q = search.trim().toLowerCase();
      const sinceTime = since ? new Date(`${since}T00:00:00`).getTime() : null;
      return rows.filter((r) => {
         if (!matchesFilter(r, filter)) return false;
         if (sinceTime !== null && (!r.createdAt || new Date(r.createdAt).getTime() < sinceTime)) return false;
         if (!q) return true;
         return [r.kycName, r.firstName, r.username, r.email].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      });
   }, [rows, filter, search, since]);

   const counts = useMemo(
      () => Object.fromEntries(FILTERS.map((f) => [f.id, rows.filter((r) => matchesFilter(r, f.id)).length])) as Record<Filter, number>,
      [rows]
   );

   const selectedRows = useMemo(
      () => [...selected].map((id) => byId.get(id)).filter((r): r is EmailableUserRow => Boolean(r)),
      [selected, byId]
   );
   const nameFor = (r: EmailableUserRow) => names[r.id]?.trim() || r.firstName;

   const toggle = (id: string) =>
      setSelected((prev) => {
         const next = new Set(prev);
         if (next.has(id)) next.delete(id);
         else next.add(id);
         return next;
      });

   const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));
   const toggleAllVisible = () =>
      setSelected((prev) => {
         const next = new Set(prev);
         if (allVisibleSelected) visible.forEach((r) => next.delete(r.id));
         else visible.forEach((r) => next.add(r.id));
         return next;
      });

   const insertPlaceholder = () => {
      const el = messageRef.current;
      if (!el) {
         setMessage((m) => m + PLACEHOLDER);
         return;
      }
      const start = el.selectionStart ?? message.length;
      const end = el.selectionEnd ?? message.length;
      setMessage(message.slice(0, start) + PLACEHOLDER + message.slice(end));
      requestAnimationFrame(() => {
         el.focus();
         el.setSelectionRange(start + PLACEHOLDER.length, start + PLACEHOLDER.length);
      });
   };

   const previewFor = selectedRows[0] ?? null;
   const canSend = !sending && subject.trim() && message.trim() && selectedRows.length > 0 && selectedRows.length <= MAX_PER_SEND;

   const send = async () => {
      if (!canSend) return;
      const count = selectedRows.length;
      if (!window.confirm(`Send "${subject.trim()}" to ${count} ${count === 1 ? 'person' : 'people'}?`)) return;
      setSending(true);
      setSendError(null);
      setResults(null);
      try {
         const res = await sendAdminEmail({
            recipients: selectedRows.map((r) => ({ userId: r.id, name: nameFor(r) })),
            subject: subject.trim(),
            message: message.trim(),
            dedupeKey: batchKey.current
         });
         setResults(res.results);
         if (res.failed === 0) {
            // Done — start fresh so the next email is a new batch.
            setSelected(new Set());
            setNames({});
            setSubject('');
            setMessage('');
            batchKey.current = newBatchKey();
         }
      } catch (err) {
         setSendError((err as { message?: string } | null)?.message || 'Could not send.');
      } finally {
         setSending(false);
      }
   };

   const sentCount = results?.filter((r) => r.status === 'sent').length ?? 0;
   const problems = results?.filter((r) => r.status !== 'sent') ?? [];

   return (
      <div className="space-y-6">
         {/* Compose */}
         <div className="space-y-3 rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4">
            <input
               className="w-full rounded-xl border border-[#2a1453] bg-[#12052a] px-3 py-2 text-base font-bold text-white placeholder:text-[#7a6b8f]"
               maxLength={200}
               onChange={(e) => setSubject(e.target.value)}
               placeholder="Subject"
               value={subject}
            />
            <textarea
               className="min-h-44 w-full rounded-xl border border-[#2a1453] bg-[#12052a] p-3 text-base text-white placeholder:text-[#7a6b8f]"
               maxLength={10000}
               onChange={(e) => setMessage(e.target.value)}
               placeholder={`Hi ${PLACEHOLDER},\n\nWrite your message here…`}
               ref={messageRef}
               value={message}
            />
            <div className="flex flex-wrap items-center gap-2">
               <button
                  className="rounded-full bg-[#241044] px-4 py-1.5 text-sm font-black text-[#c9b8ff]"
                  onClick={insertPlaceholder}
                  type="button"
               >
                  + Insert first name
               </button>
               <span className="text-sm text-[#a89bb8]">
                  {PLACEHOLDER} becomes each person&apos;s first name. Sent from support@moodeng.app — replies go to the support inbox.
               </span>
            </div>

            {previewFor && (subject.trim() || message.trim()) ? (
               <div className="rounded-xl border border-[#2a1453] bg-white p-4 text-[#1a1a1a]">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#7a6b8f]">Preview for {previewFor.email}</p>
                  <p className="mt-1 font-black">{fill(subject.trim(), nameFor(previewFor))}</p>
                  <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{fill(message.trim(), nameFor(previewFor))}</p>
               </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
               <button
                  className="rounded-full bg-[#8336f0] px-5 py-2 text-base font-black text-white disabled:opacity-50"
                  disabled={!canSend}
                  onClick={() => void send()}
                  type="button"
               >
                  {sending
                     ? `Sending to ${selectedRows.length}…`
                     : `Send to ${selectedRows.length} ${selectedRows.length === 1 ? 'person' : 'people'}`}
               </button>
               {selectedRows.length > MAX_PER_SEND ? (
                  <span className="text-sm font-bold text-amber-300">Max {MAX_PER_SEND} per send — untick some.</span>
               ) : null}
               {sending ? <span className="text-sm text-[#a89bb8]">Takes about a second per person — keep this tab open.</span> : null}
            </div>

            {sendError ? <p className="rounded-xl border border-red-900 bg-red-950/40 p-3 font-bold text-red-300">{sendError}</p> : null}
            {results ? (
               <div className="rounded-xl border border-[#2a1453] bg-[#12052a] p-3 text-sm">
                  <p className="font-black text-emerald-300">
                     Sent to {sentCount} {sentCount === 1 ? 'person' : 'people'} ✓
                  </p>
                  {problems.length ? (
                     <ul className="mt-2 space-y-1 text-amber-300">
                        {problems.map((p) => (
                           <li key={p.userId}>
                              {p.email ?? p.userId}: {REASONS[p.reason ?? ''] ?? p.reason ?? p.status}
                           </li>
                        ))}
                        {problems.some((p) => p.status === 'failed') ? (
                           <li className="text-[#a89bb8]">Press Send again to retry — people who already got it are skipped.</li>
                        ) : null}
                     </ul>
                  ) : null}
               </div>
            ) : null}
         </div>

         {/* Pick people */}
         <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
               {FILTERS.map((f) => (
                  <button
                     className={`rounded-full px-4 py-1.5 text-sm font-black ${filter === f.id ? 'bg-[#8336f0] text-white' : 'bg-[#241044] text-[#a89bb8]'}`}
                     key={f.id}
                     onClick={() => setFilter(f.id)}
                     type="button"
                  >
                     {f.label} ({counts[f.id] ?? 0})
                  </button>
               ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
               <input
                  className="min-w-48 flex-1 rounded-full border border-[#2a1453] bg-[#1c0a3a] px-4 py-1.5 text-sm font-bold text-white placeholder:text-[#7a6b8f]"
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, username, email…"
                  value={search}
               />
               <label className="flex items-center gap-2 text-sm font-bold text-[#a89bb8]">
                  Signed up since
                  <input
                     className="rounded-full border border-[#2a1453] bg-[#1c0a3a] px-3 py-1 text-sm text-white [color-scheme:dark]"
                     onChange={(e) => setSince(e.target.value)}
                     type="date"
                     value={since}
                  />
               </label>
               <button
                  className="rounded-full bg-[#1c053d] px-4 py-1.5 text-sm font-black text-white disabled:opacity-50"
                  disabled={!visible.length}
                  onClick={toggleAllVisible}
                  type="button"
               >
                  {allVisibleSelected ? 'Untick all shown' : `Tick all shown (${visible.length})`}
               </button>
               {selected.size ? (
                  <button
                     className="rounded-full bg-[#241044] px-4 py-1.5 text-sm font-black text-[#a89bb8]"
                     onClick={() => setSelected(new Set())}
                     type="button"
                  >
                     Clear ({selected.size})
                  </button>
               ) : null}
               <button
                  className="rounded-full bg-[#1c053d] px-4 py-1.5 text-sm font-black text-white disabled:opacity-50"
                  disabled={loading}
                  onClick={() => void load()}
                  type="button"
               >
                  {loading ? 'Loading…' : 'Refresh'}
               </button>
            </div>

            {error ? (
               <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-lg font-bold text-red-300">{error}</div>
            ) : null}
            {!loading && !visible.length && !error ? <p className="text-lg text-[#a89bb8]">Nobody matches.</p> : null}

            <ul className="divide-y divide-[#2a1453] overflow-hidden rounded-2xl border border-[#2a1453] bg-[#1c0a3a]">
               {visible.map((r) => {
                  const checked = selected.has(r.id);
                  return (
                     <li className={`flex flex-wrap items-center gap-3 px-4 py-3 ${checked ? 'bg-[#241044]' : ''}`} key={r.id}>
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                           <input
                              checked={checked}
                              className="size-5 shrink-0 accent-[#8336f0]"
                              onChange={() => toggle(r.id)}
                              type="checkbox"
                           />
                           <span className="min-w-0">
                              <span className="block break-words font-black">{r.kycName ?? r.username ?? r.email}</span>
                              <span className="block break-all text-sm text-[#a89bb8]">
                                 {r.email}
                                 {r.username ? ` · @${r.username}` : ''}
                                 {r.createdAt ? ` · joined ${shortDate(r.createdAt)}` : ''}
                              </span>
                           </span>
                        </label>
                        <span className="flex flex-wrap items-center gap-2">
                           {r.role ? (
                              <span className="rounded-full bg-[#12052a] px-2.5 py-0.5 text-xs font-bold text-[#a89bb8]">{r.role}</span>
                           ) : null}
                           <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${r.verified ? 'bg-emerald-950 text-emerald-300' : 'bg-[#12052a] text-[#7a6b8f]'}`}
                           >
                              {r.verified ? 'verified' : 'not verified'}
                           </span>
                           {r.accountStatus && r.accountStatus !== 'active' ? (
                              <span className="rounded-full bg-red-950 px-2.5 py-0.5 text-xs font-bold text-red-300">
                                 {r.accountStatus}
                              </span>
                           ) : null}
                           {checked ? (
                              <label className="flex items-center gap-1.5 text-xs font-bold text-[#a89bb8]">
                                 Hi
                                 <input
                                    className="w-36 rounded-lg border border-[#2a1453] bg-[#12052a] px-2 py-1 text-sm text-white"
                                    onChange={(e) => setNames((prev) => ({ ...prev, [r.id]: e.target.value }))}
                                    placeholder={r.firstName}
                                    value={names[r.id] ?? r.firstName}
                                 />
                              </label>
                           ) : null}
                        </span>
                     </li>
                  );
               })}
            </ul>
         </div>
      </div>
   );
}
