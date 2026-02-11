import { type FC } from 'react';

import { Shield } from 'lucide-react';

import { ModalHeader } from '@/components/worldId/modal/ModalHeader';
import { modalHeaderConfig } from '@/components/worldId/modal/verificationModalConfig';

interface VerificationModalHeaderProps {
   onClose: () => void;
}

/**
 * Pre-configured header for the verification modal
 */
export const VerificationModalHeader: FC<VerificationModalHeaderProps> = ({ onClose }) => {
   return (
      <ModalHeader
         icon={
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
               <Shield size={40} />
            </div>
         }
         title={modalHeaderConfig.title}
         description={modalHeaderConfig.description}
         onClose={onClose}
         titleId="verification-modal-title"
         descriptionId="verification-modal-description"
      />
   );
};
