import { type MouseEvent } from 'react';

interface LoanApplicationBannerProps {
   onApplyClick: (e: MouseEvent<HTMLButtonElement>) => void;
}

export default function LoanApplicationBanner({ onApplyClick }: LoanApplicationBannerProps) {
   return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
         <div className="flex items-center justify-between gap-6">
            <div className="flex-1">
               <h3 className="text-lg font-semibold text-gray-900 mb-2">Need short-term support?</h3>
               <p className="text-sm text-gray-600">
                  Borrow USDC to build trust and unlock higher loan levels.
               </p>
               <button
                  onClick={onApplyClick}
                  className="mt-4 bg-purple-600 text-white text-sm font-semibold px-6 py-3 rounded-lg hover:bg-purple-700 transition shadow-md"
               >
                  Apply For A Loan
               </button>
            </div>
            
            {/* 3D Hippo Illustration placeholder - image asset required */}
            <div className="hidden md:block w-40 h-40 bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl flex items-center justify-center">
               <div className="text-center">
                  <div className="text-6xl mb-2">🦛</div>
                  <div className="text-2xl">👍</div>
               </div>
            </div>
         </div>
      </div>
   );
}
