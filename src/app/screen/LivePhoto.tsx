import { useCallback, useEffect, useRef, useState } from 'react';

import { Loader2, SwitchCamera } from 'lucide-react';

import PhotoCheckStory from '@/app/screen/PhotoCheckStory';
import { clock, docHint, GALLERY_MAX_AGE_MS, OLD_FILE_MS, PHOTO_SECONDS, shrinkFile, shrinkImage } from '@/lib/prescreenV2';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { GhostButton, PrimaryButton } from '@/views/dashboard/components/connectKit';

// One job photo on /screen (pre-screening v2). Taken with the camera inside the page (no gallery), within
// 5 minutes of the ask: pre_screening_photo_ask stamps the ask on the server, which marks the photo late
// if it arrives after that. Where the page can't open the camera (some in-app browsers), the phone's
// camera app opens instead; a file older than the ask is turned away as an old photo.

export type PhotoAnswer = {
   photo?: string;
   source?: 'camera' | 'file';
   taken_at?: string;
   file_modified_at?: string;
   alt?: boolean;
   skip?: boolean;
   skip_reason?: string;
};

export type PhotoPreview = 'ready' | 'live' | 'review' | 'expired' | 'tip' | 'checking';
type State = 'asking' | 'ready' | 'starting' | 'live' | 'review' | 'expired' | 'uploading' | 'checked';

const errorClass = 'text-center text-[14px] font-semibold text-[#c2410c]';

