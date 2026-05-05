import { ChevronLeft, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DashboardHeaderProps {
   title?: string;
}

export default function DashboardHeader({ title = 'Dashboard' }: DashboardHeaderProps) {
   const navigate = useNavigate();

   return (
      <header className="flex items-center justify-between">
         <div className="flex min-w-0 items-center gap-md-2">
            <button
               aria-label="Go back"
               className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-md-heading shadow-md-card active:scale-95"
               type="button"
               onClick={() => navigate(-1)}
            >
               <ChevronLeft className="h-6 w-6" strokeWidth={2.3} />
            </button>
            <h1 className="truncate text-[28px] font-semibold leading-tight text-md-heading">{title}</h1>
         </div>
         <button
            aria-label="Open help and support"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-md-primary-900 shadow-md-card active:scale-95"
            type="button"
            onClick={() => navigate('/support')}
         >
            <HelpCircle className="h-6 w-6" strokeWidth={1.7} />
         </button>
      </header>
   );
}
