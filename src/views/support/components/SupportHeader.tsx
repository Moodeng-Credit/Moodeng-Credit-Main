import { useNavigate } from 'react-router-dom';

import { ICON_MASK_BASE } from '@/views/support/constants';

interface SupportHeaderProps {
   title: string;
}

export default function SupportHeader({ title }: SupportHeaderProps) {
   const navigate = useNavigate();

   return (
      <div className="flex items-center gap-md-3 px-md-5 py-md-3">
         <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="w-6 h-6 flex items-center justify-center shrink-0"
         >
            <div
               className="w-6 h-6 bg-md-primary-2000"
               style={{
                  ...ICON_MASK_BASE,
                  WebkitMaskImage: "url('/icons/arrow-left.svg')",
                  maskImage: "url('/icons/arrow-left.svg')"
               }}
            />
         </button>
         <h1 className="text-md-h3 font-semibold text-md-primary-2000 tracking-[-0.56px]">{title}</h1>
      </div>
   );
}
