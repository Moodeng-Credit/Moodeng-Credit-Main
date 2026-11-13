'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

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

const CHECK_ICON: Record<string, string> = { pass: '✅', warn: '🟠', fail: '🔴', skip: '➖' };

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
// One tap fills the decline reason the borrower sees (still editable before sending).
const QUICK_REASONS = [
   'Please send your last 2–3 months of history, not just a few days.',
   'This is a company account. Please send your own personal account or payslip.',
   'The name on the document doesn’t match your ID. Please send one in your own name.',
   'The photo is too blurry to check. Please send a clearer screenshot with all 4 corners showing.',
   'Please send the original from your bank or GCash app, not an edited copy.'
];

/** The files of one send as tappable previews: photos inline, PDFs as a tile. */
function DocPreviews({ files, onOpen }: { files: AdminIncomeDocument['files']; onOpen: (path: string) => void }) {
   const [urls, setUrls] = useState<Record<string, string>>({});
   useEffect(() => {
      let cancelled = false;
      for (const f of files) {
         if (!(f.mime ?? '').startsWith('image/')) continue;
         void incomeDocumentUrl(f.path)
            .then((url) => !cancelled && setUrls((prev) => ({ ...prev, [f.path]: url })))
            .catch(() => undefined);
      }
      return () => {
         cancelled = true;
      };
   }, [files]);
   return (
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
         {files.map((f, i) => (
            <button
               key={f.path}
               type="button"
               onClick={() => onOpen(f.path)}
               title={f.name}
               className="relative h-40 w-28 shrink-0 overflow-hidden rounded-xl border border-[#3a2d4f] bg-[#241044] text-left"
            >
               {urls[f.path] ? (
                  <img alt={f.name ?? `File ${i + 1}`} className="size-full object-cover object-top" src={urls[f.path]} />
               ) : (
                  <span className="flex size-full flex-col items-center justify-center gap-1 px-2 text-center text-xs font-bold text-[#cfc6dd]">
                     <span className="text-2xl">{f.mime === 'application/pdf' ? '📄' : '🖼️'}</span>
                     <span className="line-clamp-3 break-all">{f.name ?? `File ${i + 1}`}</span>
                  </span>
               )}
               <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-white">
                  {i + 1} · {f.mime === 'application/pdf' ? 'PDF' : 'photo'} · open
               </span>
            </button>
         ))}
      </div>
   );
}

export default function IncomeDocsSection() {
   const [docs, setDocs] = useState<AdminIncomeDocument[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [openRows, setOpenRows] = useState<string | null>(null);
   const [showReviewed, setShowReviewed] = useState(false);
   const [busy, setBusy] = useState<string | null>(null);
   const [declining, setDeclining] = useState<string | null>(null);
   const [reasons, setReasons] = useState<Record<string, string>>({});
   // ?doc=<id> (the Telegram / Discord card's link): that send first, highlighted, even if decided.
   const focusId = useMemo(() => new URLSearchParams(window.location.search).get('doc'), []);

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
   // Sent back to the borrower but with fraud signs (risk red) stays on the list.
   const toReview = docs.filter((d) => !d.decision && (d.verdict !== 'resend' || d.risk === 'red'));
   // Sent back to fix: still listed (newest first, like everything else) so the upload can be seen
   // and approved anyway, but not counted as "to review".
   const resent = docs.filter((d) => !d.decision && d.verdict === 'resend' && d.risk !== 'red');
   const focused = docs.find((d) => d.id === focusId);
   const shown = [...(focused ? [focused] : []), ...(showReviewed ? docs : docs.filter((d) => !d.decision)).filter((d) => d !== focused)];

   useEffect(() => {
      if (focused) document.getElementById(`income-doc-${focused.id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
   }, [focused]);

   return (
      <section className="space-y-4">
         <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
               <h2 className="break-words text-2xl font-black sm:text-3xl">
                  Income docs{' '}
                  <span className="text-base font-bold text-[#a89bb8]">
                     ({toReview.length} to review{resent.length ? ` · ${resent.length} asked to resend` : ''})
                  </span>
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
                  {showReviewed ? 'Hide decided' : 'Show decided too'}
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
                  <li
                     key={doc.id}
                     id={`income-doc-${doc.id}`}
                     className={`scroll-mt-4 rounded-2xl border p-4 ${RISK_STYLE[doc.risk ?? ''] ?? 'border-[#3a2d4f] bg-[#1c0a3a]'} ${doc === focused ? 'ring-4 ring-[#f5c542]' : ''}`}
                  >
                     <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                           <p className="text-lg font-black text-white">
                              {doc.risk === 'red' ? (
                                 <span className="mr-2 rounded-lg bg-red-600 px-2 py-0.5 text-sm text-white">🚨 Fraud signs</span>
                              ) : null}
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
                              {doc.requested_amount ? ` · asking $${Number(doc.requested_amount)}` : ''}
                              {doc.tier
                                 ? ` · $${doc.tier.min} step (${doc.tier.months ? `${doc.tier.months}+ months` : 'any recent'}${doc.tier.fresh ? ', fresh' : ''}${doc.tier.maxShare != null ? `, repay ≤${Math.round(doc.tier.maxShare * 100)}%` : ''}${doc.tier.liveCall ? ', live GCash on call' : ''}${doc.tier.autoApprove ? ', approves itself if every check passes' : ''})`
                                 : ''}
                              {doc.note ? ` · “${doc.note}”` : ''}
                              {doc.user?.monthly_income ? ` · bio says ${doc.user.monthly_income}/month` : ''}
                              {doc.decision
                                 ? ` · ${doc.decision === 'approved' ? '✅ approved' : '❌ declined'} by ${doc.decided_by ?? 'admin'}${doc.notified_at ? ' · borrower told' : ''}`
                                 : ''}
                           </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
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

                     <DocPreviews files={doc.files} onOpen={(path) => void openFile(path)} />
                     {doc.checks?.length ? (
                        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                           {doc.checks.map((c) => (
                              <li
                                 key={c.key}
                                 className="rounded-lg bg-white/5 px-3 py-1.5 text-sm text-[#e8e0f2]"
                                 title={c.notes.join('\n')}
                              >
                                 {CHECK_ICON[c.status]} <b>{c.label}</b>
                                 {c.status === 'skip' ? (
                                    <span className="block text-xs text-[#a89bb8]">Not checked — couldn’t read it</span>
                                 ) : null}
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
                           <div className="flex w-full flex-wrap gap-1.5">
                              {QUICK_REASONS.map((text) => (
                                 <button
                                    key={text}
                                    type="button"
                                    onClick={() => setReasons((prev) => ({ ...prev, [doc.id]: text }))}
                                    className={`rounded-full px-3 py-1 text-xs font-bold ${reasons[doc.id] === text ? 'bg-red-700 text-white' : 'bg-[#241044] text-[#cfc6dd]'}`}
                                 >
                                    {text.split('.')[0]}
                                 </button>
                              ))}
                           </div>
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
