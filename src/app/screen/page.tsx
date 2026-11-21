import { useCallback, useEffect, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';

import BrandedVideo from '@/components/BrandedVideo';

import { fetchPrescreenPath, PRE_KYC_CONNECT_PATH } from '@/hooks/usePreKycGate';

import HippoStory from '@/app/screen/HippoStory';
import LivePhoto, { type PhotoAnswer, type PhotoPreview } from '@/app/screen/LivePhoto';
import MedicalBodyMap from '@/app/screen/MedicalBodyMap';
import { useLocalization } from '@/i18n/LocalizationProvider';
import { trackPrescreenStep } from '@/lib/analytics/prescreenSteps';
import { describeBrowser } from '@/lib/attribution';
import { EMPTY_MEDICAL, medicalAnswerText, type MedicalPick } from '@/lib/medicalPick';
import {
   isPersonalInviteCode,
   joinPrescreenPath,
   markPrescreenPath,
   parkTeamCode,
   readPreScreening,
   savePreScreening
} from '@/lib/preScreening';
import {
   coachHint,
   docHint,
   MEDICAL_CHOICES,
   type MedicalChoice,
   minutesLeft,
   planJobQuestions,
   PRESCREEN_CAPS,
   prescreenHippo,
   saidNo
} from '@/lib/prescreenV2';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { audioContextCtor, joinChunks, wavBlob, wavFromMediaFile } from '@/lib/wavAudio';
import type { RootState } from '@/store/store';
import { CONNECT_HIPPOS, ConnectHero, GhostButton, PrimaryButton, StepTrail } from '@/views/dashboard/components/connectKit';

// moodeng.app/screen/<affiliate code> — the optional pre-screening link affiliates send people before
// they sign up. Name → watch the 3 short Moodeng videos → record a short video answer to each question
// → send about 1 month of proof of income (photos or PDF) → "Sign up". The AI then reviews the answers
// and the document together. No sign-in: pre_screening_start() gives this browser a token, the clips upload under it,
// and when the person later signs in on this browser the result is tied to their account
// (lib/preScreening.ts). The AI grade is for the team only and is never shown here.
// Database + switch: supabase/migrations/20261116180000_pre_screening.sql.

// signup / facebook / waiting / good / notneeded: the after-sign-up path (migration 20261118090000) —
// make the account and connect Facebook first, then answer, then wait for the team's ✅.
export type ScreenStage =
   | 'loading'
   | 'closed'
   | 'busy'
   | 'signup'
   | 'facebook'
   | 'intro'
   | 'video'
   | 'question'
   | 'proof'
   | 'sending'
   | 'done'
   | 'waiting'
   | 'good'
   | 'notneeded';
/** kind 'text' = a typed answer; none / 'video' = a short recorded video. */
/** `min` = fewest characters a typed answer needs (default MIN_TEXT; 1 lets "No" through). */
/**
 * v2 (lib/prescreenV2.ts): 'job' = typed job, then the AI's follow-ups are added after it; 'photo' = a
 * live job photo (`alt` = what to take when not at work); 'doc' = the certificate of employment
 * (`optional`); 'medical' = typed "no" or what it is, + what the loan is for.
 */
export type ScreenQuestion = {
   id: string;
   text: string;
   hint?: string;
   kind?: 'text' | 'video' | 'job' | 'medical' | 'photo' | 'doc';
   min?: number;
   alt?: string;
   optional?: boolean;
};
/** `tall` = a YouTube Short (9:16); otherwise a normal 16:9 video. */
type ScreenVideo = { id: string; title: string; tall?: boolean };
type UploadedDoc = { path: string; name: string; mime: string; size: number };
export type ScreenPreview = { stage: ScreenStage; question?: number; photo?: PhotoPreview; coach?: boolean; med?: boolean };

type UploadedAnswer = PhotoAnswer & {
   q: string;
   video: string | null;
   audio: string | null;
   seconds: number;
   text?: string;
   // v2: the first try + the hint shown, the medical choice, the certificate.
   first?: string;
   coach?: string;
   choice?: MedicalChoice;
   doc?: string;
   doc_mime?: string;
};
type Coached = { first: string; hint: string };
// Typed answers: long enough to say something real, short enough to read on the call.
const MIN_TEXT = 15;
const minFor = (q: ScreenQuestion) => Math.max(1, q.min ?? MIN_TEXT);
const MAX_TEXT = 600;

const MAX_SECONDS = 45;
// The live clip at the job step: short, so it stays small for the AI.
const JOB_VIDEO_SECONDS = 15;
const MIN_SECONDS = 3;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
// Proof of income: what the AI can read (iPhones turn HEIC photos into JPEG for this list).
const DOC_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
const DOC_TYPES = new Set(DOC_ACCEPT.split(','));
const MAX_DOCS = 6;
const MAX_DOC_BYTES = 10 * 1024 * 1024;

const SAMPLE_QUESTIONS: ScreenQuestion[] = [
   {
      id: 'intro',
      text: 'Introduce yourself in English.',
      hint: 'Your full name, age and job. If you are a student, what do you do for work?'
   },
   { id: 'borrowed', text: 'Have you borrowed before, like Maya, Tala or Salmon?', kind: 'text' },
   { id: 'purpose', text: 'What is this loan for?', kind: 'text' },
   { id: 'grow', text: 'How will you use the loan to build up your income?', kind: 'text' }
];
// /screen-preview?stage=question&q=4…10 shows the v2 steps (photo=ready|live|review|expired, coach=1, med=1).
// coach=1 also shows the AI's tip on the work permit step.
const SAMPLE_V2: ScreenQuestion[] = [
   { id: 'job', kind: 'job', text: 'What is your job?', hint: 'Like farmer, teacher, Grab driver, sari-sari store', min: 3 },
   { id: 'job_q1', kind: 'text', text: 'What do you farm?', hint: 'Like rice, corn, vegetables, pigs', min: 3 },
   { id: 'job_photo1', kind: 'photo', text: 'Take a photo of you at your farm', alt: 'Not at the farm now? A photo of your farm tools' },
   { id: 'job_video', text: 'Show us your work', hint: '10 seconds: say your job, then show your work place, tools or uniform.' },
   {
      id: 'coe',
      kind: 'doc',
      text: 'Do you have a certificate of employment?',
      hint: 'Optional. A photo or PDF of your COE.',
      optional: true
   },
   {
      id: 'work_permit',
      kind: 'doc',
      text: 'Send a photo of your work permit or visa',
      hint: 'The page with your name and the end date.',
      optional: true
   },
   { id: 'medical', kind: 'medical', text: 'Do you or your family have a medical problem?', hint: 'Type “no”, or what it is', min: 2 }
];
const SAMPLE_VIDEOS: ScreenVideo[] = [
   { id: 'G4hibvp-T9g', title: 'How to get started (6 simple steps)', tall: true },
   { id: 'SMasdjEpDkg', title: 'How to cash out your loan' },
   { id: 'Eu9JzDMOSmw', title: 'How to repay in 1 minute' }
];

/** The start call's video list; yesterday's database sends one `video` id only. */
const videosOf = (res: { video?: string | null; videos?: ScreenVideo[] | null } | null): ScreenVideo[] =>
   Array.isArray(res?.videos) && res.videos.length
      ? res.videos.filter((v) => v?.id)
      : res?.video
        ? [{ id: res.video, title: '', tall: true }]
        : [];

// Progress on this browser, so a reload (Facebook's browser drops pages when they switch apps to find a
// screenshot) picks up where they were instead of starting over. Same token; kept for 20 hours.
const PROGRESS_KEY = 'md_prescreen_progress';
type SavedProgress = {
   token: string;
   at: number;
   stage: 'question' | 'proof';
   index: number;
   questions: ScreenQuestion[];
   askProof: boolean;
   typed: Record<string, string>;
   uploaded: UploadedAnswer[];
   uploadedDocs: UploadedDoc[] | null;
   v2?: boolean;
   coached?: Record<string, Coached>;
   choices?: Record<string, MedicalChoice>;
   plannedFor?: string | null;
};
const readProgress = (token: string | undefined): SavedProgress | null => {
   try {
      const saved = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? 'null') as SavedProgress | null;
      return saved && token && saved.token === token && Date.now() - saved.at < 20 * 3_600_000 && saved.questions?.length ? saved : null;
   } catch {
      return null;
   }
};
const writeProgress = (progress: SavedProgress | null) => {
   try {
      if (progress) window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
      else window.localStorage.removeItem(PROGRESS_KEY);
   } catch {
      // Storage blocked: a reload starts over, as before.
   }
};

