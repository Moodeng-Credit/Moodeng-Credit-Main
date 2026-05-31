import { type FC } from 'react';

import { ModalHeader } from '@/components/worldId/modal/ModalHeader';

import { useLocalization } from '@/i18n/LocalizationProvider';
import type { LocaleCode } from '@/i18n/translations';

interface VerificationModalHeaderProps {
   onClose: () => void;
}

const VERIFICATION_MODAL_HEADER_COPY = {
   en: {
      goBack: 'Go back',
      viewInformation: 'View information',
      title: 'Verify World ID',
      mainTitle: "Verify You're Human",
      description: "Prove you're a real person with World ID"
   },
   fil: {
      goBack: 'Bumalik',
      viewInformation: 'Tingnan ang impormasyon',
      title: 'I-verify ang World ID',
      mainTitle: 'I-verify na tao ka',
      description: 'Patunayan na totoong tao ka gamit ang World ID'
   },
   id: {
      goBack: 'Kembali',
      viewInformation: 'Lihat informasi',
      title: 'Verifikasi World ID',
      mainTitle: 'Verifikasi bahwa kamu manusia',
      description: 'Buktikan bahwa kamu orang sungguhan dengan World ID'
   }
} satisfies Record<
   LocaleCode,
   {
      goBack: string;
      viewInformation: string;
      title: string;
      mainTitle: string;
      description: string;
   }
>;

export const VerificationModalHeader: FC<VerificationModalHeaderProps> = ({ onClose }) => {
   const { locale } = useLocalization();
   const copy = VERIFICATION_MODAL_HEADER_COPY[locale] ?? VERIFICATION_MODAL_HEADER_COPY.en;

   return (
      <>
         <div className="flex items-center justify-between bg-white px-4 sm:px-6 py-3 sm:py-4 font-sans border-b border-gray-200">
            <div className="flex items-center gap-3">
               <button
                  onClick={onClose}
                  className="flex items-center justify-center -ml-2 rounded-full transition-all active:scale-95"
                  aria-label={copy.goBack}
               >
                  <img src="/world-id-back.svg" alt="" aria-hidden="true" className="w-7 h-7 sm:w-8 sm:h-8" />
               </button>

               <h3 className="text-xl sm:text-3xl font-semibold text-gray-900 tracking-tighter">{copy.title}</h3>
            </div>
            <button
               // onClick={() => window.open(modalHeaderConfig.infoLink, '_blank')}
               className="flex items-center justify-center rounded-full text-blue-600 w-8 h-8 sm:w-12 sm:h-12 transition-all active:scale-95 shadow-md"
               aria-label={copy.viewInformation}
            >
               <img src="/world-id-info.svg" alt="" aria-hidden="true" className="w-5 h-5 sm:w-7 sm:h-7" />
            </button>
         </div>
         <ModalHeader
            title={copy.mainTitle}
            description={copy.description}
            titleId="verification-modal-title"
            descriptionId="verification-modal-description"
            isMainContent
         />
      </>
   );
};
