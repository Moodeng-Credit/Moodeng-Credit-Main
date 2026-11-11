import { type RefObject, useEffect, useState } from 'react';

import jsQR from 'jsqr';

/**
 * Reading a QR on the phone: from a photo / screenshot, or live from the rear camera (jsQR on each frame).
 * Used by /testqr (store QRs) and the Withdraw "cash out with your QR" flow.
 */

/** The QR's text from a photo or screenshot, or null if none is found. */
export const readQrFromImage = (file: File) =>
   new Promise<string | null>((resolve) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
         const canvas = document.createElement('canvas');
         const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
         canvas.width = Math.round(image.width * scale);
         canvas.height = Math.round(image.height * scale);
         const context = canvas.getContext('2d');
         context?.drawImage(image, 0, 0, canvas.width, canvas.height);
         const data = context?.getImageData(0, 0, canvas.width, canvas.height);
         URL.revokeObjectURL(url);
         resolve(data ? (jsQR(data.data, canvas.width, canvas.height)?.data ?? null) : null);
      };
      image.onerror = () => {
         URL.revokeObjectURL(url);
         resolve(null);
      };
      image.src = url;
   });

/** Streams the rear camera into `videoRef` and calls onCode once with the first QR it sees. Returns an error line, if any. */
export function useQrCamera(videoRef: RefObject<HTMLVideoElement | null>, onCode: (text: string) => void) {
   const [error, setError] = useState('');
   useEffect(() => {
      let stream: MediaStream | null = null;
      let frame = 0;
      let stopped = false;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });

      const tick = () => {
         const video = videoRef.current;
         if (stopped || !video || !context) return;
         if (video.readyState >= 2 && video.videoWidth) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0);
            const code = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
            if (code?.data) {
               stopped = true;
               onCode(code.data);
               return;
            }
         }
         frame = requestAnimationFrame(tick);
      };

      navigator.mediaDevices
         ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
         .then((media) => {
            stream = media;
            if (stopped) return media.getTracks().forEach((track) => track.stop());
            if (videoRef.current) {
               videoRef.current.srcObject = media;
               void videoRef.current.play();
            }
            frame = requestAnimationFrame(tick);
         })
         .catch(() => setError('Camera blocked. Allow the camera, or upload a photo of the QR instead.'));

      return () => {
         stopped = true;
         cancelAnimationFrame(frame);
         stream?.getTracks().forEach((track) => track.stop());
      };
   }, [onCode, videoRef]);
   return error;
}

/**
 * The payee name inside a QR Ph / EMVCo payload (tag 59), e.g. "JUAN DELA CRUZ". Only a hint for the
 * screen before Stableyard reads it; null if the text isn't an EMVCo QR.
 */
export function qrPayeeName(payload: string): string | null {
   let i = 0;
   while (i + 4 <= payload.length) {
      const tag = payload.slice(i, i + 2);
      const len = Number(payload.slice(i + 2, i + 4));
      if (!/^\d{2}$/.test(tag) || !Number.isInteger(len)) return null;
      const value = payload.slice(i + 4, i + 4 + len);
      if (value.length !== len) return null;
      if (tag === '59') return value.trim() || null;
      i += 4 + len;
   }
   return null;
}
