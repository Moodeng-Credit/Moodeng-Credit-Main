'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Pre-screenings from moodeng.app/screen/<affiliate code> (optional, done before sign-up). Each card
 * is one person: the AI's grade, what they said to each question, and the clip to watch. "Signed up"
 * shows once the same browser made an account. The grade is advice only — nothing checks it.
 * Database: supabase/migrations/20261116180000_pre_screening.sql.
 */

type Question = { id: string; text: string };
type Answer = { q: string; video: string | null; audio: string | null; seconds: number; text?: string | null };
type GradedAnswer = { q: string; transcript: string | null; score: number | null; note: string };
type IncomeFile = { path: string; name: string; mime: string; size: number };
type IncomeRead = {
   readable: boolean;
   doc_type: string | null;
   holder_name: string | null;
   institution: string | null;
   currency: string | null;
   period_start: string | null;
   period_end: string | null;
   months_covered: number | null;
   transactions: number;
   monthly_in: number | null;
   monthly_income_usd: number | null;
   warnings: string[];
};
type PreScreening = {
   id: string;
   name: string;
   ref_code: string | null;
   status: 'open' | 'sent' | 'graded' | 'failed';
   video_watched: boolean;
   videos_watched: number | null;
   questions: Question[];
   answers: Answer[];
   income_files: IncomeFile[] | null;
   grade: {
      summary?: string;
      unheard?: number;
      answers?: GradedAnswer[];
      income?: { files: number; read: IncomeRead | null; score: number | null; note: string } | null;
      flags?: string[];
   } | null;
   score: number | null;
   verdict: 'good' | 'ok' | 'weak' | null;
   grade_error: string | null;
   user_id: string | null;
   browser: string | null;
   files_removed_at: string | null;
   created_at: string;
   user: { username: string | null; email: string | null } | null;
};

const SELECT =
   'id, name, ref_code, status, video_watched, videos_watched, income_files, questions, answers, grade, score, verdict, grade_error, user_id, browser, files_removed_at, created_at, user:users(username, email)';

const VERDICT: Record<string, { label: string; className: string }> = {
   good: { label: '🟢 Good', className: 'bg-emerald-600 text-white' },
   ok: { label: '🟡 OK', className: 'bg-amber-500 text-black' },
   weak: { label: '🔴 Weak', className: 'bg-red-600 text-white' }
};

const bkk = (iso: string) =>
   new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Bangkok', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err));

const pill = 'rounded-full bg-[#241044] px-4 py-1.5 text-sm font-black text-[#a89bb8]';

