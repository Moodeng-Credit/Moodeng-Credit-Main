'use client';

import { useEffect, useState } from 'react';

import { type AdminCallFace, getAdminCallFaces } from '@/app/admin/adminSupabase';

// The borrower's face for the host: sign-in profile picture, the pre-screening intro video and the
// photos they took there. Used on the Calls list, the call sheet and the account page.

const FACE_REFRESH_MS = 26 * 60_000;

/** Faces for these people. Quiet on failure: the page just shows initials. */
export function useCallFaces(userIds: string[]): Record<string, AdminCallFace> {
   const [faces, setFaces] = useState<Record<string, AdminCallFace>>({});
   const key = [...new Set(userIds)].sort().join(',');
   // Storage links last an hour: ask again before they run out, so a tab left open keeps its pictures.
   const [round, setRound] = useState(0);
   useEffect(() => {
      const timer = window.setInterval(() => setRound((n) => n + 1), FACE_REFRESH_MS);
      return () => window.clearInterval(timer);
   }, []);
   useEffect(() => {
      if (!key) return;
      let cancelled = false;
      void getAdminCallFaces(key.split(','))
         .then((next) => {
            if (!cancelled) setFaces((prev) => ({ ...prev, ...next }));
         })
         .catch(() => undefined);
      return () => {
         cancelled = true;
      };
   }, [key, round]);
   return faces;
}

const SIZES = { sm: 'h-10 w-10 text-base', md: 'h-14 w-14 text-xl', lg: 'h-24 w-24 text-4xl' } as const;

/** Round face: a still from their intro video, else their profile picture, else their initial. */
export function FaceThumb({ face, name, size = 'sm' }: { face?: AdminCallFace | null; name: string; size?: keyof typeof SIZES }) {
   const [avatarBroken, setAvatarBroken] = useState(false);
   const box = `${SIZES[size]} shrink-0 overflow-hidden rounded-full border-2 border-[color:var(--ct-pill,#8336f0)] bg-[var(--ct-soft,#2a1453)]`;
   // Their own intro video first: sign-in pictures are often a blank letter circle or someone else.
   if (face?.clip) {
      // #t=0.5 makes the browser show a frame half a second in instead of a black first frame.
      return <video src={`${face.clip}#t=0.5`} muted playsInline preload="metadata" tabIndex={-1} aria-hidden="true" className={`${box} object-cover`} />;
   }
   if (face?.avatar && !avatarBroken) {
      return <img src={face.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setAvatarBroken(true)} className={`${box} object-cover`} />;
   }
   return (
      <span aria-hidden="true" className={`${box} grid place-items-center font-black text-[color:var(--ct-ink,#fff)]`}>
         {(name.trim().charAt(0) || '?').toUpperCase()}
      </span>
   );
}

/** Everything we have of them, side by side: profile picture, intro video (plays here), photos. Nothing when empty. */
export function FaceStrip({ face, light = false }: { face?: AdminCallFace | null; light?: boolean }) {
   const [avatarBroken, setAvatarBroken] = useState(false);
   if (!face) return null;
   const avatar = face.avatar && !avatarBroken ? face.avatar : null;
   const proof = face.proof ?? [];
   if (!avatar && !face.clip && !face.photos.length && !proof.length) return null;
   const tile = `h-28 w-24 rounded-xl border object-cover ${light ? 'border-[#e3e3e3] bg-[#f5f5f5]' : 'border-[color:var(--ct-line,#2a1453)] bg-black/30'}`;
   const caption = `mt-1 text-center text-[11px] font-black uppercase ${light ? 'text-[#6b6b6b]' : 'text-[color:var(--ct-dim,#a89bb8)]'}`;
   return (
      <div className="flex flex-wrap gap-3">
         {avatar ? (
            <a href={avatar} target="_blank" rel="noreferrer" className="block no-underline">
               <img src={avatar} alt="Profile picture" loading="lazy" referrerPolicy="no-referrer" onError={() => setAvatarBroken(true)} className={tile} />
               <p className={caption}>Profile</p>
            </a>
         ) : null}
         {face.clip ? (
            <div>
               <video src={`${face.clip}#t=0.5`} controls playsInline preload="metadata" className={`${tile} w-40`} />
               <p className={caption}>Intro video</p>
            </div>
         ) : null}
         {face.photos.map((photo) => (
            <a key={photo.url} href={photo.url} target="_blank" rel="noreferrer" className="block no-underline">
               <img src={photo.url} alt={photo.label} loading="lazy" className={tile} />
               <p className={caption}>{photo.label}</p>
            </a>
         ))}
         {proof.length ? <span aria-hidden="true" className={`mx-1 w-px self-stretch ${light ? 'bg-[#e3e3e3]' : 'bg-[var(--ct-soft,#2a1453)]'}`} /> : null}
         {proof.map((file) => (
            <a key={file.url} href={file.url} target="_blank" rel="noreferrer" title="Open full size" className="block no-underline">
               {file.image ? (
                  <img src={file.url} alt={file.label} loading="lazy" className={tile} />
               ) : (
                  <span className={`${tile} grid place-items-center text-3xl`}>📄</span>
               )}
               <p className={`${caption} max-w-24 truncate`}>{file.label}</p>
            </a>
         ))}
      </div>
   );
}
