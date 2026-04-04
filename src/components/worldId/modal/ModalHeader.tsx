import { type FC, type ReactNode } from 'react';

interface ModalHeaderProps {
   title?: string;
   description?: string;
   titleId?: string;
   descriptionId?: string;
   leftIcon?: ReactNode;
   onLeftIconClick?: () => void;
   onClose?: () => void;
   isMainContent?: boolean;
}

export const ModalHeader: FC<ModalHeaderProps> = ({
   title,
   description,
   titleId,
   descriptionId,
   leftIcon,
   onLeftIconClick,
   onClose,
   isMainContent
}) => {
   return (
      <div className="relative flex font-sans flex-col bg-white px-5 space-y-5 pt-6">
         {/* Top Nav Bar */}
         {onClose && (
            <div className="flex items-center justify-between">
               <button
                  onClick={onClose}
                  className="flex items-center justify-center text-gray-700 hover:text-gray-900 transition-colors"
                  aria-label="Go back"
               >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
               </button>
               <span className="text-sm font-medium text-gray-900">Verify World ID</span>
               <div className="w-6" />
            </div>
         )}

         <img src="/world-id.png" alt="" aria-hidden="true" className="w-40" />

         <div className="flex-1 text-left flex flex-col gap-2">
            {/* Main Title: Deep Navy, Bold, Large */}
            <h2 id={titleId} className="text-4xl font-semibold text-md-heading leading-tighter tracking-tight">
               {title || "Verify You're Human"}
            </h2>

            {/* Description: Medium Gray, Regular Weight */}
            {description && (
               <p id={descriptionId} className="text-base text-gray-500 font-medium">
                  {description}
               </p>
            )}
         </div>
      </div>
   );
};
