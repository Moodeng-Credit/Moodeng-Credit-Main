import { useEffect, useMemo, useRef, useState } from 'react';

import { Check, FileText, ImagePlus, Loader2, Lock, MessageCircle, X } from 'lucide-react';
import { useParams } from 'react-router-dom';

import { EXTERNAL_LINKS } from '@/config/externalLinks';
import { missingItems, type ProofAnswers, type ProofItem } from '@/lib/proofRequests';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { CONNECT_HIPPOS, ConnectHero, PrimaryButton } from '@/views/dashboard/components/connectKit';

// moodeng.app/proof/<token> — the link the team sends a new applicant after their call, to back up
// what they said (proof they work at their company, their work visa, a couple of written answers).
// No sign-in: the token is the key. One card per thing asked; a proof takes photos/PDFs, or "I don't
// have this" + why; a question takes a written answer. Send stays off until every card is done.
// Files go to the private proof-requests bucket under {token}/...; submit_proof_request() saves it and
// pings the team. No automatic checks — the team reads it in Admin → People → Proof requests.

const MAX_FILES_PER_ITEM = 6;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';
const ACCEPTED = new Set(ACCEPT.split(','));

type Stage = 'loading' | 'not_found' | 'expired' | 'open' | 'sending' | 'submitted' | 'done';
type Request = {
   first_name: string | null;
   message: string | null;
   items: ProofItem[];
   stage: 'open' | 'expired' | 'submitted' | 'done';
   ask_again: string | null;
   answers: ProofAnswers;
   file_counts: Record<string, number>;
};
type Picked = { key: string; item: string; file: File; preview: string | null; error: string | null };

export type ProofPagePreview = { stage: Stage; request?: Request; picked?: Array<{ item: string; name: string }> };

const facebookHref = () =>
   typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
      ? EXTERNAL_LINKS.support.messengerLoginCodeAndroid
      : EXTERNAL_LINKS.support.messengerDocuments;

const draftKey = (token: string) => `proof-draft:${token}`;
const readDraft = (token: string): ProofAnswers | null => {
   try {
      const raw = window.localStorage.getItem(draftKey(token));
      return raw ? (JSON.parse(raw) as ProofAnswers) : null;
   } catch {
      return null;
   }
};
const writeDraft = (token: string, answers: ProofAnswers | null) => {
   try {
      if (answers) window.localStorage.setItem(draftKey(token), JSON.stringify(answers));
      else window.localStorage.removeItem(draftKey(token));
   } catch {
      // Private window / blocked storage: the draft just isn't kept.
   }
};

const fieldClass =
   'w-full rounded-[12px] border-2 border-[#e2dcee] bg-white px-3 py-2.5 text-[16px] text-[#3b2f4a] placeholder:text-[#b3a9c2] focus:border-[#7661f9] focus:outline-none dark:border-[#3a2d4f] dark:bg-[#1b1526] dark:text-[#f5f0ff]';

