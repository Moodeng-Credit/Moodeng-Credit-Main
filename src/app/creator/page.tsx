import { useEffect, useRef, useState } from 'react';

import { Loader2, Video } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import {
   type CreatorApplicationForm,
   creatorErrorMessage,
   type CreatorFormErrors,
   type CreatorStatus,
   creatorVideoProblem,
   EMPTY_CREATOR_FORM,
   fetchCreatorStatus,
   readVideoSeconds,
   resendCreatorCode,
   startCreatorApplication,
   uploadCreatorVideo,
   validateCreatorForm,
   verifyCreatorCode
} from '@/lib/creatorApplication';
import { DASHBOARD_V2_ASSETS } from '@/views/dashboard-v2/assets';

/*
 * moodeng.app/creator — creators apply to be Moodeng partners. Same steps as our first creator page, in the
 * affiliate look (purple hippo banner, white cards, one gold button) + an optional "why Moodeng" video
 * (Emma 2026-11-27). Form → video upload → emailed code → application number. The AI reads it after the
 * code; the team approves in Admin → Affiliates, which emails a one-time moodeng.app/partner/TOKEN link.
 */

const HERO_GRADIENT = 'linear-gradient(180deg, #7f86f6 0%, #8c94f7 100%)';
const GOLD = 'linear-gradient(180deg, #ffe27a 0%, #ffbe1a 100%)';
const PURPLE = '#6b55f7';
const RED = '#e5484d';

const inputCls =
   'w-full rounded-2xl border border-[#e4e0f5] bg-[#f7f6fc] px-4 py-3.5 text-base text-[#1d1636] placeholder:text-[#a59fbd] focus:border-[#6b55f7] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6b55f7]/25';

