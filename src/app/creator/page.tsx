import { useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import {
   type CreatorApplicationForm,
   creatorErrorMessage,
   type CreatorFormErrors,
   type CreatorStatus,
   EMPTY_CREATOR_FORM,
   fetchCreatorStatus,
   resendCreatorCode,
   startCreatorApplication,
   validateCreatorForm,
   verifyCreatorCode
} from '@/lib/creatorApplication';

/*
 * moodeng.app/creator — "Become a Moodeng Affiliate Partner". Public: apply (form → emailed code →
 * application number) or check status (number + email). The team approves in Admin → Affiliates, which
 * emails a one-time moodeng.app/partner/TOKEN link. Own look (cream, ink borders, hard shadows,
 * 4-colour stripe) scoped to this page.
 */

const C = {
   bg: '#F7F5F0',
   ink: '#121316',
   cobalt: '#2541B2',
   terracotta: '#E85D3F',
   lime: '#C5F046',
   amber: '#F5B82E'
};

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&display=swap';
const display = { fontFamily: "'Space Grotesk', Inter, sans-serif" };

function useDisplayFont() {
   useEffect(() => {
      if (document.querySelector(`link[href="${FONT_HREF}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONT_HREF;
      document.head.appendChild(link);
   }, []);
}

const STRIPE = [C.cobalt, C.terracotta, C.amber, C.lime];
const STRIPE_REVERSED = [C.lime, C.amber, C.terracotta, C.cobalt];

function Stripe({ order = STRIPE }: { order?: string[] }) {
   return (
      <div className="grid h-3 grid-cols-4 border-b-2 border-[#121316]">
         {order.map((c) => (
            <div key={c} style={{ background: c }} />
         ))}
      </div>
   );
}

function Card({ children, stripe }: { children: React.ReactNode; stripe?: string[] }) {
   return (
      <section className="overflow-hidden rounded-3xl border-2 border-[#121316] bg-white shadow-[8px_8px_0_#121316]">
         <Stripe order={stripe} />
         <div className="p-5 sm:p-9">{children}</div>
      </section>
   );
}

function SectionHead({ n, title, note, color, shape }: { n: string; title: string; note?: string; color: string; shape: string }) {
   return (
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b-2 border-neutral-200 pb-3">
         <div className="flex items-center gap-3">
            <span
               className={`flex h-8 w-8 items-center justify-center border-2 border-[#121316] text-sm font-bold ${shape}`}
               style={{ ...display, background: color, color: color === C.amber ? C.ink : '#fff' }}
            >
               {n}
            </span>
            <h2 className="text-xl font-bold tracking-tight" style={display}>
               {title}
            </h2>
         </div>
         {note ? <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{note}</span> : null}
      </div>
   );
}

const inputCls =
   'w-full rounded-xl border-2 border-[#121316] bg-[#F7F5F0] px-4 py-3.5 text-base font-medium text-[#121316] placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2541B2]';

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
   return (
      <label className="block">
         <span className="mb-2 block text-xs font-bold uppercase tracking-wider">
            {label} {required ? <span style={{ color: C.terracotta }}>*</span> : null}
         </span>
         {children}
         {error ? (
            <span className="mt-1.5 block text-xs font-semibold" style={{ color: C.terracotta }}>
               {error}
            </span>
         ) : null}
      </label>
   );
}

function YesNo({ value, onChange, yesColor }: { value: boolean; onChange: (v: boolean) => void; yesColor: string }) {
   return (
      <div className="mb-3 flex gap-3">
         {[true, false].map((v) => (
            <button
               key={String(v)}
               type="button"
               onClick={() => onChange(v)}
               aria-pressed={value === v}
               className={`rounded-xl border-2 border-[#121316] px-5 py-2.5 text-sm font-bold transition-all ${value === v ? 'shadow-[3px_3px_0_#121316]' : 'bg-white'}`}
               style={value === v ? { background: v ? yesColor : C.lime } : undefined}
            >
               {v ? 'YES' : 'NO'}
            </button>
         ))}
      </div>
   );
}

function PrimaryBtn({ children, busy, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
   return (
      <button
         {...rest}
         disabled={busy || rest.disabled}
         className={`inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#121316] bg-[#2541B2] px-7 py-3.5 text-base font-bold text-white shadow-[3px_3px_0_#121316] transition-colors hover:bg-[#121316] disabled:opacity-60 ${rest.className ?? ''}`}
         style={display}
      >
         {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
         {children}
      </button>
   );
}

function BackgroundArt() {
   return (
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
         <svg className="absolute -left-20 -top-20 h-40 w-40 sm:-left-16 sm:-top-16 sm:h-80 sm:w-80" viewBox="0 0 200 200">
            <circle cx="0" cy="0" r="180" fill={C.cobalt} />
            <circle cx="0" cy="0" r="110" fill="none" stroke={C.bg} strokeWidth="3" strokeDasharray="8 8" />
         </svg>
         <svg className="absolute -right-10 top-12 hidden h-56 w-56 sm:block sm:h-72 sm:w-72" viewBox="0 0 220 220">
            <polygon points="110,15 205,180 15,180" fill={C.amber} stroke={C.ink} strokeWidth="3" />
            <circle cx="155" cy="75" r="34" fill={C.terracotta} stroke={C.ink} strokeWidth="3" />
            <rect x="45" y="135" width="44" height="44" fill={C.lime} stroke={C.ink} strokeWidth="3" />
         </svg>
         <svg className="absolute -bottom-16 -right-12 h-56 w-56 sm:h-80 sm:w-80" viewBox="0 0 200 200">
            <path d="M 200 40 A 160 160 0 0 0 40 200 L 200 200 Z" fill={C.terracotta} />
            <line x1="80" y1="200" x2="200" y2="80" stroke={C.ink} strokeWidth="3" />
            <line x1="115" y1="200" x2="200" y2="115" stroke={C.ink} strokeWidth="3" />
            <line x1="150" y1="200" x2="200" y2="150" stroke={C.ink} strokeWidth="3" />
         </svg>
      </div>
   );
}

// ── Apply ────────────────────────────────────────────────────────────────────────────────────────────
function ApplyForm({ onDone }: { onDone: (appNumber: string, email: string) => void }) {
   const [f, setF] = useState<CreatorApplicationForm>(EMPTY_CREATOR_FORM);
   const [errors, setErrors] = useState<CreatorFormErrors>({});
   const [busy, setBusy] = useState(false);
   const [formError, setFormError] = useState<string | null>(null);
   const [appId, setAppId] = useState<string | null>(null);

   const set = <K extends keyof CreatorApplicationForm>(k: K, v: CreatorApplicationForm[K]) => setF((prev) => ({ ...prev, [k]: v }));

   const submit = async (e: React.FormEvent) => {
      e.preventDefault();
      const errs = validateCreatorForm(f);
      setErrors(errs);
      if (Object.keys(errs).length) {
         setFormError('Please fix the boxes in red.');
         return;
      }
      setBusy(true);
      setFormError(null);
      try {
         setAppId(await startCreatorApplication(f));
      } catch (err) {
         setFormError(creatorErrorMessage((err as Error)?.message));
      } finally {
         setBusy(false);
      }
   };

   return (
      <>
         <Card>
            <form onSubmit={submit} noValidate className="space-y-9">
               <div>
                  <SectionHead n="01" title="About you" note="* Must fill in" color={C.cobalt} shape="rounded-lg" />
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                     <div className="md:col-span-2">
                        <Field label="Full name" required error={errors.full_name}>
                           <input
                              className={inputCls}
                              value={f.full_name}
                              onChange={(e) => set('full_name', e.target.value)}
                              autoComplete="name"
                           />
                        </Field>
                     </div>
                     <div className="md:col-span-2">
                        <Field label="Full address" required error={errors.address}>
                           <input
                              className={inputCls}
                              value={f.address}
                              onChange={(e) => set('address', e.target.value)}
                              placeholder="House no., street, barangay, city, province"
                              autoComplete="street-address"
                           />
                        </Field>
                     </div>
                     <Field label="Phone number" required error={errors.phone}>
                        <input
                           className={inputCls}
                           type="tel"
                           value={f.phone}
                           onChange={(e) => set('phone', e.target.value)}
                           placeholder="+63 917 123 4567"
                           autoComplete="tel"
                        />
                     </Field>
                     <Field label="Email" required error={errors.email}>
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
               </div>

               <div>
                  <SectionHead n="02" title="Your channels" note="At least one" color={C.terracotta} shape="rounded-full" />
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                     {(
                        [
                           ['facebook_url', 'Facebook link', 'https://facebook.com/yourpage'],
                           ['tiktok_url', 'TikTok link', 'https://tiktok.com/@you'],
                           ['youtube_url', 'YouTube link', 'https://youtube.com/@you'],
                           ['instagram_url', 'Instagram link', 'https://instagram.com/you']
                        ] as const
                     ).map(([k, label, ph]) => (
                        <Field key={k} label={label}>
                           <input className={inputCls} type="url" value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder={ph} />
                        </Field>
                     ))}
                  </div>
                  {errors.socials ? (
                     <p className="mt-2 text-xs font-semibold" style={{ color: C.terracotta }}>
                        {errors.socials}
                     </p>
                  ) : null}
               </div>

               <div>
                  <SectionHead n="03" title="Why you" color={C.amber} shape="rounded-xl" />
                  <div className="space-y-5">
                     <div className="rounded-2xl border-2 border-[#121316] bg-[#F7F5F0] p-5">
                        <p className="mb-3 text-sm font-bold uppercase tracking-wide">Have you worked with a fintech app before?</p>
                        <YesNo value={f.prior_fintech} onChange={(v) => set('prior_fintech', v)} yesColor={C.lime} />
                        {f.prior_fintech ? (
                           <input
                              className={`${inputCls} bg-white py-2.5`}
                              value={f.prior_fintech_details}
                              onChange={(e) => set('prior_fintech_details', e.target.value)}
                              placeholder="Which app? (optional)"
                           />
                        ) : null}
                     </div>
                     <div className="rounded-2xl border-2 border-[#121316] bg-[#F7F5F0] p-5">
                        <p className="mb-3 text-sm font-bold uppercase tracking-wide">
                           Do you work with another loan or money app right now that could clash with us?
                        </p>
                        <YesNo value={f.conflict} onChange={(v) => set('conflict', v)} yesColor={C.amber} />
                        {f.conflict ? (
                           <input
                              className={`${inputCls} bg-white py-2.5`}
                              value={f.conflict_details}
                              onChange={(e) => set('conflict_details', e.target.value)}
                              placeholder="Which brand? (optional)"
                           />
                        ) : null}
                     </div>
                     <Field label="Why should we pick you?">
                        <textarea
                           className={`${inputCls} resize-y`}
                           rows={4}
                           value={f.pitch}
                           maxLength={2000}
                           onChange={(e) => set('pitch', e.target.value)}
                           placeholder="Who watches you, what you post, and why Moodeng fits your followers."
                        />
                     </Field>
                     <div className="rounded-2xl border-2 border-[#121316] bg-[#F7F5F0] p-5">
                        <label className="flex cursor-pointer items-start gap-3.5">
                           <input
                              type="checkbox"
                              checked={f.consent}
                              onChange={(e) => set('consent', e.target.checked)}
                              className="mt-1 h-5 w-5 shrink-0 accent-[#2541B2]"
                           />
                           <span className="text-sm font-medium leading-relaxed">
                              I let <strong>Moodeng</strong> keep and use these details to review my application, set me up as a partner,
                              and contact me about the program, as allowed by data privacy law.{' '}
                              <span style={{ color: C.terracotta }}>*</span>
                           </span>
                        </label>
                        {errors.consent ? (
                           <p className="mt-2 text-xs font-semibold" style={{ color: C.terracotta }}>
                              {errors.consent}
                           </p>
                        ) : null}
                     </div>
                  </div>
               </div>

               <div className="flex flex-col items-stretch justify-between gap-4 border-t-2 border-neutral-200 pt-5 sm:flex-row sm:items-center">
                  <p className="text-sm font-semibold" style={{ color: formError ? C.terracotta : '#666' }}>
                     {formError ?? 'We email you a 6-digit code to check it’s you.'}
                  </p>
                  <PrimaryBtn type="submit" busy={busy}>
                     Send application →
                  </PrimaryBtn>
               </div>
            </form>
         </Card>
         {appId ? <CodeModal appId={appId} email={f.email.trim()} onClose={() => setAppId(null)} onDone={onDone} /> : null}
      </>
   );
}

function CodeModal({
   appId,
   email,
   onClose,
   onDone
}: {
   appId: string;
   email: string;
   onClose: () => void;
   onDone: (appNumber: string, email: string) => void;
}) {
   const [code, setCode] = useState('');
   const [busy, setBusy] = useState(false);
   const [msg, setMsg] = useState<string | null>(null);

   const verify = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!/^\d{6}$/.test(code)) {
         setMsg('Type the 6 numbers from the email.');
         return;
      }
      setBusy(true);
      setMsg(null);
      try {
         const number = await verifyCreatorCode(appId, code);
         if (number) onDone(number, email);
         else setMsg('That code is wrong. Check the email and try again.');
      } catch (err) {
         setMsg(creatorErrorMessage((err as Error)?.message));
      } finally {
         setBusy(false);
      }
   };

   const resend = async () => {
      setMsg(null);
      try {
         await resendCreatorCode(appId);
         setMsg('New code sent. Check your inbox (and spam).');
      } catch (err) {
         setMsg(creatorErrorMessage((err as Error)?.message));
      }
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#121316]/75 p-4">
         <div className="w-full max-w-md overflow-hidden rounded-3xl border-2 border-[#121316] bg-white shadow-[10px_10px_0_#121316]">
            <Stripe />
            <div className="p-6 sm:p-8">
               <div className="mb-3 flex items-center justify-between">
                  <span
                     className="rounded-full border border-[#121316] px-3 py-1 text-xs font-bold uppercase tracking-wider"
                     style={{ background: C.lime }}
                  >
                     Email check
                  </span>
                  <button type="button" onClick={onClose} className="rounded-lg p-1.5 font-bold hover:bg-neutral-100" aria-label="Close">
                     ✕
                  </button>
               </div>
               <h3 className="mb-2 text-2xl font-bold tracking-tight" style={display}>
                  Check your inbox
               </h3>
               <p className="mb-5 text-sm text-neutral-600">
                  We sent a 6-digit code to <strong className="break-all text-[#121316]">{email}</strong>.
               </p>
               <form onSubmit={verify} className="space-y-4">
                  <input
                     value={code}
                     onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                     inputMode="numeric"
                     autoComplete="one-time-code"
                     placeholder="000000"
                     aria-label="6-digit code"
                     className={`${inputCls} text-center text-2xl font-bold tracking-[0.35em]`}
                     style={display}
                     autoFocus
                  />
                  {msg ? (
                     <p className="text-sm font-semibold" style={{ color: msg.startsWith('New code') ? '#2f7a1f' : C.terracotta }}>
                        {msg}
                     </p>
                  ) : null}
                  <div className="flex items-center justify-between gap-3 pt-1">
                     <button type="button" onClick={resend} className="text-sm font-bold underline" style={{ color: C.cobalt }}>
                        Send a new code
                     </button>
                     <PrimaryBtn type="submit" busy={busy}>
                        Check & send →
                     </PrimaryBtn>
                  </div>
               </form>
            </div>
         </div>
      </div>
   );
}

// ── Done + status ────────────────────────────────────────────────────────────────────────────────────
function Done({ appNumber, onTrack, onAgain }: { appNumber: string; onTrack: () => void; onAgain: () => void }) {
   return (
      <Card stripe={STRIPE_REVERSED}>
         <span
            className="rounded-full border border-[#121316] px-3 py-1 text-xs font-bold uppercase tracking-wider"
            style={{ background: C.lime }}
         >
            Sent
         </span>
         <h2 className="mb-2 mt-4 text-3xl font-bold tracking-tight" style={display}>
            Application sent! 🎉
         </h2>
         <p className="mb-5 text-neutral-700">We emailed you a copy. Our team will look at your profile and email you.</p>
         <div className="mb-6 rounded-2xl border-2 border-[#121316] bg-[#F7F5F0] p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Your application number</p>
            <p className="mt-1 text-3xl font-bold tracking-widest" style={{ ...display, color: C.cobalt }}>
               {appNumber}
            </p>
         </div>
         <div className="flex flex-col gap-3 sm:flex-row">
            <PrimaryBtn type="button" onClick={onTrack}>
               Check my status
            </PrimaryBtn>
            <button
               type="button"
               onClick={onAgain}
               className="rounded-xl border-2 border-[#121316] bg-white px-6 py-3.5 font-bold"
               style={display}
            >
               Send another profile
            </button>
         </div>
      </Card>
   );
}

function StatusResult({ s }: { s: CreatorStatus }) {
   const badge =
      s.status === 'approved'
         ? { text: 'Approved', bg: C.lime, fg: C.ink }
         : s.status === 'rejected'
           ? { text: 'Not approved', bg: C.terracotta, fg: '#fff' }
           : { text: 'We’re looking at it', bg: C.amber, fg: C.ink };
   const when = s.submittedAt
      ? new Date(s.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })
      : null;
   return (
      <div className="mt-6 rounded-2xl border-2 border-[#121316] bg-[#F7F5F0] p-5">
         <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#121316]/20 pb-3">
            <div>
               <p className="text-xs font-semibold text-neutral-500">Application {s.appNumber}</p>
               <h3 className="text-xl font-bold" style={display}>
                  Hi {s.firstName}
               </h3>
            </div>
            <span
               className="rounded-full border border-[#121316] px-3 py-1 text-xs font-bold uppercase"
               style={{ background: badge.bg, color: badge.fg }}
            >
               {badge.text}
            </span>
         </div>
         {when ? <p className="mt-2 text-xs text-neutral-500">Sent {when}</p> : null}
         {s.status === 'pending' ? <p className="mt-3 text-sm text-neutral-700">Our team will email you when we decide.</p> : null}
         {s.status === 'rejected' ? (
            <p className="mt-3 text-sm text-neutral-700">Thank you for applying. We can’t approve your application this time.</p>
         ) : null}
         {s.status === 'approved' ? (
            <div className="mt-4 rounded-xl border-2 border-[#121316] bg-white p-4">
               {s.code ? (
                  <>
                     <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Your code</p>
                     <p className="mb-3 text-2xl font-bold tracking-widest" style={{ ...display, color: C.cobalt }}>
                        {s.code}
                     </p>
                  </>
               ) : null}
               {s.partnerLink ? (
                  <a
                     href={s.partnerLink}
                     className="inline-flex rounded-xl border-2 border-[#121316] bg-[#2541B2] px-5 py-3 font-bold text-white shadow-[3px_3px_0_#121316]"
                     style={display}
                  >
                     Set up my partner account →
                  </a>
               ) : null}
               <p className="mt-3 text-xs text-neutral-600">Already set up? Sign in and open your dashboard at moodeng.app/affiliate.</p>
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
         setMsg('Type your application number and your email.');
         return;
      }
      setBusy(true);
      setMsg(null);
      setResult(null);
      try {
         const s = await fetchCreatorStatus(num, email);
         if (s) setResult(s);
         else setMsg('We can’t find that. Check the number and use the same email you applied with.');
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
      <Card stripe={STRIPE_REVERSED}>
         <h2 className="mb-2 text-2xl font-bold tracking-tight" style={display}>
            Check your status
         </h2>
         <p className="mb-5 text-sm text-neutral-600">
            Use the application number from your email (like <strong>MDG-2026-1234</strong>) and the email you applied with.
         </p>
         <form onSubmit={check} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input
               className={`${inputCls} font-bold uppercase tracking-wider`}
               value={num}
               onChange={(e) => setNum(e.target.value)}
               placeholder="MDG-2026-1234"
               aria-label="Application number"
               style={display}
            />
            <input
               className={inputCls}
               type="email"
               value={email}
               onChange={(e) => setEmail(e.target.value)}
               placeholder="you@email.com"
               aria-label="Email"
            />
            <PrimaryBtn type="submit" busy={busy}>
               Check
            </PrimaryBtn>
         </form>
         {msg ? (
            <p className="mt-4 text-sm font-semibold" style={{ color: C.terracotta }}>
               {msg}
            </p>
         ) : null}
         {result ? <StatusResult s={result} /> : null}
      </Card>
   );
}

export default function CreatorApplyPage() {
   useDisplayFont();
   const [params] = useSearchParams();
   const trackParam = params.get('track') ?? '';
   const [tab, setTab] = useState<'apply' | 'track'>(trackParam ? 'track' : 'apply');
   const [done, setDone] = useState<{ number: string; email: string } | null>(null);
   const [trackSeed, setTrackSeed] = useState({ number: trackParam, email: '' });
   const [formKey, setFormKey] = useState(0);

   useEffect(() => {
      document.title = 'Become a Moodeng Creator Partner';
   }, []);

   const tabBtn = (t: 'apply' | 'track', label: string) => (
      <button
         type="button"
         onClick={() => {
            setTab(t);
            setDone(null);
         }}
         className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${tab === t ? 'bg-[#121316] text-white' : 'text-[#121316] hover:bg-[#F7F5F0]'}`}
         style={display}
      >
         {label}
      </button>
   );

   return (
      <div
         className="relative min-h-screen overflow-x-hidden text-[#121316]"
         style={{
            backgroundColor: C.bg,
            backgroundImage: 'radial-gradient(#12131622 1.25px, transparent 1.25px)',
            backgroundSize: '24px 24px',
            colorScheme: 'light'
         }}
      >
         <BackgroundArt />
         <div className="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-14">
            <nav className="mb-10 flex flex-wrap items-center justify-between gap-3">
               <a href="https://moodeng.app" className="flex items-center gap-2">
                  <span
                     className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#121316] text-lg font-bold text-white shadow-[3px_3px_0_#121316]"
                     style={{ ...display, background: C.cobalt }}
                  >
                     M
                  </span>
                  <span className="text-lg font-bold tracking-tight" style={display}>
                     MOODENG <span className="font-semibold text-neutral-500">Creators</span>
                  </span>
               </a>
               <div className="flex gap-1 rounded-2xl border-2 border-[#121316] bg-white p-1 shadow-[3px_3px_0_#121316]">
                  {tabBtn('apply', 'Apply')}
                  {tabBtn('track', 'Check status')}
               </div>
            </nav>

            <header className="mb-10 grid items-end gap-6 lg:grid-cols-12">
               <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:col-span-8 lg:text-6xl" style={display}>
                  Become a{' '}
                  <span className="relative inline-block">
                     <span className="relative z-10">Moodeng</span>
                     <span className="absolute bottom-1 left-0 h-3.5 w-full" style={{ background: C.lime }} />
                  </span>{' '}
                  Creator Partner.
               </h1>
               <p
                  className="border-l-4 pl-4 text-base leading-relaxed text-neutral-700 lg:col-span-4"
                  style={{ borderColor: C.terracotta }}
               >
                  Share Moodeng with your followers and earn for the friends you bring. Fill in your profile to apply.
               </p>
            </header>

            {tab === 'track' ? (
               <TrackCard key={`${trackSeed.number}|${trackSeed.email}`} initialNumber={trackSeed.number} initialEmail={trackSeed.email} />
            ) : done ? (
               <Done
                  appNumber={done.number}
                  onTrack={() => {
                     setTrackSeed({ number: done.number, email: done.email });
                     setTab('track');
                     setDone(null);
                  }}
                  onAgain={() => {
                     setDone(null);
                     setFormKey((k) => k + 1);
                  }}
               />
            ) : (
               <ApplyForm key={formKey} onDone={(number, email) => setDone({ number, email })} />
            )}

            <footer className="mt-12 flex flex-col items-center justify-between gap-2 border-t-2 border-[#121316]/10 pt-6 text-xs font-semibold text-neutral-500 sm:flex-row">
               <span>© {new Date().getFullYear()} Moodeng Credit</span>
               <span>
                  Questions?{' '}
                  <a href="mailto:support@moodeng.app" className="underline" style={{ color: C.cobalt }}>
                     support@moodeng.app
                  </a>
               </span>
            </footer>
         </div>
      </div>
   );
}
