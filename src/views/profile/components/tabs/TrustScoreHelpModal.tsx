import { type RefObject } from 'react';

interface TrustScoreHelpModalProps {
   isOpen: boolean;
   onClose: () => void;
   clickOutsideRef?: RefObject<HTMLDivElement>;
}

const TrustScoreHelpModal = ({ isOpen, onClose, clickOutsideRef }: TrustScoreHelpModalProps) => {
   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
         <div
            ref={clickOutsideRef}
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
         >
            <div className="p-6 space-y-6">
               {/* Header */}
               <div className="flex items-center justify-between border-b pb-4">
                  <h2 className="text-2xl font-bold text-gray-900">How Trust Score Works</h2>
                  <button
                     onClick={onClose}
                     className="text-gray-400 hover:text-gray-600 text-2xl"
                     type="button"
                     aria-label="Close"
                  >
                     <i className="fa-solid fa-xmark" />
                  </button>
               </div>

               {/* Content */}
               <div className="space-y-4">
                  <div>
                     <h3 className="text-lg font-semibold text-gray-900 mb-2">What is Trust Score?</h3>
                     <p className="text-gray-700">
                        Your Trust Score is a measure of your reliability as a borrower. It helps lenders assess the risk of
                        lending to you and determines your eligibility for higher credit limits.
                     </p>
                  </div>

                  <div>
                     <h3 className="text-lg font-semibold text-gray-900 mb-2">How is it calculated?</h3>
                     <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <div className="flex items-start gap-3">
                           <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                              <i className="fa-solid fa-arrow-up text-sm" />
                           </div>
                           <div>
                              <p className="font-semibold text-gray-900">Base Score: 50 points</p>
                              <p className="text-sm text-gray-600">Everyone starts with a base score of 50 points</p>
                           </div>
                        </div>

                        <div className="flex items-start gap-3">
                           <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
                              <i className="fa-solid fa-plus text-sm" />
                           </div>
                           <div>
                              <p className="font-semibold text-gray-900">+10 points for World ID Verification</p>
                              <p className="text-sm text-gray-600">Verify your identity to boost your starting score</p>
                           </div>
                        </div>

                        <div className="flex items-start gap-3">
                           <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
                              <i className="fa-solid fa-plus text-sm" />
                           </div>
                           <div>
                              <p className="font-semibold text-gray-900">+5 points per on-time repayment</p>
                              <p className="text-sm text-gray-600">Repay your loans before the due date to increase your score</p>
                           </div>
                        </div>

                        <div className="flex items-start gap-3">
                           <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                              <i className="fa-solid fa-minus text-sm" />
                           </div>
                           <div>
                              <p className="font-semibold text-gray-900">-10 points per late repayment</p>
                              <p className="text-sm text-gray-600">
                                 Late payments negatively impact your score and pause credit progression
                              </p>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div>
                     <h3 className="text-lg font-semibold text-gray-900 mb-2">Score Ranges</h3>
                     <div className="space-y-2">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50">
                           <div className="w-4 h-4 rounded-full bg-red-500" />
                           <div>
                              <span className="font-semibold text-red-900">0-39 points: Poor</span>
                           </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50">
                           <div className="w-4 h-4 rounded-full bg-orange-500" />
                           <div>
                              <span className="font-semibold text-orange-900">40-69 points: Fair</span>
                           </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50">
                           <div className="w-4 h-4 rounded-full bg-green-500" />
                           <div>
                              <span className="font-semibold text-green-900">70-89 points: Good Standing</span>
                           </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50">
                           <div className="w-4 h-4 rounded-full bg-emerald-500" />
                           <div>
                              <span className="font-semibold text-emerald-900">90-100 points: Excellent</span>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div>
                     <h3 className="text-lg font-semibold text-gray-900 mb-2">How to increase your Trust Score</h3>
                     <ul className="space-y-2 text-gray-700">
                        <li className="flex items-start gap-2">
                           <i className="fa-solid fa-check text-green-600 mt-1" />
                           <span>Verify your World ID to get an instant +10 point bonus</span>
                        </li>
                        <li className="flex items-start gap-2">
                           <i className="fa-solid fa-check text-green-600 mt-1" />
                           <span>Always repay your loans on or before the due date</span>
                        </li>
                        <li className="flex items-start gap-2">
                           <i className="fa-solid fa-check text-green-600 mt-1" />
                           <span>Build a consistent repayment history over time</span>
                        </li>
                        <li className="flex items-start gap-2">
                           <i className="fa-solid fa-check text-green-600 mt-1" />
                           <span>Avoid late payments, as they significantly impact your score</span>
                        </li>
                     </ul>
                  </div>

                  <div>
                     <h3 className="text-lg font-semibold text-gray-900 mb-2">Can it decrease?</h3>
                     <p className="text-gray-700">
                        Yes, your Trust Score can decrease if you make late repayments. Each late payment reduces your score by 10
                        points and can pause your credit progression. To recover, focus on making timely repayments going forward.
                     </p>
                  </div>
               </div>

               {/* Footer */}
               <div className="border-t pt-4">
                  <button
                     onClick={onClose}
                     className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
                     type="button"
                  >
                     Got it!
                  </button>
               </div>
            </div>
         </div>
      </div>
   );
};

export default TrustScoreHelpModal;
