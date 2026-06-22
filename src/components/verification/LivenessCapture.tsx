import { useCallback, useEffect, useRef, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type LivenessResult = 'APPROVED' | 'DUPLICATE' | 'DECLINED';

type Phase = 'requesting' | 'ready' | 'submitting' | 'error';

// In-app passive-liveness capture. Replaces Didit's hosted liveness page (and its
// trailing "You've been verified!" screen): we grab a selfie with getUserMedia, send
// it to the create-didit-liveness edge function, and hand the resolved status back to
// the parent. No redirect, no polling.
export default function LivenessCapture({
   onResult,
   onCancel
}: {
   onResult: (result: LivenessResult) => void;
   onCancel: () => void;
}) {
   const videoRef = useRef<HTMLVideoElement | null>(null);
   const streamRef = useRef<MediaStream | null>(null);
   const [phase, setPhase] = useState<Phase>('requesting');
   const [errorMessage, setErrorMessage] = useState('');

   const stopStream = useCallback(() => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
   }, []);

   const startCamera = useCallback(async () => {
      setErrorMessage('');
      setPhase('requesting');
      try {
         const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
            audio: false
         });
         streamRef.current = stream;
         if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => undefined);
         }
         setPhase('ready');
      } catch {
         setErrorMessage(
            'We need camera access to confirm you’re a real person. Please allow camera access and try again.'
         );
         setPhase('error');
      }
   }, []);

   useEffect(() => {
      void startCamera();
      return stopStream;
   }, [startCamera, stopStream]);

   const submit = useCallback(async () => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return;
      setPhase('submitting');
      setErrorMessage('');

      // Draw the current frame to a square canvas and export as JPEG.
      const size = Math.min(video.videoWidth, video.videoHeight);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
         setErrorMessage('Something went wrong capturing the photo. Please try again.');
         setPhase('error');
         return;
      }
      ctx.drawImage(
         video,
         (video.videoWidth - size) / 2,
         (video.videoHeight - size) / 2,
         size,
         size,
         0,
         0,
         size,
         size
      );
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

      try {
         const supabase = getSupabaseBrowserClient();
         const { data, error } = await supabase.functions.invoke('create-didit-liveness', {
            body: { image: dataUrl }
         });
         const status = (data as { status?: LivenessResult; error?: string } | null)?.status;
         if (error || !status) {
            const message = (data as { error?: string } | null)?.error;
            throw new Error(message || 'Could not run the liveness check. Please try again.');
         }
         stopStream();
         onResult(status);
      } catch (err) {
         setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
         setPhase('error');
      }
   }, [onResult, stopStream]);

   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f] flex flex-col items-center justify-center max-w-modal mx-auto w-full px-md-4 py-md-5">
         <div className="flex flex-col items-center gap-md-3 text-center w-full">
            <p className="text-md-b3 font-semibold text-md-neutral-700 uppercase tracking-widest">Step 1 of 2</p>
            <div className="flex flex-col gap-md-1">
               <h1 className="text-md-display text-md-heading">Confirm you&rsquo;re a real person</h1>
               <p className="text-md-b1 font-medium text-md-neutral-700">
                  Center your face in the circle, then take the photo. Good, even lighting helps.
               </p>
            </div>

            {/* Circular live preview */}
            <div
               className="relative overflow-hidden rounded-full border-4 border-md-primary-1200 bg-black/5"
               style={{ width: 240, height: 240 }}
            >
               <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
               />
               {phase === 'requesting' ? (
                  <div className="absolute inset-0 flex items-center justify-center text-md-b2 text-md-neutral-700">
                     Starting camera…
                  </div>
               ) : null}
            </div>

            {errorMessage ? (
               <p className="text-md-b2 font-medium text-md-red-700">{errorMessage}</p>
            ) : null}

            {phase === 'error' ? (
               <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="flex items-center justify-center w-full px-md-4 py-md-3 rounded-md-lg bg-md-primary-1200 text-md-b1 font-semibold text-md-neutral-100"
               >
                  Try again
               </button>
            ) : (
               <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={phase !== 'ready'}
                  className="flex items-center justify-center gap-2 w-full px-md-4 py-md-3 rounded-md-lg bg-md-primary-1200 text-md-b1 font-semibold text-md-neutral-100 disabled:opacity-60"
               >
                  {phase === 'submitting' ? (
                     <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Checking…
                     </>
                  ) : (
                     'Take photo'
                  )}
               </button>
            )}

            <button
               type="button"
               onClick={() => { stopStream(); onCancel(); }}
               className="text-md-b2 font-medium text-md-neutral-700 underline underline-offset-2"
            >
               Go back
            </button>
         </div>
      </div>
   );
}
