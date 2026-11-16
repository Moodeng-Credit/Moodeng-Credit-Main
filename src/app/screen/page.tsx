import { useCallback, useEffect, useRef, useState } from 'react';

import { Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';

import { describeBrowser } from '@/lib/attribution';
import { readPreScreening, savePreScreening } from '@/lib/preScreening';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { audioContextCtor, joinChunks, wavBlob, wavFromMediaFile } from '@/lib/wavAudio';
import { CONNECT_HIPPOS, ConnectHero, GhostButton, PrimaryButton, StepTrail } from '@/views/dashboard/components/connectKit';

// moodeng.app/screen/<affiliate code> — the optional pre-screening link affiliates send people before
// they sign up. Name → watch the Moodeng video → record a short video answer to each of 3 questions →
// "Sign up". No sign-in: pre_screening_start() gives this browser a token, the clips upload under it,
// and when the person later signs in on this browser the result is tied to their account
// (lib/preScreening.ts). The AI grade is for the team only and is never shown here.
// Database + switch: supabase/migrations/20261116180000_pre_screening.sql.

export type ScreenStage = 'loading' | 'closed' | 'busy' | 'intro' | 'video' | 'question' | 'sending' | 'done';
export type ScreenQuestion = { id: string; text: string };
export type ScreenPreview = { stage: ScreenStage; question?: number };

type UploadedAnswer = { q: string; video: string | null; audio: string | null; seconds: number };

const MAX_SECONDS = 45;
const MIN_SECONDS = 3;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

const SAMPLE_QUESTIONS: ScreenQuestion[] = [
   { id: 'work', text: 'What is your job, and how much do you earn in a month?' },
   { id: 'purpose', text: 'What will you use your first loan for?' },
   { id: 'repay', text: 'When and how will you pay it back?' }
];

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

// ── The video they watch ────────────────────────────────────────────────────────────────────────────

type YTPlayer = { destroy: () => void };
type YTApi = {
   Player: new (
      el: HTMLElement,
      opts: {
         videoId: string;
         playerVars: Record<string, number | string>;
         events: { onStateChange?: (e: { data: number }) => void; onError?: () => void };
      }
   ) => YTPlayer;
};
type YTWindow = Window & { YT?: YTApi; onYouTubeIframeAPIReady?: () => void };

const loadYouTube = () =>
   new Promise<YTApi>((resolve, reject) => {
      const w = window as YTWindow;
      if (w.YT?.Player) return resolve(w.YT);
      const previous = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
         previous?.();
         if (w.YT) resolve(w.YT);
      };
      if (!document.querySelector('script[data-yt-api]')) {
         const script = document.createElement('script');
         script.src = 'https://www.youtube.com/iframe_api';
         script.dataset.ytApi = '1';
         script.onerror = () => reject(new Error('youtube blocked'));
         document.head.appendChild(script);
      }
      window.setTimeout(() => reject(new Error('youtube timeout')), 12000);
   });

