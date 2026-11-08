'use client';

import { useCallback, useEffect, useState } from 'react';

import {
   type AdminProofRequest,
   type AdminUserOption,
   listProofRequests,
   proofFileUrl,
   resendProofRequest,
   reviewProofRequest
} from '@/app/admin/adminSupabase';
import ProofRequestComposer from '@/app/admin/ProofRequestComposer';
import UserPicker from '@/app/admin/UserPicker';
import { proofLink } from '@/lib/proofRequests';

// Admin → People → Proof requests: every link sent to a new applicant after their call. "To review"
// shows what they answered and uploaded, item by item; "Looks good" closes it, "Ask again" opens the
// link again with what's still missing and tells them. No automatic checks — the team decides.

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err));
const personLabel = (p: AdminProofRequest['user']) =>
   p ? p.display_name?.trim() || (p.username ? `@${p.username}` : 'Unknown') : 'Deleted account';
const bkk = (iso: string) =>
   new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Bangkok', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

type Filter = 'submitted' | 'open' | 'reviewed';
const FILTERS: Array<{ id: Filter; label: string }> = [
   { id: 'submitted', label: 'To review' },
   { id: 'open', label: 'Waiting on them' },
   { id: 'reviewed', label: 'Done' }
];

function FileTiles({ files }: { files: AdminProofRequest['files'] }) {
   const [urls, setUrls] = useState<Record<string, string>>({});
   useEffect(() => {
      let cancelled = false;
      for (const f of files) {
         if (!(f.mime ?? '').startsWith('image/') || /hei[cf]/.test(f.mime ?? '')) continue;
         void proofFileUrl(f.path)
            .then((url) => !cancelled && setUrls((prev) => ({ ...prev, [f.path]: url })))
            .catch(() => undefined);
      }
      return () => {
         cancelled = true;
      };
   }, [files]);
   const open = async (path: string) => {
      try {
         window.open(await proofFileUrl(path), '_blank', 'noopener');
      } catch {
         // Link failed; nothing to open.
      }
   };
   return (
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
         {files.map((f, i) => (
            <button
               className="relative h-36 w-28 shrink-0 overflow-hidden rounded-xl border border-[#3a2d4f] bg-[#241044] text-left"
               key={f.path}
               onClick={() => void open(f.path)}
               title={f.name}
               type="button"
            >
               {urls[f.path] ? (
                  <img alt={f.name ?? `File ${i + 1}`} className="size-full object-cover object-top" src={urls[f.path]} />
               ) : (
                  <span className="flex size-full flex-col items-center justify-center gap-1 px-2 text-center text-xs font-bold text-[#cfc6dd]">
                     <span className="text-2xl">{f.mime === 'application/pdf' ? '📄' : '🖼️'}</span>
                     <span className="line-clamp-3 break-all">{f.name ?? `File ${i + 1}`}</span>
                  </span>
               )}
               <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-white">open</span>
            </button>
         ))}
      </div>
   );
}

