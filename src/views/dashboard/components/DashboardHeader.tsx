import { HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DashboardHeader() {
   const navigate = useNavigate();

   return (
      <div className="flex items-center justify-between">
         <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate(-1)} className="w-6 h-6 flex items-center justify-center">
               <img src="/icons/arrow-left.svg" alt="Back" className="w-5 h-5" />
            </button>
            <h1 className="text-md-h4 font-semibold text-md-heading">Dashboard</h1>
         </div>
         <button
            type="button"
            className="shrink-0 w-12 h-12 bg-white rounded-full shadow-md-card flex items-center justify-center"
            onClick={() => navigate('/support')}
            aria-label="Open help and support center"
         >
            <HelpCircle className="w-6 h-6 text-md-primary-900" strokeWidth={1.5} />
         </button>
      </div>
   );
}
