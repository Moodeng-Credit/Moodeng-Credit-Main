import { HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useLocalization } from '@/i18n';

export default function DashboardHeader() {
   const navigate = useNavigate();
   const { locale } = useLocalization();
   const copy =
      locale === 'fil'
         ? { title: 'Buod', back: 'Bumalik', help: 'Buksan ang Tulong at Suporta Center' }
         : locale === 'id'
           ? { title: 'Ringkasan', back: 'Kembali', help: 'Buka pusat bantuan dan dukungan' }
           : { title: 'Dashboard', back: 'Back', help: 'Open help and support center' };

   return (
      <div className="flex items-center justify-between">
         <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate(-1)} className="w-6 h-6 flex items-center justify-center">
               <img src="/icons/arrow-left.svg" alt={copy.back} className="w-5 h-5" />
            </button>
            <h1 className="text-md-h4 font-semibold text-md-heading">{copy.title}</h1>
         </div>
         <button
            type="button"
            className="shrink-0 w-12 h-12 bg-white rounded-full shadow-md-card flex items-center justify-center"
            onClick={() => navigate('/support')}
            aria-label={copy.help}
         >
            <HelpCircle className="w-6 h-6 text-md-primary-900" strokeWidth={1.5} />
         </button>
      </div>
   );
}
