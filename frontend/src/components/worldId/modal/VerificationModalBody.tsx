import { type FC } from 'react';

import { Button } from '@/components/shadcn/button';

const STEPS = [
   { num: 1, title: 'Click "Verify with World ID"', sub: 'Opens the verification modal' },
   { num: 2, title: 'Scan QR with World App', sub: 'Uses your phone camera' },
   { num: 3, title: 'Confirm & Complete', sub: 'Verified instantly' }
];

interface VerificationModalBodyProps {
   onVerify: () => void;
   onCheckStatus: () => void;
}

export const VerificationModalBody: FC<VerificationModalBodyProps> = ({ onVerify }) => {
   return (
      <div className="p-6 flex flex-col gap-6">
         <div className="flex justify-start">
            <img
               src="/hippo_worldid.png"
               alt=""
               className="w-32 h-auto object-contain"
               width={128}
               height={128}
            />
         </div>
         <div>
            <h3 id="verification-modal-title" className="text-foreground text-xl font-bold tracking-tight">Verify You&apos;re Human</h3>
            <p id="verification-modal-description" className="text-muted-foreground text-sm mt-1">
               Prove you&apos;re a real person with World ID
            </p>
         </div>

         <div>
            <h4 className="text-foreground font-semibold text-sm mb-3">How to Verify?</h4>
            <div className="flex flex-col gap-3">
               {STEPS.map(({ num, title, sub }) => (
                  <div
                     key={num}
                     className="flex items-start gap-3 rounded-xl p-4 shadow-sm border border-border"
                     style={{ backgroundColor: '#F1E9FD' }}
                  >
                     <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6d57ff] text-white text-sm font-bold">
                        {num}
                     </span>
                     <div>
                        <p className="text-foreground font-medium text-sm">{title}</p>
                        <p className="text-muted-foreground text-xs mt-0.5">{sub}</p>
                     </div>
                  </div>
               ))}
            </div>
         </div>

         <Button
            type="button"
            onClick={onVerify}
            className="w-full h-11 font-semibold bg-[#6d57ff] hover:bg-[#5b46e0] text-white rounded-lg shadow-sm flex items-center justify-center gap-2"
         >
            Verify with World ID
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
         </Button>

         <p className="text-center text-xs text-muted-foreground leading-relaxed">
            Privacy-First proof of personhood. Verify without revealing your identity.
         </p>
      </div>
   );
};
