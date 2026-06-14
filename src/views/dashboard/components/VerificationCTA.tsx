import { useVerifyYourself } from '@/components/verification/VerifyYourselfModal';

export default function VerificationCTA() {
   const { open, modal } = useVerifyYourself('loan-request');
   return (
      <div className="bg-md-yellow-100 rounded-md-lg p-4 flex gap-3 items-center shadow-md-card">
         <div className="flex-1">
            <p className="text-md-heading text-md-b2 font-semibold mb-1">One quick step to request a loan</p>
            <p className="text-md-neutral-700 text-md-b4 mb-3">
               Complete a one-time verification to start building trust with lenders.
            </p>
            <button
               type="button"
               onClick={open}
               className="inline-flex items-center px-4 py-2 rounded-md-md bg-md-primary-900 text-white text-md-b3 font-semibold"
            >
               Verify Yourself
            </button>
         </div>
         <img src="/hippos/welcome.png" alt="Moodeng" className="w-20 h-20 object-contain shrink-0" />
         {modal}
      </div>
   );
}
