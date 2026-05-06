import { useNavigate } from 'react-router-dom';

export default function LenderDiversityInsights() {
   const navigate = useNavigate();

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28 flex flex-col gap-5 px-md-4 py-md-3">
            <div className="flex items-center gap-3">
               <button type="button" onClick={() => navigate(-1)} className="w-6 h-6 flex items-center justify-center">
                  <img src="/icons/arrow-left.svg" alt="Back" className="w-5 h-5" />
               </button>
               <h1 className="text-md-h4 font-semibold text-md-heading">Lender Diversity</h1>
            </div>

            <div className="bg-md-neutral-100 rounded-md-lg p-8 shadow-md-card flex flex-col items-center justify-center gap-3">
               <img src="/hippos/borrower-insights-trophy.png" alt="Moodeng" className="w-24 h-24 object-contain" />
               <p className="text-md-h5 font-semibold text-md-heading text-center">Coming Soon</p>
               <p className="text-md-b2 text-md-neutral-700 text-center">
                  Detailed lender diversity insights will be available here.
               </p>
            </div>
         </div>
      </div>
   );
}