export default function ProofRequestPage({ preview }: { preview?: ProofPagePreview } = {}) {
   const { token = '' } = useParams();
   const [stage, setStage] = useState<Stage>(preview?.stage ?? 'loading');
   const [request, setRequest] = useState<Request | null>(preview?.request ?? null);
   const [answers, setAnswers] = useState<ProofAnswers>(preview?.request?.answers ?? {});
   const [picked, setPicked] = useState<Picked[]>(
      (preview?.picked ?? []).map((p, i) => ({
         key: `preview-${i}`,
         item: p.item,
         file: new File([''], p.name, { type: p.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg' }),
         preview: null,
         error: null
      }))
   );
   const [sentCount, setSentCount] = useState(0);
   const [error, setError] = useState<string | null>(null);
   const [showMissing, setShowMissing] = useState(false);
   const inputs = useRef<Record<string, HTMLInputElement | null>>({});

   useEffect(() => {
      if (preview) return;
      let cancelled = false;
      void getSupabaseBrowserClient()
         .rpc('get_proof_request', { p_token: token })
         .then(({ data, error: rpcError }) => {
            if (cancelled) return;
            const row = data as Request | null;
            if (rpcError || !row) return setStage('not_found');
            setRequest(row);
            setAnswers({ ...(row.answers ?? {}), ...(readDraft(token) ?? {}) });
            setStage(row.stage);
         });
      return () => {
         cancelled = true;
      };
   }, [preview, token]);

   const items = useMemo(() => request?.items ?? [], [request]);
   const fileCounts = useMemo(() => {
      const counts: Record<string, number> = { ...(request?.file_counts ?? {}) };
      for (const p of picked) if (!p.error) counts[p.item] = (counts[p.item] ?? 0) + 1;
      return counts;
   }, [picked, request]);
   const missing = missingItems(items, answers, fileCounts);
   const doneCount = items.length - missing.length;

   const setAnswer = (id: string, patch: Partial<ProofAnswers[string]>) => {
      setAnswers((prev) => {
         const next = { ...prev, [id]: { ...prev[id], ...patch } };
         if (!preview) writeDraft(token, next);
         return next;
      });
   };

   const addFiles = (item: string, list: FileList | null) => {
      if (!list?.length) return;
      const already = picked.filter((p) => p.item === item).length;
      const next = Array.from(list)
         .slice(0, MAX_FILES_PER_ITEM - already)
         .map((file, i) => ({
            key: `${Date.now()}-${item}-${i}`,
            item,
            file,
            preview: /^image\/(jpeg|png|webp)$/.test(file.type) ? URL.createObjectURL(file) : null,
            error: !ACCEPTED.has(file.type) ? 'Use a photo or PDF' : file.size > MAX_BYTES ? 'Max 10 MB' : null
         }));
      setPicked((prev) => [...prev, ...next]);
      setAnswer(item, { missing: false });
      const input = inputs.current[item];
      if (input) input.value = '';
   };

   const good = picked.filter((p) => !p.error);

   const send = async () => {
      if (missing.length) {
         setShowMissing(true);
         document.getElementById(`item-${missing[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
         return;
      }
      setStage('sending');
      setSentCount(0);
      setError(null);
      const supabase = getSupabaseBrowserClient();
      const files: Array<{ item: string; path: string; name: string; mime: string; size: number }> = [];
      let failed = 0;
      for (const p of good) {
         const safeName = p.file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80) || 'file';
         const path = `${token}/${p.item}/${crypto.randomUUID()}-${safeName}`;
         const { error: uploadError } = await supabase.storage
            .from('proof-requests')
            .upload(path, p.file, { contentType: p.file.type, upsert: false });
         if (uploadError) failed += 1;
         else files.push({ item: p.item, path, name: p.file.name.slice(0, 200), mime: p.file.type, size: p.file.size });
         setSentCount((n) => n + 1);
      }
      if (failed) {
         setError('Some files didn’t upload. Check your connection and try again.');
         setStage('open');
         return;
      }
      const clean: ProofAnswers = {};
      for (const item of items) {
         const a = answers[item.id];
         if (a) clean[item.id] = { text: a.text?.trim() || undefined, missing: item.kind === 'proof' ? Boolean(a.missing) : undefined };
      }
      const { error: submitError } = await supabase.rpc('submit_proof_request', { p_token: token, p_answers: clean, p_files: files });
      if (submitError) {
         setError(
            /closed/i.test(submitError.message)
               ? 'This link is closed. Message us on Facebook and we’ll help.'
               : 'Couldn’t send. Check your connection and try again.'
         );
         setStage('open');
         return;
      }
      writeDraft(token, null);
      setPicked([]);
      setStage('submitted');
   };

   const facebookButton = (
      <a
         className="flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border-2 border-[#e2dcee] bg-white px-4 text-[15px] font-bold text-[#6b55f7] dark:border-[#3a2d4f] dark:bg-transparent dark:text-[#b4a6ff]"
         href={facebookHref()}
         rel="noreferrer"
         target="_blank"
      >
         <MessageCircle aria-hidden="true" className="size-5" strokeWidth={2.2} />
         Message us on Facebook
      </a>
   );

   const card = 'flex flex-col gap-4 rounded-[20px] bg-white px-5 py-5 dark:bg-dv2-card';

   return (
      <div className="min-h-screen bg-dv2-page">
         <div className="mx-auto flex max-w-[440px] flex-col gap-4 px-4 pb-28">
            <header className="flex h-16 items-end justify-center pb-1">
               <h1 className="text-[24px] font-semibold leading-[1.1] tracking-[-0.48px] text-[#594d65] dark:text-[#e6def2]">
                  Finish your application
               </h1>
            </header>

            {stage === 'loading' ? (
               <div className="mt-4 h-[260px] animate-pulse rounded-[16px] bg-[#ece9f1] dark:bg-dv2-card" aria-busy="true" />
            ) : null}

            {stage === 'not_found' || stage === 'expired' ? (
               <div className={card}>
                  <ConnectHero
                     image={CONNECT_HIPPOS.missed}
                     title={stage === 'expired' ? 'This link has expired' : 'We can’t find this link'}
                     subtitle="Message us on Facebook and we’ll send you a new one."
                  />
                  {facebookButton}
               </div>
            ) : null}

            {stage === 'open' && request ? (
               <>
                  <div className={card}>
                     <ConnectHero
                        image={CONNECT_HIPPOS.hello}
                        title={`Hi${request.first_name ? ` ${request.first_name}` : ''}! One last step`}
                        subtitle="Please send proof of what you told us on the call. It takes about 2 minutes."
                     />
                     {request.ask_again ? (
                        <div className="rounded-[16px] bg-[#fff6e5] px-4 py-3 text-[15px] leading-[21px] text-[#6a4a12] dark:bg-[#33270f] dark:text-[#f3d9a4]">
                           <b>We still need:</b> {request.ask_again}
                        </div>
                     ) : request.message ? (
                        <div className="rounded-[16px] bg-[#f8f1ff] px-4 py-3 text-[15px] leading-[21px] text-[#594d65] dark:bg-[#221a31] dark:text-[#d9cfe8]">
                           <b>From the Moodeng team:</b> {request.message}
                        </div>
                     ) : null}
                     <div>
                        <div className="mb-1.5 flex justify-between text-[13px] font-bold text-[#7b6b8c] dark:text-[#b9abcc]">
                           <span>
                              {doneCount} of {items.length} done
                           </span>
                           {missing.length ? <span>{missing.length} left</span> : <span className="text-[#2f8a3c]">Ready to send ✓</span>}
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#ece6f6] dark:bg-[#2a2235]">
                           <div
                              className="h-full rounded-full bg-[#6b55f7] transition-[width] duration-300"
                              style={{ width: `${(doneCount / Math.max(1, items.length)) * 100}%` }}
                           />
                        </div>
                     </div>
                  </div>

                  {items.map((item, index) => {
                     const a = answers[item.id] ?? {};
                     const isDone = !missing.some((m) => m.id === item.id);
                     const flagged = showMissing && !isDone;
                     const mine = picked.filter((p) => p.item === item.id);
                     const earlier = request.file_counts?.[item.id] ?? 0;
                     return (
                        <section
                           className={`${card} border-2 ${flagged ? 'border-[#f2b8b5]' : isDone ? 'border-[#bfe6c6] dark:border-[#24502f]' : 'border-transparent'}`}
                           id={`item-${item.id}`}
                           key={item.id}
                        >
                           <div className="flex items-start gap-3">
                              <span
                                 className={`grid size-8 shrink-0 place-items-center rounded-full text-[15px] font-bold ${isDone ? 'bg-[#4aa256] text-white' : 'bg-[#f3ecff] text-[#6b55f7] dark:bg-[#2a2140]'}`}
                              >
                                 {isDone ? <Check aria-hidden="true" className="size-4" strokeWidth={3} /> : index + 1}
                              </span>
                              <div className="min-w-0">
                                 <h2 className="text-[17px] font-bold leading-[22px] text-[#3b2f4a] dark:text-[#f5f0ff]">{item.label}</h2>
                                 {item.hint ? (
                                    <p className="mt-0.5 text-[14px] leading-[19px] text-[#7b6b8c] dark:text-[#b9abcc]">{item.hint}</p>
                                 ) : null}
                              </div>
                           </div>

                           {item.kind === 'question' ? (
                              <textarea
                                 aria-label={item.label}
                                 className={`${fieldClass} min-h-[84px] resize-y`}
                                 maxLength={1000}
                                 onChange={(e) => setAnswer(item.id, { text: e.target.value })}
                                 placeholder="Type your answer"
                                 value={a.text ?? ''}
                              />
                           ) : a.missing ? (
                              <div className="flex flex-col gap-2">
                                 <textarea
                                    aria-label={`Why you can't send: ${item.label}`}
                                    className={`${fieldClass} min-h-[84px] resize-y`}
                                    maxLength={1000}
                                    onChange={(e) => setAnswer(item.id, { text: e.target.value })}
                                    placeholder="Tell us why, or what you can send instead"
                                    value={a.text ?? ''}
                                 />
                                 <button
                                    className="self-start text-[14px] font-semibold text-[#6b55f7] underline dark:text-[#b4a6ff]"
                                    onClick={() => setAnswer(item.id, { missing: false })}
                                    type="button"
                                 >
                                    I can send it after all
                                 </button>
                              </div>
                           ) : (
                              <div className="flex flex-col gap-3">
                                 {earlier ? (
                                    <p className="text-[14px] font-semibold text-[#2f8a3c]">
                                       ✓ {earlier} {earlier === 1 ? 'file' : 'files'} sent before
                                    </p>
                                 ) : null}
                                 {mine.length ? (
                                    <ul className="grid grid-cols-3 gap-2">
                                       {mine.map((p) => (
                                          <li
                                             className={`relative aspect-[3/4] overflow-hidden rounded-[12px] border-2 ${p.error ? 'border-[#f2b8b5] bg-[#fff4f3]' : 'border-[#e2dcee] bg-[#f6f5f9] dark:border-[#3a2d4f] dark:bg-[#1b1526]'}`}
                                             key={p.key}
                                          >
                                             {p.preview ? (
                                                <img alt="" className="size-full object-cover" src={p.preview} />
                                             ) : (
                                                <span className="flex size-full flex-col items-center justify-center gap-1 px-1 text-center text-[11px] font-semibold text-[#7b6b8c]">
                                                   <FileText aria-hidden="true" className="size-6" strokeWidth={2} />
                                                   <span className="line-clamp-2 break-all">{p.file.name}</span>
                                                </span>
                                             )}
                                             {p.error ? (
                                                <span className="absolute inset-x-0 bottom-0 bg-[#c0392b] px-1 py-0.5 text-center text-[11px] font-bold text-white">
                                                   {p.error}
                                                </span>
                                             ) : null}
                                             <button
                                                aria-label={`Remove ${p.file.name}`}
                                                className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/60 text-white"
                                                onClick={() => setPicked((prev) => prev.filter((x) => x.key !== p.key))}
                                                type="button"
                                             >
                                                <X aria-hidden="true" className="size-4" strokeWidth={3} />
                                             </button>
                                          </li>
                                       ))}
                                    </ul>
                                 ) : null}
                                 {mine.length < MAX_FILES_PER_ITEM ? (
                                    <label className="flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-[#7661f9] bg-white px-4 text-[16px] font-bold text-[#6b55f7] active:scale-[0.99] dark:bg-transparent">
                                       <ImagePlus aria-hidden="true" className="size-5" strokeWidth={2.2} />
                                       {mine.length || earlier ? 'Add more' : 'Add photo or PDF'}
                                       <input
                                          accept={ACCEPT}
                                          className="sr-only"
                                          multiple
                                          onChange={(e) => addFiles(item.id, e.target.files)}
                                          ref={(el) => {
                                             inputs.current[item.id] = el;
                                          }}
                                          type="file"
                                       />
                                    </label>
                                 ) : null}
                                 <input
                                    aria-label={`Anything to add about ${item.label}`}
                                    className={fieldClass}
                                    maxLength={1000}
                                    onChange={(e) => setAnswer(item.id, { text: e.target.value })}
                                    placeholder="Anything to add? (optional)"
                                    value={a.text ?? ''}
                                 />
                                 {mine.length || earlier ? null : (
                                    <button
                                       className="self-start text-[14px] font-semibold text-[#7b6b8c] underline dark:text-[#b9abcc]"
                                       onClick={() => setAnswer(item.id, { missing: true })}
                                       type="button"
                                    >
                                       I don’t have this
                                    </button>
                                 )}
                              </div>
                           )}
                           {flagged ? (
                              <p className="text-[14px] font-semibold text-[#c0392b]">
                                 {item.kind === 'question'
                                    ? 'Please answer this one.'
                                    : a.missing
                                      ? 'Please tell us why.'
                                      : 'Add a photo or PDF, or tap “I don’t have this”.'}
                              </p>
                           ) : null}
                        </section>
                     );
                  })}

                  <div className={card}>
                     <p className="flex items-start gap-2 text-[13px] leading-[18px] text-[#7b6b8c] dark:text-[#b9abcc]">
                        <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
                        Sent privately. Only the Moodeng team sees it, never lenders.
                     </p>
                     {error ? <p className="text-[14px] font-semibold text-[#c0392b]">{error}</p> : null}
                     <PrimaryButton onClick={() => void send()}>
                        {missing.length ? `Send (${missing.length} left)` : 'Send to the team'}
                     </PrimaryButton>
                  </div>
               </>
            ) : null}

            {stage === 'sending' ? (
               <div className={card}>
                  <ConnectHero image={CONNECT_HIPPOS.waiting} title="Sending…" subtitle="Keep this screen open for a moment." />
                  <div className="h-3 w-full overflow-hidden rounded-full bg-[#ece6f6] dark:bg-[#2a2235]">
                     <div
                        className="h-full rounded-full bg-[#6b55f7] transition-[width] duration-300"
                        style={{ width: `${Math.max(8, (sentCount / Math.max(1, good.length)) * 100)}%` }}
                     />
                  </div>
                  <p className="flex items-center gap-2 text-[15px] font-semibold text-[#594d65] dark:text-[#d9cfe8]">
                     <Loader2 aria-hidden="true" className="size-4 animate-spin" strokeWidth={3} />
                     {good.length ? `Uploading ${Math.min(sentCount + 1, good.length)} of ${good.length}` : 'Sending your answers'}
                  </p>
               </div>
            ) : null}

            {stage === 'submitted' || stage === 'done' ? (
               <div className={card}>
                  <ConnectHero
                     image={stage === 'done' ? CONNECT_HIPPOS.approved : CONNECT_HIPPOS.connected}
                     title={stage === 'done' ? 'All set ✅' : 'Thanks, we got it!'}
                     subtitle={
                        stage === 'done'
                           ? 'The team has checked what you sent.'
                           : 'The team will look at it and message you on Facebook. You don’t need to do anything else.'
                     }
                  />
                  {facebookButton}
               </div>
            ) : null}
         </div>
      </div>
   );
}