const card = 'flex flex-col gap-4 rounded-[20px] bg-white px-5 py-5 dark:bg-dv2-card';
const fieldClass =
   'w-full rounded-[12px] border-2 border-[#e2dcee] bg-white px-3 py-2.5 text-[16px] text-[#3b2f4a] placeholder:text-[#b3a9c2] focus:border-[#7661f9] focus:outline-none dark:border-[#3a2d4f] dark:bg-[#1b1526] dark:text-[#f5f0ff]';
const errorClass = 'text-center text-[14px] font-semibold text-[#c2410c]';

const pickRecorderType = () => {
   if (typeof MediaRecorder === 'undefined') return null;
   return ['video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
};

const baseType = (type: string) => type.split(';')[0].trim().toLowerCase();
const extensionFor = (type: string) => (type === 'video/webm' ? 'webm' : type === 'video/quicktime' ? 'mov' : 'mp4');

// ── Recording one answer ────────────────────────────────────────────────────────────────────────────

type Clip = { video: Blob | null; audio: Blob | null; seconds: number; url: string | null };
type RecorderState = 'idle' | 'starting' | 'recording' | 'review';

/**
 * One question: Record → Stop → watch it back → Next (or record again). Records in the page when the
 * browser allows it; otherwise (some in-app browsers) the same button opens the phone's own camera.
 */
function AnswerRecorder({
   busy,
   onUse,
   previewState,
   maxSeconds = MAX_SECONDS
}: {
   busy: boolean;
   onUse: (clip: Clip) => void;
   previewState?: RecorderState;
   maxSeconds?: number;
}) {
   const [state, setState] = useState<RecorderState>(previewState ?? 'idle');
   const [clip, setClip] = useState<Clip | null>(null);
   const [left, setLeft] = useState(maxSeconds);
   const [error, setError] = useState<string | null>(null);
   const [useCameraApp, setUseCameraApp] = useState(false);
   const liveRef = useRef<HTMLVideoElement>(null);
   const fileRef = useRef<HTMLInputElement>(null);
   // The recording in progress: finish() keeps the clip, cancel() throws it away (leaving the page).
   const session = useRef<{ finish: () => void; cancel: () => void } | null>(null);

   const dropClip = useCallback(() => {
      setClip((old) => {
         if (old?.url) URL.revokeObjectURL(old.url);
         return null;
      });
   }, []);

   useEffect(
      () => () => {
         session.current?.cancel();
      },
      []
   );

   const start = async () => {
      setError(null);
      dropClip();
      const type = pickRecorderType();
      const Ctor = audioContextCtor();
      if (useCameraApp || !type || !Ctor || !navigator.mediaDevices?.getUserMedia) {
         setUseCameraApp(true);
         fileRef.current?.click();
         return;
      }
      setState('starting');
      // Made inside the tap, before anything is awaited: phones only let sound start from a tap.
      const ctx = new Ctor();
      void ctx.resume().catch(() => undefined);
      let stream: MediaStream;
      try {
         stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 } },
            audio: { echoCancellation: true, noiseSuppression: true }
         });
      } catch {
         // Not allowed here (or no camera): the phone's own camera still works.
         void ctx.close().catch(() => undefined);
         setUseCameraApp(true);
         setState('idle');
         setError('Tap Record again to open your camera.');
         return;
      }
      if (liveRef.current) {
         liveRef.current.srcObject = stream;
         void liveRef.current.play().catch(() => undefined);
      }

      // The sound, straight from the microphone, for the speech-to-text.
      const source = ctx.createMediaStreamSource(stream);
      const tap = ctx.createScriptProcessor(4096, 1, 1);
      const silent = ctx.createGain();
      silent.gain.value = 0;
      const chunks: Float32Array[] = [];
      tap.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      source.connect(tap);
      tap.connect(silent);
      silent.connect(ctx.destination);

      const parts: Blob[] = [];
      const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 500_000, audioBitsPerSecond: 32_000 });
      recorder.ondataavailable = (e) => {
         if (e.data.size) parts.push(e.data);
      };
      const startedAt = Date.now();
      const timer = window.setInterval(() => {
         const remaining = maxSeconds - Math.floor((Date.now() - startedAt) / 1000);
         setLeft(Math.max(0, remaining));
         if (remaining <= 0 && recorder.state === 'recording') recorder.stop();
      }, 250);
      let cancelled = false;
      recorder.onstop = () => {
         window.clearInterval(timer);
         stream.getTracks().forEach((t) => t.stop());
         tap.disconnect();
         source.disconnect();
         const rate = ctx.sampleRate;
         void ctx.close().catch(() => undefined);
         session.current = null;
         if (cancelled) return;
         const seconds = (Date.now() - startedAt) / 1000;
         if (seconds < MIN_SECONDS) {
            setError('Too short. Please answer the question.');
            setState('idle');
            return;
         }
         if (liveRef.current) liveRef.current.srcObject = null;
         const video = new Blob(parts, { type: baseType(type) });
         const samples = joinChunks(chunks);
         const url = URL.createObjectURL(video);
         // No sound, or only silence, came through the microphone tap: read it out of the clip instead.
         const heard = samples.some((v) => Math.abs(v) > 0.002);
         if (heard) {
            setClip({ video, audio: wavBlob(samples, rate), seconds, url });
            setState('review');
            return;
         }
         setState('starting');
         void wavFromMediaFile(video).then((sound) => {
            setClip({ video, audio: sound?.wav ?? null, seconds, url });
            setState('review');
         });
      };
      const end = () => {
         if (recorder.state !== 'inactive') recorder.stop();
      };
      session.current = {
         finish: end,
         cancel: () => {
            cancelled = true;
            end();
         }
      };
      setLeft(maxSeconds);
      recorder.start(1000);
      setState('recording');
   };

   const stop = () => {
      if (liveRef.current) liveRef.current.srcObject = null;
      session.current?.finish();
   };

   const onFile = async (file: File | undefined) => {
      if (fileRef.current) fileRef.current.value = '';
      if (!file) return;
      setState('starting');
      const sound = await wavFromMediaFile(file);
      const type = baseType(file.type);
      const video = VIDEO_TYPES.includes(type) && file.size <= MAX_VIDEO_BYTES ? file : null;
      if (!sound && !video) {
         setError('That clip is too big. Keep it under 20 seconds and try again.');
         setState('idle');
         return;
      }
      if (sound && sound.seconds < MIN_SECONDS) {
         setError('Too short. Please answer the question.');
         setState('idle');
         return;
      }
      setClip({ video, audio: sound?.wav ?? null, seconds: sound?.seconds ?? 0, url: URL.createObjectURL(file) });
      setState('review');
   };

   return (
      <div className="flex flex-col gap-4">
         <div className="relative mx-auto aspect-[3/4] w-full max-w-[300px] overflow-hidden rounded-[18px] bg-[#1b1230]">
            {state === 'review' && clip?.url ? (
               <video className="size-full object-cover" controls playsInline src={clip.url} />
            ) : (
               <video
                  className={`size-full -scale-x-100 object-cover ${state === 'recording' ? '' : 'opacity-0'}`}
                  muted
                  playsInline
                  ref={liveRef}
               />
            )}
            {state === 'idle' || state === 'starting' ? (
               <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#cfc6dd]">
                  {state === 'starting' ? <Loader2 className="size-8 animate-spin" /> : <span className="text-[44px]">🎥</span>}
                  <span className="text-[14px] font-semibold">Up to {maxSeconds} seconds</span>
               </div>
            ) : null}
            {state === 'recording' ? (
               <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[13px] font-bold text-white">
                  <span className="size-2.5 animate-pulse rounded-full bg-red-500" />
                  {left}s
               </div>
            ) : null}
         </div>

         <input
            accept="video/*"
            capture="user"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
            ref={fileRef}
            type="file"
         />
         {error ? <p className={errorClass}>{error}</p> : null}

         {state === 'idle' || state === 'starting' ? (
            <PrimaryButton disabled={state === 'starting'} onClick={() => void start()}>
               Record my answer
            </PrimaryButton>
         ) : null}
         {state === 'recording' ? (
            <PrimaryButton className="!bg-[#e5484d] !shadow-[0_4px_0_#b3261e]" onClick={stop}>
               Stop
            </PrimaryButton>
         ) : null}
         {state === 'review' ? (
            <>
               <PrimaryButton disabled={busy || !clip} onClick={() => clip && onUse(clip)}>
                  {busy ? <Loader2 aria-label="Sending" className="mx-auto size-5 animate-spin" /> : 'Next'}
               </PrimaryButton>
               {busy ? null : (
                  <GhostButton
                     onClick={() => {
                        dropClip();
                        setState('idle');
                     }}
                  >
                     Record again
                  </GhostButton>
               )}
            </>
         ) : null}
      </div>
   );
}