function GoldButton({ children, busy, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
   return (
      <button
         {...rest}
         disabled={busy || rest.disabled}
         className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-lg font-extrabold text-[#4a2a00] shadow-[0_4px_0_#d99a00] transition active:translate-y-[2px] active:shadow-[0_2px_0_#d99a00] disabled:opacity-60 ${className}`}
         style={{ backgroundImage: GOLD }}
      >
         {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
         {children}
      </button>
   );
}

function Card({ step, title, note, children }: { step?: string; title: string; note?: string; children: React.ReactNode }) {
   return (
      <section className="rounded-[24px] bg-white p-5 shadow-[0_6px_24px_rgba(91,68,230,0.08)] sm:p-6">
         <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
               {step ? (
                  <span
                     className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-black text-white"
                     style={{ background: PURPLE }}
                  >
                     {step}
                  </span>
               ) : null}
               <h2 className="text-[20px] font-extrabold italic text-[#1d1636]">{title}</h2>
            </div>
            {note ? <span className="rounded-full bg-[#efecff] px-2.5 py-1 text-xs font-bold text-[#6b55f7]">{note}</span> : null}
         </div>
         {children}
      </section>
   );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
   return (
      <label className="block">
         <span className="mb-1.5 block text-sm font-bold text-[#4b4468]">{label}</span>
         {children}
         {error ? (
            <span className="mt-1.5 block text-sm font-semibold" style={{ color: RED }}>
               {error}
            </span>
         ) : null}
      </label>
   );
}

function YesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
   return (
      <div className="grid grid-cols-2 gap-2 rounded-full bg-[#f1effa] p-1">
         {[true, false].map((v) => (
            <button
               key={String(v)}
               type="button"
               aria-pressed={value === v}
               onClick={() => onChange(v)}
               className={`rounded-full py-2.5 text-sm font-extrabold transition ${value === v ? 'bg-white text-[#6b55f7] shadow' : 'text-[#8a83a6]'}`}
            >
               {v ? 'Yes' : 'No'}
            </button>
         ))}
      </div>
   );
}

function Hero({ tab, setTab }: { tab: 'apply' | 'track'; setTab: (t: 'apply' | 'track') => void }) {
   return (
      <section
         className="relative overflow-hidden"
         style={{
            backgroundImage: HERO_GRADIENT,
            maskImage: 'linear-gradient(180deg, #000 78%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(180deg, #000 78%, transparent 100%)'
         }}
      >
         <div className="mx-auto max-w-[560px] px-5 pt-6">
            <div className="flex items-center justify-between">
               <a href="https://moodeng.app" className="text-base font-black italic tracking-tight text-white">
                  MOODENG
               </a>
               <div className="flex rounded-full bg-white/20 p-1 backdrop-blur">
                  {(
                     [
                        ['apply', 'Apply'],
                        ['track', 'My status']
                     ] as const
                  ).map(([t, label]) => (
                     <button
                        key={t}
                        type="button"
                        onClick={() => setTab(t)}
                        className={`rounded-full px-4 py-1.5 text-sm font-extrabold transition ${tab === t ? 'bg-white text-[#6b55f7]' : 'text-white'}`}
                     >
                        {label}
                     </button>
                  ))}
               </div>
            </div>
            <div className="pt-8 text-center">
               <h1
                  className="text-[40px] font-black italic leading-none tracking-[-1px] text-white sm:text-[48px]"
                  style={{ textShadow: '0 3px 0 rgba(91,68,230,0.35)' }}
               >
                  BE A MOODENG CREATOR
               </h1>
               <p className="mt-2 text-[18px] font-extrabold italic text-white">Share Moodeng. Earn for every friend we fund.</p>
            </div>
         </div>
         <img
            src={DASHBOARD_V2_ASSETS.affiliateHero}
            alt="Two Moodeng hippos high-fiving"
            className="mx-auto -mt-2 block w-full max-w-[560px] [mask-image:linear-gradient(180deg,transparent_0%,#000_16%)] sm:mt-0 sm:[mask-image:radial-gradient(ellipse_50%_58%_at_50%_52%,#000_45%,transparent_100%)]"
         />
      </section>
   );
}

// ── Video step ───────────────────────────────────────────────────────────────────────────────────────
function VideoPicker({ file, onFile }: { file: File | null; onFile: (f: File | null) => void }) {
   const input = useRef<HTMLInputElement>(null);
   const [preview, setPreview] = useState<string | null>(null);
   const [problem, setProblem] = useState<string | null>(null);
   const [checking, setChecking] = useState(false);

   useEffect(() => {
      if (!file) {
         setPreview(null);
         return;
      }
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
   }, [file]);

   const pick = async (f: File | undefined) => {
      if (!f) return;
      setChecking(true);
      const why = creatorVideoProblem(f, await readVideoSeconds(f));
      setChecking(false);
      setProblem(why);
      onFile(why ? null : f);
   };

   return (
      <div>
         <input
            ref={input}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
               void pick(e.target.files?.[0]);
               e.target.value = '';
            }}
         />
         {preview ? (
            <div className="space-y-2">
               <video src={preview} controls playsInline className="max-h-[360px] w-full rounded-2xl bg-black" />
               <button type="button" onClick={() => input.current?.click()} className="text-sm font-bold text-[#6b55f7] underline">
                  Use another video
               </button>
            </div>
         ) : (
            <button
               type="button"
               onClick={() => input.current?.click()}
               className="flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-[#cfc7f7] bg-[#f7f6fc] p-3 text-left"
            >
               <img src="/hippos/prescreen/ready-to-record.webp" alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
               <span>
                  <span className="flex items-center gap-1.5 text-base font-extrabold text-[#1d1636]">
                     {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4 text-[#6b55f7]" />}
                     Record or pick a video
                  </span>
                  <span className="mt-0.5 block text-sm text-[#7a7396]">Why do you want to work with Moodeng? Under 1 minute.</span>
               </span>
            </button>
         )}
         {problem ? (
            <p className="mt-2 text-sm font-semibold" style={{ color: RED }}>
               {problem}
            </p>
         ) : null}
      </div>
   );
}

// ── Apply ────────────────────────────────────────────────────────────────────────────────────────────
function ApplyForm({ onDone }: { onDone: (appNumber: string, email: string) => void }) {
   const [f, setF] = useState<CreatorApplicationForm>(EMPTY_CREATOR_FORM);
   const [video, setVideo] = useState<File | null>(null);
   const [errors, setErrors] = useState<CreatorFormErrors>({});
   const [busy, setBusy] = useState<null | 'saving' | 'video'>(null);
   const [formError, setFormError] = useState<string | null>(null);
   const [appId, setAppId] = useState<string | null>(null);
   const [videoFailed, setVideoFailed] = useState(false);

   const set = <K extends keyof CreatorApplicationForm>(k: K, v: CreatorApplicationForm[K]) => setF((prev) => ({ ...prev, [k]: v }));

   const submit = async (e: React.FormEvent) => {
      e.preventDefault();
      const errs = validateCreatorForm(f);
      setErrors(errs);
      if (Object.keys(errs).length) {
         setFormError('Please fix the red boxes.');
         return;
      }
      setBusy('saving');
      setFormError(null);
      try {
         const id = await startCreatorApplication(f);
         if (video) {
            setBusy('video');
            try {
               await uploadCreatorVideo(id, video);
               setVideoFailed(false);
            } catch {
               setVideoFailed(true);
            }
         }
         setAppId(id);
      } catch (err) {
         setFormError(creatorErrorMessage((err as Error)?.message));
      } finally {
         setBusy(null);
      }
   };

   return (
      <>
         <form onSubmit={submit} noValidate className="space-y-4">
            <Card step="1" title="About you">
               <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                     <Field label="Full name" error={errors.full_name}>
                        <input
                           className={inputCls}
                           value={f.full_name}
                           onChange={(e) => set('full_name', e.target.value)}
                           autoComplete="name"
                        />
                     </Field>
                  </div>
                  <div className="sm:col-span-2">
                     <Field label="Address" error={errors.address}>
                        <input
                           className={inputCls}
                           value={f.address}
                           onChange={(e) => set('address', e.target.value)}
                           placeholder="Street, barangay, city"
                           autoComplete="street-address"
                        />
                     </Field>
                  </div>
                  <Field label="Phone" error={errors.phone}>
                     <input
                        className={inputCls}
                        type="tel"
                        value={f.phone}
                        onChange={(e) => set('phone', e.target.value)}
                        placeholder="+63 917 123 4567"
                        autoComplete="tel"
                     />
                  </Field>
                  <Field label="Email" error={errors.email}>
                     <input
                        className={inputCls}
                        type="email"
                        value={f.email}
                        onChange={(e) => set('email', e.target.value)}
                        placeholder="you@email.com"
                        autoComplete="email"
                     />
                  </Field>
               </div>
            </Card>

            <Card step="2" title="Your pages" note="1 or more">
               <div className="grid gap-4 sm:grid-cols-2">
                  {(
                     [
                        ['tiktok_url', 'TikTok', 'tiktok.com/@you'],
                        ['facebook_url', 'Facebook', 'facebook.com/you'],
                        ['instagram_url', 'Instagram', 'instagram.com/you'],
                        ['youtube_url', 'YouTube', 'youtube.com/@you']
                     ] as const
                  ).map(([k, label, ph]) => (
                     <Field key={k} label={label}>
                        <input
                           className={inputCls}
                           type="url"
                           inputMode="url"
                           value={f[k]}
                           onChange={(e) => set(k, e.target.value)}
                           placeholder={ph}
                        />
                     </Field>
                  ))}
               </div>
               {errors.socials ? (
                  <p className="mt-2 text-sm font-semibold" style={{ color: RED }}>
                     {errors.socials}
                  </p>
               ) : null}
            </Card>

            <Card step="3" title="Your video" note="Gets picked first">
               <VideoPicker file={video} onFile={setVideo} />
            </Card>

            <Card step="4" title="A few questions">
               <div className="space-y-5">
                  <div>
                     <p className="mb-2 text-sm font-bold text-[#4b4468]">Worked with a money app before?</p>
                     <YesNo value={f.prior_fintech} onChange={(v) => set('prior_fintech', v)} />
                     {f.prior_fintech ? (
                        <input
                           className={`${inputCls} mt-2`}
                           value={f.prior_fintech_details}
                           onChange={(e) => set('prior_fintech_details', e.target.value)}
                           placeholder="Which one?"
                        />
                     ) : null}
                  </div>
                  <div>
                     <p className="mb-2 text-sm font-bold text-[#4b4468]">Working with another loan app now?</p>
                     <YesNo value={f.conflict} onChange={(v) => set('conflict', v)} />
                     {f.conflict ? (
                        <input
                           className={`${inputCls} mt-2`}
                           value={f.conflict_details}
                           onChange={(e) => set('conflict_details', e.target.value)}
                           placeholder="Which one?"
                        />
                     ) : null}
                  </div>
                  <Field label="Why you? (optional)">
                     <textarea
                        className={`${inputCls} resize-y`}
                        rows={3}
                        maxLength={2000}
                        value={f.pitch}
                        onChange={(e) => set('pitch', e.target.value)}
                        placeholder="Who follows you and what you post"
                     />
                  </Field>
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-[#f7f6fc] p-4">
                     <input
                        type="checkbox"
                        checked={f.consent}
                        onChange={(e) => set('consent', e.target.checked)}
                        className="mt-0.5 h-5 w-5 shrink-0 accent-[#6b55f7]"
                     />
                     <span className="text-sm leading-relaxed text-[#4b4468]">
                        Moodeng can keep and use my details to review my application and contact me, as allowed by privacy law.
                     </span>
                  </label>
                  {errors.consent ? (
                     <p className="-mt-3 text-sm font-semibold" style={{ color: RED }}>
                        {errors.consent}
                     </p>
                  ) : null}
               </div>
            </Card>

            {formError ? (
               <p className="text-center text-sm font-bold" style={{ color: RED }}>
                  {formError}
               </p>
            ) : null}
            <GoldButton type="submit" busy={Boolean(busy)}>
               {busy === 'video' ? 'Sending your video…' : 'Send application'}
            </GoldButton>
         </form>
         {appId ? (
            <CodeModal appId={appId} email={f.email.trim()} videoFailed={videoFailed} onClose={() => setAppId(null)} onDone={onDone} />
         ) : null}
      </>
   );
}

function CodeModal({
   appId,
   email,
   videoFailed,
   onClose,
   onDone
}: {
   appId: string;
   email: string;
   videoFailed: boolean;
   onClose: () => void;
   onDone: (appNumber: string, email: string) => void;
}) {
   const [code, setCode] = useState('');
   const [busy, setBusy] = useState(false);
   const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);

   const verify = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!/^\d{6}$/.test(code)) {
         setMsg({ text: 'Type the 6 numbers from the email.' });
         return;
      }
      setBusy(true);
      setMsg(null);
      try {
         const number = await verifyCreatorCode(appId, code);
         if (number) onDone(number, email);
         else setMsg({ text: 'Wrong code. Check the email again.' });
      } catch (err) {
         setMsg({ text: creatorErrorMessage((err as Error)?.message) });
      } finally {
         setBusy(false);
      }
   };

   const resend = async () => {
      setMsg(null);
      try {
         await resendCreatorCode(appId);
         setMsg({ text: 'New code sent. Check spam too.', ok: true });
      } catch (err) {
         setMsg({ text: creatorErrorMessage((err as Error)?.message) });
      }
   };

   return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1d1636]/60 p-3 sm:items-center">
         <div className="relative w-full max-w-[420px] rounded-[28px] bg-white p-6 text-center shadow-2xl">
            <button type="button" onClick={onClose} className="absolute right-4 top-3 text-xl font-bold text-[#a59fbd]" aria-label="Close">
               ✕
            </button>
            <img src="/hippos/hippo-purple-envelope-email.png" alt="" className="mx-auto h-28 w-auto" />
            <h3 className="mt-2 text-2xl font-black italic text-[#1d1636]">Check your email</h3>
            <p className="mt-1 text-sm text-[#7a7396]">
               Code sent to <strong className="break-all text-[#1d1636]">{email}</strong>
            </p>
            {videoFailed ? (
               <p className="mt-2 rounded-xl bg-[#fff4d6] px-3 py-2 text-sm font-semibold text-[#7a5300]">
                  Your video didn’t send. You can still apply without it.
               </p>
            ) : null}
            <form onSubmit={verify} className="mt-4 space-y-3">
               <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  aria-label="6-digit code"
                  className={`${inputCls} text-center text-3xl font-black tracking-[0.4em]`}
                  autoFocus
               />
               {msg ? (
                  <p className="text-sm font-semibold" style={{ color: msg.ok ? '#1f8a4c' : RED }}>
                     {msg.text}
                  </p>
               ) : null}
               <GoldButton type="submit" busy={busy}>
                  Send
               </GoldButton>
               <button type="button" onClick={resend} className="text-sm font-bold text-[#6b55f7] underline">
                  Send a new code
               </button>
            </form>
         </div>
      </div>
   );
}

