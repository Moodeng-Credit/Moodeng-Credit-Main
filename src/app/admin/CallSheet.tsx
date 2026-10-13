'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { AdminCallApprovalRow } from '@/app/admin/adminSupabase';
import {
   type CallScreening,
   type CallSheetProfile,
   type CallTranscript,
   CASH_VIDEOS,
   EXCHANGES,
   loadCallSheet,
   loadCallTranscript,
   prefillAnswers,
   saveCallScreening,
   type ScreeningAnswers
} from '@/app/admin/callSheetData';

// Admin → Call approvals → Call sheet: everything the host needs on a borrower's onboarding call in
// one place — who they are (bio, checks, loans), the screening questions to fill in while talking
// (the old Fillout "Screening Questions" form, now saved to the borrower), and the host's notes. The
// Showed up / No-show buttons stay on the call row.

const money = (n: number) => `$${n.toFixed(n % 1 ? 2 : 0)}`;
const label = (v: string | null | undefined) => (v ? v.replace(/_/g, ' ') : '—');
const income = (v: string | null) => (v ? (v.endsWith('_plus') ? `$${v.replace('_plus', '+')}` : `$${v.replace('_', '–')}`) : '—');
const AUTOSAVE_MS = 1200;

// Tally-style building blocks, compact so the whole sheet fits on one screen: a numbered question with an
// inline hint, a soft input, a lettered choice row.
function Question({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
   return (
      <section>
         <p className="text-[14px] font-semibold leading-[18px] text-[#1f1f1f]">
            <span className="mr-1.5 text-[12px] font-medium text-[#6b55f7]">{n} →</span>
            {title}
            {hint ? <span className="ml-1.5 font-normal text-[#9a9a9a]">{hint}</span> : null}
         </p>
         <div className="mt-1">{children}</div>
      </section>
   );
}

const inputClass =
   'w-full rounded-md border border-[#e3e3e3] bg-white px-2.5 py-1.5 text-[14px] text-[#1f1f1f] placeholder:text-[#b3b3b3] focus:border-[#6b55f7] focus:outline-none focus:ring-2 focus:ring-[#6b55f7]/20';

function Choice({
   letter,
   selected,
   onClick,
   children
}: {
   letter: string;
   selected: boolean;
   onClick: () => void;
   children: React.ReactNode;
}) {
   return (
      <button
         aria-pressed={selected}
         className={`flex w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left text-[13px] leading-[17px] transition ${
            selected ? 'border-[#6b55f7] bg-[#f4f1ff] text-[#1f1f1f]' : 'border-[#e3e3e3] bg-white text-[#37352f] hover:bg-[#fafafa]'
         }`}
         onClick={onClick}
         type="button"
      >
         <span
            className={`grid size-[18px] shrink-0 place-items-center rounded border text-[10px] font-semibold ${
               selected ? 'border-[#6b55f7] bg-[#6b55f7] text-white' : 'border-[#d4d4d4] text-[#7a7a7a]'
            }`}
         >
            {selected ? '✓' : letter}
         </span>
         <span className="min-w-0 flex-1">{children}</span>
      </button>
   );
}

const RISK_TONE: Record<string, string> = {
   low: 'bg-[#e7f6ec] text-[#1f7a3d]',
   medium: 'bg-[#fff4e0] text-[#9a5b00]',
   high: 'bg-[#fde8e8] text-[#b42318]'
};

function TranscriptBlock({ transcript }: { transcript: CallTranscript | null }) {
   if (!transcript) {
      return (
         <section className="rounded-xl border border-dashed border-[#e3e3e3] p-5 text-[15px] text-[#7a7a7a]">
            <b className="text-[#1f1f1f]">Call transcript & AI risk summary</b> — appears here a few minutes after a recorded Zoom call
            ends.
         </section>
      );
   }
   const s = transcript.summary;
   const list = (title: string, items?: string[]) =>
      items?.length ? (
         <div>
            <p className="font-semibold text-[#1f1f1f]">{title}</p>
            <ul className="ml-5 list-disc">
               {items.map((item) => (
                  <li key={item}>{item}</li>
               ))}
            </ul>
         </div>
      ) : null;
   return (
      <section className="space-y-3 rounded-xl border border-[#e3e3e3] bg-white p-5 text-[15px] text-[#37352f]">
         <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[18px] font-semibold text-[#1f1f1f]">AI risk summary</h3>
            {transcript.riskLevel ? (
               <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold uppercase ${RISK_TONE[transcript.riskLevel]}`}>
                  {transcript.riskLevel} risk
               </span>
            ) : null}
            <span className="text-[13px] text-[#9a9a9a]">a second pair of ears, not a decision</span>
         </div>
         {s ? (
            <>
               {s.summary ? <p className="text-[16px] text-[#1f1f1f]">{s.summary}</p> : null}
               <div className="grid gap-2 sm:grid-cols-2">
                  {s.loan_use ? (
                     <p>
                        <b>Loan use:</b> {s.loan_use}
                     </p>
                  ) : null}
                  {s.repayment_plan ? (
                     <p>
                        <b>Repayment plan:</b> {s.repayment_plan}
                     </p>
                  ) : null}
                  {s.income_and_work ? (
                     <p>
                        <b>Work & income:</b> {s.income_and_work}
                     </p>
                  ) : null}
                  {s.consistency_with_bio ? (
                     <p>
                        <b>Matches their bio?</b> {s.consistency_with_bio}
                     </p>
                  ) : null}
               </div>
               {list('🚩 Red flags', s.red_flags)}
               {list('👍 Positives', s.positives)}
               {list('Ask next time', s.follow_up_questions)}
            </>
         ) : (
            <p className="text-[#9a5b00]">
               {transcript.summaryError ? `Summary failed: ${transcript.summaryError}` : 'Summary is being written…'}
            </p>
         )}
         <details>
            <summary className="cursor-pointer font-semibold text-[#6b55f7]">Full transcript</summary>
            <pre className="mt-2 max-h-[360px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-[#fafafa] p-3 font-sans text-[14px]">
               {transcript.transcript}
            </pre>
         </details>
      </section>
   );
}

function ProfileCard({ profile }: { profile: CallSheetProfile }) {
   const funded = profile.loans.filter((l) => l.status === 'Lent');
   const repaid = funded.filter((l) => l.repayment === 'Paid').length;
   const latest = profile.loans[0];
   const chip = (on: boolean, text: string) => (
      <span
         className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${on ? 'bg-[#e7f6ec] text-[#1f7a3d]' : 'bg-[#ececea] text-[#7a7a7a]'}`}
      >
         {text}
      </span>
   );
   return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-[#f7f7f5] px-3 py-2 text-[13px] text-[#37352f]">
         <span className="flex flex-wrap gap-1">
            {chip(profile.facebookVerified, `Facebook ${profile.facebookVerified ? '✓' : '—'}`)}
            {chip(profile.idVerified, `ID ${profile.idVerified ? '✓' : 'not yet'}`)}
            {chip(profile.liveness, `Liveness ${profile.liveness ? '✓' : '—'}`)}
            {chip(repaid > 0, funded.length ? `${funded.length} loans · ${repaid} repaid` : 'No loans yet')}
         </span>
         <span>
            <b>Job:</b> {profile.profession ?? '—'} ({label(profile.incomeType)})
         </span>
         <span>
            <b>Income:</b> {income(profile.monthlyIncome)}/mo · exp. {income(profile.monthlyExpenses)}
         </span>
         {profile.gapReasons.length ? (
            <span>
               <b>Gaps:</b> {profile.gapReasons.map(label).join(', ')}
            </span>
         ) : null}
         <span>
            <b>Joined:</b> {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}
            {profile.referralCode ? ` · ref ${profile.referralCode}` : ''}
         </span>
         {latest ? (
            <span className="text-[#5a5a5a]">
               <b className="text-[#37352f]">Latest:</b> {money(latest.amount)} → {money(latest.repay)} ·{' '}
               {latest.status === 'Lent' ? (latest.repayment === 'Paid' ? 'repaid' : 'active') : latest.status.toLowerCase()}
               {latest.reason ? ` · “${latest.reason.slice(0, 70)}”` : ''}
            </span>
         ) : null}
      </div>
   );
}

export default function CallSheet({ row, onClose }: { row: AdminCallApprovalRow; onClose: () => void }) {
   const [profile, setProfile] = useState<CallSheetProfile | null>(null);
   const [screening, setScreening] = useState<CallScreening | null>(null);
   const [answers, setAnswers] = useState<ScreeningAnswers>({});
   const [notes, setNotes] = useState('');
   const [redFlags, setRedFlags] = useState('');
   const [score, setScore] = useState<number | null>(null);
   const [error, setError] = useState('');
   const [status, setStatus] = useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle');
   const [transcript, setTranscript] = useState<CallTranscript | null>(null);
   const savingRef = useRef(false);
   const idRef = useRef<string | null>(null);

   useEffect(() => {
      let cancelled = false;
      void loadCallTranscript(row.userId).then((t) => !cancelled && setTranscript(t));
      loadCallSheet(row.userId, row.callStartsAt)
         .then(({ profile: p, screening: s }) => {
            if (cancelled) return;
            setProfile(p);
            setScreening(s);
            idRef.current = s.id;
            setAnswers(s.id ? s.answers : prefillAnswers(p));
            setNotes(s.notes);
            setRedFlags(s.redFlags);
            setScore(s.score);
         })
         .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load the call sheet.'));
      return () => {
         cancelled = true;
      };
   }, [row.userId, row.callStartsAt]);

   useEffect(() => {
      const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
   }, [onClose]);

   const touch = () => setStatus('dirty');
   const set = <K extends keyof ScreeningAnswers>(key: K, value: ScreeningAnswers[K]) => {
      setAnswers((a) => ({ ...a, [key]: value }));
      touch();
   };
   const toggleExchange = (name: string) =>
      set(
         'exchanges',
         (answers.exchanges ?? []).includes(name)
            ? (answers.exchanges ?? []).filter((x) => x !== name)
            : [...(answers.exchanges ?? []), name]
      );

   const save = useCallback(async () => {
      if (savingRef.current) return;
      savingRef.current = true;
      setStatus('saving');
      setError('');
      try {
         const saved = await saveCallScreening({
            id: idRef.current,
            userId: row.userId,
            callStartsAt: row.callStartsAt,
            answers,
            notes,
            redFlags,
            score
         });
         idRef.current = saved.id;
         setScreening((s) => ({ ...(s as CallScreening), id: saved.id, updatedAt: saved.updatedAt }));
         setStatus((current) => (current === 'saving' ? 'saved' : current));
      } catch (err) {
         setStatus('dirty');
         setError(err instanceof Error ? err.message : 'Could not save.');
      } finally {
         savingRef.current = false;
      }
   }, [row.userId, row.callStartsAt, answers, notes, redFlags, score]);

   // Autosave a moment after the host stops typing, so nothing is lost if they forget to press Done.
   useEffect(() => {
      if (status !== 'dirty') return undefined;
      const timer = window.setTimeout(() => void save(), AUTOSAVE_MS);
      return () => window.clearTimeout(timer);
   }, [status, save]);

   const name = profile?.displayName || profile?.username || row.name;
   const checks = [
      Boolean(answers.fullName?.trim()),
      Boolean(answers.role?.trim()),
      Boolean(answers.facebookUrl?.trim()),
      Boolean(answers.tiktokUrl?.trim()),
      Boolean(answers.referral?.trim()),
      Boolean(answers.loanUse?.trim()),
      Boolean(answers.exchanges?.length),
      Boolean(answers.showedCashInOut),
      Boolean(answers.informedTerms),
      Boolean(answers.addedEmma),
      score !== null
   ];
   const progress = checks.filter(Boolean).length / checks.length;

   const statusText =
      status === 'saving'
         ? 'Saving…'
         : status === 'saved'
           ? 'Saved ✓'
           : status === 'dirty'
             ? 'Editing…'
             : screening?.updatedAt
               ? `Saved ${new Date(screening.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
               : 'Not saved yet';

   return (
      <div aria-modal="true" className="fixed inset-0 z-[80] overflow-y-auto bg-white text-[#1f1f1f]" role="dialog">
         {/* Header + progress, pinned. Everything below is laid out to fit one laptop screen. */}
         <div className="sticky top-0 z-10 border-b border-[#f0f0f0] bg-white/95 backdrop-blur">
            <div className="h-1 bg-[#f0f0f0]">
               <div className="h-1 bg-[#6b55f7] transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2">
               <h1 className="min-w-0 truncate text-[18px] font-bold">{name}</h1>
               <span className="text-[13px] text-[#7a7a7a]">
                  {row.callStartsAt
                     ? new Date(row.callStartsAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
                     : 'No call booked'}
                  {row.host ? ` · with ${row.host}` : ''}
                  {row.attendance ? ` · ${row.attendance}` : ''}
               </span>
               <span className="ml-auto text-[12px] text-[#9a9a9a]">{statusText}</span>
               {row.joinUrl && !row.outcome ? (
                  <a
                     className="rounded-md bg-[#0b5cff] px-2.5 py-1 text-[13px] font-semibold text-white no-underline"
                     href={row.joinUrl}
                     rel="noreferrer"
                     target="_blank"
                  >
                     🎥 Join Zoom
                  </a>
               ) : null}
               <button
                  className="rounded-md bg-[#1f1f1f] px-3 py-1 text-[13px] font-semibold text-white disabled:opacity-50"
                  disabled={status === 'saving'}
                  onClick={async () => {
                     await save();
                     onClose();
                  }}
                  type="button"
               >
                  Done
               </button>
               <button
                  className="rounded-md border border-[#e3e3e3] px-2.5 py-1 text-[13px] font-semibold text-[#37352f]"
                  onClick={onClose}
                  type="button"
               >
                  Close
               </button>
            </div>
         </div>

         <div className="mx-auto max-w-[1100px] px-5 pb-10 pt-3">
            {error ? <p className="mb-2 rounded-md bg-[#fde8e8] p-2 text-[13px] font-semibold text-[#b42318]">{error}</p> : null}
            {!profile && !error ? <p className="mt-6 text-[#7a7a7a]">Loading…</p> : null}

            {profile ? (
               <div className="space-y-3">
                  <ProfileCard profile={profile} />

                  <div className="grid gap-x-6 gap-y-3 lg:grid-cols-2">
                     <div className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                           <Question n={1} title="Full name">
                              <input
                                 className={inputClass}
                                 onChange={(e) => set('fullName', e.target.value)}
                                 placeholder="Their name"
                                 value={answers.fullName ?? ''}
                              />
                           </Question>
                           <Question n={2} title="What do they do?">
                              <input
                                 className={inputClass}
                                 onChange={(e) => set('role', e.target.value)}
                                 placeholder="Role / specialty"
                                 value={answers.role ?? ''}
                              />
                           </Question>
                           <Question n={3} title="Facebook">
                              <input
                                 className={inputClass}
                                 onChange={(e) => set('facebookUrl', e.target.value)}
                                 placeholder="facebook.com/…"
                                 value={answers.facebookUrl ?? ''}
                              />
                           </Question>
                           <Question n={4} title="TikTok">
                              <input
                                 className={inputClass}
                                 onChange={(e) => set('tiktokUrl', e.target.value)}
                                 placeholder="tiktok.com/@…"
                                 value={answers.tiktokUrl ?? ''}
                              />
                           </Question>
                        </div>
                        <Question n={5} title="How do they know us?" hint="referred by / where they saw us">
                           <input
                              className={inputClass}
                              onChange={(e) => set('referral', e.target.value)}
                              placeholder="e.g. Saw a Facebook poster"
                              value={answers.referral ?? ''}
                           />
                        </Question>
                        <Question n={6} title="Loan today: how would they use it for an immediate win?">
                           <textarea
                              className={`${inputClass} h-[64px] resize-none`}
                              onChange={(e) => set('loanUse', e.target.value)}
                              placeholder="Their words"
                              value={answers.loanUse ?? ''}
                           />
                        </Question>
                        <Question n={7} title="Local exchange they use">
                           <div className="flex flex-wrap gap-1.5">
                              {EXCHANGES.map((ex) => {
                                 const on = (answers.exchanges ?? []).includes(ex);
                                 return (
                                    <button
                                       aria-pressed={on}
                                       className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${on ? 'border-[#6b55f7] bg-[#6b55f7] text-white' : 'border-[#e3e3e3] text-[#37352f] hover:bg-[#fafafa]'}`}
                                       key={ex}
                                       onClick={() => toggleExchange(ex)}
                                       type="button"
                                    >
                                       {on ? '✓ ' : ''}
                                       {ex}
                                    </button>
                                 );
                              })}
                           </div>
                        </Question>
                     </div>

                     <div className="space-y-2.5">
                        <Question n={8} title="Before you finish, cover these">
                           <div className="space-y-1.5">
                              <Choice
                                 letter="A"
                                 onClick={() => set('showedCashInOut', !answers.showedCashInOut)}
                                 selected={Boolean(answers.showedCashInOut)}
                              >
                                 Showed how to cash out and repay ·{' '}
                                 {CASH_VIDEOS.map((v, i) => (
                                    <a
                                       className="font-semibold text-[#6b55f7] underline"
                                       href={v.url}
                                       key={v.url}
                                       onClick={(e) => e.stopPropagation()}
                                       rel="noreferrer"
                                       target="_blank"
                                    >
                                       {i ? ' · ' : ''}▶ {v.label}
                                    </a>
                                 ))}
                              </Choice>
                              <Choice
                                 letter="B"
                                 onClick={() => set('informedTerms', !answers.informedTerms)}
                                 selected={Boolean(answers.informedTerms)}
                              >
                                 Explained the repayment terms: a default is flagged right away and means a permanent ban across all
                                 affiliated platforms
                              </Choice>
                              <Choice letter="C" onClick={() => set('addedEmma', !answers.addedEmma)} selected={Boolean(answers.addedEmma)}>
                                 Added Emma Moodeng and Voices Against Unfair Loan on Facebook
                              </Choice>
                           </div>
                        </Question>
                        <div className="grid grid-cols-2 gap-x-3">
                           <Question n={9} title="Notes">
                              <textarea
                                 className={`${inputClass} h-[76px] resize-none`}
                                 onChange={(e) => (setNotes(e.target.value), touch())}
                                 value={notes}
                              />
                           </Question>
                           <Question n={10} title="Red flags" hint="if any">
                              <textarea
                                 className={`${inputClass} h-[76px] resize-none`}
                                 onChange={(e) => (setRedFlags(e.target.value), touch())}
                                 value={redFlags}
                              />
                           </Question>
                        </div>
                        <Question n={11} title="Lend to them?" hint="1 = no · 5 = great">
                           <div className="flex gap-1.5">
                              {[1, 2, 3, 4, 5].map((n) => (
                                 <button
                                    aria-pressed={score === n}
                                    className={`h-9 flex-1 rounded-md border text-[15px] font-semibold transition ${
                                       score === n
                                          ? 'border-[#6b55f7] bg-[#6b55f7] text-white'
                                          : 'border-[#e3e3e3] bg-white text-[#37352f] hover:bg-[#fafafa]'
                                    }`}
                                    key={n}
                                    onClick={() => (setScore(score === n ? null : n), touch())}
                                    type="button"
                                 >
                                    {n}
                                 </button>
                              ))}
                           </div>
                        </Question>
                     </div>
                  </div>

                  <TranscriptBlock transcript={transcript} />
               </div>
            ) : null}
         </div>
      </div>
   );
}
