import { type FC } from 'react';

import { ActionButtonsSection } from '@/components/worldId/modal/ActionButtonsSection';
import { HowItWorksSection } from '@/components/worldId/modal/HowItWorksSection';

interface VerificationModalBodyProps {
   onVerify: () => void;
   onCheckStatus: () => void;
}

export const VerificationModalBody: FC<VerificationModalBodyProps> = ({ onVerify, onCheckStatus }) => {
   return (
      <div className="space-y-5 pt-5 px-5 pb-2">
         <HowItWorksSection />
         <ActionButtonsSection onVerify={onVerify} onCheckStatus={onCheckStatus} />
      </div>
   );
};
