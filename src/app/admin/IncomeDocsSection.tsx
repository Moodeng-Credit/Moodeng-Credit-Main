'use client';

import { useCallback, useEffect, useState } from 'react';

import { type AdminIncomeDocument, decideIncomeDocument, incomeDocumentUrl, listIncomeDocuments } from '@/app/admin/adminSupabase';

const personLabel = (p: AdminIncomeDocument['user']) =>
   p ? p.display_name?.trim() || (p.username ? `@${p.username}` : 'Unknown') : 'Deleted account';

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err));

const RISK_STYLE: Record<string, string> = {
   red: 'border-red-500/70 bg-red-950/30',
   orange: 'border-amber-500/70 bg-amber-950/20',
   green: 'border-emerald-700/60 bg-emerald-950/20'
};

// The automatic verdict, like Didit's status: what the checks concluded before anyone looked.
const VERDICT_BADGE: Record<string, { label: string; className: string }> = {
   looks_good: { label: '✅ Looks good', className: 'bg-emerald-600 text-white' },
   needs_review: { label: '⚠️ Needs review', className: 'bg-amber-500 text-black' },
   resend: { label: '↩️ Asked to resend', className: 'bg-[#3a2d4f] text-[#cfc6dd]' }
};

const CHECK_ICON: Record<string, string> = { pass: '✅', warn: '🟠', fail: '🔴' };

const bkk = (iso: string) =>
   new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Bangkok', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const STATUS_LINE: Record<string, string> = {
   pending: 'Waiting to be read…',
   processing: 'AI is reading it…',
   skipped: 'No AI read (no API key) — open the files and check by hand.'
};

/**
 * Proof of income sent from moodeng.app/documents. Each card is one send: open the files, read the
 * score, memo and AI note, then Approve or Decline (with a reason the borrower sees); the borrower is
 * told on push, Messenger and Telegram, and sees it on /documents. "Rows" lists every transaction the AI read with the
 * exact line it came from, so any number in the memo ([T4] = row 4) can be checked in one tap.
 */
