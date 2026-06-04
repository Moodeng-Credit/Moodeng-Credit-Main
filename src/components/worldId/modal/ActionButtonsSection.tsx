import { type FC } from 'react';

// import TextWithLine from '@/components/ui/TextWithLine';
import { ModalButton } from '@/components/worldId/modal/ModalButton';
// import { dividerText, verificationButtons } from '@/components/worldId/modal/verificationModalConfig';
import { verificationButtons } from '@/components/worldId/modal/verificationModalConfig';

import { useLocalization } from '@/i18n/LocalizationProvider';
import type { LocaleCode } from '@/i18n/translations';

interface ActionButtonsSectionProps {
   onVerify: () => void;
   onCheckStatus: () => void;
}

const ACTION_BUTTONS_COPY = {
   en: {
      labels: {
         'connect-world-id': 'Verify with World ID',
         'find-location': 'Find a Verification Location',
         'check-status': 'Check Connection Status'
      }
   },
   fil: {
      labels: {
         'connect-world-id': 'Mag-verify gamit ang World ID',
         'find-location': 'Maghanap ng verification location',
         'check-status': 'Tingnan ang connection status'
      }
   },
   id: {
      labels: {
         'connect-world-id': 'Verifikasi dengan World ID',
         'find-location': 'Cari lokasi verifikasi',
         'check-status': 'Cek status koneksi'
      }
   }
} satisfies Record<LocaleCode, { labels: Record<string, string> }>;

export const ActionButtonsSection: FC<ActionButtonsSectionProps> = ({ onVerify, onCheckStatus }) => {
   const { locale } = useLocalization();
   const copy = ACTION_BUTTONS_COPY[locale] ?? ACTION_BUTTONS_COPY.en;
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
         {verificationButtons.map((button) => (
            <div key={button.id}>
               <ModalButton
                  variant={button.variant}
                  onClick={() => handleButtonClick(button)}
                  icon={button.icon}
                  iconPosition={button.iconPosition || 'left'}
               >
                  {button.externalIcon ? (
                     <span className="flex items-center gap-2">
                        {copy.labels[button.id] ?? button.label}
                        {button.externalIcon}
                     </span>
                  ) : (
                     (copy.labels[button.id] ?? button.label)
                  )}
               </ModalButton>

               {/* Show divider after first button */}
               {/* {index === 0 ? <TextWithLine text={dividerText} textColour="text-gray-500" lineColour="bg-gray-300" /> : null} */}
            </div>
         ))}
      </div>
   );
};
