'use client';

import { type RefObject } from 'react';

interface SuccessModalProps {
   clickOutsideRef: RefObject<HTMLDivElement> | undefined;
   isOpen: boolean;
   onClose: () => void;
}

export default function SuccessModal({ clickOutsideRef, isOpen, onClose }: SuccessModalProps) {
   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
         <section
            ref={clickOutsideRef}
            className="max-w-md mx-auto rounded-lg shadow-md relative"
            style={{ minWidth: '320px', aspectRatio: '9 / 16' }}
         >
            <button onClick={onClose} className="absolute top-3 right-4 text-white hover:text-gray-200 z-10 text-2xl">
               ✖
            </button>
            <div className="w-full h-full rounded-lg bg-gradient-to-tr from-[#7B5FFF] via-[#C55FFF] to-[#D45FFF] flex items-center justify-center">
               <div
                  aria-hidden="true"
                  className="bg-white rounded-full p-6 flex items-center justify-center"
                  style={{ width: '72px', height: '72px' }}
               >
                  <i className="fas fa-check text-[#7B5FFF] text-4xl"></i>
               </div>
            </div>
         </section>
      </div>
   );
}
