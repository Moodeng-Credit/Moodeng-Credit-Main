import { useCallback, useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { openMessengerSupport } from '@/config/contactVerification';
import { EXTERNAL_LINKS } from '@/config/externalLinks';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { CONNECT_HIPPOS } from '@/views/dashboard/components/connectKit';
import VideoCallStep from '@/views/dashboard/components/VideoCallStep';
import { idStepPath, inputClass, isIdStepKey, pick } from '@/views/indonesia/idFlow';
import type { IdStepProps } from '@/views/indonesia/steps/types';
import { ErrorText, GoldButton, GoldLink, SoftButton, SoftLink, StepHead, WaitRow } from '@/views/indonesia/ui';

// Step 8: book the 15-min video call (VideoCallStep → calcom-round-robin), then send the access request
// to the team exactly like ConnectStep (loan-access, action 'submit', with what the loan is for). Then
// wait: the booked time, ✅ "I'll be there" (unconfirmed calls get cancelled), the join link. Once the
// team approves (loan_access_status = 'approved'): "You're approved" → the $5/$10 loan form.

const COPY = {
   id: {
      title: 'Video call 15 menit',
      subtitle: 'Kenalan dengan tim Moodeng.',
      goalLabel: 'Untuk apa pinjamannya?',
      goalPlaceholder: 'contoh: bayar listrik',
      chips: ['Kebutuhan harian', 'Tagihan', 'Sekolah', 'Usaha', 'Keluarga', 'Transport'],
      goalNext: 'Lanjut pilih jadwal',
      goalShort: 'Tulis sedikit lagi.',
      sending: 'Mengirim ke tim…',
      waitingTitle: 'Sampai jumpa di call!',
      waitingBody: 'Setelah call, tim akan menyetujui kamu.',
      localTime: 'waktu kamu',
      timeByEmail: 'Jadwal ada di email kamu.',
      confirm: '✅ Saya akan hadir',
      confirmLater: 'Tombol “Saya akan hadir” muncul 1 jam sebelum call.',
      confirmed: '✅ Kamu sudah konfirmasi',
      calendar: 'Tambah ke kalender',
      join: 'Gabung call',
      callOver: 'Terima kasih sudah ikut! Tim sedang menyetujui kamu.',
      retry: 'Kirim ke tim',
      approvedTitle: 'Kamu disetujui! 🎉',
      approvedBody: (amounts: string) => `Ajukan pinjaman ${amounts}.`,
      apply: 'Ajukan pinjaman',
      kycWait: 'Menunggu cek KTP disetujui',
      rejected: 'Maaf, kamu belum disetujui.',
      contact: 'Hubungi kami',
      locked: 'Selesaikan langkah sebelumnya dulu.',
      or: 'atau',
      errors: {
         reason_required: 'Tulis untuk apa pinjamannya.',
         call_not_booked: 'Pilih jadwal call dulu.',
         contact_not_verified: 'Hubungkan Messenger atau WhatsApp dulu.',
         default: 'Gagal mengirim. Coba lagi sebentar lagi.'
      }
   },
   en: {
      title: '15-min video call',
      subtitle: 'Meet the Moodeng team.',
      goalLabel: 'What is the loan for?',
      goalPlaceholder: 'e.g. paying the electricity bill',
      chips: ['Daily needs', 'Bills', 'School', 'Business', 'Family', 'Transport'],
      goalNext: 'Next: pick a time',
      goalShort: 'Write a little more.',
      sending: 'Sending to the team…',
      waitingTitle: 'See you on the call!',
      waitingBody: 'After the call, the team approves you.',
      localTime: 'your time',
      timeByEmail: 'Your time is in your email.',
      confirm: '✅ I’ll be there',
      confirmLater: 'The “I’ll be there” button opens 1 hour before the call.',
      confirmed: '✅ You confirmed',
      calendar: 'Add to my calendar',
      join: 'Join the call',
      callOver: 'Thanks for joining! The team is approving you.',
      retry: 'Send to the team',
      approvedTitle: 'You’re approved! 🎉',
      approvedBody: (amounts: string) => `Apply for a ${amounts} loan.`,
      apply: 'Apply for a loan',
      kycWait: 'Waiting for your ID check',
      rejected: 'Sorry, you weren’t approved.',
      contact: 'Message us',
      locked: 'Finish the steps before this first.',
      or: 'or',
      errors: {
         reason_required: 'Say what the loan is for.',
         call_not_booked: 'Pick a call time first.',
         contact_not_verified: 'Connect Messenger or WhatsApp first.',
         default: 'Couldn’t send. Try again in a moment.'
      }
   }
};

const MIN_REASON = 3;
// The call is 15 min; after start + 30 the waiting card stops saying "see you".
const CALL_OVER_AFTER_MS = 30 * 60 * 1000;
// Mirrors video-call-reminders: "I'll be there" opens 1h before (plus a cron tick).
const CONFIRM_OPENS_MS = 65 * 60 * 1000;

const functionsBase = () => `${(import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '')}/functions/v1`;

type Meeting = { startsAt: string | null; joinUrl: string | null; confirmToken: string | null; confirmed: boolean };

export default function CallStep({ data, user, lang, refresh }: IdStepProps) {
   const t = pick(lang, COPY);
   const navigate = useNavigate();
   const reasonKey = `md_id_call_reason:${user.id}`;
   const [reason, setReason] = useState(() => {
      try {
         return window.sessionStorage.getItem(reasonKey) ?? '';
      } catch {
         return '';
      }
   });
   const [goalDone, setGoalDone] = useState(false);
   const [sending, setSending] = useState(false);
   const [error, setError] = useState('');
   const [meeting, setMeeting] = useState<Meeting | null>(null);
   const [now, setNow] = useState(() => Date.now());
   // The server said there's no upcoming call (or the booked time passed): book again.
   const [rebook, setRebook] = useState(false);

   useEffect(() => {
      try {
         if (reason) window.sessionStorage.setItem(reasonKey, reason);
         else window.sessionStorage.removeItem(reasonKey);
      } catch {
         // ignore
      }
   }, [reason, reasonKey]);

   const booked = data.steps.call;
   const approved = data.access === 'approved';
   const rejected = data.access === 'rejected';
   const pending = data.access === 'pending';

   useEffect(() => {
      if (!booked || approved) return;
      let cancelled = false;
      void getSupabaseBrowserClient()
         .from('users')
         .select('video_call_starts_at, video_call_join_url, video_call_confirm_token, video_call_confirmed_at')
         .eq('id', user.id)
         .maybeSingle()
         .then(({ data: row }) => {
            if (cancelled || !row) return;
            const r = row as Record<string, string | null | undefined>;
            setMeeting({
               startsAt: r.video_call_starts_at ?? null,
               joinUrl: r.video_call_join_url ?? null,
               confirmToken: r.video_call_confirm_token ?? null,
               confirmed: Boolean(r.video_call_confirmed_at)
            });
         });
      return () => {
         cancelled = true;
      };
   }, [booked, approved, user.id, data.access]);

   useEffect(() => {
      const timer = window.setInterval(() => setNow(Date.now()), 60_000);
      return () => window.clearInterval(timer);
   }, []);

   const submit = useCallback(async () => {
      if (sending) return;
      const trimmed = reason.trim();
      if (trimmed.length < MIN_REASON) {
         setError(t.errors.reason_required);
         setGoalDone(false);
         return;
      }
      setSending(true);
      setError('');
      try {
         // Same call as ConnectStep: loan-access flips them to pending and pings the team.
         const { data: res, error: invokeError } = await getSupabaseBrowserClient().functions.invoke('loan-access', {
            body: { action: 'submit', reason: trimmed, displayName: user.displayName || undefined }
         });
         let payload = res as { ok?: boolean; status?: string; error?: string; code?: string; next?: unknown; data?: { next?: unknown } } | null;
         if (invokeError) {
            const ctx = (invokeError as { context?: Response }).context;
            payload = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
         }
         if (!payload?.ok) {
            const code = payload?.code || payload?.error || '';
            if (code === 'ID_ONBOARDING_INCOMPLETE') {
               // An earlier step isn't done on the server: refresh and go back to it.
               await refresh();
               const next = payload?.next ?? payload?.data?.next;
               navigate(idStepPath(typeof next === 'string' && isIdStepKey(next) ? next : undefined));
               return;
            }
            setError((t.errors as Record<string, string>)[code] ?? t.errors.default);
            if (code === 'contact_not_verified') navigate(idStepPath('whatsapp'));
            if (code === 'call_not_booked') {
               // No upcoming call on the server: show the booking widget again.
               setRebook(true);
               setGoalDone(true);
            }
            return;
         }
         setRebook(false);
         try {
            window.sessionStorage.removeItem(reasonKey);
         } catch {
            // ignore
         }
         await refresh();
      } catch (err) {
         console.error('[IdOnboarding] loan-access submit failed', err);
         setError(t.errors.default);
      } finally {
         setSending(false);
      }
   }, [sending, reason, t, user.displayName, navigate, reasonKey, refresh]);

   const amounts = data.rules.amounts.map((a) => `$${a}`).join(` ${t.or} `);

   if (approved) {
      return (
         <div data-i18n-skip className="flex flex-col gap-4">
            <StepHead image={CONNECT_HIPPOS.approved} title={t.approvedTitle} subtitle={t.approvedBody(amounts)} />
            {data.kycApproved ? (
               <GoldButton onClick={() => navigate('/request-board', { state: { openLoanRequest: true } })}>{t.apply}</GoldButton>
            ) : (
               <WaitRow>{t.kycWait}</WaitRow>
            )}
         </div>
      );
   }

   if (rejected) {
      return (
         <div data-i18n-skip className="flex flex-col gap-4">
            <StepHead image={CONNECT_HIPPOS.missed} title={t.rejected} />
            <SoftButton onClick={() => openMessengerSupport(EXTERNAL_LINKS.support.messenger)}>{t.contact}</SoftButton>
         </div>
      );
   }

   const bookedStartsMs = meeting?.startsAt ? Date.parse(meeting.startsAt) : NaN;
   // Not sent to the team yet and no upcoming call: loan-access would answer call_not_booked, so
   // go straight back to the booking widget instead of a "Send" button that can't work.
   const needsRebook = booked && !pending && (rebook || (!Number.isNaN(bookedStartsMs) && now > bookedStartsMs));

   if (booked && !needsRebook) {
      const startsMs = bookedStartsMs;
      const callOver = !Number.isNaN(startsMs) && now > startsMs + CALL_OVER_AFTER_MS;
      const needsConfirm = Boolean(meeting?.confirmToken) && !meeting?.confirmed && !callOver;
      const confirmOpen = needsConfirm && !Number.isNaN(startsMs) && now >= startsMs - CONFIRM_OPENS_MS;
      const locale = lang === 'id' ? 'id-ID' : undefined;
      const day = meeting?.startsAt
         ? new Date(meeting.startsAt).toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' })
         : null;
      const time = meeting?.startsAt ? new Date(meeting.startsAt).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }) : null;
      return (
         <div data-i18n-skip className="flex flex-col gap-4">
            <StepHead
               image={CONNECT_HIPPOS.waiting}
               title={callOver ? t.callOver : t.waitingTitle}
               subtitle={callOver ? undefined : t.waitingBody}
            />
            <div className="flex flex-col items-center gap-3 rounded-[20px] border-2 border-[#ffd36b] bg-[#fff6dc] px-4 py-4 text-center dark:bg-[#2a220f]">
               {time ? (
                  <span className="flex flex-col">
                     <span className="text-[28px] font-extrabold leading-[32px]">{time}</span>
                     <span className="text-[14px] text-[#7a6a4f] dark:text-[#bfb29a]">
                        {day} · {t.localTime}
                     </span>
                  </span>
               ) : (
                  <span className="text-[15px] text-[#7a6a4f]">{t.timeByEmail}</span>
               )}
               {confirmOpen && meeting?.confirmToken ? (
                  <a
                     className="flex min-h-[52px] w-full items-center justify-center rounded-[16px] bg-[#2f9e44] text-[18px] font-extrabold text-white"
                     href={`${functionsBase()}/video-call-confirm?t=${encodeURIComponent(meeting.confirmToken)}`}
                  >
                     {t.confirm}
                  </a>
               ) : needsConfirm ? (
                  <span className="text-[14px] font-semibold text-[#6b4a00] dark:text-[#ffd36b]">{t.confirmLater}</span>
               ) : meeting?.confirmed && !callOver ? (
                  <span className="text-[15px] font-bold text-[#2f7a3a]">{t.confirmed}</span>
               ) : null}
               {meeting?.confirmToken && !meeting.confirmed && !callOver ? (
                  <SoftLink href={`${functionsBase()}/video-call-confirm?ics=${encodeURIComponent(meeting.confirmToken)}`}>
                     📅 {t.calendar}
                  </SoftLink>
               ) : null}
               {meeting?.joinUrl && !callOver ? (
                  <GoldLink href={meeting.joinUrl} rel="noreferrer" target="_blank">
                     🎥 {t.join}
                  </GoldLink>
               ) : null}
            </div>
            {/* Booked, but the request never reached the team (closed the app mid-send): send it now. */}
            {!pending ? (
               <>
                  {reason.trim().length < MIN_REASON ? (
                     <label className="flex flex-col gap-1.5 text-[15px] font-bold">
                        {t.goalLabel}
                        <input
                           className={inputClass}
                           maxLength={500}
                           onChange={(e) => setReason(e.target.value)}
                           placeholder={t.goalPlaceholder}
                           value={reason}
                        />
                     </label>
                  ) : null}
                  <GoldButton busy={sending} disabled={reason.trim().length < MIN_REASON} onClick={() => void submit()}>
                     {sending ? t.sending : t.retry}
                  </GoldButton>
               </>
            ) : null}
            <ErrorText>{error}</ErrorText>
         </div>
      );
   }

   if (!data.readyForCall) {
      return (
         <div data-i18n-skip className="flex flex-col gap-4">
            <StepHead image={CONNECT_HIPPOS.call} title={t.title} />
            <p className="text-[15px] font-semibold text-[#7a6a4f] dark:text-[#bfb29a]">{t.locked}</p>
         </div>
      );
   }

   // 1) What the loan is for (the team sees it before the call), 2) pick the time.
   if (!goalDone) {
      return (
         <div data-i18n-skip className="flex flex-col gap-4">
            <StepHead image={CONNECT_HIPPOS.call} title={t.title} subtitle={t.subtitle} />
            <label className="flex flex-col gap-1.5 text-[16px] font-bold">
               {t.goalLabel}
               <input
                  className={inputClass}
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t.goalPlaceholder}
                  value={reason}
               />
            </label>
            <div className="flex flex-wrap gap-2">
               {t.chips.map((chip) => (
                  <button
                     key={chip}
                     className="rounded-full border-2 border-[#ecdfb8] bg-white px-3 py-1.5 text-[15px] font-bold text-[#6b4a00] active:scale-95 dark:border-[#4a3d1c] dark:bg-[#1c1710] dark:text-[#ffd36b]"
                     onClick={() => setReason((current) => (current.trim() ? `${current.trim()}, ${chip.toLowerCase()}` : chip))}
                     type="button"
                  >
                     {chip}
                  </button>
               ))}
            </div>
            <ErrorText>{error}</ErrorText>
            <GoldButton
               disabled={reason.trim().length < MIN_REASON}
               onClick={() => {
                  setError('');
                  setGoalDone(true);
               }}
            >
               {t.goalNext}
            </GoldButton>
         </div>
      );
   }

   return (
      <>
         <div data-i18n-skip>
            <StepHead image={CONNECT_HIPPOS.call} title={t.title} subtitle={t.subtitle} />
         </div>
         {sending ? (
            <div data-i18n-skip>
               <WaitRow>{t.sending}</WaitRow>
            </div>
         ) : null}
         {error ? (
            <div data-i18n-skip>
               <ErrorText>{error}</ErrorText>
            </div>
         ) : null}
         {/* The shared booking widget (Cal.com round robin), translated by the app like the rest of it. */}
         <div className="-mx-4">
            <VideoCallStep
               continueLabel={sending ? t.sending : t.retry}
               intro={null}
               isSubmitting={sending}
               onBack={() => setGoalDone(false)}
               onBooked={() => void submit()}
               onContinue={() => void submit()}
               requireUpcoming
               userId={user.id}
            />
         </div>
      </>
   );
}
