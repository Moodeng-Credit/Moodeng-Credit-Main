'use client';

import { MapPin } from 'lucide-react';

interface LocationPrimingModalProps {
   open: boolean;
   onShare: () => void;
   onSkip: () => void;
}

/**
 * Pre-permission ("priming") step for location. We show OUR explanation first,
 * and only when the borrower taps "Share location" do we let the caller fire
 * the native browser prompt — so it appears in context, right after a
 * deliberate tap. "Not now" is always available (location is soft-required).
 *
 * Self-contained overlay so it never touches the multi-step loan modal machine.
 */
export default function LocationPrimingModal({ open, onShare, onSkip }: LocationPrimingModalProps) {
   if (!open) return null;

   return (
      <div
         className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
         role="dialog"
         aria-modal="true"
         aria-labelledby="location-priming-title"
      >
         <div className="w-full max-w-sm rounded-3xl border border-[#2a1453] bg-[#1c0a3a] p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#241044]">
               <MapPin className="h-7 w-7 text-md-green-700" aria-hidden="true" />
            </div>

            <h2 id="location-priming-title" className="mt-4 text-2xl font-black text-white">
               One last step
            </h2>
            <p className="mt-2 text-base font-bold leading-relaxed text-[#cfc6dd]">
               We check your location to keep lending safe and catch fraud. It&apos;s only used to verify your request — never shared with
               lenders.
            </p>

            <button
               type="button"
               onClick={onShare}
               className="mt-6 w-full rounded-full bg-[#8336f0] px-6 py-3 text-lg font-black text-white transition hover:bg-[#7229e0]"
            >
               Share location
            </button>
            <button
               type="button"
               onClick={onSkip}
               className="mt-3 w-full rounded-full px-6 py-2 text-base font-black text-[#a89bb8] transition hover:text-white"
            >
               Not now
            </button>
         </div>
      </div>
   );
}
