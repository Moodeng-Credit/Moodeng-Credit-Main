import { useCallback, useEffect, useRef, useState } from 'react';

import { Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';

import BrandedVideo from '@/components/BrandedVideo';
import { describeBrowser } from '@/lib/attribution';
import { readPreScreening, savePreScreening } from '@/lib/preScreening';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { audioContextCtor, joinChunks, wavBlob, wavFromMediaFile } from '@/lib/wavAudio';
import { CONNECT_HIPPOS, ConnectHero, GhostButton, PrimaryButton, StepTrail } from '@/views/dashboard/components/connectKit';

// moodeng.app/screen/<affiliate code> — the optional pre-screening link affiliates send people before
// they sign up. Name → watch the 3 short Moodeng videos → record a short video answer to each question
// → send about 1 month of proof of income (photos or PDF) → "Sign up". The AI then reviews the answers
// and the document together. No sign-in: pre_screening_start() gives this browser a token, the clips upload under it,
// and when the person later signs in on this browser the result is tied to their account
// (lib/preScreening.ts). The AI grade is for the team only and is never shown here.
// Database + switch: supabase/migrations/20261116180000_pre_screening.sql.

export type ScreenStage = 'loading' | 'closed' | 'busy' | 'intro' | 'video' | 'question' | 'proof' | 'sending' | 'done';
/** kind 'text' = a typed answer; anything else = a short recorded video. */
/** `min` = fewest characters a typed answer needs (default MIN_TEXT; 1 lets "No" through). */
export type ScreenQuestion = { id: string; text: string; hint?: string; kind?: 'text' | 'video'; min?: number };
/** `tall` = a YouTube Short (9:16); otherwise a normal 16:9 video. */
type ScreenVideo = { id: string; title: string; tall?: boolean };
type UploadedDoc = { path: string; name: string; mime: string; size: number };
export type ScreenPreview = { stage: ScreenStage; question?: number };

type UploadedAnswer = { q: string; video: string | null; audio: string | null; seconds: number; text?: string };
// Typed answers: long enough to say something real, short enough to read on the call.
const MIN_TEXT = 15;
const minFor = (q: ScreenQuestion) => Math.max(1, q.min ?? MIN_TEXT);
const MAX_TEXT = 600;

const MAX_SECONDS = 45;
const MIN_SECONDS = 3;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
// Proof of income: what the AI can read (iPhones turn HEIC photos into JPEG for this list).
const DOC_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
const DOC_TYPES = new Set(DOC_ACCEPT.split(','));
const MAX_DOCS = 6;
const MAX_DOC_BYTES = 10 * 1024 * 1024;

const SAMPLE_QUESTIONS: ScreenQuestion[] = [
   { id: 'intro', text: 'Introduce yourself in English.', hint: 'Your full name, age and job. If you are a student, what do you do for work?' },
   { id: 'borrowed', text: 'Have you borrowed before, like Maya, Tala or Salmon?', kind: 'text' },
   { id: 'purpose', text: 'What is this loan for?', kind: 'text' },
   { id: 'grow', text: 'How will you use the loan to build up your income?', kind: 'text' }
];
const SAMPLE_VIDEOS: ScreenVideo[] = [
   { id: 'G4hibvp-T9g', title: 'How to get started (6 simple steps)', tall: true },
   { id: 'SMasdjEpDkg', title: 'How to cash out your loan' },
   { id: 'Eu9JzDMOSmw', title: 'How to repay in 1 minute' }
];

/** The start call's video list; yesterday's database sends one `video` id only. */
const videosOf = (res: { video?: string | null; videos?: ScreenVideo[] | null } | null): ScreenVideo[] =>
   Array.isArray(res?.videos) && res.videos.length ? res.videos.filter((v) => v?.id) : res?.video ? [{ id: res.video, title: '', tall: true }] : [];

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
function AnswerRecorder({ busy, onUse, previewState }: { busy: boolean; onUse: (clip: Clip) => void; previewState?: RecorderState }) {
   const [state, setState] = useState<RecorderState>(previewState ?? 'idle');
   const [clip, setClip] = useState<Clip | null>(null);
   const [left, setLeft] = useState(MAX_SECONDS);
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
         const remaining = MAX_SECONDS - Math.floor((Date.now() - startedAt) / 1000);
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
      setLeft(MAX_SECONDS);
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
                  <span className="text-[14px] font-semibold">Up to {MAX_SECONDS} seconds</span>
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

// ── The page ────────────────────────────────────────────────────────────────────────────────────────

export default function PreScreeningPage({ preview }: { preview?: ScreenPreview }) {
   const { code } = useParams<{ code?: string }>();
   const ref = code ?? new URLSearchParams(window.location.search).get('ref') ?? '';
   const [stage, setStage] = useState<ScreenStage>(preview?.stage ?? 'loading');
   const [name, setName] = useState('');
   const [token, setToken] = useState<string | null>(null);
   const [videos, setVideos] = useState<ScreenVideo[]>(preview ? SAMPLE_VIDEOS : []);
   const [videoIndex, setVideoIndex] = useState(0);
   const [questions, setQuestions] = useState<ScreenQuestion[]>(preview ? SAMPLE_QUESTIONS : []);
   const [index, setIndex] = useState(preview?.question ?? 0);
   // Videos that played to the end / couldn't load here.
   const [watched, setWatched] = useState<Set<string>>(new Set());
   const [broken, setBroken] = useState<Set<string>>(new Set());
   const [uploaded, setUploaded] = useState<UploadedAnswer[]>([]);
   const [docs, setDocs] = useState<File[]>([]);
   const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[] | null>(null);
   // prescreen_config.proof = false: no proof-of-income step here (journey v2 asks for it after sign-up).
   const [askProof, setAskProof] = useState(true);
   const docInput = useRef<HTMLInputElement>(null);
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      if (preview) return;
      if (readPreScreening()?.done) {
         setStage('done');
         return;
      }
      let gone = false;
      void getSupabaseBrowserClient()
         .rpc('pre_screening_start', { p_name: null, p_ref: null, p_browser: null })
         .then(({ data, error: rpcError }) => {
            if (gone) return;
            const res = data as { status?: string; video?: string; videos?: ScreenVideo[]; questions?: ScreenQuestion[]; proof?: boolean } | null;
            if (rpcError || res?.status !== 'ready') {
               setStage('closed');
               return;
            }
            setVideos(videosOf(res));
            setAskProof(res.proof !== false);
            setQuestions(res.questions ?? []);
            setStage('intro');
         });
      return () => {
         gone = true;
      };
   }, [preview]);

   const begin = async () => {
      if (preview) return setStage('video');
      setBusy(true);
      setError(null);
      const { browser, os } = describeBrowser();
      const { data, error: rpcError } = await getSupabaseBrowserClient().rpc('pre_screening_start', {
         p_name: name,
         p_ref: ref || null,
         p_browser: `${browser} · ${os}`
      });
      setBusy(false);
      const res = data as { status?: string; token?: string; video?: string; videos?: ScreenVideo[]; questions?: ScreenQuestion[]; proof?: boolean } | null;
      if (rpcError)
         return setError(/bad_name/.test(rpcError.message) ? 'Please type your name.' : 'Something went wrong. Please try again.');
      if (res?.status === 'busy') return setStage('busy');
      if (res?.status !== 'open' || !res.token) return setStage('closed');
      setToken(res.token);
      savePreScreening(res.token, false);
      const list = videosOf(res);
      setAskProof(res.proof !== false);
      setVideos(list);
      setVideoIndex(0);
      setQuestions(res.questions ?? []);
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
         setError(askProof ? 'Could not send. Check your connection and try again.' : 'Could not send. Check your connection and tap Next again.');
         setStage(askProof ? 'proof' : 'question');
         return;
      }
      if (token) savePreScreening(token, true);
      setStage('done');
   };

   const addDocs = (list: FileList | null) => {
      if (docInput.current) docInput.current.value = '';
      if (!list?.length) return;
      setError(null);
      const picked = Array.from(list);
      const bad = picked.find((f) => !DOC_TYPES.has(f.type));
      const big = picked.find((f) => f.size > MAX_DOC_BYTES);
      if (bad) setError('Please send a photo (JPG or PNG) or a PDF.');
      else if (big) setError('That file is too big. Send a screenshot instead.');
      const good = picked.filter((f) => DOC_TYPES.has(f.type) && f.size <= MAX_DOC_BYTES);
      setDocs((prev) => [...prev, ...good].slice(0, MAX_DOCS));
      setUploadedDocs(null);
   };

   const sendProof = async () => {
      if (preview) return setStage('done');
      // Already up (only the final send failed): just send again.
      if (uploadedDocs) return void finish(uploaded, uploadedDocs);
      setBusy(true);
      setError(null);
      const storage = getSupabaseBrowserClient().storage.from('pre-screenings');
      const done: UploadedDoc[] = [];
      for (const file of docs) {
         const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
         const path = `${token}/income-${crypto.randomUUID()}.${ext}`;
         const { error: upError } = await storage.upload(path, file, { contentType: file.type, upsert: false });
         if (!upError) done.push({ path, name: file.name.slice(0, 200), mime: file.type, size: file.size });
      }
      setBusy(false);
      if (done.length < docs.length) {
         setError('Could not send your files. Check your connection and tap Send again.');
         return;
      }
      setUploadedDocs(done);
      void finish(uploaded, done);
   };

   // Typed answers per question id, kept while they move through the questions.
   const [typed, setTyped] = useState<Record<string, string>>({});

   const nextAfter = (next: UploadedAnswer[]) => {
      if (index + 1 < questions.length) setIndex(index + 1);
      else if (askProof) setStage('proof');
      else void finish(next, []);
   };

   const acceptText = () => {
      const question = questions[index];
      const text = (typed[question.id] ?? '').trim().slice(0, MAX_TEXT);
      if (text.length < minFor(question)) return setError('Please write a little more.');
      setError(null);
      if (preview) return nextAfter(uploaded);
      const next = [...uploaded.filter((a) => a.q !== question.id), { q: question.id, video: null, audio: null, seconds: 0, text }];
      setUploaded(next);
      nextAfter(next);
   };

   const acceptClip = async (clip: Clip) => {
      const question = questions[index];
      if (preview) {
         if (index + 1 < questions.length) setIndex(index + 1);
         else setStage('proof');
         return;
      }
      // The last answer is already up (only the final send failed): on to the proof, or send again.
      if (uploaded.some((a) => a.q === question.id)) return askProof ? setStage('proof') : void finish(uploaded, []);
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
      const next = [...uploaded, answer];
      setUploaded(next);
      if (index + 1 < questions.length) setIndex(index + 1);
      else if (askProof) setStage('proof');
      else void finish(next, []);
   };

   // The token rides on the link too, so the result follows them into another browser.
   const doneToken = token ?? readPreScreening()?.token ?? null;
   const signUpHref = `${ref ? `/invite/${encodeURIComponent(ref)}` : '/signup'}${doneToken ? `?ps=${doneToken}` : ''}`;
   const trailSteps = ['You', ...(videos.length ? ['Watch'] : []), 'Answer', ...(askProof ? ['Income'] : []), 'Done'];
   const trail = (step: string) => <StepTrail current={step === 'end' ? trailSteps.length : Math.max(0, trailSteps.indexOf(step))} steps={trailSteps} />;
   const question = questions[index];
   const video = videos[videoIndex];
   // Each video must play to the end; if YouTube can't load here, don't trap them.
   const canContinue = Boolean(preview) || (video ? watched.has(video.id) || broken.has(video.id) : true);
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

            {stage === 'busy' ? (
               <div className={card}>
                  <ConnectHero image={CONNECT_HIPPOS.waiting} subtitle="Please come back tomorrow." title="We’re full for today" />
               </div>
            ) : null}

            {stage === 'intro' ? (
               <div className={card}>
                  <ConnectHero
                     image={CONNECT_HIPPOS.hello}
                     subtitle={[
                        videos.length ? (videos.length === 1 ? '1 short video' : `${videos.length} short videos`) : null,
                        `${questions.length || 4} quick answers`,
                        askProof ? 'Proof of income' : null
                     ]
                        .filter(Boolean)
                        .join('. ') + '.'}
                     title="Say hi to Moodeng!"
                     trail={trail('You')}
                  />
                  <div>
                     <label className="mb-1.5 block text-[14px] font-bold text-[#594d65] dark:text-[#d9cfe8]" htmlFor="screen-name">
                        Your name
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
                     onBroken={() => setBroken((prev) => new Set(prev).add(video.id))}
                     onEnded={() => setWatched((prev) => new Set(prev).add(video.id))}
                     tall={video.tall ?? false}
                     videoId={video.id}
                  />
                  <PrimaryButton disabled={!canContinue} onClick={nextVideo}>
                     {canContinue ? (videoIndex + 1 < videos.length ? 'Next video' : 'Continue') : 'Watch to the end'}
                  </PrimaryButton>
               </div>
            ) : null}

            {stage === 'question' && question ? (
               <div className={card} key={question.id}>
                  <ConnectHero
                     image={CONNECT_HIPPOS.cashout}
                     subtitle={`Question ${index + 1} of ${questions.length}${question.hint ? ` · ${question.hint}` : ''}`}
                     title={question.text}
                     trail={trail('Answer')}
                  />
                  {error ? <p className={errorClass}>{error}</p> : null}
                  {question.kind === 'text' ? (
                     <>
                        <textarea
                           aria-label="Your answer"
                           className={`${fieldClass} min-h-[140px] resize-none`}
                           maxLength={MAX_TEXT}
                           onChange={(e) => setTyped((prev) => ({ ...prev, [question.id]: e.target.value }))}
                           placeholder={minFor(question) > 3 ? 'Write 1–2 sentences' : 'Type your answer'}
                           value={typed[question.id] ?? ''}
                        />
                        {(() => {
                           const left = minFor(question) - (typed[question.id] ?? '').trim().length;
                           return minFor(question) > 3 && left > 0 && (typed[question.id] ?? '').trim() ? (
                              <p className="text-[14px] text-[#8a7f99] dark:text-[#a89bb8]">A bit more please — 1 or 2 sentences.</p>
                           ) : null;
                        })()}
                        <PrimaryButton disabled={(typed[question.id] ?? '').trim().length < minFor(question)} onClick={acceptText}>
                           Next
                        </PrimaryButton>
                     </>
                  ) : (
                     <AnswerRecorder busy={busy} onUse={(clip) => void acceptClip(clip)} />
                  )}
               </div>
            ) : null}

            {stage === 'proof' ? (
               <div className={card}>
                  <ConnectHero
                     image={CONNECT_HIPPOS.cashout}
                     subtitle="Show us 1 month of your income."
                     title="Last step: proof of income"
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
                  {docs.length ? (
                     <>
                        <PrimaryButton disabled={busy} onClick={() => void sendProof()}>
                           {busy ? <Loader2 aria-label="Sending" className="mx-auto size-5 animate-spin" /> : 'Send'}
                        </PrimaryButton>
                        {busy || docs.length >= MAX_DOCS ? null : <GhostButton onClick={() => docInput.current?.click()}>Add more</GhostButton>}
                     </>
                  ) : (
                     <PrimaryButton onClick={() => docInput.current?.click()}>Add my proof</PrimaryButton>
                  )}
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
                  <ConnectHero image={CONNECT_HIPPOS.approved} subtitle="Now make your account." title="All done! 🎉" trail={trail('end')} />
                  <a className="block" href={signUpHref}>
                     <PrimaryButton>Sign up</PrimaryButton>
                  </a>
               </div>
            ) : null}
         </div>
      </div>
   );
}
