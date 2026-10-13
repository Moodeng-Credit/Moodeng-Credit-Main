'use client';

import { useEffect, useState } from 'react';

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

function Field({ label: text, children }: { label: string; children: React.ReactNode }) {
   return (
      <label className="block">
         <span className="text-sm font-bold text-[#c9a7ff]">{text}</span>
         <div className="mt-1">{children}</div>
      </label>
   );
}

const inputClass = 'w-full rounded-xl border border-[#3d1f6e] bg-[#12052a] px-3 py-2 text-base text-white placeholder:text-[#6f5f86]';

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
   return (
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#2a1453] bg-[#12052a] p-3 text-base text-white">
         <input checked={checked} className="mt-1 size-5 accent-emerald-500" onChange={(e) => onChange(e.target.checked)} type="checkbox" />
         <span>{children}</span>
      </label>
   );
}

const RISK_TONE: Record<string, string> = {
   low: 'bg-emerald-900 text-emerald-200',
   medium: 'bg-amber-900 text-amber-200',
   high: 'bg-red-900 text-red-200'
};

function TranscriptBlock({ transcript }: { transcript: CallTranscript | null }) {
   if (!transcript) {
      return (
         <section className="rounded-2xl border border-dashed border-[#3d1f6e] p-4 text-sm text-[#a89bb8]">
            <b className="text-white">Call transcript & AI risk summary</b> — appears here a few minutes after a recorded Zoom call ends.
         </section>
      );
   }
   const s = transcript.summary;
   const list = (title: string, items?: string[]) =>
      items?.length ? (
         <div>
            <p className="font-bold text-white">{title}</p>
            <ul className="ml-5 list-disc">
               {items.map((item) => (
                  <li key={item}>{item}</li>
               ))}
            </ul>
         </div>
      ) : null;
   return (
      <section className="space-y-3 rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4 text-sm text-[#d8cfe6]">
         <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-black text-white">AI risk summary</h3>
            {transcript.riskLevel ? (
               <span className={`rounded-full px-2 py-1 text-xs font-black uppercase ${RISK_TONE[transcript.riskLevel]}`}>
                  {transcript.riskLevel} risk
               </span>
            ) : null}
            <span className="text-xs text-[#a89bb8]">
               {transcript.callStartedAt ? `Call ${new Date(transcript.callStartedAt).toLocaleString()}` : ''} · a second pair of ears, not
               a decision
            </span>
         </div>
         {s ? (
            <>
               {s.summary ? <p className="text-base text-white">{s.summary}</p> : null}
               <div className="grid gap-2 sm:grid-cols-2">
                  {s.loan_use ? (
                     <p>
                        <b className="text-white">Loan use:</b> {s.loan_use}
                     </p>
                  ) : null}
                  {s.repayment_plan ? (
                     <p>
                        <b className="text-white">Repayment plan:</b> {s.repayment_plan}
                     </p>
                  ) : null}
                  {s.income_and_work ? (
                     <p>
                        <b className="text-white">Work & income:</b> {s.income_and_work}
                     </p>
                  ) : null}
                  {s.consistency_with_bio ? (
                     <p>
                        <b className="text-white">Matches their bio?</b> {s.consistency_with_bio}
                     </p>
                  ) : null}
               </div>
               {list('🚩 Red flags', s.red_flags)}
               {list('👍 Positives', s.positives)}
               {list('Ask next time', s.follow_up_questions)}
            </>
         ) : (
            <p className="text-amber-300">
               {transcript.summaryError ? `Summary failed: ${transcript.summaryError}` : 'Summary is being written…'}
            </p>
         )}
         <details>
            <summary className="cursor-pointer font-bold text-[#c9a7ff]">Full transcript</summary>
            <pre className="mt-2 max-h-[360px] overflow-y-auto whitespace-pre-wrap rounded-xl bg-[#12052a] p-3 font-sans text-sm">
               {transcript.transcript}
            </pre>
         </details>
      </section>
   );
}

