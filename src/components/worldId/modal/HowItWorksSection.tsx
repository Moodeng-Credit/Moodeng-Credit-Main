import { type FC } from 'react';

import { ModalStep } from '@/components/worldId/modal/ModalStep';
import { verificationSteps } from '@/components/worldId/modal/verificationModalConfig';

import { useLocalization } from '@/i18n/LocalizationProvider';
import type { LocaleCode } from '@/i18n/translations';

const HOW_IT_WORKS_COPY = {
   en: {
      sectionTitle: 'How to Verify?',
      steps: [
         {
            title: 'Click "Verify with World ID"',
            description: 'Opens the verification modal'
         },
         {
            title: 'Scan QR with World App',
            description: 'Uses your phone camera'
         },
         {
            title: 'Confirm & Complete',
            description: 'Verified instantly'
         }
      ]
   },
   fil: {
      sectionTitle: 'Paano mag-verify?',
      steps: [
         {
            title: 'I-click ang "Mag-verify gamit ang World ID"',
            description: 'Bubuksan nito ang verification modal'
         },
         {
            title: 'I-scan ang QR gamit ang World App',
            description: 'Gamitin ang camera ng phone mo'
         },
         {
            title: 'Kumpirmahin at tapusin',
            description: 'Mave-verify agad'
         }
      ]
   },
   id: {
      sectionTitle: 'Bagaimana cara verifikasi?',
      steps: [
         {
            title: 'Klik "Verifikasi dengan World ID"',
            description: 'Membuka modal verifikasi'
         },
         {
            title: 'Pindai QR dengan World App',
            description: 'Gunakan kamera ponsel kamu'
         },
         {
            title: 'Konfirmasi dan selesai',
            description: 'Terverifikasi secara instan'
         }
      ]
   }
} satisfies Record<LocaleCode, { sectionTitle: string; steps: Array<{ title: string; description: string }> }>;

export const HowItWorksSection: FC = () => {
   const { locale } = useLocalization();
   const copy = HOW_IT_WORKS_COPY[locale] ?? HOW_IT_WORKS_COPY.en;

   return (
      <div>
         <h3 className="mb-2 sm:mb-4 text-sm sm:text-[18px] font-semibold font-sans text-gray-900 text-left">{copy.sectionTitle}</h3>

         <div className="space-y-2 sm:space-y-3">
            {verificationSteps.map((step, index) => (
               <ModalStep
                  key={step.stepNumber}
                  stepNumber={step.stepNumber}
                  title={copy.steps[index]?.title ?? step.title}
                  description={copy.steps[index]?.description ?? step.description}
                  icon={step.icon}
                  iconColor={step.iconColor}
                  bgColor={step.bgColor}
               />
            ))}
         </div>
      </div>
   );
};