export default function LivePhoto({
   token,
   questionId,
   text,
   alt,
   useAlt,
   onUseAlt,
   onDone,
   onExpired,
   preview,
   locale = 'en'
}: {
   token: string | null;
   questionId: string;
   text: string;
   alt?: string;
   /** "Not at work right now?" → the alt ask (the page shows it as the title). */
   useAlt: boolean;
   onUseAlt: () => void;
   onDone: (answer: PhotoAnswer) => void;
   /** Time ran out (true) or they started again (false) — the page swaps in the "time's up" hippo. */
   onExpired?: (expired: boolean) => void;
   preview?: PhotoPreview;
   locale?: string;
}) {
   const [state, setState] = useState<State>(preview === 'tip' ? 'review' : preview === 'checking' ? 'uploading' : (preview ?? 'asking'));
   // The AI's tip on the photo they sent (once per question): retake it, or use it anyway (never blocks).
   const [tip, setTip] = useState<{ hint: string; answer: PhotoAnswer } | null>(
      preview === 'tip'
         ? {
              hint: 'We can’t see you in this photo yet. A photo of you at your farm, or your crops, works great 🙂',
              answer: { source: 'camera' }
           }
         : null
   );
   const [tipped, setTipped] = useState(preview === 'tip');
   const [deadline, setDeadline] = useState<number>(() => Date.now() + PHOTO_SECONDS * 1000);
   const [now, setNow] = useState(Date.now());
   const [askedAt, setAskedAt] = useState<number>(Date.now());
   const [facing, setFacing] = useState<'environment' | 'user'>('environment');
   const [shot, setShot] = useState<{ blob: Blob; url: string; source: 'camera' | 'file'; takenAt: number; fileModified?: number } | null>(
      preview === 'review' || preview === 'tip'
         ? { blob: new Blob(), url: '/hippos/connect/cashout.png', source: 'camera', takenAt: Date.now() }
         : null
   );
   const [error, setError] = useState<string | null>(null);
   const [cameraFailed, setCameraFailed] = useState(false);
   useEffect(() => onExpired?.(state === 'expired'), [state, onExpired]);
   const videoRef = useRef<HTMLVideoElement>(null);
   const streamRef = useRef<MediaStream | null>(null);
   const fileRef = useRef<HTMLInputElement>(null);
   const galleryRef = useRef<HTMLInputElement>(null);

   const stopCamera = useCallback(() => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
   }, []);

   // The clock starts on the server when the ask is shown (and again after "Start again").
   const ask = useCallback(async () => {
      setError(null);
      if (preview || !token) {
         setDeadline(Date.now() + PHOTO_SECONDS * 1000);
         setAskedAt(Date.now());
         setState('ready');
         return;
      }
      setState('asking');
      const { data, error: rpcError } = await getSupabaseBrowserClient().rpc('pre_screening_photo_ask', {
         p_token: token,
         p_q: questionId
      });
      const res = data as { seconds?: number } | null;
      if (rpcError) {
         setError(/too_many/.test(rpcError.message) ? 'Too many tries. Take the photo now.' : 'Could not start. Check your connection.');
         // Still let them take it: the server marks it (no ask time = late).
      }
      setAskedAt(Date.now());
      setDeadline(Date.now() + (res?.seconds ?? PHOTO_SECONDS) * 1000);
      setState('ready');
   }, [preview, token, questionId]);

   useEffect(() => {
      if (!preview) void ask();
      return stopCamera;
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [questionId]);

   useEffect(() => {
      if (preview === 'expired') return;
      const timer = window.setInterval(() => setNow(Date.now()), 500);
      return () => window.clearInterval(timer);
   }, [preview]);

   const left = preview === 'expired' ? 0 : deadline - now;
   useEffect(() => {
      if (left > 0 || preview) return;
      if (state === 'ready' || state === 'live' || state === 'starting') {
         stopCamera();
         setState('expired');
      }
   }, [left, state, preview, stopCamera]);

   const openCamera = async (mode = facing) => {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia || cameraFailed) {
         fileRef.current?.click();
         return;
      }
      setState('starting');
      try {
         stopCamera();
         const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 960 } },
            audio: false
         });
         streamRef.current = stream;
         if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => undefined);
         }
         setState('live');
      } catch {
         // Not allowed here: the phone's own camera still works.
         setCameraFailed(true);
         setState('ready');
         setError('Tap the button again to open your camera.');
      }
   };

   const flip = () => {
      const next = facing === 'environment' ? 'user' : 'environment';
      setFacing(next);
      void openCamera(next);
   };

   const snap = async () => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return;
      const blob = await shrinkImage(video, video.videoWidth, video.videoHeight);
      stopCamera();
      if (!blob) {
         setError('Could not take the photo. Try again.');
         setState('ready');
         return;
      }
      setShot({ blob, url: URL.createObjectURL(blob), source: 'camera', takenAt: Date.now() });
      setState('review');
   };

   const onFile = async (file: File | undefined, fromGallery = false) => {
      if (fileRef.current) fileRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
      if (!file) return;
      setError(null);
      // Camera app: must be new. Gallery: any photo from the last 2 months is fine.
      const oldest = fromGallery ? Date.now() - GALLERY_MAX_AGE_MS : askedAt - OLD_FILE_MS;
      if (file.lastModified && file.lastModified < oldest) {
         setError(
            fromGallery
               ? 'That photo is older than 2 months. Pick a newer one, or take a new one.'
               : 'That photo is old. Please take a new one now.'
         );
         return;
      }
      const blob = await shrinkFile(file);
      if (!blob) {
         setError('Could not open that photo. Try again.');
         return;
      }
      setShot({ blob, url: URL.createObjectURL(blob), source: 'file', takenAt: Date.now(), fileModified: file.lastModified || undefined });
      setState('review');
   };

   const retake = () => {
      if (shot?.url.startsWith('blob:')) URL.revokeObjectURL(shot.url);
      setShot(null);
      setTip(null);
      if (Date.now() >= deadline) return setState('expired');
      void openCamera();
   };

   const use = async () => {
      if (!shot) return;
      if (preview || !token) return onDone({ source: shot.source, alt: useAlt || undefined });
      setState('uploading');
      setError(null);
      const path = `${token}/${questionId}-${crypto.randomUUID()}.jpg`;
      const { error: upError } = await getSupabaseBrowserClient()
         .storage.from('pre-screenings')
         .upload(path, shot.blob, { contentType: 'image/jpeg', upsert: false });
      if (upError) {
         setError('Could not send. Check your connection and try again.');
         setState('review');
         return;
      }
      const answer: PhotoAnswer = {
         photo: path,
         source: shot.source,
         taken_at: new Date(shot.takenAt).toISOString(),
         ...(shot.fileModified ? { file_modified_at: new Date(shot.fileModified).toISOString() } : {}),
         ...(useAlt ? { alt: true } : {})
      };
      // First photo for this question: the AI says what to take instead if it doesn't show what we asked.
      if (!tipped) {
         setTipped(true);
         const hint = await docHint(token, questionId, path, locale, useAlt);
         if (hint) {
            setTip({ hint, answer });
            setState('review');
            return;
         }
      }
      // A short "Looks good!" with the framed photo on the wall, then the next step.
      setState('checked');
      window.setTimeout(() => onDone(answer), 900);
   };

   const ask_ = useAlt && alt ? alt : text;
   const urgent = left < 60_000;

   return (
      <div className="flex flex-col gap-4">
         {state !== 'expired' ? (
            <div
               className={`self-center rounded-full px-3 py-1 text-[14px] font-bold ${urgent ? 'bg-[#fdecea] text-[#c2410c]' : 'bg-[#f4f1fb] text-[#594d65] dark:bg-[#221a31] dark:text-[#d9cfe8]'}`}
            >
               ⏱ {clock(left)} left
            </div>
         ) : null}

         <div
            className={`relative mx-auto w-full max-w-[300px] overflow-hidden rounded-[18px] bg-[#1b1230] ${state === 'live' || state === 'review' || state === 'uploading' || state === 'checked' ? 'aspect-[3/4]' : 'aspect-[16/10]'}`}
         >
            <video
               className={`size-full object-cover ${facing === 'user' ? '-scale-x-100' : ''} ${state === 'live' ? '' : 'hidden'}`}
               muted
               playsInline
               ref={videoRef}
            />
            {state === 'review' && shot ? <img alt="Your photo" className="size-full object-cover" src={shot.url} /> : null}
            {state === 'live' ? (
               <button
                  aria-label="Switch camera"
                  className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-black/55 text-white"
                  onClick={flip}
                  type="button"
               >
                  <SwitchCamera className="size-5" />
               </button>
            ) : null}
            {state === 'asking' || state === 'starting' ? (
               <div className="absolute inset-0 grid place-items-center text-[#cfc6dd]">
                  <Loader2 className="size-8 animate-spin" />
               </div>
            ) : null}
            {state === 'uploading' || state === 'checked' ? <PhotoCheckStory done={state === 'checked'} /> : null}
            {state === 'ready' ? (
               <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-[#cfc6dd]">
                  <span className="text-[44px]">📸</span>
                  <span className="text-[14px] font-semibold">{ask_}</span>
               </div>
            ) : null}
            {state === 'expired' ? (
               <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-[#cfc6dd]">
                  <span className="text-[44px]">⏰</span>
                  <span className="text-[15px] font-bold text-white">Time’s up</span>
                  <span className="text-[13px]">Start again for 5 more minutes, or pick a recent photo.</span>
               </div>
            ) : null}
         </div>

         <input
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
            ref={fileRef}
            type="file"
         />
         <input accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0], true)} ref={galleryRef} type="file" />
         {error ? <p className={errorClass}>{error}</p> : null}
         {tip && state === 'review' ? (
            <div className="rounded-[14px] bg-[#fff6e0] px-4 py-3 text-[15px] leading-[21px] text-[#5a4300] dark:bg-[#2e2512] dark:text-[#f3dfa8]">
               💡 {tip.hint}
            </div>
         ) : null}

         {state === 'ready' || state === 'starting' || state === 'asking' ? (
            <PrimaryButton disabled={state !== 'ready'} onClick={() => void openCamera()}>
               Open camera
            </PrimaryButton>
         ) : null}
         {state === 'live' ? <PrimaryButton onClick={() => void snap()}>Take photo</PrimaryButton> : null}
         {tip && state === 'review' ? (
            <>
               <PrimaryButton onClick={retake}>Try another photo</PrimaryButton>
               <GhostButton onClick={() => onDone(tip.answer)}>Use this one</GhostButton>
            </>
         ) : state === 'review' ? (
            <>
               <PrimaryButton onClick={() => void use()}>Use this photo</PrimaryButton>
               {state === 'review' ? <GhostButton onClick={retake}>Take again</GhostButton> : null}
            </>
         ) : null}
         {state === 'expired' ? <PrimaryButton onClick={() => void ask()}>Start again</PrimaryButton> : null}
         {state === 'ready' || state === 'live' || state === 'expired' ? (
            <GhostButton onClick={() => galleryRef.current?.click()}>Pick a recent photo instead</GhostButton>
         ) : null}
         {state === 'expired' || (cameraFailed && error) ? (
            <button
               className="text-center text-[14px] font-semibold text-[#8a7f99] underline dark:text-[#a89bb8]"
               onClick={() =>
                  onDone({
                     skip: true,
                     skip_reason: state === 'expired' ? 'ran out of time' : 'camera did not open',
                     alt: useAlt || undefined
                  })
               }
               type="button"
            >
               I can’t take this photo
            </button>
         ) : null}
         {alt && !useAlt && (state === 'ready' || state === 'live') ? (
            <button className="text-center text-[14px] font-semibold text-[#7661f9] underline" onClick={onUseAlt} type="button">
               Not at work right now?
            </button>
         ) : null}
      </div>
   );
}
