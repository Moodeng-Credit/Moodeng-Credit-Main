import { useLocation, useNavigate } from 'react-router-dom';

export default function TourOverviewPage() {
   const navigate = useNavigate();
   const location = useLocation();

   return (
      <div className="min-h-screen bg-white flex flex-col max-w-[440px] mx-auto px-5">
         <div className="flex flex-col flex-1 justify-between py-4">
            <div className="flex flex-col gap-5">
               <img src="/hippos/role-selection.png" alt="Moodeng hippo" className="w-[228px] h-[200px] object-cover" />

               <div className="flex flex-col gap-3">
                  <h1 className="text-[34px] font-semibold leading-[1.2] tracking-[-0.04em] text-md-heading">How Moodeng works</h1>
                  <p className="text-md-b1 text-md-neutral-700 tracking-[-0.02em] leading-[26px]">
                     Moodeng connects two kinds of people: <strong className="text-md-heading">borrowers</strong>, who post requests for
                     small, short-term USDC loans, and <strong className="text-md-heading">lenders</strong>, who fund those requests and
                     earn by supporting people they trust.
                  </p>
                  <p className="text-md-b1 text-md-neutral-700 tracking-[-0.02em] leading-[26px]">
                     Both sides build a track record over time — borrowers by repaying on time, lenders by funding responsibly. Pick a
                     side below and we&apos;ll show you exactly how it works.
                  </p>
               </div>

               <button
                  type="button"
                  onClick={() => navigate('/request-board?tour=1&tourRole=borrower')}
                  className="flex flex-col gap-3 items-start p-4 rounded-[12px] border w-full text-left transition-colors bg-md-neutral-100 border-md-neutral-600 hover:border-md-primary-900"
               >
                  <span className="text-md-h5 font-semibold tracking-[-0.04em] text-md-heading">Show me borrowing</span>
                  <span className="text-md-b2 text-[#45556c] tracking-[-0.02em] leading-[21px]">
                     See how to request a short-term USDC loan and build trust through on-time repayment.
                  </span>
               </button>

               <button
                  type="button"
                  onClick={() => navigate('/request-board?tour=1&tourRole=lender')}
                  className="flex flex-col gap-3 items-start p-4 rounded-[12px] border w-full text-left transition-colors bg-md-neutral-100 border-md-neutral-600 hover:border-md-primary-900"
               >
                  <span className="text-md-h5 font-semibold tracking-[-0.04em] text-md-heading">Show me lending</span>
                  <span className="text-md-b2 text-[#45556c] tracking-[-0.02em] leading-[21px]">
                     See how to fund loan requests, review borrower trust signals, and earn by supporting people you believe in.
                  </span>
               </button>
            </div>

            <button
               type="button"
               onClick={() => (location.key === 'default' ? navigate('/request-board') : navigate(-1))}
               className="text-center text-base font-semibold tracking-[-0.02em] text-[#8336F0] hover:underline py-4"
            >
               ← Back
            </button>
         </div>
      </div>
   );
}
