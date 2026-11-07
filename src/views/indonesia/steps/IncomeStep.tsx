import { useCallback, useEffect, useRef, useState } from 'react';

import { FileText, ImagePlus, Lock, X } from 'lucide-react';

import {
   ACCEPT,
   ACCEPTED,
   fetchIncomeDocStatus,
   type IncomeDocStatus,
   MAX_BYTES,
   MAX_FILES,
   uploadIncomeDocuments
} from '@/app/documents/incomeDocUpload';
import { CONNECT_HIPPOS } from '@/views/dashboard/components/connectKit';
import { inputClass, pick } from '@/views/indonesia/idFlow';
import type { IdStepProps } from '@/views/indonesia/steps/types';
import { DoneRow, ErrorText, GoldButton, SoftButton, StepHead, WaitRow } from '@/views/indonesia/ui';

// Step 5: proof of income, the same send as /documents (income-docs bucket → submit_income_document →
// automatic checks → team review), in Bahasa and with Indonesian examples. A send that isn't declined
// counts as done, so they can carry on while it's checked; a "resend" or "declined" shows the reason.

const COPY = {
   id: {
      title: 'Bukti penghasilan',
      subtitle: 'Salah satu:',
      examples: ['📱 Riwayat e-wallet (DANA, OVO, GoPay) 2–3 bulan', '🏦 Mutasi rekening bank', '🧾 Slip gaji terbaru'],
      add: 'Tambah foto atau PDF',
      addMore: 'Tambah lagi',
      note: 'Apa ini? (opsional)',
      notePlaceholder: 'contoh: mutasi DANA Sep–Okt',
      private: 'Rahasia. Hanya tim Moodeng yang melihat.',
      send: (n: number) => `Kirim ${n} file`,
      addFirst: 'Tambah dokumen dulu',
      badType: 'Pakai foto atau PDF',
      tooBig: 'Maks 10 MB',
      sending: (done: number, all: number) => `Mengirim ${done}/${all}…`,
      checking: 'Terkirim! Sedang dicek…',
      inReview: 'Terkirim. Tim sedang memeriksa.',
      approved: 'Disetujui ✅',
      resendTitle: 'Kirim lagi, ya',
      declinedTitle: 'Belum bisa disetujui',
      why: 'Alasan:',
      sendAgain: 'Kirim lagi',
      sendAnother: 'Kirim dokumen lain',
      next: 'Lanjut',
      errors: {
         signin: 'Masuk lagi, lalu kirim.',
         too_many: 'Terlalu banyak kiriman hari ini. Coba besok.',
         failed: 'Gagal mengirim. Cek koneksi lalu coba lagi.'
      }
   },
   en: {
      title: 'Proof of income',
      subtitle: 'Any one of these:',
      examples: ['📱 E-wallet history (DANA, OVO, GoPay), 2–3 months', '🏦 Bank statement', '🧾 Latest payslip'],
      add: 'Add photos or PDF',
      addMore: 'Add more',
      note: 'What is it? (optional)',
      notePlaceholder: 'e.g. my DANA history Sep–Oct',
      private: 'Private. Only the Moodeng team sees it.',
      send: (n: number) => `Send ${n} ${n === 1 ? 'file' : 'files'}`,
      addFirst: 'Add a document first',
      badType: 'Use a photo or PDF',
      tooBig: 'Max 10 MB',
      sending: (done: number, all: number) => `Sending ${done}/${all}…`,
      checking: 'Sent! Checking it…',
      inReview: 'Sent. The team is reviewing it.',
      approved: 'Approved ✅',
      resendTitle: 'Please send it again',
      declinedTitle: 'We couldn’t approve it',
      why: 'Why:',
      sendAgain: 'Send again',
      sendAnother: 'Send another document',
      next: 'Continue',
      errors: {
         signin: 'Sign in again, then send.',
         too_many: 'You’ve sent a lot today. Try again tomorrow.',
         failed: 'Couldn’t send. Check your connection and try again.'
      }
   }
};

