import { useCallback, useEffect, useRef, useState } from 'react';

import { Check, ChevronLeft, FileText, ImagePlus, Loader2, Lock, MessageCircle, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { EXTERNAL_LINKS } from '@/config/externalLinks';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { CONNECT_HIPPOS, ConnectHero, GhostButton, PrimaryButton } from '@/views/dashboard/components/connectKit';

// moodeng.app/documents — a borrower sends proof of income (GCash/Maya history, bank statement,
// payslip) and follows it here. Cards, in order:
//   pick       add photos/PDFs (up to 6) + what it is
//   sending    each file ticks off as it uploads
//   checking   Sent ✓ → Reading → Checking, while the AI reads it (get_my_income_document = checking)
//   in_review  "We'll let you know within 24 hours" + message us on Facebook
//   approved   / declined (with the team's reason) — what they see when they come back, and what the
//              push / Messenger / Telegram message opens
// Files go to the private income-docs bucket; submit_income_document() records the send and pings the
// team. Borrowers never see scores or flags — only the stage and, if declined, the team's reason.

const MAX_FILES = 6;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';
const ACCEPTED = new Set(ACCEPT.split(','));
const POLL_MS = 3000;
// The AI read usually takes under a minute; after this the card moves on to "in review" anyway.
const CHECKING_MAX_MS = 75_000;

export type DocumentsPhase = 'loading' | 'pick' | 'sending' | 'checking' | 'in_review' | 'approved' | 'declined';
type Picked = { key: string; file: File; preview: string | null; error: string | null };
type Status = {
   stage: 'checking' | 'in_review' | 'approved' | 'declined';
   file_count: number;
   sent_at: string;
   reason: string | null;
} | null;

const fetchStatus = async (): Promise<Status> => {
   const { data, error } = await getSupabaseBrowserClient().rpc('get_my_income_document');
   if (error) return null;
   const row = (Array.isArray(data) ? data[0] : data) as Status | undefined;
   return row ?? null;
};

// Android Chrome can't open m.me links; messenger.com/t works there.
const facebookHref = () =>
   typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
      ? EXTERNAL_LINKS.support.messengerLoginCodeAndroid
      : EXTERNAL_LINKS.support.messengerDocuments;

export default function DocumentsPage({
   preview
}: { preview?: { phase: DocumentsPhase; reason?: string; checkingStep?: 1 | 2 | 3; fileNames?: string[] } } = {}) {
   const [phase, setPhase] = useState<DocumentsPhase>(preview?.phase ?? 'loading');
   const [picked, setPicked] = useState<Picked[]>([]);
   const [note, setNote] = useState('');
   const [sentCount, setSentCount] = useState(0);
   const [checkingStep, setCheckingStep] = useState<1 | 2 | 3>(preview?.checkingStep ?? 1);
   const [reason, setReason] = useState<string | null>(preview?.reason ?? null);
   const [error, setError] = useState<string | null>(null);
   const inputRef = useRef<HTMLInputElement>(null);
   const navigate = useNavigate();

   const showStatus = useCallback((status: Status) => {
      if (!status) return setPhase('pick');
      setReason(status.reason);
      setPhase(status.stage);
   }, []);

   // Where is their latest send? (Skipped in design previews.)
   useEffect(() => {
      if (preview) return;
      void fetchStatus().then(showStatus);
   }, [preview, showStatus]);

   // While the AI reads: tick "Reading" → "Checking" for the feel of progress, and move on to
   // "in review" as soon as the read is done (or after CHECKING_MAX_MS whatever happens).
   useEffect(() => {
      if (phase !== 'checking' || preview) return;
      const startedAt = Date.now();
      const stepTimer = window.setTimeout(() => setCheckingStep(2), 6000);
      const poll = window.setInterval(async () => {
         const status = await fetchStatus();
         if (status && status.stage !== 'checking') {
            setCheckingStep(3);
            window.setTimeout(() => showStatus(status), 900);
            window.clearInterval(poll);
         } else if (Date.now() - startedAt > CHECKING_MAX_MS) {
            setPhase('in_review');
            window.clearInterval(poll);
         }
      }, POLL_MS);
      return () => {
         window.clearTimeout(stepTimer);
         window.clearInterval(poll);
      };
   }, [phase, preview, showStatus]);

   const addFiles = (list: FileList | null) => {
      if (!list?.length) return;
      const next = Array.from(list)
         .slice(0, MAX_FILES - picked.length)
         .map((file, i) => ({
            key: `${Date.now()}-${i}`,
            file,
            preview: /^image\/(jpeg|png|webp)$/.test(file.type) ? URL.createObjectURL(file) : null,
            error: !ACCEPTED.has(file.type) ? 'Use a photo or PDF' : file.size > MAX_BYTES ? 'Max 10 MB' : null
         }));
      setPicked((prev) => [...prev, ...next]);
      if (inputRef.current) inputRef.current.value = '';
   };

   const good = picked.filter((p) => !p.error);
   const sendingNames = good.length ? good.map((p) => p.file.name) : (preview?.fileNames ?? []);

   const send = async () => {
      if (!good.length) return;
      setPhase('sending');
      setSentCount(0);
      setError(null);
      const supabase = getSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) {
         setError('Please sign in again, then send.');
         setPhase('pick');
         return;
      }
      const files: Array<{ path: string; name: string; mime: string; size: number }> = [];
      for (const p of good) {
         const safeName = p.file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80) || 'document';
         const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
         const { error: uploadError } = await supabase.storage
            .from('income-docs')
            .upload(path, p.file, { contentType: p.file.type, upsert: false });
         if (!uploadError) files.push({ path, name: p.file.name.slice(0, 200), mime: p.file.type, size: p.file.size });
         setSentCount((n) => n + 1);
      }
      const { error: submitError } = files.length
         ? await supabase.rpc('submit_income_document', { p_files: files, p_note: note.trim() || null })
         : { error: new Error('nothing uploaded') };
      if (submitError) {
         setError(
            /too many/i.test(submitError.message)
               ? 'You’ve sent a lot today. Try again tomorrow, or message us.'
               : 'Couldn’t send. Check your connection and try again.'
         );
         setPhase('pick');
         return;
      }
      setPicked([]);
      setNote('');
      setCheckingStep(1);
      setPhase('checking');
   };

   const startOver = () => {
      setPicked([]);
      setError(null);
      setPhase('pick');
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

   return (
      <div className="min-h-screen bg-dv2-page">
         <div className="mx-auto flex max-w-[440px] flex-col gap-4 px-5 pb-28">
            <header className="relative flex h-16 items-end justify-center pb-1">
               <Link to="/dashboard" className="absolute bottom-1 left-0 text-[#594d65] dark:text-[#d9cfe6]" aria-label="Back to dashboard">
                  <ChevronLeft className="h-6 w-6" strokeWidth={2} />
               </Link>
               <h1 className="text-[24px] font-semibold leading-[1.1] tracking-[-0.48px] text-[#594d65] dark:text-[#e6def2]">
                  Proof of income
               </h1>
            </header>

            {phase === 'loading' ? (
               <div className="mt-4 h-[220px] animate-pulse rounded-[16px] bg-[#ece9f1] dark:bg-dv2-card" aria-busy="true" />
            ) : null}

            {phase === 'pick' ? (
               <div className="flex flex-col gap-4 rounded-[20px] bg-white px-5 py-5 dark:bg-dv2-card">
                  <ConnectHero
                     image={CONNECT_HIPPOS.cashout}
                     title="Send your proof of income"
                     subtitle="It helps you borrow more. Any one of these works:"
                  />
                  <ul className="flex flex-col gap-1.5 text-[15px] leading-[20px] text-[#594d65] dark:text-[#d9cfe8]">
                     <li>📱 GCash or Maya history, last 2–3 months (screenshots are fine)</li>
                     <li>🏦 Bank statement</li>
                     <li>🧾 Latest payslip</li>
                  </ul>

                  {picked.length ? (
                     <ul className="grid grid-cols-3 gap-2">
                        {picked.map((p) => (
                           <li
                              key={p.key}
                              className={`relative aspect-[3/4] overflow-hidden rounded-[12px] border-2 ${p.error ? 'border-[#f2b8b5] bg-[#fff4f3]' : 'border-[#e2dcee] bg-[#f6f5f9] dark:border-[#3a2d4f] dark:bg-[#1b1526]'}`}
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

                  {picked.length < MAX_FILES ? (
                     <label className="flex min-h-[56px] cursor-pointer items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-[#7661f9] bg-white px-4 text-[16px] font-bold text-[#6b55f7] active:scale-[0.99] dark:bg-transparent">
                        <ImagePlus aria-hidden="true" className="size-5" strokeWidth={2.2} />
                        {picked.length ? 'Add more' : 'Add photos or PDF'}
                        <input
                           ref={inputRef}
                           accept={ACCEPT}
                           className="sr-only"
                           multiple
                           onChange={(e) => addFiles(e.target.files)}
                           type="file"
                        />
                     </label>
                  ) : null}

                  <label className="flex flex-col gap-1.5 text-[14px] font-semibold text-[#594d65] dark:text-[#d9cfe8]">
                     What is it? (optional)
                     <input
                        className="min-h-[48px] rounded-[12px] border-2 border-[#e2dcee] bg-white px-3 text-[16px] font-normal text-[#3b2f4a] dark:border-[#3a2d4f] dark:bg-[#1b1526] dark:text-[#f5f0ff]"
                        maxLength={300}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="e.g. my GCash history for Sept–Oct"
                        value={note}
                     />
                  </label>

                  <p className="flex items-start gap-2 text-[13px] leading-[18px] text-[#7b6b8c] dark:text-[#b9abcc]">
                     <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
                     Sent privately. Only the Moodeng team sees it, never lenders. A password-locked PDF can’t be opened, so send
                     screenshots instead.
                  </p>
                  {error ? <p className="text-[14px] font-semibold text-[#c0392b]">{error}</p> : null}

                  <PrimaryButton disabled={!good.length} onClick={() => void send()}>
                     {good.length ? `Send ${good.length} ${good.length === 1 ? 'file' : 'files'}` : 'Add a document first'}
                  </PrimaryButton>
               </div>
            ) : null}

            {phase === 'sending' ? (
               <div className="flex flex-col gap-4 rounded-[20px] bg-white px-5 py-5 dark:bg-dv2-card">
                  <ConnectHero image={CONNECT_HIPPOS.waiting} title="Uploading…" subtitle="Keep this screen open for a moment." />
                  <div className="h-3 w-full overflow-hidden rounded-full bg-[#ece6f6] dark:bg-[#2a2235]">
                     <div
                        className="h-full rounded-full bg-[#6b55f7] transition-[width] duration-300"
                        style={{ width: `${Math.max(8, (sentCount / Math.max(1, sendingNames.length)) * 100)}%` }}
                     />
                  </div>
                  <ul className="flex flex-col gap-3">
                     {sendingNames.map((name, i) => (
                        <StepRow key={`${name}-${i}`} label={name} state={i < sentCount ? 'done' : i === sentCount ? 'active' : 'todo'} />
                     ))}
                  </ul>
               </div>
            ) : null}

            {phase === 'checking' ? (
               <div className="flex flex-col gap-4 rounded-[20px] bg-white px-5 py-5 dark:bg-dv2-card">
                  <ConnectHero
                     image={CONNECT_HIPPOS.waiting}
                     title="Checking your document"
                     subtitle="This takes about a minute. You can leave this page."
                  />
                  <ul className="flex flex-col gap-3 rounded-[16px] border-2 border-[#e2dcee] px-4 py-4 dark:border-[#3a2d4f]">
                     <StepRow state="done" label="Uploaded" />
                     <StepRow state={checkingStep >= 2 ? 'done' : 'active'} label="Reading your document" />
                     <StepRow state={checkingStep >= 3 ? 'done' : checkingStep === 2 ? 'active' : 'todo'} label="Checking the details" />
                     <StepRow state="todo" label="Team review" />
                  </ul>
               </div>
            ) : null}

            {phase === 'in_review' ? (
               <div className="flex flex-col gap-4 rounded-[20px] bg-white px-5 py-5 dark:bg-dv2-card">
                  <ConnectHero image={CONNECT_HIPPOS.waiting} title="Thanks, we got it!" subtitle="The team is reviewing your document." />
                  <ul className="flex flex-col gap-3 rounded-[16px] border-2 border-[#e2dcee] px-4 py-4 dark:border-[#3a2d4f]">
                     <StepRow state="done" label="Uploaded" />
                     <StepRow state="done" label="Read and checked" />
                     <StepRow state="active" label="Team review" />
                  </ul>
                  <div className="rounded-[16px] bg-[#f8f1ff] px-4 py-3 text-[15px] leading-[21px] text-[#594d65] dark:bg-[#221a31] dark:text-[#d9cfe8]">
                     <b>We’ll let you know within 24 hours</b> on Messenger and here. Questions? Message us on Facebook.
                  </div>
                  {facebookButton}
                  <GhostButton onClick={() => navigate('/dashboard')}>Back to dashboard</GhostButton>
               </div>
            ) : null}

            {phase === 'approved' ? (
               <div className="flex flex-col gap-4 rounded-[20px] bg-white px-5 py-5 dark:bg-dv2-card">
                  <ConnectHero image={CONNECT_HIPPOS.approved} title="You’re approved! ✅" subtitle="Your proof of income is verified." />
                  <ul className="flex flex-col gap-3 rounded-[16px] border-2 border-[#4aa256] bg-[#eefbf2] px-4 py-4 dark:bg-[#123222]">
                     <StepRow state="done" label="Uploaded" />
                     <StepRow state="done" label="Read and checked" />
                     <StepRow state="done" label="Approved by the team" />
                  </ul>
                  <p className="text-[15px] leading-[21px] text-[#594d65] dark:text-[#d9cfe8]">
                     It helps your loan requests get funded. Repay on time to keep raising your limit.
                  </p>
                  <PrimaryButton onClick={() => navigate('/dashboard')}>Go to dashboard</PrimaryButton>
               </div>
            ) : null}

            {phase === 'declined' ? (
               <div className="flex flex-col gap-4 rounded-[20px] bg-white px-5 py-5 dark:bg-dv2-card">
                  <ConnectHero image={CONNECT_HIPPOS.missed} title="We couldn’t approve it" subtitle="You can send a different document." />
                  {reason ? (
                     <div className="rounded-[16px] bg-[#fff4f3] px-4 py-3 text-[15px] leading-[21px] text-[#7a2b22] dark:bg-[#3a1a18] dark:text-[#f2c4bf]">
                        <b>Why:</b> {reason}
                     </div>
                  ) : null}
                  <PrimaryButton onClick={startOver}>Send a different document</PrimaryButton>
                  {facebookButton}
               </div>
            ) : null}

            {phase === 'in_review' || phase === 'approved' ? (
               <button className="text-center text-[14px] font-semibold text-[#7b6b8c] underline" onClick={startOver} type="button">
                  Send another document
               </button>
            ) : null}
         </div>
      </div>
   );
}

function StepRow({ state, label }: { state: 'done' | 'active' | 'todo'; label: string }) {
   return (
      <li className="flex items-center gap-3">
         {state === 'done' ? (
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#4aa256] text-white">
               <Check aria-hidden="true" className="size-4" strokeWidth={3} />
            </span>
         ) : state === 'active' ? (
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#f3ecff] text-[#6b55f7]">
               <Loader2 aria-hidden="true" className="size-4 animate-spin" strokeWidth={3} />
            </span>
         ) : (
            <span className="size-7 shrink-0 rounded-full border-2 border-[#e2dcee] dark:border-[#3a2d4f]" />
         )}
         <span
            className={`min-w-0 truncate text-[16px] ${state === 'todo' ? 'text-[#a49cb5]' : 'font-semibold text-[#3b2f4a] dark:text-[#f5f0ff]'}`}
         >
            {label}
         </span>
      </li>
   );
}
