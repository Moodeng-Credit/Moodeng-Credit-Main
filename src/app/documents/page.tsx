import { useCallback, useEffect, useRef, useState } from 'react';

import { Check, ChevronLeft, ChevronRight, FileText, Loader2, Lock, MessageCircle, Plus, X } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useIncomeDocFacts } from '@/hooks/useIncomeDocRequirement';

import { DocExample } from '@/app/documents/DocExample';
import { askFor, EARN_TYPES, type EarnId, kindsFor, moreNeededHint, sendNote, slotCount, tooSmallToRead } from '@/app/documents/incomeDocKinds';

import {
   ACCEPT,
   ACCEPTED,
   fetchIncomeDocStatus,
   type IncomeDocStatus,
   MAX_BYTES,
   MAX_FILES,
   uploadIncomeDocuments
} from '@/app/documents/incomeDocUpload';
import { EXTERNAL_LINKS } from '@/config/externalLinks';
import { type IncomeDocStep, stepFor } from '@/lib/incomeDocSteps';
import { CONNECT_HIPPOS, ConnectHero, GhostButton, PrimaryButton } from '@/views/dashboard/components/connectKit';
import { GoldButton } from '@/views/indonesia/ui';

// moodeng.app/documents — a borrower sends proof of income and follows it here. Cards, in order:
//   pick       1. "How do you earn?"  2. the documents that fit (incomeDocKinds.ts)
//              3. a drawn example of a good one, then add photos/PDFs (up to 6)
//   sending    each file ticks off as it uploads
//   checking   Sent ✓ → Reading → Checking, while the AI reads it (get_my_income_document = checking)
//   resend     "Let's try that again" with the exact fix — the automatic checks found something they can
//              fix (blurry, locked PDF, wrong document, too old, too short); no team decision needed
//   in_review  "We'll let you know within 24 hours" + message us on Facebook
//   approved   / declined (with the team's reason) — what they see when they come back, and what the
//              push / Messenger / Telegram message opens
// Files go to the private income-docs bucket; submit_income_document() records the send and pings the
// team. Borrowers never see scores or flags — only the stage and, if declined, the team's reason.

const POLL_MS = 3000;
// The AI read usually takes under a minute; after this the card moves on to "in review" anyway.
const CHECKING_MAX_MS = 75_000;

export type DocumentsPhase = 'loading' | 'pick' | 'sending' | 'checking' | 'resend' | 'in_review' | 'approved' | 'declined';

// What to fix, by the reason code the checks return (incomeDocs.ts RESEND_TEXT says the same).
const RESEND_FIX: Record<string, string> = {
   password_protected: 'Your PDF is locked with a password, so we can’t open it. Please send screenshots of your history instead.',
   scanned_pdf: 'We couldn’t read your PDF. Please send screenshots of your history instead.',
   unsupported_file: 'We couldn’t open that photo type. Please send a screenshot or a JPG/PNG photo instead.',
   unreadable: 'We couldn’t read it clearly. Please retake it in good light with all 4 corners showing and the numbers sharp.',
   not_financial: 'This doesn’t look like proof of income. Please send one of the examples shown: a payslip, your earnings screen, or your GCash or Maya history.',
   old_document: 'This is more than 2 months old. Please send your latest one.',
   short_history: 'This shows less than 2 months. Please send your last 2–3 months of history.',
   no_income: 'We couldn’t see money coming in. Please send a history or statement that shows the money you receive.'
};
// error = can't be sent (wrong type, too big); warn = can be sent but will likely bounce (too small to read).
type Picked = { key: string; file: File; preview: string | null; error: string | null; warn?: string };
type Status = IncomeDocStatus;

const REVIEW_HOURS = 24;

