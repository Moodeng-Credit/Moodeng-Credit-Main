import { type FC } from 'react';

import { ModalStep } from '@/components/worldId/modal/ModalStep';
import { sectionTitle, verificationSteps } from '@/components/worldId/modal/verificationModalConfig';

export const HowItWorksSection: FC = () => {
   return (
      <div>
         <h3 className="mb-4 text-xl font-bold text-gray-900">{sectionTitle}</h3>

         <div className="space-y-4">
            {verificationSteps.map((step) => (
               <ModalStep
                  key={step.stepNumber}
                  stepNumber={step.stepNumber}
                  title={step.title}
                  description={step.description}
                  icon={step.icon}
                  iconColor={step.iconColor}
                  bgColor={step.bgColor}
               />
            ))}
         </div>
      </div>
   );
};