// ── Done + status ────────────────────────────────────────────────────────────────────────────────────
function NumberPill({ value }: { value: string }) {
   return (
      <div className="mx-auto inline-block rounded-2xl bg-gradient-to-b from-white to-[#ece8ff] px-5 py-3 shadow-[inset_0_0_0_1px_#e4e0f5]">
         <p className="text-xs font-bold uppercase tracking-wider text-[#8a83a6]">Your number</p>
         <p className="text-2xl font-black tracking-wider text-[#6b55f7]">{value}</p>
      </div>
   );
}

function Done({ appNumber, onTrack }: { appNumber: string; onTrack: () => void }) {
   return (
      <section className="rounded-[24px] bg-white p-6 text-center shadow-[0_6px_24px_rgba(91,68,230,0.08)]">
         <img src="/hippos/party.png" alt="" className="mx-auto h-[130px] w-auto" />
         <h2 className="mt-2 text-[26px] font-black italic text-[#1d1636]">Application sent!</h2>
         <p className="mb-4 mt-1 text-[#7a7396]">We’ll email you soon.</p>
         <NumberPill value={appNumber} />
         <GoldButton type="button" onClick={onTrack} className="mt-6">
            Check my status
         </GoldButton>
      </section>
   );
}

function StatusResult({ s }: { s: CreatorStatus }) {
   const badge =
      s.status === 'approved'
         ? { text: 'Approved 🎉', cls: 'bg-[#dcf7e6] text-[#1f8a4c]' }
         : s.status === 'rejected'
           ? { text: 'Not this time', cls: 'bg-[#fde4e4] text-[#c0392b]' }
           : { text: 'We’re checking', cls: 'bg-[#efecff] text-[#6b55f7]' };
   return (
      <div className="mt-5 rounded-2xl bg-[#f7f6fc] p-4 text-left">
         <div className="flex items-center justify-between gap-2">
            <p className="text-lg font-extrabold text-[#1d1636]">Hi {s.firstName}!</p>
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${badge.cls}`}>{badge.text}</span>
         </div>
         <p className="mt-0.5 text-xs text-[#8a83a6]">{s.appNumber}</p>
         {s.status === 'pending' ? <p className="mt-3 text-sm text-[#4b4468]">We’ll email you when we decide.</p> : null}
         {s.status === 'rejected' ? (
            <p className="mt-3 text-sm text-[#4b4468]">Thank you for applying. We can’t approve it this time.</p>
         ) : null}
         {s.status === 'approved' ? (
            <div className="mt-3 space-y-3">
               {s.code ? (
                  <p className="text-sm text-[#4b4468]">
                     Your code: <strong className="text-lg tracking-wider text-[#6b55f7]">{s.code}</strong>
                  </p>
               ) : null}
               {s.partnerLink ? (
                  <a
                     href={s.partnerLink}
                     className="flex w-full items-center justify-center rounded-full px-6 py-3.5 text-base font-extrabold text-[#4a2a00] shadow-[0_4px_0_#d99a00]"
                     style={{ backgroundImage: GOLD }}
                  >
                     Set up my partner account
                  </a>
               ) : null}
            </div>
         ) : null}
      </div>
   );
}

function TrackCard({ initialNumber, initialEmail }: { initialNumber: string; initialEmail: string }) {
   const [num, setNum] = useState(initialNumber);
   const [email, setEmail] = useState(initialEmail);
   const [busy, setBusy] = useState(false);
   const [result, setResult] = useState<CreatorStatus | null>(null);
   const [msg, setMsg] = useState<string | null>(null);

   const check = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!num.trim() || !email.trim()) {
         setMsg('Type your number and email.');
         return;
      }
      setBusy(true);
      setMsg(null);
      setResult(null);
      try {
         const s = await fetchCreatorStatus(num, email);
         if (s) setResult(s);
         else setMsg('Not found. Use the email you applied with.');
      } catch {
         setMsg('Something went wrong. Please try again.');
      } finally {
         setBusy(false);
      }
   };

   useEffect(() => {
      if (initialNumber && initialEmail) void check();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   return (
      <Card title="My status">
         <form onSubmit={check} className="space-y-3">
            <Field label="Application number">
               <input
                  className={`${inputCls} font-bold uppercase tracking-wider`}
                  value={num}
                  onChange={(e) => setNum(e.target.value)}
                  placeholder="MDG-2026-1234"
               />
            </Field>
            <Field label="Email">
               <input
                  className={inputCls}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
               />
            </Field>
            {msg ? (
               <p className="text-sm font-semibold" style={{ color: RED }}>
                  {msg}
               </p>
            ) : null}
            <GoldButton type="submit" busy={busy}>
               Check
            </GoldButton>
         </form>
         {result ? <StatusResult s={result} /> : null}
      </Card>
   );
}

export default function CreatorApplyPage() {
   const [params] = useSearchParams();
   const trackParam = params.get('track') ?? '';
   const [tab, setTab] = useState<'apply' | 'track'>(trackParam ? 'track' : 'apply');
   const [done, setDone] = useState<{ number: string; email: string } | null>(null);
   const [trackSeed, setTrackSeed] = useState({ number: trackParam, email: '' });

   useEffect(() => {
      document.title = 'Be a Moodeng Creator';
   }, []);

   const switchTab = (t: 'apply' | 'track') => {
      setTab(t);
      setDone(null);
   };

   return (
      <div className="min-h-screen bg-[#f6f5fb] text-[#1d1636]" style={{ colorScheme: 'light' }}>
         <Hero tab={tab} setTab={switchTab} />
         <main className="relative z-10 mx-auto -mt-10 max-w-[560px] space-y-4 px-4 pb-12">
            {tab === 'track' ? (
               <TrackCard key={`${trackSeed.number}|${trackSeed.email}`} initialNumber={trackSeed.number} initialEmail={trackSeed.email} />
            ) : done ? (
               <Done
                  appNumber={done.number}
                  onTrack={() => {
                     setTrackSeed({ number: done.number, email: done.email });
                     switchTab('track');
                  }}
               />
            ) : (
               <ApplyForm onDone={(number, email) => setDone({ number, email })} />
            )}
            <p className="pt-4 text-center text-sm text-[#8a83a6]">
               Questions?{' '}
               <a href="mailto:support@moodeng.app" className="font-bold text-[#6b55f7] underline">
                  support@moodeng.app
               </a>
            </p>
         </main>
      </div>
   );
}
