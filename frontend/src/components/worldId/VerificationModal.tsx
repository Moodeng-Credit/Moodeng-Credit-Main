

import { type FC } from 'react';

import { ModalOverlay } from '@/components/worldId/modal/ModalOverlay';
import { VerificationModalBody } from '@/components/worldId/modal/VerificationModalBody';
import { VerificationModalHeader } from '@/components/worldId/modal/VerificationModalHeader';

interface VerificationModalProps {
   isOpen: boolean;
   onClose: () => void;
   onVerify: () => void;
   onCheckStatus: () => void;
}

export const VerificationModal: FC<VerificationModalProps> = ({ isOpen, onClose, onVerify, onCheckStatus }) => {
   return (
      <ModalOverlay
         isOpen={isOpen}
         onClose={onClose}
         ariaLabelledBy="verification-modal-title"
         ariaDescribedBy="verification-modal-description"
      >
         <section className="overflow-hidden rounded-xl shadow-2xl border border-border bg-background">
            <VerificationModalHeader onClose={onClose} />
            <VerificationModalBody onVerify={onVerify} onCheckStatus={onCheckStatus} />
         </section>
      </ModalOverlay>
   );
};
