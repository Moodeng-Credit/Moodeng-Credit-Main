import { type ChangeEvent, useEffect, useRef, useState } from 'react';

import { drawFightImage } from '@/views/referral/sharkFighter/shareFightImage';

// "Share my fight" sheet: take a selfie (or skip it), see the Ride the Hippo card, share it with the invite
// link in the caption. The photo stays on the phone. Facebook/Messenger's Android in-app browser blocks the
// camera and photo picker, so there it goes straight to the Moodeng-only card.

const PRIMARY_GRADIENT = 'linear-gradient(77.66deg, #9584ff 0.5%, #6b55f7 98.16%)';

const isAndroidMetaBrowser = () =>
   typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent) && /FBAN|FBAV|FB_IAB|FB4A|Messenger/i.test(navigator.userAgent);

export default function ShareFightSheet({
   streak,
   caption,
   onClose
}: {
   /** On-time repayments in a row, for the gold pill. */
   streak: number;
   /** Message + invite link that goes with the image. */
   caption: string;
   onClose: () => void;
}) {
   const fileRef = useRef<HTMLInputElement>(null);
   const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
   const [busy, setBusy] = useState(false);
   const [note, setNote] = useState<string | null>(null);
   const [hasSelfie, setHasSelfie] = useState(false);
   const skipSelfie = isAndroidMetaBrowser();

   const build = async (selfie: File | null) => {
      setBusy(true);
      setNote(null);
      try {
         const count = Math.max(1, streak);
         const blob = await drawFightImage(selfie, {
            line1: 'RIDE THE HIPPO 🦛',
            line2: 'FIGHT THE SHARKS 🦈',
            streak: `🔥 ${count} PROMISE${count === 1 ? '' : 'S'} KEPT${count > 1 ? ' IN A ROW' : ''}`,
            tagline: 'Fighting loan sharks with Moodeng Credit 💪',
            site: 'moodeng.app'
         });
         setImage((old) => {
            if (old) URL.revokeObjectURL(old.url);
            return { blob, url: URL.createObjectURL(blob) };
         });
         setHasSelfie(Boolean(selfie));
      } catch {
         setNote('Couldn’t make the picture. Try again.');
      } finally {
         setBusy(false);
      }
   };

   useEffect(() => {
      if (skipSelfie) void build(null);
      // Build once on open for in-app browsers; the selfie path builds on pick.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   useEffect(() => () => (image ? URL.revokeObjectURL(image.url) : undefined), [image]);

   const onPick = (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      event.target.value = '';
      if (file) void build(file);
   };

   const share = async () => {
      if (!image) return;
      const file = new File([image.blob], 'ride-the-hippo.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
         await navigator.share({ files: [file], text: caption }).catch(() => undefined);
         return;
      }
      // No image sharing here: save the picture and copy the message to paste with it.
      const link = document.createElement('a');
      link.href = image.url;
      link.download = 'ride-the-hippo.png';
      link.click();
      await navigator.clipboard?.writeText(caption).catch(() => undefined);
      setNote('Picture saved and message copied. Post it with the picture 🦛');
   };

   return (
      <div
         className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 sm:items-center sm:px-5"
         role="dialog"
         aria-modal="true"
         aria-labelledby="share-fight-title"
         onClick={onClose}
      >
         <div
            className="relative flex w-full max-w-[440px] flex-col items-center gap-4 rounded-t-[28px] bg-white px-5 pb-8 pt-5 text-center dark:bg-dv2-card sm:rounded-[28px]"
            onClick={(event) => event.stopPropagation()}
         >
            <button
               type="button"
               onClick={onClose}
               className="absolute right-4 top-4 text-[18px] font-bold text-[#9a92bd]"
               aria-label="Close"
            >
               ✕
            </button>
            <p id="share-fight-title" className="text-[22px] font-black italic text-[#4c239f] dark:text-[#c4b8ff]">
               {image ? 'Ready to post 🥊' : 'Show us your fighter face 🥊'}
            </p>

            {image ? (
               <img
                  src={image.url}
                  alt="Your Ride the Hippo card"
                  className="w-full max-w-[320px] rounded-[18px] shadow-[0_10px_24px_rgba(51,26,102,0.3)]"
               />
            ) : (
               <img src="/shark-fighter/fighter-moodeng.webp" alt="" className="h-[180px] object-contain" draggable={false} />
            )}

            <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onPick} />
            <button
               type="button"
               disabled={busy}
               onClick={() => (image ? void share() : fileRef.current?.click())}
               className="flex h-[52px] w-full max-w-[346px] items-center justify-center rounded-[35px] text-[20px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
               style={{ backgroundImage: PRIMARY_GRADIENT }}
            >
               {busy ? 'Making it…' : image ? 'Share' : 'Take a selfie'}
            </button>
            {skipSelfie ? null : (
               <button
                  type="button"
                  disabled={busy}
                  onClick={() => (image ? fileRef.current?.click() : void build(null))}
                  className="text-[14px] font-semibold text-[#6b55f7] underline underline-offset-2 dark:text-[#b3a6ff]"
               >
                  {image ? (hasSelfie ? 'Retake selfie' : 'Add a selfie') : 'Use my Moodeng instead'}
               </button>
            )}
            {note ? <p className="text-[13px] font-semibold text-[#7a6fa3]">{note}</p> : null}
            <p className="text-[12px] text-[#9a92bd]">Your photo stays on your phone.</p>
         </div>
      </div>
   );
}
