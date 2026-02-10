import { type FC } from 'react';

import { ActionButtonsSection } from '@/components/worldId/modal/ActionButtonsSection';
import { HowItWorksSection } from '@/components/worldId/modal/HowItWorksSection';

interface VerificationModalBodyProps {
   onVerify: () => void;
   onCheckStatus: () => void;
}

export const VerificationModalBody: FC<VerificationModalBodyProps> = ({ onVerify, onCheckStatus }) => {
   return (
      <div className="space-y-6 p-8">
         <HowItWorksSection />
         <ActionButtonsSection onVerify={onVerify} onCheckStatus={onCheckStatus} />
      </div>
   );
};