export default function PreScreeningSection() {
   const [rows, setRows] = useState<PreScreening[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [onlySignedUp, setOnlySignedUp] = useState(false);
   const [clips, setClips] = useState<Record<string, string>>({});
   const [busy, setBusy] = useState<string | null>(null);
   // ?screen=<id> (the Telegram / Discord card's link): that one first.
   const focusId = useMemo(() => new URLSearchParams(window.location.search).get('screen'), []);

   const load = useCallback(async () => {
      setLoading(true);
      const { data, error: loadError } = await getSupabaseBrowserClient()
         .from('pre_screenings')
         .select(SELECT)
         .neq('status', 'open')
         .order('created_at', { ascending: false })
         .limit(100);
      if (loadError) setError(loadError.message);
      else {
         setRows((data ?? []) as unknown as PreScreening[]);
         setError(null);
      }
      setLoading(false);
   }, []);

   useEffect(() => {
      void load();
   }, [load]);

   const play = useCallback(async (path: string) => {
      try {
         const { data, error: urlError } = await getSupabaseBrowserClient().storage.from('pre-screenings').createSignedUrl(path, 600);
         if (urlError || !data?.signedUrl) throw urlError ?? new Error('No link');
         setClips((prev) => ({ ...prev, [path]: data.signedUrl }));
      } catch (err) {
         setError(errorMessage(err));
      }
   }, []);

   const regrade = useCallback(
      async (id: string) => {
         setBusy(id);
         const { error: rpcError } = await getSupabaseBrowserClient().rpc('regrade_pre_screening', { p_id: id });
         if (rpcError) setError(rpcError.message);
         else window.setTimeout(() => void load(), 15000);
         setBusy(null);
      },
      [load]
   );

   const focused = rows.find((r) => r.id === focusId);
   const shown = [...(focused ? [focused] : []), ...rows.filter((r) => r !== focused && (!onlySignedUp || r.user_id))];
   const signedUp = rows.filter((r) => r.user_id).length;

   return (
      <section className="space-y-4">
         <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
               <h2 className="break-words text-2xl font-black sm:text-3xl">
                  Pre-screening{' '}
                  <span className="text-base font-bold text-[#a89bb8]">
                     ({rows.length} done · {signedUp} signed up)
                  </span>
               </h2>
               <p className="mt-1.5 max-w-3xl text-base text-[#a89bb8]">
                  People who did moodeng.app/screen before signing up. The AI hears each answer and scores what was said — it does not watch
                  the video, so open the clips yourself. Optional: nothing blocks or passes anyone on this score.
               </p>
            </div>
            <div className="flex gap-2">
               <button className={pill} onClick={() => setOnlySignedUp((v) => !v)} type="button">
                  {onlySignedUp ? 'Show everyone' : 'Only signed up'}
               </button>
               <button className={pill} onClick={() => void load()} type="button">
                  {loading ? 'Loading…' : 'Refresh'}
               </button>
            </div>
         </div>
         {error ? <p className="text-sm font-bold text-red-300">{error}</p> : null}
         {!shown.length && !loading ? <p className="text-base font-bold text-[#6f6385]">Nobody yet.</p> : null}

         <ul className="space-y-3">
            {shown.map((row) => {
               const verdict = row.verdict ? VERDICT[row.verdict] : null;
               return (
                  <li
                     className={`rounded-2xl border-2 p-4 ${row.id === focusId ? 'border-[#7661f9] bg-[#1d1233]' : 'border-[#2b1d45] bg-[#150c26]'}`}
                     key={row.id}
                  >
                     <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-black">{row.name}</span>
                        {verdict ? (
                           <span className={`rounded-full px-3 py-0.5 text-sm font-black ${verdict.className}`}>
                              {verdict.label} · {row.score}/100
                              {row.grade?.unheard ? ` · ${row.grade.unheard} not heard` : ''}
                           </span>
                        ) : (
                           <span className="rounded-full bg-[#3a2d4f] px-3 py-0.5 text-sm font-black text-[#cfc6dd]">
                              {row.status === 'sent' ? 'AI is grading…' : 'Not graded — watch the clips'}
                           </span>
                        )}
                        {row.user_id ? (
                           <span className="rounded-full bg-emerald-900/60 px-3 py-0.5 text-sm font-black text-emerald-200">
                              ✅ Signed up{row.user?.username ? ` · @${row.user.username}` : row.user?.email ? ` · ${row.user.email}` : ''}
                           </span>
                        ) : (
                           <span className="rounded-full bg-[#241044] px-3 py-0.5 text-sm font-bold text-[#a89bb8]">No account yet</span>
                        )}
                     </div>
                     <p className="mt-1 text-sm text-[#a89bb8]">
                        {bkk(row.created_at)} · {row.ref_code ? `affiliate ${row.ref_code}` : 'no affiliate code'} ·{' '}
                        {row.videos_watched != null
                           ? row.video_watched
                              ? `watched all ${row.videos_watched} videos`
                              : `⚠️ watched ${row.videos_watched} video${row.videos_watched === 1 ? '' : 's'} to the end`
                           : row.video_watched
                             ? 'watched the video'
                             : '⚠️ did not finish the video'}
                        {row.browser ? ` · ${row.browser}` : ''}
                     </p>
                     {row.grade?.summary ? <p className="mt-2 text-base font-bold text-[#e6def5]">{row.grade.summary}</p> : null}
                     {row.grade?.flags?.length ? (
                        <ul className="mt-2 space-y-1">
                           {row.grade.flags.map((f) => (
                              <li className="text-sm font-bold text-amber-300" key={f}>
                                 ⚠️ {f}
                              </li>
                           ))}
                        </ul>
                     ) : null}

                     <ol className="mt-3 space-y-3">
                        {row.questions.map((q, i) => {
                           const answer = row.answers.find((a) => a.q === q.id);
                           const graded = row.grade?.answers?.find((a) => a.q === q.id);
                           const path = answer?.video ?? answer?.audio ?? null;
                           return (
                              <li className="rounded-xl bg-[#1b1030] p-3" key={q.id}>
                                 <p className="text-sm font-black text-[#cfc6dd]">
                                    {i + 1}. {q.text}{' '}
                                    <span className="text-[#a89bb8]">{graded?.score != null ? `· ${graded.score}/10` : '· no score'}</span>
                                 </p>
                                 <p className="mt-1 text-base text-white">
                                    {answer?.text ? (
                                       <>
                                          <span className="mr-1 rounded bg-[#241044] px-1.5 py-0.5 text-xs font-bold text-[#a89bb8]">typed</span>“{answer.text}”
                                       </>
                                    ) : graded?.transcript ? (
                                       `“${graded.transcript}”`
                                    ) : (
                                       <span className="text-[#a89bb8]">Not heard.</span>
                                    )}
                                 </p>
                                 {graded?.note ? <p className="mt-1 text-sm text-[#a89bb8]">{graded.note}</p> : null}
                                 {path && clips[path] ? (
                                    answer?.video ? (
                                       <video className="mt-2 max-h-[360px] rounded-lg" controls playsInline src={clips[path]} />
                                    ) : (
                                       <audio className="mt-2 w-full" controls src={clips[path]} />
                                    )
                                 ) : path && !row.files_removed_at ? (
                                    <button className={`${pill} mt-2`} onClick={() => void play(path)} type="button">
                                       ▶️ {answer?.video ? 'Watch' : 'Listen (no video)'}
                                       {answer?.seconds ? ` · ${answer.seconds}s` : ''}
                                    </button>
                                 ) : (
                                    <p className="mt-2 text-sm text-[#6f6385]">
                                       {path ? 'Clip removed (older than 30 days, never signed up).' : answer?.text ? 'Typed answer.' : 'No clip for this answer.'}
                                    </p>
                                 )}
                              </li>
                           );
                        })}
                     </ol>
                     <IncomeProof clips={clips} onOpen={play} row={row} />
                     <div className="mt-3 flex flex-wrap items-center gap-3">
                        {row.files_removed_at ? null : (
                           <button className={pill} disabled={busy === row.id} onClick={() => void regrade(row.id)} type="button">
                              {busy === row.id ? 'Asking…' : 'Grade again'}
                           </button>
                        )}
                        {row.grade_error ? <span className="text-sm text-amber-300">AI problem: {row.grade_error}</span> : null}
                     </div>
                  </li>
               );
            })}
         </ul>
      </section>
   );
}

/** The proof of income they sent: what the AI read from it, its 0-10, and the files to open. */
function IncomeProof({ row, clips, onOpen }: { row: PreScreening; clips: Record<string, string>; onOpen: (path: string) => Promise<void> }) {
   const files = row.income_files ?? [];
   const income = row.grade?.income ?? null;
   const read = income?.read ?? null;
   if (!files.length) {
      // Pre-screenings from before the proof step (Nov 17) never had one.
      return row.videos_watched != null ? <p className="mt-3 text-sm font-bold text-[#a89bb8]">📄 No proof of income sent.</p> : null;
   }
   return (
      <div className="mt-3 rounded-xl bg-[#1b1030] p-3">
         <p className="text-sm font-black text-[#cfc6dd]">
            📄 Proof of income · {files.length} file{files.length === 1 ? '' : 's'}{' '}
            <span className="text-[#a89bb8]">{income?.score != null ? `· ${income.score}/10` : '· no score'}</span>
         </p>
         {read?.readable ? (
            <p className="mt-1 text-base text-white">
               {[
                  read.doc_type?.replace(/_/g, ' '),
                  read.holder_name,
                  read.institution,
                  read.period_start && read.period_end ? `${read.period_start} → ${read.period_end}` : null,
                  `${read.transactions} rows`,
                  read.monthly_in != null ? `${read.monthly_in.toLocaleString()} ${read.currency ?? ''} in/month` : null,
                  read.monthly_income_usd != null ? `~$${Math.round(read.monthly_income_usd)}/month` : null
               ]
                  .filter(Boolean)
                  .join(' · ')}
            </p>
         ) : null}
         {income?.note ? <p className="mt-1 text-sm text-[#a89bb8]">{income.note}</p> : null}
         {read?.warnings?.length ? <p className="mt-1 text-sm font-bold text-red-300">🚩 {read.warnings.join(' · ')}</p> : null}
         {row.files_removed_at ? (
            <p className="mt-2 text-sm text-[#6f6385]">Files removed (older than 30 days, never signed up).</p>
         ) : (
            <div className="mt-2 flex flex-wrap gap-2">
               {files.map((f, i) =>
                  clips[f.path] ? (
                     f.mime === 'application/pdf' ? (
                        <a className={pill} href={clips[f.path]} key={f.path} rel="noreferrer" target="_blank">
                           📄 Open {f.name || `file ${i + 1}`}
                        </a>
                     ) : (
                        <a href={clips[f.path]} key={f.path} rel="noreferrer" target="_blank">
                           <img alt={f.name} className="max-h-[360px] rounded-lg" src={clips[f.path]} />
                        </a>
                     )
                  ) : (
                     <button className={pill} key={f.path} onClick={() => void onOpen(f.path)} type="button">
                        👀 {f.name || `File ${i + 1}`}
                     </button>
                  )
               )}
            </div>
         )}
      </div>
   );
}
