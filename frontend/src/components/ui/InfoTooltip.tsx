import type { ReactNode } from 'react';

import { HelpCircle } from 'lucide-react';

interface InfoTooltipProps {
   content: ReactNode;
   className?: string;
   iconClassName?: string;
   position?: 'top' | 'bottom' | 'left' | 'right';
}

const positionStyles = {
   top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
   bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
   left: 'right-full top-1/2 -translate-y-1/2 mr-2',
   right: 'left-full top-1/2 -translate-y-1/2 ml-2'
};

export function InfoTooltip({ content, className = '', iconClassName = '', position = 'top' }: InfoTooltipProps) {
   return (
      <div className={`relative group ${className}`}>
         <HelpCircle className={`w-4 h-4 text-gray-400 cursor-help ${iconClassName}`} />
         <div
            className={`absolute invisible group-hover:visible bg-[#111827] text-gray-100 p-3 rounded-lg text-sm w-64 z-10 shadow-xl border border-gray-800 ${positionStyles[position]}`}
         >
            {content}
         </div>
      </div>
   );
}
