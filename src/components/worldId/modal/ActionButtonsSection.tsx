import { type FC } from 'react';

import TextWithLine from '@/components/ui/TextWithLine';
import { ModalButton } from '@/components/worldId/modal/ModalButton';
import { dividerText, verificationButtons } from '@/components/worldId/modal/verificationModalConfig';

interface ActionButtonsSectionProps {
   onVerify: () => void;
   onCheckStatus: () => void;
}

export const ActionButtonsSection: FC<ActionButtonsSectionProps> = ({ onVerify, onCheckStatus }) => {
   const actionHandlers = {
      externalLink: (button: (typeof verificationButtons)[number]) => {
         if (button.url) {
            window.open(button.url, '_blank', 'noopener,noreferrer');
         }
      },
      verify: onVerify,
      checkStatus: onCheckStatus
   };

   const handleButtonClick = (button: (typeof verificationButtons)[number]) => {
      const handler = actionHandlers[button.action];
      if (typeof handler === 'function') {
         handler(button);
      }
   };

   return (
      <div className="space-y-3">
         {verificationButtons.map((button, index) => (
            <div key={button.id}>
               <ModalButton variant={button.variant} onClick={() => handleButtonClick(button)} icon={button.icon} iconPosition="left">
                  {button.externalIcon ? (
                     <span className="flex items-center gap-2">
                        {button.label}
                        {button.externalIcon}
                     </span>
                  ) : (
                     button.label
                  )}
               </ModalButton>

               {/* Show divider after first button */}
               {index === 0 ? <TextWithLine text={dividerText} textColour="text-gray-500" lineColour="bg-gray-300" /> : null}
            </div>
         ))}
      </div>
   );
};