// What to fix, by the reason code the automatic checks return (documents page: RESEND_FIX).
const RESEND_FIX: Record<string, { id: string; en: string }> = {
   password_protected: {
      id: 'PDF dikunci kata sandi. Kirim screenshot saja.',
      en: 'Your PDF is password-locked. Send screenshots instead.'
   },
   scanned_pdf: { id: 'PDF tidak terbaca. Kirim screenshot saja.', en: 'We couldn’t read the PDF. Send screenshots instead.' },
   unsupported_file: { id: 'Jenis foto tidak didukung. Kirim JPG/PNG.', en: 'That photo type isn’t supported. Send a JPG/PNG.' },
   unreadable: {
      id: 'Kurang jelas. Foto ulang di tempat terang, angka terlihat.',
      en: 'Not clear enough. Retake it in good light, numbers sharp.'
   },
   not_financial: {
      id: 'Ini bukan riwayat e-wallet, mutasi bank, atau slip gaji.',
      en: 'This isn’t an e-wallet history, bank statement or payslip.'
   },
   old_document: { id: 'Lebih dari 2 bulan. Kirim yang terbaru.', en: 'Older than 2 months. Send your latest one.' },
   short_history: { id: 'Kurang dari 2 bulan. Kirim 2–3 bulan terakhir.', en: 'Less than 2 months. Send the last 2–3 months.' },
   no_income: {
      id: 'Tidak terlihat uang masuk. Kirim yang menunjukkan pemasukan.',
      en: 'We couldn’t see money coming in. Send one that shows it.'
   }
};

type Picked = { key: string; file: File; preview: string | null; error: string | null };
const POLL_MS = 4000;