/**
 * pre_screening_start, saying the page can show v2. A database without the v2 migration has no p_caps
 * argument: ask again without it, so this page never closes pre-screening there.
 */
const startRpc = async (args: { p_name: string | null; p_ref: string | null; p_browser: string | null }) => {
   const client = getSupabaseBrowserClient();
   const first = await client.rpc('pre_screening_start', { ...args, p_caps: PRESCREEN_CAPS });
   if (first.error && /PGRST202|p_caps|pre_screening_start|function/i.test(`${first.error.code ?? ''} ${first.error.message}`)) {
      return client.rpc('pre_screening_start', args);
   }
   return first;
};

// ── The page ────────────────────────────────────────────────────────────────────────────────────────

export default function PreScreeningPage({ preview }: { preview?: ScreenPreview }) {
   const { code } = useParams<{ code?: string }>();
   const ref = code ?? new URLSearchParams(window.location.search).get('ref') ?? '';
   const [stage, setStage] = useState<ScreenStage>(preview?.stage ?? 'loading');
   const [name, setName] = useState('');
   const [token, setToken] = useState<string | null>(null);
   const [videos, setVideos] = useState<ScreenVideo[]>(preview ? SAMPLE_VIDEOS : []);
   const [videoIndex, setVideoIndex] = useState(0);
   const [questions, setQuestions] = useState<ScreenQuestion[]>(preview ? [...SAMPLE_QUESTIONS, ...SAMPLE_V2] : []);
   const [index, setIndex] = useState(preview?.question ?? 0);
   // Videos that played to the end (counted for the team; nobody has to finish one).
   const [watched, setWatched] = useState<Set<string>>(new Set());
   const [uploaded, setUploaded] = useState<UploadedAnswer[]>([]);
   const [docs, setDocs] = useState<File[]>([]);
   const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[] | null>(null);
   // prescreen_config.proof = false: no proof-of-income step here (journey v2 asks for it after sign-up).
   const [askProof, setAskProof] = useState(true);
   const docInput = useRef<HTMLInputElement>(null);
   const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState<string | null>(null);
   // Typed answers per question id, kept while they move through the questions (and saved, see PROGRESS_KEY).
   const [typed, setTyped] = useState<Record<string, string>>(
      preview?.coach ? { purpose: 'For my bills this month' } : preview?.med ? { medical: 'My mother has diabetes' } : {}
   );
   // v2 (lib/prescreenV2.ts): the server added the job + medical questions to this one.
   const [v2, setV2] = useState(Boolean(preview));
   // The one hint each typed answer can get, with the first try (both are sent).
   const [coached, setCoached] = useState<Record<string, Coached>>(
      preview?.coach
         ? { purpose: { first: 'For my bills this month', hint: 'Tell us which bills, like electricity or rent, so we understand.' } }
         : {}
   );
   const [choices, setChoices] = useState<Record<string, MedicalChoice>>({});
   // v2 medical as the tap-the-hippo game; it writes the same plain answer into `typed`.
   const [medPick, setMedPick] = useState<MedicalPick>(
      preview?.med
         ? {
              ...EMPTY_MEDICAL,
              who: 'family',
              relation: 'Mother',
              parts: ['Inside the body'],
              conditions: ['Inside the body: Diabetes / sugar'],
              since: 'A year or more',
              doctor: 'Sometimes',
              medicine: 'Yes, every month',
              future: 'monthly',
              futureAmount: '₱1,000–3,000',
              payer: 'Me'
           }
         : EMPTY_MEDICAL
   );
   // The job the follow-ups were made for (same job after Back = no new questions).
   const [plannedFor, setPlannedFor] = useState<string | null>(preview ? 'farmer' : null);
   const [useAlt, setUseAlt] = useState<Record<string, boolean>>({});
   // LivePhoto reports "time's up" so the hero can show the alarm-clock hippo.
   const [photoExpired, setPhotoExpired] = useState<Record<string, boolean>>({});
   const markPhotoExpired = useCallback(
      (id: string, expired: boolean) => setPhotoExpired((prev) => (Boolean(prev[id]) === expired ? prev : { ...prev, [id]: expired })),
      []
   );
   const [coeFile, setCoeFile] = useState<File | null>(null);
   // The AI's tip on an uploaded document (once per question): they send a different one or go on anyway.
   const [docTip, setDocTip] = useState<Record<string, { path: string; mime: string; hint: string }>>(
      preview?.coach
         ? {
              work_permit: {
                 path: '',
                 mime: 'image/jpeg',
                 hint: 'This permit ended in September 2026. Please send your new permit, with the end date showing.'
              }
           }
         : {}
   );
   const coeInput = useRef<HTMLInputElement>(null);
   const { locale } = useLocalization();

   useEffect(() => {
      if (preview || !token) return;
      if (stage === 'done') return writeProgress(null);
      if (stage !== 'question' && stage !== 'proof') return;
      writeProgress({
         token,
         at: Date.now(),
         stage,
         index,
         questions,
         askProof,
         typed,
         uploaded,
         uploadedDocs,
         v2,
         coached,
         choices,
         plannedFor
      });
   }, [preview, token, stage, index, questions, askProof, typed, uploaded, uploadedDocs, v2, coached, choices, plannedFor]);

   // One analytics event per screen they reach, so we see which step people stop at.
   const stepKey = stage === 'question' ? `q:${questions[index]?.id ?? index}` : stage;
   useEffect(() => {
      if (preview || stage === 'loading') return;
      const q = stage === 'question' ? questions[index] : undefined;
      trackPrescreenStep(stepKey, {
         v2,
         index,
         of: questions.length,
         kind: q?.kind ?? null,
         category: (questions.find((x) => x.kind === 'job') as { category?: string } | undefined)?.category ?? null
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps -- once per screen
   }, [stepKey]);

   const authUser = useSelector((state: RootState) => state.auth.user);
   const isAuthChecked = useSelector((state: RootState) => state.auth.isAuthChecked);
   const queryClient = useQueryClient();
   const signedIn = Boolean(authUser?.id);
   // The job they already gave at loan request (users.profession) fills in "What is your job?" once.
   // Only a starting value: empty or wrong, they just type, nothing waits on it.
   const jobPrefilled = useRef(false);
   useEffect(() => {
      const q = stage === 'question' ? questions[index] : undefined;
      const saved = authUser?.profession?.trim();
      if (jobPrefilled.current || !q || q.kind !== 'job' || !saved) return;
      jobPrefilled.current = true;
      setTyped((prev) => (prev[q.id]?.trim() ? prev : { ...prev, [q.id]: saved.slice(0, 80) }));
   }, [stage, index, questions, authUser?.profession]);

   useEffect(() => {
      if (preview || !isAuthChecked) return;
      // Account + Facebook come first now: someone signed out makes their account, then comes back.
      if (!authUser?.id) {
         markPrescreenPath();
         if (ref) parkTeamCode(ref);
         setStage('signup');
         return;
      }
      let gone = false;
      void (async () => {
         markPrescreenPath();
         await joinPrescreenPath();
         const path = await fetchPrescreenPath();
         if (gone) return;
         if (!path.on_path || path.decision === 'not_fit') return setStage('notneeded');
         if (path.decision === 'good') return setStage('good');
         if (path.status && path.status !== 'none' && path.status !== 'open') return setStage('waiting');
         if (!authUser.hasVerifiedContact) return setStage('facebook');
         setName((current) => current || authUser.displayName || '');
         startForm();
      })();
      return () => {
         gone = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [preview, isAuthChecked, authUser?.id, authUser?.hasVerifiedContact]);

   // The questions: resume this browser's progress, or load them to start.
   const startForm = () => {
      const saved = readPreScreening();
      const progress = readProgress(saved?.token);
      if (progress) {
         setToken(progress.token);
         setQuestions(progress.questions);
         setAskProof(progress.askProof);
         setTyped(progress.typed ?? {});
         setUploaded(progress.uploaded ?? []);
         setUploadedDocs(progress.uploadedDocs ?? null);
         setV2(progress.v2 === true);
         setCoached(progress.coached ?? {});
         setChoices(progress.choices ?? {});
         setPlannedFor(progress.plannedFor ?? null);
         setIndex(Math.min(progress.index, progress.questions.length - 1));
         setStage(progress.stage);
         return;
      }
      void startRpc({ p_name: null, p_ref: null, p_browser: null }).then(({ data, error: rpcError }) => {
         const res = data as {
            status?: string;
            video?: string;
            videos?: ScreenVideo[];
            questions?: ScreenQuestion[];
            proof?: boolean;
            v2?: boolean;
         } | null;
         if (rpcError || res?.status !== 'ready') {
            setStage('closed');
            return;
         }
         setVideos(videosOf(res));
         setAskProof(res.proof !== false);
         setQuestions(res.questions ?? []);
         setV2(res.v2 === true);
         setStage('intro');
      });
   };

   const begin = async () => {
      if (preview) return setStage('video');
      setBusy(true);
      setError(null);
      const { browser, os } = describeBrowser();
      const { data, error: rpcError } = await startRpc({ p_name: name, p_ref: ref || null, p_browser: `${browser} · ${os}` });
      setBusy(false);
      const res = data as {
         status?: string;
         token?: string;
         video?: string;
         videos?: ScreenVideo[];
         questions?: ScreenQuestion[];
         proof?: boolean;
         v2?: boolean;
      } | null;
      if (rpcError)
         return setError(/bad_name/.test(rpcError.message) ? 'Please type your name.' : 'Something went wrong. Please try again.');
      if (res?.status === 'busy') return setStage('busy');
      if (res?.status === 'sent') return setStage('waiting');
      if (res?.status !== 'open' || !res.token) return setStage('closed');
      setToken(res.token);
      savePreScreening(res.token, false);
      const list = videosOf(res);
      setAskProof(res.proof !== false);
      setVideos(list);
      setVideoIndex(0);
      setQuestions(res.questions ?? []);
      setV2(res.v2 === true);
      setStage(list.length ? 'video' : 'question');
   };

   const finish = async (answers: UploadedAnswer[], proof: UploadedDoc[]) => {
      setStage('sending');
      const { error: rpcError } = await getSupabaseBrowserClient().rpc('pre_screening_submit', {
         p_token: token,
         p_watched: videos.every((v) => watched.has(v.id)),
         p_files: answers,
         p_docs: proof,
         p_videos: videos.filter((v) => watched.has(v.id)).length
      });
      if (rpcError) {
         setError(
            askProof ? 'Could not send. Check your connection and try again.' : 'Could not send. Check your connection and tap Next again.'
         );
         setStage(askProof ? 'proof' : 'question');
         return;
      }
      if (token) savePreScreening(token, true);
      void queryClient.invalidateQueries({ queryKey: ['prescreen-path'] });
      setStage(signedIn ? 'waiting' : 'done');
   };

   const addDocs = (list: FileList | null) => {
      // Copy the files out BEFORE clearing the input: the FileList is live, and clearing the input
      // empties it — every pick was silently dropped (George's test, 2026-11-17).
      const picked = list ? Array.from(list) : [];
      if (docInput.current) docInput.current.value = '';
      if (!picked.length) return;
      setError(null);
      const bad = picked.find((f) => !DOC_TYPES.has(f.type));
      const big = picked.find((f) => f.size > MAX_DOC_BYTES);
      if (bad) setError('Please send a photo (JPG or PNG) or a PDF.');
      else if (big) setError('That file is too big. Send a screenshot instead.');
      const good = picked.filter((f) => DOC_TYPES.has(f.type) && f.size <= MAX_DOC_BYTES);
      setDocs((prev) => [...prev, ...good].slice(0, MAX_DOCS));
      setUploadedDocs(null);
   };

   // v2: the proof of income sits between the job and the medical question.
   const afterProof = (docsUp: UploadedDoc[]) => {
      if (questions[index]?.kind === 'medical') return setStage('question');
      void finish(uploaded, docsUp);
   };

   const sendProof = async () => {
      if (preview) return questions[index]?.kind === 'medical' ? setStage('question') : setStage('done');
      // Already up (only the final send failed, or they came Back from the medical question): carry on.
      if (uploadedDocs) return afterProof(uploadedDocs);
      setBusy(true);
      setError(null);
      const storage = getSupabaseBrowserClient().storage.from('pre-screenings');
      const done: UploadedDoc[] = [];
      setUploadProgress({ done: 0, total: docs.length });
      for (const file of docs) {
         const ext =
            file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
         const path = `${token}/income-${crypto.randomUUID()}.${ext}`;
         const { error: upError } = await storage.upload(path, file, { contentType: file.type, upsert: false });
         if (!upError) done.push({ path, name: file.name.slice(0, 200), mime: file.type, size: file.size });
         setUploadProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev));
      }
      setBusy(false);
      setUploadProgress(null);
      if (done.length < docs.length) {
         setError('Could not send your files. Check your connection and tap Send again.');
         return;
      }
      setUploadedDocs(done);
      afterProof(done);
   };

   const goBack = () => {
      setError(null);
      if (stage === 'proof') {
         // v2: proof comes before the medical question, so Back goes to the job step before it.
         if (questions[index]?.kind === 'medical' && index > 0) setIndex(index - 1);
         return setStage('question');
      }
      if (questions[index]?.kind === 'medical' && askProof) return setStage('proof');
      if (index > 0) setIndex(index - 1);
   };
   const backButton = <GhostButton onClick={goBack}>Back</GhostButton>;

   const nextAfter = (next: UploadedAnswer[], list: ScreenQuestion[] = questions) => {
      const i = index + 1;
      if (i < list.length) {
         setIndex(i);
         // v2: job first, then income, then the medical question.
         if (askProof && list[i].kind === 'medical' && !uploadedDocs) setStage('proof');
         return;
      }
      if (askProof && !uploadedDocs) setStage('proof');
      else void finish(next, uploadedDocs ?? []);
   };

   const save = (answer: UploadedAnswer) => {
      const next = [...uploaded.filter((a) => a.q !== answer.q), answer];
      setUploaded(next);
      return next;
   };
   const blank = (q: string): UploadedAnswer => ({ q, video: null, audio: null, seconds: 0 });

   // v2 coaching: typed answers that aren't yes/no (and a medical answer that isn't "no").
   const wantsCoach = (q: ScreenQuestion, text: string) =>
      v2 && ((q.kind === 'text' && minFor(q) > 1) || (q.kind === 'medical' && !saidNo(text)));

   const acceptText = async () => {
      const question = questions[index];
      const text = (typed[question.id] ?? '').trim().slice(0, MAX_TEXT);
      if (text.length < minFor(question)) return setError('Please write a little more.');
      const choice = choices[question.id];
      if (question.kind === 'medical' && !saidNo(text) && !choice) return setError('Please pick one.');
      setError(null);
      if (preview) return nextAfter(uploaded);
      // One gentle hint, once: they can improve it or keep it.
      if (token && wantsCoach(question, text) && !coached[question.id]) {
         setBusy(true);
         const hint = await coachHint(token, question.id, text, locale);
         setBusy(false);
         if (hint) return setCoached((prev) => ({ ...prev, [question.id]: { first: text, hint } }));
      }
      const tip = coached[question.id];
      nextAfter(
         save({
            ...blank(question.id),
            text,
            ...(tip ? { first: tip.first, coach: tip.hint } : {}),
            ...(question.kind === 'medical' ? { choice: saidNo(text) ? 'none' : choice } : {})
         })
      );
   };

   // v2: the job → the AI's follow-ups and photo asks, written into this pre-screening by the server.
   const acceptJob = async () => {
      const question = questions[index];
      const job = (typed[question.id] ?? '').trim().slice(0, 80);
      if (job.length < minFor(question)) return setError('Please write your job.');
      setError(null);
      if (preview) return nextAfter(uploaded);
      let list = questions;
      let kept = uploaded;
      if (plannedFor !== job.toLowerCase() || !questions.some((q) => /^job_q/.test(q.id))) {
         if (!token) return;
         setBusy(true);
         const planned = await planJobQuestions(token, job, locale);
         setBusy(false);
         if (!planned) return setError('Could not load the next step. Check your connection and tap Next again.');
         list = planned as ScreenQuestion[];
         setQuestions(list);
         setPlannedFor(job.toLowerCase());
         // Answers to the old follow-ups don't fit the new job.
         kept = uploaded.filter((a) => list.some((q) => q.id === a.q) && !/^job_|^coe$|^work_permit$/.test(a.q));
      }
      const next = [...kept.filter((a) => a.q !== question.id), { ...blank(question.id), text: job }];
      setUploaded(next);
      nextAfter(next, list);
   };

   const acceptPhoto = (answer: PhotoAnswer) => {
      const question = questions[index];
      if (preview) return nextAfter(uploaded);
      nextAfter(save({ ...blank(question.id), ...answer }));
   };

   const sendCoe = async (skip: boolean) => {
      const question = questions[index];
      setError(null);
      if (preview) return nextAfter(uploaded);
      if (skip || !coeFile || !token) {
         setCoeFile(null);
         return nextAfter(save({ ...blank(question.id), skip: true }));
      }
      setBusy(true);
      const type = coeFile.type;
      const ext = type === 'application/pdf' ? 'pdf' : type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${token}/${question.id}-${crypto.randomUUID()}.${ext}`;
      const { error: upError } = await getSupabaseBrowserClient()
         .storage.from('pre-screenings')
         .upload(path, coeFile, { contentType: type, upsert: false });
      if (upError) {
         setBusy(false);
         return setError('Could not send. Check your connection and try again.');
      }
      // First upload for this question: the AI says what to send instead if it doesn't fit (never blocks).
      if (v2 && !docTip[question.id]) {
         const hint = await docHint(token, question.id, path, locale);
         if (hint) {
            setBusy(false);
            setDocTip((prev) => ({ ...prev, [question.id]: { path, mime: type, hint } }));
            setCoeFile(null);
            return;
         }
      }
      setBusy(false);
      nextAfter(save({ ...blank(question.id), doc: path, doc_mime: type }));
   };

   /** After the AI's tip: keep the document they already sent. */
   const keepTippedDoc = () => {
      const question = questions[index];
      const tip = docTip[question.id];
      if (!tip) return;
      nextAfter(save({ ...blank(question.id), doc: tip.path, doc_mime: tip.mime }));
   };

   const acceptClip = async (clip: Clip) => {
      const question = questions[index];
      if (preview) return nextAfter(uploaded);
      setBusy(true);
      setError(null);
      const storage = getSupabaseBrowserClient().storage.from('pre-screenings');
      const stamp = crypto.randomUUID();
      const answer: UploadedAnswer = { q: question.id, video: null, audio: null, seconds: Math.round(clip.seconds) };
      if (clip.audio) {
         const path = `${token}/${question.id}-${stamp}.wav`;
         const { error: upError } = await storage.upload(path, clip.audio, { contentType: 'audio/wav', upsert: false });
         if (!upError) answer.audio = path;
      }
      if (clip.video && clip.video.size <= MAX_VIDEO_BYTES) {
         const type = baseType(clip.video.type);
         const path = `${token}/${question.id}-${stamp}.${extensionFor(type)}`;
         const { error: upError } = await storage.upload(path, clip.video, { contentType: type, upsert: false });
         if (!upError) answer.video = path;
      }
      setBusy(false);
      if (!answer.audio && !answer.video) {
         setError('Could not send. Check your connection and tap Next again.');
         return;
      }
      // Recorded again after going Back: the new one replaces the old.
      nextAfter(save(answer));
   };

   // The token rides on the link too, so the result follows them into another browser.
   const doneToken = token ?? readPreScreening()?.token ?? null;
   // Personal invite code → its invite page; a team code (MAHJID, IRISH…) → plain sign-up, and the code is
   // attached after sign-up (parkTeamCode).
   const signUpBase = ref && isPersonalInviteCode(ref) ? `/invite/${encodeURIComponent(ref.toUpperCase())}` : '/sign-up';
   const signUpHref = `${signUpBase}${doneToken ? `?ps=${doneToken}` : ''}`;
   const trailSteps = [
      'You',
      ...(videos.length ? ['Watch'] : []),
      'Answer',
      ...(v2 ? ['Job'] : []),
      ...(askProof ? ['Income'] : []),
      ...(v2 ? ['Health'] : []),
      'Done'
   ];
   const stepOf = (q: ScreenQuestion | undefined) =>
      !v2 || !q
         ? 'Answer'
         : q.kind === 'medical'
           ? 'Health'
           : q.kind === 'job' || q.kind === 'photo' || q.kind === 'doc' || /^job_|^coe$|^work_permit$/.test(q.id)
             ? 'Job'
             : 'Answer';
   const trail = (step: string) => (
      <StepTrail current={step === 'end' ? trailSteps.length : Math.max(0, trailSteps.indexOf(step))} steps={trailSteps} />
   );
   const question = questions[index];
   const video = videos[videoIndex];
   const nextVideo = () => {
      if (videoIndex + 1 < videos.length) setVideoIndex(videoIndex + 1);
      else setStage('question');
   };

   return (
      <div className="min-h-screen bg-dv2-page">
         <div className="mx-auto flex max-w-[440px] flex-col gap-4 px-4 pb-16 pt-4">
            <div className="flex items-center justify-center gap-2">
               <img alt="" className="size-7 rounded-full object-contain" src="/moodenglogo.png" />
               <span className="text-[16px] font-extrabold text-[#3b2f4a] dark:text-[#f5f0ff]">Moodeng Credit</span>
            </div>

            {stage === 'loading' ? (
               <div className="flex justify-center py-16">
                  <Loader2 className="size-7 animate-spin text-[#7661f9]" />
               </div>
            ) : null}

            {stage === 'closed' ? (
               <div className={card}>
                  <ConnectHero image={CONNECT_HIPPOS.waiting} subtitle="You can still sign up." title="This link is closed" />
                  <a className="block" href={signUpHref}>
                     <PrimaryButton>Sign up</PrimaryButton>
                  </a>
               </div>
            ) : null}

            {stage === 'signup' ? (
               <div className={card}>
                  <ConnectHero
                     image={CONNECT_HIPPOS.hello}
                     subtitle="Then connect Facebook and answer a few quick questions. About 5 minutes."
                     title="First, make your Moodeng account"
                  />
                  <a className="block" href={`${signUpBase}?prescreen=1`}>
                     <PrimaryButton>Make my account</PrimaryButton>
                  </a>
                  <a className="block" href="/sign-in?prescreen=1">
                     <GhostButton>I already have an account</GhostButton>
                  </a>
               </div>
            ) : null}

            {stage === 'facebook' ? (
               <div className={card}>
                  <ConnectHero
                     image={CONNECT_HIPPOS.hello}
                     subtitle="So the team can message you about your answers."
                     title="Connect Facebook first"
                  />
                  <a className="block" href={PRE_KYC_CONNECT_PATH}>
                     <PrimaryButton>Connect Facebook</PrimaryButton>
                  </a>
               </div>
            ) : null}

            {stage === 'waiting' ? (
               <div className={card}>
                  <ConnectHero
                     image={CONNECT_HIPPOS.waiting}
                     subtitle="We’ll message you on Messenger, usually within a day. You don’t need to do anything until then."
                     title="Thanks! The team is looking at your answers"
                  />
                  <a className="block" href="/dashboard">
                     <GhostButton>Look around meanwhile</GhostButton>
                  </a>
               </div>
            ) : null}

            {stage === 'good' ? (
               <div className={card}>
                  <ConnectHero image={CONNECT_HIPPOS.approved} subtitle="The team says you can keep going." title="Good news! 🎉" />
                  <a className="block" href={PRE_KYC_CONNECT_PATH}>
                     <PrimaryButton>Keep going</PrimaryButton>
                  </a>
               </div>
            ) : null}

            {stage === 'notneeded' ? (
               <div className={card}>
                  <ConnectHero image={CONNECT_HIPPOS.hello} subtitle="There’s nothing to do on this page." title="You’re all set here" />
                  <a className="block" href="/dashboard">
                     <PrimaryButton>Go to Moodeng</PrimaryButton>
                  </a>
               </div>
            ) : null}

            {stage === 'busy' ? (
               <div className={card}>
                  <ConnectHero image={CONNECT_HIPPOS.waiting} subtitle="Please come back tomorrow." title="We’re full for today" />
               </div>
            ) : null}

            {stage === 'intro' ? (
               <div className={card}>
                  <ConnectHero
                     image={CONNECT_HIPPOS.hello}
                     subtitle="About 5 minutes. It helps the team get to know you before you apply."
                     title="Say hi to Moodeng!"
                     trail={trail('You')}
                  />
                  <ul className="flex flex-col gap-1.5 text-[15px] text-[#594d65] dark:text-[#d9cfe8]">
                     {videos.length ? <li>▶️ Watch {videos.length === 1 ? '1 short video' : `${videos.length} short videos`}</li> : null}
                     {questions.some((q) => q.kind === 'text') ? (
                        <li>✍️ Answer {questions.filter((q) => q.kind === 'text').length} quick questions</li>
                     ) : null}
                     {questions.some((q) => q.kind !== 'text') ? <li>🤳 Record a short video of yourself (camera needed)</li> : null}
                     {v2 ? <li>💼 Show us your job with your camera</li> : null}
                     {askProof ? <li>📄 Send 1 month of proof of income</li> : null}
                     {v2 ? <li>🩺 One health question</li> : null}
                  </ul>
                  <div>
                     <label className="mb-1.5 block text-[14px] font-bold text-[#594d65] dark:text-[#d9cfe8]" htmlFor="screen-name">
                        Your full name
                     </label>
                     <input
                        autoComplete="name"
                        className={fieldClass}
                        id="screen-name"
                        maxLength={80}
                        onChange={(e) => setName(e.target.value)}
                        value={name}
                     />
                  </div>
                  {error ? <p className={errorClass}>{error}</p> : null}
                  <PrimaryButton disabled={busy || name.trim().length < 2} onClick={() => void begin()}>
                     {busy ? <Loader2 aria-label="Starting" className="mx-auto size-5 animate-spin" /> : 'Start'}
                  </PrimaryButton>
               </div>
            ) : null}

            {stage === 'video' && video ? (
               <div className={card} key={video.id}>
                  <ConnectHero
                     image={CONNECT_HIPPOS.call}
                     subtitle={videos.length > 1 ? `Video ${videoIndex + 1} of ${videos.length}` : undefined}
                     title={video.title || 'Watch this first'}
                     trail={trail('Watch')}
                  />
                  <BrandedVideo
                     onEnded={() => setWatched((prev) => new Set(prev).add(video.id))}
                     tall={video.tall ?? false}
                     videoId={video.id}
                  />
                  <PrimaryButton onClick={nextVideo}>{videoIndex + 1 < videos.length ? 'Next video' : 'Continue'}</PrimaryButton>
               </div>
            ) : null}

            {stage === 'question' && question ? (
               <div className={card} key={question.id}>
                  <ConnectHero
                     image={prescreenHippo(question, { expired: Boolean(photoExpired[question.id]) })}
                     subtitle={
                        question.kind === 'photo'
                           ? 'Take it now, or pick a photo from the last 2 months.'
                           : `Question ${index + 1} of ${questions.length}${v2 && question.kind === 'medical' ? ' · Just tap to answer' : question.hint && question.kind !== 'video' && question.kind ? ` · ${question.hint}` : ''}`
                     }
                     title={question.kind === 'photo' && useAlt[question.id] && question.alt ? question.alt : question.text}
                     trail={trail(stepOf(question))}
                  />
                  {v2 && question.kind !== 'photo' ? (
                     <p className="-mt-1 text-center text-[13px] font-semibold text-[#8a7f99] dark:text-[#a89bb8]">
                        ⏱ About {minutesLeft(questions, index, askProof && !uploadedDocs)} min left
                     </p>
                  ) : null}
                  {error ? <p className={errorClass}>{error}</p> : null}
                  {question.kind === 'text' || question.kind === 'medical' ? (
                     <>
                        {v2 && question.kind === 'medical' ? (
                           <MedicalBodyMap
                              onChange={(next) => {
                                 setMedPick(next);
                                 setTyped((prev) => ({ ...prev, [question.id]: medicalAnswerText(next) }));
                              }}
                              value={medPick}
                           />
                        ) : (
                           <textarea
                              aria-label="Your answer"
                              className={`${fieldClass} ${question.kind === 'medical' ? 'min-h-[96px]' : 'min-h-[140px]'} resize-none`}
                              maxLength={MAX_TEXT}
                              onChange={(e) => setTyped((prev) => ({ ...prev, [question.id]: e.target.value }))}
                              placeholder={
                                 question.kind === 'medical'
                                    ? 'Type “no”, or what it is'
                                    : minFor(question) > 3
                                      ? 'Write 1–2 sentences'
                                      : 'Type your answer'
                              }
                              value={typed[question.id] ?? ''}
                           />
                        )}
                        {(() => {
                           const left = minFor(question) - (typed[question.id] ?? '').trim().length;
                           return minFor(question) > 3 && left > 0 && (typed[question.id] ?? '').trim() ? (
                              <p className="text-[14px] text-[#8a7f99] dark:text-[#a89bb8]">A bit more please — 1 or 2 sentences.</p>
                           ) : null;
                        })()}
                        {question.kind === 'medical' && (typed[question.id] ?? '').trim().length >= 2 && !saidNo(typed[question.id]) ? (
                           <div className="flex flex-col gap-2" role="radiogroup" aria-label="Is this loan for it?">
                              <p className="text-[15px] font-bold text-[#3b2f4a] dark:text-[#f5f0ff]">Is this loan for it?</p>
                              {MEDICAL_CHOICES.map((c) => {
                                 const picked = (choices[question.id] ?? (preview?.med && c.id === 'ongoing' ? 'ongoing' : null)) === c.id;
                                 return (
                                    <button
                                       aria-checked={picked}
                                       className={`rounded-[14px] border-2 px-4 py-3 text-left text-[15px] font-semibold ${
                                          picked
                                             ? 'border-[#7661f9] bg-[#f4f1fb] text-[#3b2f4a] dark:bg-[#2a2140] dark:text-[#f5f0ff]'
                                             : 'border-[#e2dcee] bg-white text-[#594d65] dark:border-[#3a2d4f] dark:bg-[#1b1526] dark:text-[#d9cfe8]'
                                       }`}
                                       key={c.id}
                                       onClick={() => setChoices((prev) => ({ ...prev, [question.id]: c.id }))}
                                       role="radio"
                                       type="button"
                                    >
                                       {c.label}
                                    </button>
                                 );
                              })}
                           </div>
                        ) : null}
                        {coached[question.id] ? (
                           <div className="rounded-[14px] bg-[#fff6e0] px-4 py-3 text-[15px] leading-[21px] text-[#5c4300] dark:bg-[#3a2f12] dark:text-[#ffe6a3]">
                              💡 {coached[question.id].hint}
                              <span className="mt-1 block text-[13px] opacity-80">Add it above, then tap Next.</span>
                           </div>
                        ) : null}
                        <PrimaryButton
                           disabled={busy || (typed[question.id] ?? '').trim().length < minFor(question)}
                           onClick={() => void acceptText()}
                        >
                           {busy ? <Loader2 aria-label="Checking" className="mx-auto size-5 animate-spin" /> : 'Next'}
                        </PrimaryButton>
                        {index > 0 && !busy ? backButton : null}
                     </>
                  ) : question.kind === 'job' ? (
                     <>
                        <input
                           aria-label="Your job"
                           autoComplete="organization-title"
                           className={fieldClass}
                           maxLength={80}
                           onChange={(e) => setTyped((prev) => ({ ...prev, [question.id]: e.target.value }))}
                           placeholder="Your job"
                           value={typed[question.id] ?? ''}
                        />
                        <PrimaryButton
                           disabled={busy || (typed[question.id] ?? '').trim().length < minFor(question)}
                           onClick={() => void acceptJob()}
                        >
                           {busy ? (
                              <span className="flex items-center justify-center gap-2">
                                 <Loader2 aria-hidden className="size-5 animate-spin" />
                                 Getting your next questions…
                              </span>
                           ) : (
                              'Next'
                           )}
                        </PrimaryButton>
                        {index > 0 && !busy ? backButton : null}
                     </>
                  ) : question.kind === 'photo' ? (
                     <>
                        <LivePhoto
                           alt={question.alt}
                           onDone={acceptPhoto}
                           onUseAlt={() => setUseAlt((prev) => ({ ...prev, [question.id]: true }))}
                           onExpired={(expired) => markPhotoExpired(question.id, expired)}
                           preview={preview?.photo ?? (preview ? 'ready' : undefined)}
                           locale={locale}
                           questionId={question.id}
                           text={question.text}
                           token={token}
                           useAlt={Boolean(useAlt[question.id])}
                        />
                        {index > 0 ? backButton : null}
                     </>
                  ) : question.kind === 'doc' ? (
                     <>
                        <input
                           accept={DOC_ACCEPT}
                           className="hidden"
                           onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (coeInput.current) coeInput.current.value = '';
                              if (!file) return;
                              if (!DOC_TYPES.has(file.type)) return setError('Please send a photo (JPG or PNG) or a PDF.');
                              if (file.size > MAX_DOC_BYTES) return setError('That file is too big. Send a photo instead.');
                              setError(null);
                              setCoeFile(file);
                           }}
                           ref={coeInput}
                           type="file"
                        />
                        {coeFile ? (
                           <div className="flex items-center gap-2 rounded-[12px] bg-[#f4f1fb] px-3 py-2 text-[14px] text-[#3b2f4a] dark:bg-[#1b1526] dark:text-[#f5f0ff]">
                              <span>{coeFile.type === 'application/pdf' ? '📄' : '🖼️'}</span>
                              <span className="min-w-0 flex-1 truncate">{coeFile.name}</span>
                              {busy ? null : (
                                 <button
                                    aria-label="Remove"
                                    className="px-1 text-[16px] font-bold text-[#8a7f99]"
                                    onClick={() => setCoeFile(null)}
                                    type="button"
                                 >
                                    ✕
                                 </button>
                              )}
                           </div>
                        ) : null}
                        {busy ? (
                           <div className="rounded-[16px] bg-[#f4f1fb] px-4 py-4 dark:bg-[#221a31]">
                              <HippoStory kind="doc" tone="light" />
                           </div>
                        ) : null}
                        {docTip[question.id] && !coeFile ? (
                           <div className="rounded-[14px] bg-[#fff6e0] px-4 py-3 text-[15px] leading-[21px] text-[#5a4300] dark:bg-[#2e2512] dark:text-[#f3dfa8]">
                              💡 {docTip[question.id].hint}
                           </div>
                        ) : null}
                        {coeFile ? (
                           <PrimaryButton disabled={busy} onClick={() => void sendCoe(false)}>
                              {busy ? (
                                 <Loader2 aria-label="Sending" className="mx-auto size-5 animate-spin" />
                              ) : question.id === 'work_permit' ? (
                                 'Send my permit'
                              ) : (
                                 'Send my COE'
                              )}
                           </PrimaryButton>
                        ) : (
                           <PrimaryButton onClick={() => coeInput.current?.click()}>
                              {docTip[question.id]
                                 ? 'Send a different one'
                                 : question.id === 'work_permit'
                                   ? 'Add my work permit'
                                   : 'Add my COE'}
                           </PrimaryButton>
                        )}
                        {busy ? null : docTip[question.id] && !coeFile ? (
                           <GhostButton onClick={keepTippedDoc}>Continue with the one I sent</GhostButton>
                        ) : (
                           <GhostButton onClick={() => void sendCoe(true)}>I don’t have one</GhostButton>
                        )}
                     </>
                  ) : (
                     <>
                        {/* 3) What to say, big and plain — the hint alone was easy to miss. */}
                        {question.hint ? (
                           <div className="rounded-[14px] bg-[#f4f1fb] px-4 py-3 text-[15px] leading-[21px] text-[#3b2f4a] dark:bg-[#221a31] dark:text-[#f5f0ff]">
                              <b>Say:</b> {question.hint}
                              <span className="mt-1 block text-[13px] text-[#8a7f99] dark:text-[#a89bb8]">
                                 Look at the camera. Tap Allow if your phone asks.
                              </span>
                           </div>
                        ) : null}
                        <AnswerRecorder
                           busy={busy}
                           maxSeconds={question.id === 'job_video' ? JOB_VIDEO_SECONDS : MAX_SECONDS}
                           onUse={(clip) => void acceptClip(clip)}
                        />
                        {index > 0 && !busy ? backButton : null}
                     </>
                  )}
               </div>
            ) : null}

            {stage === 'proof' ? (
               <div className={card}>
                  <ConnectHero
                     image={prescreenHippo(null)}
                     subtitle="Show us 1 month of your income."
                     title={v2 ? 'Now: proof of income' : 'Last step: proof of income'}
                     trail={trail('Income')}
                  />
                  <ul className="flex flex-col gap-1.5 text-[15px] text-[#594d65] dark:text-[#d9cfe8]">
                     <li>📱 GCash, Maya or bank history (last 30 days)</li>
                     <li>🧾 or your payslip</li>
                     <li>🛵 or your earnings screen (Grab, Shopee, Upwork…)</li>
                  </ul>
                  <p className="text-[14px] text-[#8a7f99] dark:text-[#a89bb8]">Screenshots or PDF. Up to {MAX_DOCS} files.</p>
                  <input
                     accept={DOC_ACCEPT}
                     className="hidden"
                     multiple
                     onChange={(e) => addDocs(e.target.files)}
                     ref={docInput}
                     type="file"
                  />
                  {docs.length ? (
                     <ul className="flex flex-col gap-2">
                        {docs.map((file, i) => (
                           <li
                              className="flex items-center gap-2 rounded-[12px] bg-[#f4f1fb] px-3 py-2 text-[14px] text-[#3b2f4a] dark:bg-[#1b1526] dark:text-[#f5f0ff]"
                              key={`${file.name}-${i}`}
                           >
                              <span>{file.type === 'application/pdf' ? '📄' : '🖼️'}</span>
                              <span className="min-w-0 flex-1 truncate">{file.name}</span>
                              {busy ? null : (
                                 <button
                                    aria-label={`Remove ${file.name}`}
                                    className="px-1 text-[16px] font-bold text-[#8a7f99]"
                                    onClick={() => {
                                       setDocs((prev) => prev.filter((_, j) => j !== i));
                                       setUploadedDocs(null);
                                    }}
                                    type="button"
                                 >
                                    ✕
                                 </button>
                              )}
                           </li>
                        ))}
                     </ul>
                  ) : null}
                  {error ? <p className={errorClass}>{error}</p> : null}
                  {busy && docs.length ? (
                     <div className="rounded-[16px] bg-[#f4f1fb] px-4 py-4 dark:bg-[#221a31]">
                        <HippoStory
                           caption={
                              uploadProgress && uploadProgress.total > 1
                                 ? `Uploading ${Math.min(uploadProgress.done + 1, uploadProgress.total)} of ${uploadProgress.total}…`
                                 : undefined
                           }
                           kind="doc"
                           tone="light"
                        />
                     </div>
                  ) : null}
                  {docs.length ? (
                     <>
                        <PrimaryButton disabled={busy} onClick={() => void sendProof()}>
                           {busy ? (
                              <span className="flex items-center justify-center gap-2">
                                 <Loader2 aria-hidden className="size-5 animate-spin" />
                                 {uploadProgress
                                    ? `Uploading ${Math.min(uploadProgress.done + 1, uploadProgress.total)} of ${uploadProgress.total}…`
                                    : 'Sending…'}
                              </span>
                           ) : (
                              `Send ${docs.length} file${docs.length === 1 ? '' : 's'}`
                           )}
                        </PrimaryButton>
                        {busy || docs.length >= MAX_DOCS ? null : (
                           <GhostButton onClick={() => docInput.current?.click()}>Add more</GhostButton>
                        )}
                     </>
                  ) : uploadedDocs?.length ? (
                     <>
                        <p className="text-center text-[15px] font-semibold text-[#2f7a3a] dark:text-[#8fe0a0]">
                           ✓ {uploadedDocs.length} file{uploadedDocs.length === 1 ? '' : 's'} sent
                        </p>
                        <PrimaryButton onClick={() => void sendProof()}>Next</PrimaryButton>
                     </>
                  ) : (
                     <PrimaryButton onClick={() => docInput.current?.click()}>Add my proof</PrimaryButton>
                  )}
                  {busy ? null : backButton}
               </div>
            ) : null}

            {stage === 'sending' ? (
               <div className={card}>
                  <ConnectHero image={CONNECT_HIPPOS.waiting} title="Sending your answers…" trail={trail('Done')} />
                  <div className="flex justify-center py-4">
                     <Loader2 className="size-7 animate-spin text-[#7661f9]" />
                  </div>
               </div>
            ) : null}

            {stage === 'done' ? (
               <div className={card}>
                  <ConnectHero
                     image={CONNECT_HIPPOS.approved}
                     subtitle="The team will look at your answers. Make your account now so we can reach you."
                     title="All done! 🎉"
                     trail={trail('end')}
                  />
                  <a className="block" href={signUpHref}>
                     <PrimaryButton>Sign up</PrimaryButton>
                  </a>
               </div>
            ) : null}
         </div>
      </div>
   );
}