export default function IncomeDocsSection() {
   const [docs, setDocs] = useState<AdminIncomeDocument[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [openRows, setOpenRows] = useState<string | null>(null);
   const [showReviewed, setShowReviewed] = useState(false);
   const [busy, setBusy] = useState<string | null>(null);
   const [declining, setDeclining] = useState<string | null>(null);
   const [reasons, setReasons] = useState<Record<string, string>>({});

   const load = useCallback(async () => {
      setLoading(true);
      try {
         setDocs(await listIncomeDocuments());
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

   const openFile = useCallback(async (path: string) => {
      try {
         window.open(await incomeDocumentUrl(path), '_blank', 'noopener');
      } catch (err) {
         setError(errorMessage(err));
      }
   }, []);

   const decide = useCallback(async (doc: AdminIncomeDocument, decision: 'approved' | 'declined', reason: string | null) => {
      setBusy(doc.id);
      setError(null);
      try {
         await decideIncomeDocument(doc.id, decision, reason);
         setDocs((prev) =>
            prev.map((d) => (d.id === doc.id ? { ...d, decision, decision_reason: reason, decided_at: new Date().toISOString() } : d))
         );
         setDeclining(null);
      } catch (err) {
         setError(errorMessage(err));
      } finally {
         setBusy(null);
      }
   }, []);

   // Yours to decide: no decision yet, and not already sent back to the borrower to fix.
   const toReview = docs.filter((d) => !d.decision && d.verdict !== 'resend');
   const shown = showReviewed ? docs : toReview;

   return (
      <section className="space-y-4">
         <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
               <h2 className="break-words text-2xl font-black sm:text-3xl">
                  Income docs <span className="text-base font-bold text-[#a89bb8]">({toReview.length} to review)</span>
               </h2>
               <p className="mt-1.5 max-w-3xl text-base text-[#a89bb8]">
                  Proof of income borrowers send from moodeng.app/documents. The AI reads the files; numbers, checks and the score are
                  worked out in code. The score isn&apos;t a tested prediction yet — compare it with repayments once ~30 loans above $60
                  have come due.
               </p>
            </div>
            <div className="flex gap-2">
               <button
                  type="button"
                  onClick={() => setShowReviewed((v) => !v)}
                  className="rounded-full bg-[#241044] px-4 py-1.5 text-sm font-black text-[#a89bb8]"
               >
                  {showReviewed ? 'Only to review' : 'Show all (decided + resent)'}
               </button>
               <button
                  type="button"
                  onClick={() => void load()}
                  className="rounded-full bg-[#241044] px-4 py-1.5 text-sm font-black text-[#a89bb8]"
               >
                  {loading ? 'Loading…' : 'Refresh'}
               </button>
            </div>
         </div>
         {error ? <p className="text-sm font-bold text-red-300">{error}</p> : null}
         {!shown.length && !loading ? <p className="text-base font-bold text-[#6f6385]">Nothing to review.</p> : null}

         <ul className="space-y-3">
            {shown.map((doc) => {
               const rows = doc.extracted?.transactions ?? [];
               const currency = doc.extracted?.currency ?? 'PHP';
               return (
                  <li key={doc.id} className={`rounded-2xl border p-4 ${RISK_STYLE[doc.risk ?? ''] ?? 'border-[#3a2d4f] bg-[#1c0a3a]'}`}>
                     <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                           <p className="text-lg font-black text-white">
                              {doc.verdict ? (
                                 <span className={`mr-2 rounded-lg px-2 py-0.5 text-sm ${VERDICT_BADGE[doc.verdict].className}`}>
                                    {VERDICT_BADGE[doc.verdict].label}
                                 </span>
                              ) : null}
                              {doc.score != null ? <span className="mr-2 rounded-lg bg-white/10 px-2 py-0.5">{doc.score}/100</span> : null}
                              {personLabel(doc.user)}
                           </p>
                           <p className="text-sm font-medium text-[#a89bb8]">
                              {(doc.doc_type ?? 'document').replace(/_/g, ' ')} · sent {bkk(doc.created_at)}
                              {doc.note ? ` · “${doc.note}”` : ''}
                              {doc.user?.monthly_income ? ` · bio says ${doc.user.monthly_income}/month` : ''}
                              {doc.decision
                                 ? ` · ${doc.decision === 'approved' ? '✅ approved' : '❌ declined'} by ${doc.decided_by ?? 'admin'}${doc.notified_at ? ' · borrower told' : ''}`
                                 : ''}
                           </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                           {doc.files.map((f, i) => (
                              <button
                                 key={f.path}
                                 type="button"
                                 onClick={() => void openFile(f.path)}
                                 className="rounded-xl bg-[#8336f0] px-3 py-1.5 text-sm font-black text-white"
                                 title={f.name}
                              >
                                 File {i + 1}
                              </button>
                           ))}
                           {rows.length ? (
                              <button
                                 type="button"
                                 onClick={() => setOpenRows((cur) => (cur === doc.id ? null : doc.id))}
                                 className="rounded-xl bg-[#241044] px-3 py-1.5 text-sm font-black text-[#cfc6dd]"
                              >
                                 {openRows === doc.id ? 'Hide rows' : `Rows (${rows.length})`}
                              </button>
                           ) : null}
                           <button
                              type="button"
                              disabled={busy === doc.id}
                              onClick={() => void decide(doc, 'approved', null)}
                              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-black text-white disabled:opacity-50"
                           >
                              ✅ Approve
                           </button>
                           <button
                              type="button"
                              disabled={busy === doc.id}
                              onClick={() => setDeclining((cur) => (cur === doc.id ? null : doc.id))}
                              className="rounded-xl bg-red-700 px-3 py-1.5 text-sm font-black text-white disabled:opacity-50"
                           >
                              ❌ Decline
                           </button>
                        </div>
                     </div>

                     {doc.checks?.length ? (
                        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                           {doc.checks.map((c) => (
                              <li
                                 key={c.key}
                                 className="rounded-lg bg-white/5 px-3 py-1.5 text-sm text-[#e8e0f2]"
                                 title={c.notes.join('\n')}
                              >
                                 {CHECK_ICON[c.status]} <b>{c.label}</b>
                                 {c.status !== 'pass' && c.notes[0] ? (
                                    <span className="block text-xs text-[#a89bb8]">{c.notes[0]}</span>
                                 ) : null}
                              </li>
                           ))}
                        </ul>
                     ) : null}
                     {doc.verdict === 'resend' && !doc.decision ? (
                        <p className="mt-2 text-sm text-[#cfc6dd]">
                           Borrower was asked to resend ({(doc.resend_reason ?? '').replace(/_/g, ' ')}).
                        </p>
                     ) : null}
                     {doc.status === 'done' && doc.memo ? (
                        <p className="mt-3 whitespace-pre-line text-[15px] leading-6 text-[#e8e0f2]">{doc.memo}</p>
                     ) : (
                        <p className="mt-3 text-sm font-bold text-[#cfc6dd]">
                           {doc.status === 'failed' ? `⚠️ ${doc.error}` : STATUS_LINE[doc.status]}
                        </p>
                     )}
                     {declining === doc.id ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                           <input
                              value={reasons[doc.id] ?? ''}
                              onChange={(event) => setReasons((prev) => ({ ...prev, [doc.id]: event.target.value }))}
                              placeholder="Reason the borrower sees, e.g. Please send your last 2 months, not 1 week."
                              maxLength={300}
                              className="min-w-0 flex-1 rounded-xl bg-[#241044] px-3 py-2 text-sm text-white placeholder:text-[#6f6385]"
                           />
                           <button
                              type="button"
                              disabled={busy === doc.id}
                              onClick={() => void decide(doc, 'declined', (reasons[doc.id] ?? '').trim() || null)}
                              className="rounded-xl bg-red-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
                           >
                              Send decline
                           </button>
                        </div>
                     ) : null}
                     {doc.decision === 'declined' && doc.decision_reason ? (
                        <p className="mt-2 text-sm text-red-200">Told them: “{doc.decision_reason}”</p>
                     ) : null}
                     {doc.ai_note ? (
                        <p className="mt-2 rounded-xl bg-white/5 px-3 py-2 text-[15px] leading-6 text-[#e8e0f2]">🤖 {doc.ai_note}</p>
                     ) : null}

                     {openRows === doc.id ? (
                        <div className="mt-3 overflow-x-auto">
                           <table className="w-full min-w-[560px] text-left text-sm">
                              <thead className="text-[#a89bb8]">
                                 <tr>
                                    <th className="py-1 pr-2">#</th>
                                    <th className="py-1 pr-2">Date</th>
                                    <th className="py-1 pr-2">Description</th>
                                    <th className="py-1 pr-2 text-right">Amount</th>
                                    <th className="py-1 pr-2 text-right">Balance</th>
                                    <th className="py-1">Read from (page)</th>
                                 </tr>
                              </thead>
                              <tbody>
                                 {rows.map((row, i) => (
                                    // Rows are a fixed list read once from the file; position is their id ([T4]).
                                    // eslint-disable-next-line react/no-array-index-key
                                    <tr key={i} className="border-t border-[#3a2d4f] text-[#e8e0f2]">
                                       <td className="py-1 pr-2 font-mono text-[#a89bb8]">T{i + 1}</td>
                                       <td className="whitespace-nowrap py-1 pr-2">{row.date}</td>
                                       <td className="py-1 pr-2">{row.description}</td>
                                       <td
                                          className={`py-1 pr-2 text-right font-mono ${row.amount > 0 ? 'text-emerald-300' : 'text-[#cfc6dd]'}`}
                                       >
                                          {row.amount > 0 ? '+' : ''}
                                          {row.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} {currency}
                                       </td>
                                       <td className="py-1 pr-2 text-right font-mono">
                                          {row.balance?.toLocaleString('en-US', { maximumFractionDigits: 2 }) ?? '—'}
                                       </td>
                                       <td className="py-1 font-mono text-xs text-[#a89bb8]">
                                          “{row.source_text}” (p{row.page})
                                       </td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                     ) : null}
                  </li>
               );
            })}
         </ul>
      </section>
   );
}
