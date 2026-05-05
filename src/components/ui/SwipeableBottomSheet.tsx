import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';

import { X } from 'lucide-react';

interface SwipeableBottomSheetProps {
   isOpen: boolean;
   onClose: () => void;
   title: string;
   description?: string;
   children: ReactNode;
   ariaLabel?: string;
}

export default function SwipeableBottomSheet({
   isOpen,
   onClose,
   title,
   description,
   children,
   ariaLabel = title
}: SwipeableBottomSheetProps) {
   const dragStartY = useRef<number | null>(null);
   const dragOffsetRef = useRef(0);
   const [dragOffset, setDragOffset] = useState(0);

   useEffect(() => {
      if (!isOpen) return undefined;
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
         document.body.style.overflow = previousOverflow;
      };
   }, [isOpen]);

   if (!isOpen) return null;

   const handleDragStart = (event: PointerEvent<HTMLDivElement>) => {
      dragStartY.current = event.clientY;
      dragOffsetRef.current = 0;
      event.currentTarget.setPointerCapture(event.pointerId);
   };

   const handleDragMove = (event: PointerEvent<HTMLDivElement>) => {
      if (dragStartY.current === null) return;
      const nextOffset = Math.max(0, event.clientY - dragStartY.current);
      dragOffsetRef.current = nextOffset;
      setDragOffset(nextOffset);
   };

   const handleDragEnd = (event: PointerEvent<HTMLDivElement>) => {
      if (dragStartY.current === null) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (dragOffsetRef.current > 96) {
         onClose();
      }
      dragStartY.current = null;
      dragOffsetRef.current = 0;
      setDragOffset(0);
   };

   return (
      <div className="fixed inset-0 z-[80] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={ariaLabel}>
         <button aria-label="Close sheet" className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" type="button" onClick={onClose} />
         <section
            className="relative flex max-h-[86dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[28px] border border-white/70 bg-white shadow-[0_-14px_42px_rgba(96,16,210,0.18),0_-2px_12px_rgba(0,0,0,0.08)] transition-transform duration-150 ease-out"
            style={{ transform: `translateY(${dragOffset}px)` }}
         >
            <div
               className="shrink-0 touch-none cursor-grab select-none pb-3 pt-3 active:cursor-grabbing"
               onPointerDown={handleDragStart}
               onPointerMove={handleDragMove}
               onPointerUp={handleDragEnd}
               onPointerCancel={handleDragEnd}
            >
               <div className="mx-auto h-1 w-12 rounded-full bg-[#d6d0df]" />
            </div>
            <header className="shrink-0 border-b border-[#eee8f7] px-md-4 pb-md-4">
               <div className="flex items-start justify-between gap-md-3">
                  <div className="min-w-0">
                     <h2 className="text-[26px] font-semibold leading-tight text-md-heading">{title}</h2>
                     {description ? <p className="mt-md-1 text-md-b2 text-md-neutral-1200">{description}</p> : null}
                  </div>
                  <button
                     aria-label="Close"
                     className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-md-neutral-200 text-md-neutral-1200 active:scale-95"
                     type="button"
                     onClick={onClose}
                  >
                     <X className="h-5 w-5" strokeWidth={2.2} />
                  </button>
               </div>
            </header>
            <div className="flex-1 overflow-y-auto px-md-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-md-4">{children}</div>
         </section>
      </div>
   );
}