/** The Moodeng-framed player. `onEnded` fires when the video plays to the end; `onBroken` if it can't load. */
function BrandedVideo({ videoId, onEnded, onBroken }: { videoId: string; onEnded: () => void; onBroken: () => void }) {
   const holder = useRef<HTMLDivElement>(null);
   const ended = useRef(onEnded);
   const broken = useRef(onBroken);
   ended.current = onEnded;
   broken.current = onBroken;

   useEffect(() => {
      let player: YTPlayer | null = null;
      let gone = false;
      loadYouTube()
         .then((YT) => {
            if (gone || !holder.current) return;
            const el = document.createElement('div');
            holder.current.appendChild(el);
            player = new YT.Player(el, {
               videoId,
               playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
               events: {
                  onStateChange: (e) => {
                     if (e.data === 0) ended.current();
                  },
                  onError: () => broken.current()
               }
            });
         })
         .catch(() => {
            if (!gone) broken.current();
         });
      return () => {
         gone = true;
         player?.destroy();
      };
   }, [videoId]);

   return (
      <div className="overflow-hidden rounded-[18px] border-2 border-[#7661f9] bg-[#1b1230] shadow-[0_4px_0_#4a35c9]">
         <div className="flex items-center gap-2 bg-[#6b55f7] px-3 py-2">
            <img alt="" className="size-6 rounded-full bg-white object-contain" src="/moodenglogo.png" />
            <span className="text-[14px] font-extrabold tracking-[0.01em] text-white">Moodeng Credit</span>
         </div>
         <div className="aspect-[9/16] max-h-[60vh] w-full [&_iframe]:size-full" ref={holder} />
      </div>
   );
}

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
      let stream: MediaStream;
      try {
         stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 } },
            audio: { echoCancellation: true, noiseSuppression: true }
         });
      } catch {
         // Not allowed here (or no camera): the phone's own camera still works.
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
      const ctx = new Ctor();
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
         setClip({ video, audio: samples.length ? wavBlob(samples, rate) : null, seconds, url: URL.createObjectURL(video) });
         setState('review');
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
   const [videoId, setVideoId] = useState<string | null>(preview ? 'G4hibvp-T9g' : null);
   const [questions, setQuestions] = useState<ScreenQuestion[]>(preview ? SAMPLE_QUESTIONS : []);
   const [index, setIndex] = useState(preview?.question ?? 0);
   const [watched, setWatched] = useState(false);
   const [videoBroken, setVideoBroken] = useState(false);
   const [uploaded, setUploaded] = useState<UploadedAnswer[]>([]);
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
            const res = data as { status?: string; video?: string; questions?: ScreenQuestion[] } | null;
            if (rpcError || res?.status !== 'ready') {
               setStage('closed');
               return;
            }
            setVideoId(res.video ?? null);
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
      const res = data as { status?: string; token?: string; video?: string; questions?: ScreenQuestion[] } | null;
      if (rpcError)
         return setError(/bad_name/.test(rpcError.message) ? 'Please type your name.' : 'Something went wrong. Please try again.');
      if (res?.status === 'busy') return setStage('busy');
      if (res?.status !== 'open' || !res.token) return setStage('closed');
      setToken(res.token);
      savePreScreening(res.token, false);
      setVideoId(res.video ?? null);
      setQuestions(res.questions ?? []);
      setStage(res.video ? 'video' : 'question');
   };

   const finish = async (answers: UploadedAnswer[]) => {
      setStage('sending');
      const { error: rpcError } = await getSupabaseBrowserClient().rpc('pre_screening_submit', {
         p_token: token,
         p_watched: watched,
         p_files: answers
      });
      if (rpcError) {
         setError('Could not send. Check your connection and try again.');
         setStage('question');
         return;
      }
      if (token) savePreScreening(token, true);
      setStage('done');
   };

   const acceptClip = async (clip: Clip) => {
      const question = questions[index];
      if (preview) {
         if (index + 1 < questions.length) setIndex(index + 1);
         else setStage('done');
         return;
      }
      // The last answer is already up (only the final send failed): just send again.
      if (uploaded.some((a) => a.q === question.id)) return void finish(uploaded);
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
      else void finish(next);
   };

   const signUpHref = ref ? `/invite/${encodeURIComponent(ref)}` : '/signup';
   const trail = (current: number) => <StepTrail current={current} steps={['You', 'Watch', 'Answer', 'Done']} />;
   const question = questions[index];
   // The video must play to the end; if YouTube can't load here, don't trap them.
   const canContinue = watched || videoBroken || Boolean(preview);

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
                     subtitle="1 video. 3 quick answers. 3 minutes."
                     title="Say hi to Moodeng!"
                     trail={trail(0)}
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

            {stage === 'video' && videoId ? (
               <div className={card}>
                  <ConnectHero image={CONNECT_HIPPOS.call} title="Watch this first" trail={trail(1)} />
                  <BrandedVideo onBroken={() => setVideoBroken(true)} onEnded={() => setWatched(true)} videoId={videoId} />
                  <PrimaryButton disabled={!canContinue} onClick={() => setStage('question')}>
                     {canContinue ? 'Continue' : 'Watch to the end'}
                  </PrimaryButton>
               </div>
            ) : null}

            {stage === 'question' && question ? (
               <div className={card} key={question.id}>
                  <ConnectHero
                     image={CONNECT_HIPPOS.cashout}
                     subtitle={`Question ${index + 1} of ${questions.length}`}
                     title={question.text}
                     trail={trail(2)}
                  />
                  {error ? <p className={errorClass}>{error}</p> : null}
                  <AnswerRecorder busy={busy} onUse={(clip) => void acceptClip(clip)} />
               </div>
            ) : null}

            {stage === 'sending' ? (
               <div className={card}>
                  <ConnectHero image={CONNECT_HIPPOS.waiting} title="Sending your answers…" trail={trail(3)} />
                  <div className="flex justify-center py-4">
                     <Loader2 className="size-7 animate-spin text-[#7661f9]" />
                  </div>
               </div>
            ) : null}

            {stage === 'done' ? (
               <div className={card}>
                  <ConnectHero image={CONNECT_HIPPOS.approved} subtitle="Now make your account." title="All done! 🎉" trail={trail(4)} />
                  <a className="block" href={signUpHref}>
                     <PrimaryButton>Sign up</PrimaryButton>
                  </a>
               </div>
            ) : null}
         </div>
      </div>
   );
}