function RequestCard({ r, onChanged }: { r: AdminProofRequest; onChanged: () => void }) {
   const [busy, setBusy] = useState(false);
   const [asking, setAsking] = useState(false);
   const [note, setNote] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [copied, setCopied] = useState(false);

   const act = async (fn: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      try {
         await fn();
         onChanged();
      } catch (err) {
         setError(errorMessage(err));
      } finally {
         setBusy(false);
      }
   };
   const expired = r.status === 'open' && new Date(r.expires_at).getTime() < Date.now();
   const seen = r.opened_at ? `👀 Opened ${bkk(r.opened_at)}` : '🙈 Not opened yet';
   const sent = r.sent_at
      ? `📨 Sent ${r.sent_via?.length ? `via ${r.sent_via.join(', ')}` : '(no channel reached them — copy the link)'}`
      : '🔗 Link only';

   return (
      <li className="rounded-2xl border border-[#3a2d4f] bg-[#1c0a3a] p-4">
         <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
               <p className="text-lg font-black text-white">
                  {personLabel(r.user)}
                  {r.submit_count > 1 ? (
                     <span className="ml-2 rounded-lg bg-[#34234f] px-2 py-0.5 text-sm text-[#cfc6dd]">sent #{r.submit_count}</span>
                  ) : null}
                  {r.review === 'ok' ? (
                     <span className="ml-2 rounded-lg bg-emerald-600 px-2 py-0.5 text-sm text-white">✅ Looks good</span>
                  ) : null}
                  {expired ? <span className="ml-2 rounded-lg bg-[#5a2a2a] px-2 py-0.5 text-sm text-[#f2c4bf]">Expired</span> : null}
               </p>
               <p className="text-sm text-[#a89bb8]">
                  Asked {bkk(r.created_at)}
                  {r.created_by ? ` by ${r.created_by}` : ''} · {sent} · {seen}
                  {r.submitted_at ? ` · 📥 Sent back ${bkk(r.submitted_at)}` : ''}
               </p>
               {r.message ? <p className="mt-1 text-sm italic text-[#cfc6dd]">Note: “{r.message}”</p> : null}
               {r.review === 'ask_again' && r.status === 'open' ? (
                  <p className="mt-1 text-sm font-bold text-amber-300">↩️ Asked again: “{r.review_note}”</p>
               ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
               <button
                  className="rounded-xl bg-[#34234f] px-3 py-1.5 text-sm font-black text-white"
                  onClick={async () => {
                     await navigator.clipboard.writeText(proofLink(r.token));
                     setCopied(true);
                     window.setTimeout(() => setCopied(false), 1500);
                  }}
                  type="button"
               >
                  {copied ? 'Copied ✓' : '🔗 Copy link'}
               </button>
               {r.status === 'open' ? (
                  <button
                     className="rounded-xl bg-[#34234f] px-3 py-1.5 text-sm font-black text-white disabled:opacity-50"
                     disabled={busy}
                     onClick={() => void act(() => resendProofRequest(r.id))}
                     type="button"
                  >
                     📨 Send again
                  </button>
               ) : null}
            </div>
         </div>

         <ol className="mt-3 space-y-3">
            {r.items.map((item, i) => {
               const a = r.answers?.[item.id] ?? {};
               const files = r.files.filter((f) => f.item === item.id);
               return (
                  <li className="rounded-xl bg-[#241044] p-3" key={item.id}>
                     <p className="text-base font-bold text-white">
                        {i + 1}. {item.kind === 'question' ? '❓' : '📎'} {item.label}
                     </p>
                     {item.kind === 'question' ? (
                        <p className="mt-1 whitespace-pre-wrap text-base text-[#e6def2]">
                           {a.text ? `“${a.text}”` : <span className="text-[#6f6385]">No answer yet</span>}
                        </p>
                     ) : a.missing ? (
                        <p className="mt-1 text-base font-semibold text-amber-300">⚠️ Can’t send it: “{a.text}”</p>
                     ) : files.length ? (
                        <>
                           <FileTiles files={files} />
                           {a.text ? <p className="mt-1 text-sm text-[#cfc6dd]">“{a.text}”</p> : null}
                        </>
                     ) : (
                        <p className="mt-1 text-sm text-[#6f6385]">Nothing yet</p>
                     )}
                  </li>
               );
            })}
         </ol>

         {r.status === 'submitted' ? (
            <div className="mt-3 space-y-2">
               {asking ? (
                  <>
                     <textarea
                        className="w-full rounded-xl border border-[#3a2d4f] bg-[#120626] p-2.5 text-base text-white placeholder:text-[#6f6385]"
                        maxLength={500}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="What's still missing? They see this, e.g. The payslip is cut off — please send the whole page with your name."
                        rows={2}
                        value={note}
                     />
                     <div className="flex gap-2">
                        <button
                           className="rounded-xl bg-amber-500 px-4 py-2 text-base font-black text-black disabled:opacity-50"
                           disabled={busy || !note.trim()}
                           onClick={() => void act(() => reviewProofRequest(r.id, 'ask_again', note.trim()))}
                           type="button"
                        >
                           ↩️ Send back to them
                        </button>
                        <button
                           className="rounded-xl bg-[#34234f] px-4 py-2 text-base font-black text-white"
                           onClick={() => setAsking(false)}
                           type="button"
                        >
                           Cancel
                        </button>
                     </div>
                  </>
               ) : (
                  <div className="flex flex-wrap gap-2">
                     <button
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-base font-black text-white disabled:opacity-50"
                        disabled={busy}
                        onClick={() => void act(() => reviewProofRequest(r.id, 'ok', null))}
                        type="button"
                     >
                        ✅ Looks good
                     </button>
                     <button
                        className="rounded-xl bg-[#34234f] px-4 py-2 text-base font-black text-white"
                        onClick={() => setAsking(true)}
                        type="button"
                     >
                        ↩️ Ask again
                     </button>
                  </div>
               )}
               <p className="text-xs text-[#6f6385]">“Looks good” only closes this request — approve the loan the usual way.</p>
            </div>
         ) : null}
         {error ? <p className="mt-2 text-sm font-bold text-red-300">{error}</p> : null}
      </li>
   );
}

export default function ProofRequestsSection() {
   const [rows, setRows] = useState<AdminProofRequest[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [filter, setFilter] = useState<Filter>('submitted');
   const [picking, setPicking] = useState(false);
   const [composeFor, setComposeFor] = useState<AdminUserOption | null>(null);

   const load = useCallback(async () => {
      setLoading(true);
      try {
         setRows(await listProofRequests());
         setError(null);
      } catch (err) {
         setError(errorMessage(err));
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      void load();
   }, [load]);

   const counts = Object.fromEntries(FILTERS.map((f) => [f.id, rows.filter((r) => r.status === f.id).length])) as Record<Filter, number>;
   const shown = rows.filter((r) => r.status === filter);

   return (
      <section className="space-y-4">
         <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
               <h2 className="break-words text-2xl font-black sm:text-3xl">Proof requests</h2>
               <p className="mt-1.5 max-w-3xl text-base text-[#a89bb8]">
                  After a call, ask a new applicant to back up what they said — work ID, visa abroad, business permit, a few answers. They
                  get one link, no sign-in. You can also start one from the Call sheet.
               </p>
            </div>
            <button
               className="rounded-xl bg-[#6b55f7] px-4 py-2 text-base font-black text-white"
               onClick={() => setPicking(true)}
               type="button"
            >
               + New request
            </button>
         </div>
         {picking ? (
            <UserPicker
               onCancel={() => setPicking(false)}
               onPick={(u) => {
                  setPicking(false);
                  setComposeFor(u);
               }}
            />
         ) : null}

         <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
               <button
                  className={`rounded-full px-4 py-1.5 text-sm font-black ${filter === f.id ? 'bg-white text-[#1c0a3a]' : 'bg-[#241044] text-[#a89bb8]'}`}
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  type="button"
               >
                  {f.label} ({counts[f.id]})
               </button>
            ))}
            <button
               className="rounded-full bg-[#241044] px-4 py-1.5 text-sm font-black text-[#a89bb8]"
               onClick={() => void load()}
               type="button"
            >
               {loading ? 'Loading…' : '↻ Refresh'}
            </button>
         </div>

         {error ? <p className="text-sm font-bold text-red-300">{error}</p> : null}
         {!shown.length && !loading ? <p className="text-base font-bold text-[#6f6385]">Nothing here.</p> : null}
         <ul className="space-y-3">
            {shown.map((r) => (
               <RequestCard key={r.id} onChanged={() => void load()} r={r} />
            ))}
         </ul>

         {composeFor ? (
            <ProofRequestComposer
               name={composeFor.username ? `@${composeFor.username}` : (composeFor.email ?? 'them')}
               onClose={() => setComposeFor(null)}
               onCreated={() => {
                  setFilter('open');
                  void load();
               }}
               userId={composeFor.id}
            />
         ) : null}
      </section>
   );
}
