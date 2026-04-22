import { type FC } from 'react';

import { ModalStep } from '@/components/worldId/modal/ModalStep';
import { sectionTitle, verificationSteps } from '@/components/worldId/modal/verificationModalConfig';

export const HowItWorksSection: FC = () => {
   return (
      <div>
         <h3 className="mb-2 sm:mb-4 text-sm sm:text-[18px] font-semibold font-sans text-gray-900 text-left">{sectionTitle}</h3>

         <div className="space-y-2 sm:space-y-3">
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