export default function IncomeStep({ data, lang, refresh, onDone }: IdStepProps) {
   const t = pick(lang, COPY);
   const [status, setStatus] = useState<IncomeDocStatus | undefined>(undefined);
   const [picking, setPicking] = useState(false);
   const [picked, setPicked] = useState<Picked[]>([]);
   const [note, setNote] = useState('');
   const [sending, setSending] = useState<{ done: number; all: number } | null>(null);
   const [error, setError] = useState('');
   const inputRef = useRef<HTMLInputElement>(null);

   const load = useCallback(async () => setStatus(await fetchIncomeDocStatus()), []);
   useEffect(() => {
      void load();
   }, [load, data.incomeState]);

   // While the automatic checks read it, follow along.
   useEffect(() => {
      if (status?.stage !== 'checking') return undefined;
      const timer = window.setInterval(() => void load(), POLL_MS);
      return () => window.clearInterval(timer);
   }, [status?.stage, load]);

   const addFiles = (list: FileList | null) => {
      if (!list?.length) return;
      const next = Array.from(list)
         .slice(0, MAX_FILES - picked.length)
         .map((file, i) => ({
            key: `${Date.now()}-${i}`,
            file,
            preview: /^image\/(jpeg|png|webp)$/.test(file.type) ? URL.createObjectURL(file) : null,
            error: !ACCEPTED.has(file.type) ? t.badType : file.size > MAX_BYTES ? t.tooBig : null
         }));
      setPicked((prev) => [...prev, ...next]);
      if (inputRef.current) inputRef.current.value = '';
   };
   const good = picked.filter((p) => !p.error);

   const send = async () => {
      if (!good.length || sending) return;
      setError('');
      setSending({ done: 0, all: good.length });
      const result = await uploadIncomeDocuments(
         good.map((p) => p.file),
         { note, onFileDone: () => setSending((s) => (s ? { ...s, done: s.done + 1 } : s)) }
      );
      setSending(null);
      if (!result.ok) {
         setError(t.errors[result.error]);
         return;
      }
      setPicked([]);
      setNote('');
      setPicking(false);
      await load();
      await refresh();
   };

   const head = <StepHead image={CONNECT_HIPPOS.cashout} title={t.title} />;
   if (status === undefined) {
      return (
         <>
            {head}
            <div className="h-[160px] animate-pulse rounded-[20px] bg-[#f3ead0] dark:bg-[#1a1524]" aria-busy="true" />
         </>
      );
   }

   const showPicker = picking || !status;
   const reasonFix = status?.reason ? RESEND_FIX[status.reason]?.[lang] : undefined;

   if (!showPicker && status) {
      return (
         <>
            {head}
            {status.stage === 'approved' ? (
               <DoneRow>{t.approved}</DoneRow>
            ) : status.stage === 'checking' ? (
               <WaitRow>{t.checking}</WaitRow>
            ) : status.stage === 'in_review' ? (
               <DoneRow>{t.inReview}</DoneRow>
            ) : (
               <div className="flex flex-col gap-2 rounded-[16px] bg-[#fff1ef] px-4 py-3 text-[#7a2b22] dark:bg-[#3a1a18] dark:text-[#f2c4bf]">
                  <p className="text-[18px] font-extrabold">{status.stage === 'resend' ? t.resendTitle : t.declinedTitle}</p>
                  {reasonFix || status.reason ? (
                     <p className="text-[15px]">
                        <b>{t.why}</b> {reasonFix ?? status.reason}
                     </p>
                  ) : null}
               </div>
            )}
            {status.stage === 'resend' || status.stage === 'declined' ? (
               <GoldButton onClick={() => setPicking(true)}>{t.sendAgain}</GoldButton>
            ) : null}
            {data.steps.income ? <GoldButton onClick={onDone}>{t.next}</GoldButton> : null}
            {status.stage === 'in_review' || status.stage === 'approved' || status.stage === 'checking' ? (
               <button
                  className="text-center text-[14px] font-semibold text-[#8a7a5a] underline"
                  onClick={() => setPicking(true)}
                  type="button"
               >
                  {t.sendAnother}
               </button>
            ) : null}
         </>
      );
   }

   return (
      <>
         <StepHead image={CONNECT_HIPPOS.cashout} title={t.title} subtitle={t.subtitle} />
         <ul className="flex flex-col gap-1.5 text-[16px] font-semibold leading-[21px]">
            {t.examples.map((line) => (
               <li key={line}>{line}</li>
            ))}
         </ul>

         {picked.length ? (
            <ul className="grid grid-cols-3 gap-2">
               {picked.map((p) => (
                  <li
                     key={p.key}
                     className={`relative aspect-[3/4] overflow-hidden rounded-[12px] border-2 ${p.error ? 'border-[#f2b8b5] bg-[#fff4f3]' : 'border-[#ecdfb8] bg-[#fffaf0] dark:border-[#3a3048] dark:bg-[#120e1a]'}`}
                  >
                     {p.preview ? (
                        <img alt="" className="size-full object-cover" src={p.preview} />
                     ) : (
                        <span className="flex size-full flex-col items-center justify-center gap-1 px-1 text-center text-[11px] font-semibold">
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
                        aria-label={`× ${p.file.name}`}
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
            <label className="flex min-h-[56px] cursor-pointer items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-[#ffbe1a] bg-white px-4 text-[17px] font-bold text-[#6b4a00] active:scale-[0.99] dark:bg-transparent dark:text-[#ffd36b]">
               <ImagePlus aria-hidden="true" className="size-5" strokeWidth={2.2} />
               {picked.length ? t.addMore : t.add}
               <input ref={inputRef} accept={ACCEPT} className="sr-only" multiple onChange={(e) => addFiles(e.target.files)} type="file" />
            </label>
         ) : null}

         {picked.length ? (
            <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
               {t.note}
               <input
                  className={inputClass}
                  maxLength={300}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t.notePlaceholder}
                  value={note}
               />
            </label>
         ) : null}

         <p className="flex items-start gap-2 text-[13px] leading-[18px] text-[#7a6a4f] dark:text-[#bfb29a]">
            <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
            {t.private}
         </p>
         <ErrorText>{error}</ErrorText>
         <GoldButton busy={Boolean(sending)} disabled={!good.length} onClick={() => void send()}>
            {sending ? t.sending(sending.done, sending.all) : good.length ? t.send(good.length) : t.addFirst}
         </GoldButton>
         {status && picking ? <SoftButton onClick={() => setPicking(false)}>←</SoftButton> : null}
      </>
   );
}
