import { type ChangeEvent, type FormEvent, useRef, useState } from 'react';

import LoanRequestModal from '@/views/dashboard/components/LoanRequestModal';

const previewUser = {
   id: 'loan-request-preview-user',
   username: 'maya-preview',
   email: 'maya-preview@moodeng.local',
   walletAddress: '0x0000000000000000000000000000000000000000',
   walletProvider: 'base_wallet',
   isWorldId: 'ACTIVE',
   mal: 15,
   nal: 0,
   cs: 100,
   userRole: 'borrower',
   createdAt: new Date(0).toISOString(),
   updatedAt: new Date(0).toISOString()
};

const today = new Date().toISOString().slice(0, 10);

export default function LoanRequestPreview() {
   const modalRef = useRef<HTMLDivElement>(null);
   const [loanAmount, setLoanAmount] = useState('15');
   const [totalRepaymentAmount, setTotalRepaymentAmount] = useState('17');
   const [reason, setReason] = useState('Short-term work needs');
   const [days, setDays] = useState(today);

   const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
   };

   return (
      <div className="min-h-screen bg-[#edf0f6]">
         <LoanRequestModal
            availableCreditLimit={15}
            canUseReferralBoost={false}
            clickOutsideRef={modalRef}
            days={days}
            handleDays={(event: ChangeEvent<HTMLInputElement>) => setDays(event.target.value)}
            handleSubmit={handleSubmit}
            isOpen
            isSubmitting={false}
            loanAmount={loanAmount}
            onClose={() => undefined}
            reason={reason}
            setLoanAmount={setLoanAmount}
            setReason={setReason}
            setTotalRepaymentAmount={setTotalRepaymentAmount}
            showVerify={false}
            startOnBorrowerContextStep
            startOnReferralStep={false}
            today={today}
            totalRepaymentAmount={totalRepaymentAmount}
            user={previewUser}
         />
      </div>
   );
}
