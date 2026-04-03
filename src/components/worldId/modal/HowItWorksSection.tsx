import { type FC } from 'react';

import { ModalStep } from '@/components/worldId/modal/ModalStep';
import { sectionTitle, verificationSteps } from '@/components/worldId/modal/verificationModalConfig';

export const HowItWorksSection: FC = () => {
   return (
      <div>
         <h3 className="mb-5 text-[18px] font-semibold font-sans text-gray-900 text-left ">{sectionTitle}</h3>

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
