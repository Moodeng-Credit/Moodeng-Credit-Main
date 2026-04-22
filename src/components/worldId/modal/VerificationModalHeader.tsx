import { type FC } from 'react';

import { ModalHeader } from '@/components/worldId/modal/ModalHeader';
import { modalHeaderConfig } from '@/components/worldId/modal/verificationModalConfig';

interface VerificationModalHeaderProps {
   onClose: () => void;
}

export const VerificationModalHeader: FC<VerificationModalHeaderProps> = ({ onClose }) => {
   return (
      <>
         <div className="flex items-center justify-between bg-white px-4 sm:px-6 py-3 sm:py-4 font-sans border-b border-gray-200">
            <div className="flex items-center gap-3">
               <button
                  onClick={onClose}
                  className="flex items-center justify-center -ml-2 rounded-full transition-all active:scale-95"
                  aria-label="Go back"
               >
                  <img src="/world-id-back.svg" alt="" aria-hidden="true" className="w-7 h-7 sm:w-8 sm:h-8" />
               </button>

               <h3 className="text-xl sm:text-3xl font-semibold text-gray-900 tracking-tighter">Verify World ID</h3>
            </div>
            <button
               // onClick={() => window.open(modalHeaderConfig.infoLink, '_blank')}
               className="flex items-center justify-center rounded-full text-blue-600 w-8 h-8 sm:w-12 sm:h-12 transition-all active:scale-95 shadow-md"
               aria-label="View information"
            >
               <img src="/world-id-info.svg" alt="" aria-hidden="true" className="w-5 h-5 sm:w-7 sm:h-7" />
            </button>
         </div>
         <ModalHeader
            title={modalHeaderConfig.title}
            description={modalHeaderConfig.description}
            titleId="verification-modal-title"
            descriptionId="verification-modal-description"
            isMainContent
         />
      </>
   );
};
