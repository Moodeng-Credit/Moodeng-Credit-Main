import { type ReactNode } from 'react';

import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
   isOpen: boolean;
   onToggle: () => void;
   buttonText: string;
   children: ReactNode;
   buttonClassName?: string;
}

export default function CollapsibleSection({
   isOpen,
   onToggle,
   buttonText,
   children,
   buttonClassName = ''
}: CollapsibleSectionProps) {
   const defaultButtonClassName =
      'w-full px-4 py-2.5 text-sm font-medium text-blue-400 hover:bg-blue-900/20 border border-blue-800 rounded-lg transition-colors flex items-center justify-center gap-1';

   return (
      <>
         <button onClick={onToggle} className={buttonClassName || defaultButtonClassName}>
            {buttonText}
            <ChevronDown className={`w-4 h-4 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
         </button>
         {isOpen && <div className="mt-6">{children}</div>}
      </>
   );
}