function ProfileBlock({ profile }: { profile: CallSheetProfile }) {
   const funded = profile.loans.filter((l) => l.status === 'Lent');
   const repaid = funded.filter((l) => l.repayment === 'Paid').length;
   return (
      <div className="space-y-3 rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4 text-sm text-[#d8cfe6]">
         <div className="flex flex-wrap gap-2 text-xs font-black">
            <span
               className={`rounded-full px-2 py-1 ${profile.facebookVerified ? 'bg-emerald-900 text-emerald-200' : 'bg-[#2a1453] text-[#a89bb8]'}`}
            >
               Facebook {profile.facebookVerified ? '✓' : '—'}
            </span>
            <span
               className={`rounded-full px-2 py-1 ${profile.idVerified ? 'bg-emerald-900 text-emerald-200' : 'bg-[#2a1453] text-[#a89bb8]'}`}
            >
               ID {profile.idVerified ? '✓' : 'not yet'}
            </span>
            <span
               className={`rounded-full px-2 py-1 ${profile.liveness ? 'bg-emerald-900 text-emerald-200' : 'bg-[#2a1453] text-[#a89bb8]'}`}
            >
               Liveness {profile.liveness ? '✓' : '—'}
            </span>
            <span className="rounded-full bg-[#2a1453] px-2 py-1 text-[#a89bb8]">
               {funded.length ? `${funded.length} loans · ${repaid} repaid` : 'No loans yet'}
            </span>
         </div>
         <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            <p>
               <b className="text-white">Job:</b> {profile.profession ?? '—'} ({label(profile.incomeType)})
            </p>
            <p>
               <b className="text-white">Income:</b> {income(profile.monthlyIncome)}/mo · expenses {income(profile.monthlyExpenses)}
            </p>
            {profile.otherIncome ? (
               <p>
                  <b className="text-white">Other income:</b> {profile.otherIncome}
               </p>
            ) : null}
            {profile.gapReasons.length ? (
               <p>
                  <b className="text-white">Cash gaps:</b> {profile.gapReasons.map(label).join(', ')}
               </p>
            ) : null}
            {profile.location ? (
               <p>
                  <b className="text-white">Location:</b> {profile.location}
               </p>
            ) : null}
            <p>
               <b className="text-white">Joined:</b> {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}
               {profile.referralCode ? ` · referral ${profile.referralCode}` : ''}
            </p>
         </div>
         {profile.incomeDescription ? <p className="italic">“{profile.incomeDescription}”</p> : null}
         {profile.loans.length ? (
            <ul className="space-y-1 border-t border-[#2a1453] pt-2">
               {profile.loans.slice(0, 5).map((l) => (
                  <li key={l.trackingId}>
                     {money(l.amount)} → {money(l.repay)} ·{' '}
                     {l.status === 'Lent' ? (l.repayment === 'Paid' ? 'repaid' : 'active') : l.status.toLowerCase()}
                     {l.reason ? <span className="text-[#a89bb8]"> · “{l.reason.slice(0, 90)}”</span> : null}
                  </li>
               ))}
            </ul>
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
   const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
   const [transcript, setTranscript] = useState<CallTranscript | null>(null);

   useEffect(() => {
      let cancelled = false;
      void loadCallTranscript(row.userId).then((t) => !cancelled && setTranscript(t));
      loadCallSheet(row.userId, row.callStartsAt)
         .then(({ profile: p, screening: s }) => {
            if (cancelled) return;
            setProfile(p);
            setScreening(s);
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

   const set = <K extends keyof ScreeningAnswers>(key: K, value: ScreeningAnswers[K]) => {
      setAnswers((a) => ({ ...a, [key]: value }));
      setStatus('idle');
   };
   const toggleExchange = (name: string) =>
      set(
         'exchanges',
         (answers.exchanges ?? []).includes(name)
            ? (answers.exchanges ?? []).filter((x) => x !== name)
            : [...(answers.exchanges ?? []), name]
      );

   const save = async () => {
      setStatus('saving');
      setError('');
      try {
         const saved = await saveCallScreening({
            id: screening?.id ?? null,
            userId: row.userId,
            callStartsAt: row.callStartsAt,
            answers,
            notes,
            redFlags,
            score
         });
         setScreening((s) => ({ ...(s as CallScreening), id: saved.id, updatedAt: saved.updatedAt }));
         setStatus('saved');
      } catch (err) {
         setStatus('idle');
         setError(err instanceof Error ? err.message : 'Could not save.');
      }
   };

   const mustCover = [answers.showedCashInOut, answers.informedTerms, answers.addedEmma].filter(Boolean).length;

   return (
      <div aria-modal="true" className="fixed inset-0 z-[80] flex justify-end bg-black/60" onClick={onClose} role="dialog">
         <div
            className="h-full w-full max-w-[760px] overflow-y-auto bg-[#12052a] p-5 text-white shadow-2xl sm:p-7"
            onClick={(e) => e.stopPropagation()}
         >
            <div className="flex items-start justify-between gap-3">
               <div className="min-w-0">
                  <p className="text-sm font-bold text-[#c9a7ff]">Call sheet</p>
                  <h2 className="break-words text-2xl font-black">{row.name}</h2>
                  <p className="text-sm text-[#a89bb8]">
                     {row.callStartsAt
                        ? new Date(row.callStartsAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
                        : 'No call'}
                     {row.host ? ` · with ${row.host}` : ''}
                     {row.attendance ? ` · ${row.attendance}` : ''}
                  </p>
               </div>
               <div className="flex shrink-0 gap-2">
                  {row.joinUrl && !row.outcome ? (
                     <a
                        className="rounded-xl bg-[#8336f0] px-4 py-2 text-sm font-black text-white no-underline"
                        href={row.joinUrl}
                        rel="noreferrer"
                        target="_blank"
                     >
                        Join call
                     </a>
                  ) : null}
                  <button className="rounded-xl border border-[#3d1f6e] px-3 py-2 text-sm font-black" onClick={onClose} type="button">
                     Close
                  </button>
               </div>
            </div>

            {error ? <p className="mt-4 rounded-xl border border-red-900 bg-red-950/60 p-3 font-bold text-red-300">{error}</p> : null}
            {!profile && !error ? <p className="mt-6 text-[#a89bb8]">Loading…</p> : null}

            {profile ? (
               <div className="mt-5 space-y-6">
                  <ProfileBlock profile={profile} />

                  <section className="space-y-4">
                     <h3 className="text-xl font-black">Screening questions</h3>
                     <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Full name">
                           <input className={inputClass} onChange={(e) => set('fullName', e.target.value)} value={answers.fullName ?? ''} />
                        </Field>
                        <Field label="Primary role / specialty / what they do">
                           <input className={inputClass} onChange={(e) => set('role', e.target.value)} value={answers.role ?? ''} />
                        </Field>
                        <Field label="Facebook account (link)">
                           <input
                              className={inputClass}
                              onChange={(e) => set('facebookUrl', e.target.value)}
                              placeholder="https://facebook.com/…"
                              value={answers.facebookUrl ?? ''}
                           />
                        </Field>
                        <Field label="TikTok account (link)">
                           <input
                              className={inputClass}
                              onChange={(e) => set('tiktokUrl', e.target.value)}
                              placeholder="https://tiktok.com/@…"
                              value={answers.tiktokUrl ?? ''}
                           />
                        </Field>
                     </div>
                     <Field label="How do you know us? / Referred by whom?">
                        <input className={inputClass} onChange={(e) => set('referral', e.target.value)} value={answers.referral ?? ''} />
                     </Field>
                     <Field label="If you were granted a loan today, how would you put it to work to achieve an immediate win?">
                        <textarea
                           className={`${inputClass} min-h-[80px]`}
                           onChange={(e) => set('loanUse', e.target.value)}
                           value={answers.loanUse ?? ''}
                        />
                     </Field>
                     <Field label="What local exchange do you normally use?">
                        <div className="flex flex-wrap gap-2">
                           {EXCHANGES.map((name) => {
                              const on = (answers.exchanges ?? []).includes(name);
                              return (
                                 <button
                                    className={`rounded-full border px-3 py-1.5 text-sm font-bold ${on ? 'border-emerald-500 bg-emerald-900 text-emerald-100' : 'border-[#3d1f6e] text-[#d8cfe6]'}`}
                                    key={name}
                                    onClick={() => toggleExchange(name)}
                                    type="button"
                                 >
                                    {on ? '✓ ' : ''}
                                    {name}
                                 </button>
                              );
                           })}
                        </div>
                     </Field>
                  </section>

                  <section className="space-y-3">
                     <h3 className="text-xl font-black">
                        Cover on the call <span className={mustCover === 3 ? 'text-emerald-300' : 'text-amber-300'}>{mustCover}/3</span>
                     </h3>
                     <Check checked={Boolean(answers.showedCashInOut)} onChange={(v) => set('showedCashInOut', v)}>
                        Showed how to cash in and cash out
                        <span className="mt-1 flex flex-wrap gap-3 text-sm">
                           {CASH_VIDEOS.map((v) => (
                              <a className="font-bold text-[#c9a7ff] underline" href={v.url} key={v.url} rel="noreferrer" target="_blank">
                                 ▶ {v.label}
                              </a>
                           ))}
                        </span>
                     </Check>
                     <Check checked={Boolean(answers.informedTerms)} onChange={(v) => set('informedTerms', v)}>
                        Informed: keeping an active account means sticking to their repayment terms. A default is flagged immediately and
                        means a permanent ban across all affiliated platforms.
                     </Check>
                     <Check checked={Boolean(answers.addedEmma)} onChange={(v) => set('addedEmma', v)}>
                        Added Emma Moodeng and Voices Against Unfair Loan on Facebook
                     </Check>
                  </section>

                  <section className="space-y-4">
                     <h3 className="text-xl font-black">Host notes</h3>
                     <Field label="Notes">
                        <textarea
                           className={`${inputClass} min-h-[90px]`}
                           onChange={(e) => (setNotes(e.target.value), setStatus('idle'))}
                           value={notes}
                        />
                     </Field>
                     <Field label="Red flags">
                        <textarea
                           className={`${inputClass} min-h-[60px]`}
                           onChange={(e) => (setRedFlags(e.target.value), setStatus('idle'))}
                           placeholder="Anything that didn't add up"
                           value={redFlags}
                        />
                     </Field>
                     <Field label="Your score (1 = don't lend, 5 = great)">
                        <div className="flex gap-2">
                           {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                 className={`size-11 rounded-xl border text-lg font-black ${score === n ? 'border-emerald-500 bg-emerald-800' : 'border-[#3d1f6e]'}`}
                                 key={n}
                                 onClick={() => (setScore(score === n ? null : n), setStatus('idle'))}
                                 type="button"
                              >
                                 {n}
                              </button>
                           ))}
                        </div>
                     </Field>
                  </section>

                  <TranscriptBlock transcript={transcript} />

                  <div className="sticky bottom-0 -mx-5 flex items-center gap-3 border-t border-[#2a1453] bg-[#12052a] px-5 py-3 sm:-mx-7 sm:px-7">
                     <button
                        className="rounded-xl bg-emerald-600 px-5 py-3 text-base font-black text-white disabled:opacity-50"
                        disabled={status === 'saving'}
                        onClick={() => void save()}
                        type="button"
                     >
                        {status === 'saving' ? 'Saving…' : 'Save call sheet'}
                     </button>
                     {status === 'saved' ? <span className="font-bold text-emerald-300">Saved to {row.name}&apos;s account</span> : null}
                     {status !== 'saved' && screening?.updatedAt ? (
                        <span className="text-sm text-[#a89bb8]">Last saved {new Date(screening.updatedAt).toLocaleString()}</span>
                     ) : null}
                  </div>
               </div>
            ) : null}
         </div>
      </div>
   );
}