const dayWord = (at: Date, now: Date) => {
   const days = Math.round((new Date(at).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000);
   return days === 0
      ? 'today'
      : days === 1
        ? 'tomorrow'
        : days === -1
          ? 'yesterday'
          : at.toLocaleDateString(undefined, { weekday: 'long' });
};

/** "today 2:25 PM", "tomorrow 2:25 PM" — in the borrower's own time. Pure. */
const whenText = (at: number, now: number) => {
   const date = new Date(at);
   return `${dayWord(date, new Date(now))} ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
};

// Android Chrome can't open m.me links; messenger.com/t works there.
const facebookHref = () =>
   typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
      ? EXTERNAL_LINKS.support.messengerLoginCodeAndroid
      : EXTERNAL_LINKS.support.messengerDocuments;

export default function DocumentsPage({
   preview
}: {
   preview?: {
      phase: DocumentsPhase;
      reason?: string;
      checkingStep?: 1 | 2 | 3;
      fileNames?: string[];
      sentAt?: number;
      fileCount?: number;
      earn?: EarnId;
      kind?: string;
      step?: IncomeDocStep;
   };
} = {}) {
   const [phase, setPhase] = useState<DocumentsPhase>(preview?.phase ?? 'loading');
   const [picked, setPicked] = useState<Picked[]>([]);
   const [note, setNote] = useState('');
   const [noteOpen, setNoteOpen] = useState(false);
   // The pick card's own steps: how they earn, then which document.
   const [earnId, setEarnId] = useState<EarnId | null>(preview?.earn ?? null);
   const [kindId, setKindId] = useState<string | null>(preview?.kind ?? null);
   const [sentCount, setSentCount] = useState(0);
   const [checkingStep, setCheckingStep] = useState<1 | 2 | 3>(preview?.checkingStep ?? 1);
   const [reason, setReason] = useState<string | null>(preview?.reason ?? null);
   // Their latest send, for "Sent 3 files today 2:25 PM" and the reply-by time.
   const [sentAt, setSentAt] = useState<number | null>(preview?.sentAt ?? null);
   const [fileCount, setFileCount] = useState<number>(preview?.fileCount ?? 0);
   const [error, setError] = useState<string | null>(null);
   const inputRef = useRef<HTMLInputElement>(null);
   const navigate = useNavigate();
   // Sent here from the loan form ("Send proof of income", loans of $60+): offer the way back to it.
   const [searchParams] = useSearchParams();
   const fromLoan = searchParams.get('back') === 'loan';
   // The amount they're asking for (from the loan form): sent along so the checks use that step,
   // and used to say exactly what to send.
   const requestedAmount = Number(searchParams.get('amount')) || null;
   const requestedRepay = Number(searchParams.get('repay')) || null;
   const { steps } = useIncomeDocFacts(requestedAmount != null);
   const step = preview?.step ?? (requestedAmount != null ? stepFor(requestedAmount, steps) : null);
   const monthsNeeded = step?.months ?? 0;
   const earn = EARN_TYPES.find((e) => e.id === earnId) ?? null;
   const kinds = earn ? kindsFor(earn, monthsNeeded) : [];
   // Only one document fits: skip the choice.
   const kind = kinds.find((k) => k.id === kindId) ?? (kinds.length === 1 ? kinds[0] : null);
   const backFromKind = () => {
      setPicked([]);
      setKindId(null);
      if (kinds.length <= 1) setEarnId(null);
   };

   const showStatus = useCallback((status: Status) => {
      if (!status) return setPhase('pick');
      setReason(status.reason);
      setSentAt(Date.parse(status.sent_at));
      setFileCount(status.file_count);
      setPhase(status.stage);
   }, []);

   // Where is their latest send? (Skipped in design previews.)
   useEffect(() => {
      if (preview) return;
      void fetchIncomeDocStatus().then(showStatus);
   }, [preview, showStatus]);

   // While the AI reads: tick "Reading" → "Checking" for the feel of progress, and move on to
   // "in review" as soon as the read is done (or after CHECKING_MAX_MS whatever happens).
   useEffect(() => {
      if (phase !== 'checking' || preview) return;
      const startedAt = Date.now();
      const stepTimer = window.setTimeout(() => setCheckingStep(2), 6000);
      const poll = window.setInterval(async () => {
         const status = await fetchIncomeDocStatus();
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
      // Check each photo on the spot, so a thumbnail is caught here and not a minute after sending.
      for (const item of next) {
         if (!item.preview || item.error) continue;
         const img = new Image();
         img.onload = () => {
            if (!tooSmallToRead(img.naturalWidth, img.naturalHeight)) return;
            setPicked((prev) => prev.map((x) => (x.key === item.key ? { ...x, warn: 'Too small to read' } : x)));
         };
         img.src = item.preview;
      }
      if (inputRef.current) inputRef.current.value = '';
   };

   const good = picked.filter((p) => !p.error);
   const emptySlots = Math.max(0, Math.min(MAX_FILES, slotCount(monthsNeeded)) - picked.length);
   const moreHint = moreNeededHint(
      monthsNeeded,
      good.map((p) => ({ isPdf: p.file.type === 'application/pdf' }))
   );
   const openPicker = () => inputRef.current?.click();
   const sendingNames = good.length ? good.map((p) => p.file.name) : (preview?.fileNames ?? []);

   const send = async () => {
      if (!good.length) return;
      setPhase('sending');
      setSentCount(0);
      setError(null);
      const result = await uploadIncomeDocuments(
         good.map((p) => p.file),
         { note: earn && kind ? sendNote(earn, kind, note) : note, amount: requestedAmount, repay: requestedRepay, onFileDone: () => setSentCount((n) => n + 1) }
      );
      if (!result.ok) {
         setError(
            result.error === 'signin'
               ? 'Please sign in again, then send.'
               : result.error === 'too_many'
                 ? 'You’ve sent a lot today. Try again tomorrow, or message us.'
                 : 'Couldn’t send. Check your connection and try again.'
         );
         setPhase('pick');
         return;
      }
      setSentAt(Date.now());
      setFileCount(result.count);
      setPicked([]);
      setNote('');
      setNoteOpen(false);
      setCheckingStep(1);
      setPhase('checking');
   };

   const startOver = () => {
      setPicked([]);
      setEarnId(null);
      setKindId(null);
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

            {phase === 'pick' && !earn ? (
               <div className="flex flex-col gap-3 rounded-[20px] bg-white px-5 py-5 dark:bg-dv2-card">
                  <ConnectHero
                     image={CONNECT_HIPPOS.cashout}
                     title="How do you earn?"
                     subtitle={
                        requestedAmount && step ? `A $${requestedAmount} loan needs proof of income. Pick one first.` : 'Pick one. We’ll show you what to send.'
                     }
                  />
                  {EARN_TYPES.map((e) => (
                     <ChoiceRow key={e.id} emoji={e.emoji} title={e.label} onClick={() => setEarnId(e.id)} />
                  ))}
               </div>
            ) : null}

            {phase === 'pick' && earn && !kind ? (
               <div className="flex flex-col gap-3 rounded-[20px] bg-white px-5 py-5 dark:bg-dv2-card">
                  <ConnectHero image={CONNECT_HIPPOS.cashout} title="What can you send?" subtitle="Any one of these works." />
                  {kinds.map((k, i) => (
                     <ChoiceRow key={k.id} badge={i === 0 ? 'Best pick' : undefined} emoji={k.emoji} title={k.title} hint={k.hint} onClick={() => setKindId(k.id)} />
                  ))}
                  <GhostButton onClick={() => setEarnId(null)}>Back</GhostButton>
               </div>
            ) : null}

            {phase === 'pick' && earn && kind ? (
               <div className="flex flex-col gap-4 rounded-[20px] bg-white px-5 py-5 dark:bg-dv2-card">
                  <ConnectHero image={CONNECT_HIPPOS.cashout} title={kind.title} subtitle={askFor(kind, monthsNeeded)} />
                  <DocExample spec={kind.example} mustShow={kind.mustShow} />

                  <ul className="grid grid-cols-3 gap-2">
                     {picked.map((p) => (
                        <li
                           key={p.key}
                           className={`relative aspect-[3/4] overflow-hidden rounded-[12px] border-2 ${p.error ? 'border-[#f2b8b5] bg-[#fff4f3]' : p.warn ? 'border-[#e8b84a] bg-[#fff9e8]' : 'border-[#4aa256] bg-[#f6f5f9] dark:bg-[#1b1526]'}`}
                        >
                           {p.preview ? (
                              <img alt="" className="size-full object-cover" src={p.preview} />
                           ) : (
                              <span className="flex size-full flex-col items-center justify-center gap-1 px-1 text-center text-[11px] font-semibold text-[#7b6b8c]">
                                 <FileText aria-hidden="true" className="size-6" strokeWidth={2} />
                                 <span className="line-clamp-2 break-all">{p.file.name}</span>
                              </span>
                           )}
                           {p.error || p.warn ? (
                              <span
                                 className={`absolute inset-x-0 bottom-0 px-1 py-0.5 text-center text-[11px] font-bold ${p.error ? 'bg-[#c0392b] text-white' : 'bg-[#f5c542] text-[#5c3d00]'}`}
                              >
                                 {p.error ?? p.warn}
                              </span>
                           ) : (
                              <span className="absolute bottom-1 left-1 grid size-6 place-items-center rounded-full bg-[#4aa256] text-white">
                                 <Check aria-hidden="true" className="size-4" strokeWidth={3.5} />
                              </span>
                           )}
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
                     {Array.from({ length: emptySlots }, (_, i) => (
                        <li key={`slot-${i}`}>
                           <button
                              aria-label="Add a photo or PDF"
                              className="grid aspect-[3/4] w-full place-items-center rounded-[12px] border-2 border-dashed border-[#c9bdf5] bg-[#faf7ff] text-[#6b55f7] active:scale-[0.98] dark:border-[#4a3d6b] dark:bg-transparent"
                              onClick={openPicker}
                              type="button"
                           >
                              <Plus aria-hidden="true" className="size-7" strokeWidth={2.5} />
                           </button>
                        </li>
                     ))}
                     {!emptySlots && picked.length < MAX_FILES ? (
                        <li>
                           <button
                              className="grid aspect-[3/4] w-full place-items-center rounded-[12px] border-2 border-dashed border-[#e2dcee] text-[13px] font-bold text-[#6b55f7] active:scale-[0.98] dark:border-[#3a2d4f]"
                              onClick={openPicker}
                              type="button"
                           >
                              Add more
                           </button>
                        </li>
                     ) : null}
                  </ul>
                  <input ref={inputRef} accept={ACCEPT} className="sr-only" multiple onChange={(e) => addFiles(e.target.files)} type="file" />

                  {picked.some((p) => p.warn) ? (
                     <p className="text-[14px] font-semibold leading-[19px] text-[#8a5a00] dark:text-[#f5c542]">
                        One photo is too small to read. Send the full screenshot, not a preview.
                     </p>
                  ) : moreHint ? (
                     <p className="text-[14px] font-semibold leading-[19px] text-[#6b55f7] dark:text-[#b4a6ff]">{moreHint}</p>
                  ) : step?.autoApprove ? (
                     <p className="text-[14px] font-semibold leading-[19px] text-[#2f7a3a] dark:text-[#7ee2a0]">
                        ⚡ Clear photo = approved in about a minute.
                     </p>
                  ) : null}

                  {noteOpen ? (
                     <input
                        aria-label="Note for the team"
                        className="min-h-[48px] rounded-[12px] border-2 border-[#e2dcee] bg-white px-3 text-[16px] font-normal text-[#3b2f4a] dark:border-[#3a2d4f] dark:bg-[#1b1526] dark:text-[#f5f0ff]"
                        maxLength={300}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="e.g. I get paid on the 15th and 30th"
                        value={note}
                     />
                  ) : null}
                  {error ? <p className="text-[14px] font-semibold text-[#c0392b]">{error}</p> : null}

                  {good.length ? (
                     <GoldButton onClick={() => void send()}>{`Send ${good.length} ${good.length === 1 ? 'photo' : 'photos'}`}</GoldButton>
                  ) : (
                     <GoldButton onClick={openPicker}>Add photos</GoldButton>
                  )}
                  <p className="flex items-center justify-center gap-1.5 text-[13px] leading-[18px] text-[#7b6b8c] dark:text-[#b9abcc]">
                     <Lock aria-hidden="true" className="size-4 shrink-0" strokeWidth={2} />
                     Only the Moodeng team sees it.
                  </p>
                  <div className="flex items-center justify-center gap-4 text-[14px] font-bold text-[#8a7c9c] dark:text-[#a99cbb]">
                     {noteOpen ? null : (
                        <button className="underline" onClick={() => setNoteOpen(true)} type="button">
                           Add a note
                        </button>
                     )}
                     <button className="underline" onClick={backFromKind} type="button">
                        Send something else
                     </button>
                  </div>
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
                     <StepRow
                        state="done"
                        label={
                           sentAt
                              ? `${fileCount ? `Sent ${fileCount} ${fileCount === 1 ? 'file' : 'files'}` : 'Sent'} ${whenText(sentAt, Date.now())}`
                              : 'Uploaded'
                        }
                     />
                     <StepRow state="done" label="Read and checked" />
                     <StepRow state="active" label="Team review" />
                  </ul>
                  <div className="rounded-[16px] bg-[#f8f1ff] px-4 py-3 text-[15px] leading-[21px] text-[#594d65] dark:bg-[#221a31] dark:text-[#d9cfe8]">
                     {sentAt && Date.now() > sentAt + REVIEW_HOURS * 3_600_000 ? (
                        <>
                           <b>This is taking longer than usual.</b> Sorry! Message us on Facebook and we’ll check it right away.
                        </>
                     ) : (
                        <>
                           <b>We’ll reply by {sentAt ? whenText(sentAt + REVIEW_HOURS * 3_600_000, Date.now()) : 'within 24 hours'}</b> on
                           Messenger and here. You don’t need to do anything until then.
                        </>
                     )}
                  </div>
                  {facebookButton}
                  {fromLoan ? (
                     <PrimaryButton onClick={() => navigate('/request-board?applyLoan=1')}>Back to my loan request</PrimaryButton>
                  ) : (
                     <GhostButton onClick={() => navigate('/dashboard')}>Back to dashboard</GhostButton>
                  )}
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
                  <PrimaryButton onClick={() => navigate(fromLoan ? '/request-board?applyLoan=1' : '/dashboard')}>
                     {fromLoan ? 'Back to my loan request' : 'Go to dashboard'}
                  </PrimaryButton>
               </div>
            ) : null}

            {phase === 'resend' ? (
               <div className="flex flex-col gap-4 rounded-[20px] bg-white px-5 py-5 dark:bg-dv2-card">
                  <ConnectHero
                     image={CONNECT_HIPPOS.missed}
                     title="Let’s try that again"
                     subtitle="We need a clearer document before the team can review it."
                  />
                  <div className="rounded-[16px] bg-[#f8f1ff] px-4 py-3 text-[15px] leading-[21px] text-[#594d65] dark:bg-[#221a31] dark:text-[#d9cfe8]">
                     <b>What to send:</b> {RESEND_FIX[reason ?? ''] ?? RESEND_FIX.unreadable}
                  </div>
                  <PrimaryButton onClick={startOver}>Send again</PrimaryButton>
                  {facebookButton}
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

/** Dev only (/documents-preview?earn=rider&kind=gig_earnings&months=2): the pick cards without signing in. */
export function DocumentsPreview() {
   const [params] = useSearchParams();
   const months = Number(params.get('months')) || 0;
   const step: IncomeDocStep | undefined = params.has('months')
      ? { min: months > 0 ? 60 : 40, months, fresh: false, autoApprove: months === 0, maxShare: null, balance: false, liveCall: false }
      : undefined;
   return (
      <DocumentsPage
         preview={{ phase: 'pick', earn: (params.get('earn') as EarnId | null) ?? undefined, kind: params.get('kind') ?? undefined, step }}
      />
   );
}

function ChoiceRow({
   emoji,
   title,
   hint,
   badge,
   onClick
}: {
   emoji: string;
   title: string;
   hint?: string;
   badge?: string;
   onClick: () => void;
}) {
   return (
      <button
         className="flex min-h-[60px] w-full items-center gap-3 rounded-[16px] border-2 border-b-4 border-[#e2dcee] bg-white px-4 py-2.5 text-left transition duration-100 ease-out active:translate-y-[2px] active:border-b-2 dark:border-[#3a2d4f] dark:bg-[#1b1526]"
         onClick={onClick}
         type="button"
      >
         <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[#f3ecff] text-[22px] leading-none dark:bg-[#2a2140]">
            {emoji}
         </span>
         <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
               <span className="text-[17px] font-bold leading-[22px] text-[#3b2f4a] dark:text-[#f5f0ff]">{title}</span>
               {badge ? (
                  <span className="rounded-full bg-[#fff1c7] px-2 py-0.5 text-[12px] font-bold leading-[16px] text-[#8a5a00]">{badge}</span>
               ) : null}
            </span>
            {hint ? <span className="text-[14px] leading-[18px] text-[#7b6b8c] dark:text-[#b9abcc]">{hint}</span> : null}
         </span>
         <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-[#a49cb5]" strokeWidth={2.5} />
      </button>
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
