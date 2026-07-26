import { type ChangeEvent, useRef, useState } from 'react';

import LoanRequestModal from '@/views/dashboard/components/LoanRequestModal';
import SuccessModal from '@/views/dashboard/components/SuccessModal';
import type { User } from '@/types/authTypes';

// DEV-only screenshot harness for the loan-request flow (terms → bio page 1 → bio page 2).
// Mounts LoanRequestModal with a mock verified borrower that has no saved bio context, so the
// full multi-step flow (and the 3-dot progress rail) renders. Never registered in production.
const PREVIEW_BORROWER: User = {
   id: 'loan-request-preview',
   username: 'preview-borrower',
   email: 'loan-request-preview@moodeng.local',
   walletAddress: '0x0000000000000000000000000000000000000000',
   walletProvider: 'base_wallet',
   isWorldId: 'ACTIVE',
   mal: 3,
   nal: 0,
   cs: 100,
   userRole: 'borrower',
   createdAt: new Date(0).toISOString(),
   updatedAt: new Date(0).toISOString()
};

export default function LoanRequestPreview() {
   const clickOutsideRef = useRef<HTMLDivElement>(null);
   const successRef = useRef<HTMLDivElement>(null);
   const [loanAmount, setLoanAmount] = useState('');
   const [totalRepaymentAmount, setTotalRepaymentAmount] = useState('');
   const [reason, setReason] = useState('');
   const [days, setDays] = useState('');
   const [submitted, setSubmitted] = useState(false);
   const today = new Date().toISOString().slice(0, 10);
   // ?unverified renders the not-yet-verified state (verify blocker + inert submit button).
   const showVerify = new URLSearchParams(window.location.search).has('unverified');

   return (
      <div className="min-h-screen bg-md-neutral-300">
         {!submitted ? (
            <LoanRequestModal
               clickOutsideRef={clickOutsideRef}
               isOpen
               onClose={() => {}}
               showVerify={showVerify}
               user={PREVIEW_BORROWER}
               loanAmount={loanAmount}
               setLoanAmount={setLoanAmount}
               totalRepaymentAmount={totalRepaymentAmount}
               setTotalRepaymentAmount={setTotalRepaymentAmount}
               reason={reason}
               setReason={setReason}
               days={days}
               today={today}
               handleDays={(e: ChangeEvent<HTMLInputElement>) => setDays(e.target.value)}
               handleSubmit={() => setSubmitted(true)}
               isSubmitting={false}
               availableCreditLimit={15}
               canUseReferralBoost={false}
               requireBorrowerContextStep
               startOnReferralStep={false}
            />
         ) : null}
         {/* Shows the real post-submit success screen so the preview demonstrates the full flow. */}
         <SuccessModal clickOutsideRef={successRef} isOpen={submitted} onClose={() => setSubmitted(false)} />
      </div>
   );
}
