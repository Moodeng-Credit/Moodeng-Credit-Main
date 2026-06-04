import { type FC, type ReactNode } from 'react';

import { useLocalization } from '@/i18n/LocalizationProvider';
import type { LocaleCode } from '@/i18n/translations';

interface ModalHeaderProps {
   title?: string;
   description?: string;
   titleId?: string;
   descriptionId?: string;
   leftIcon?: ReactNode;
   onLeftIconClick?: () => void;
   onClose?: () => void;
   isMainContent?: boolean;
}

const MODAL_HEADER_COPY = {
   en: {
      goBack: 'Go back',
      verifyWorldId: 'Verify World ID',
      defaultTitle: "Verify You're Human"
   },
   fil: {
      goBack: 'Bumalik',
      verifyWorldId: 'I-verify ang World ID',
      defaultTitle: 'I-verify na tao ka'
   },
   id: {
      goBack: 'Kembali',
      verifyWorldId: 'Verifikasi World ID',
      defaultTitle: 'Verifikasi bahwa kamu manusia'
   }
} satisfies Record<LocaleCode, { goBack: string; verifyWorldId: string; defaultTitle: string }>;

export const ModalHeader: FC<ModalHeaderProps> = ({
   title,
   description,
   titleId,
   descriptionId,
   leftIcon,
   onLeftIconClick,
   onClose,
   isMainContent
}) => {
   const { locale } = useLocalization();
   const copy = MODAL_HEADER_COPY[locale] ?? MODAL_HEADER_COPY.en;

   return (
      <div className="relative flex font-sans flex-col bg-white px-4 sm:px-5 space-y-2 sm:space-y-3 pt-3 sm:pt-5">
         {/* Top Nav Bar */}
         {onClose && (
            <div className="flex items-center justify-between">
               <button
                  onClick={onClose}
                  className="flex items-center justify-center text-gray-700 hover:text-gray-900 transition-colors"
                  aria-label={copy.goBack}
               >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
               </button>
               <span className="text-sm font-medium text-gray-900">{copy.verifyWorldId}</span>
               <div className="w-6" />
            </div>
         )}

         <img src="/world-id.png" alt="" aria-hidden="true" className="w-16 sm:w-20" />

         <div className="flex-1 text-left flex flex-col gap-1 sm:gap-2">
            {/* Main Title: Deep Navy, Bold, Large */}
            <h2 id={titleId} className="text-lg sm:text-3xl font-semibold text-md-heading leading-tighter tracking-tight">
               {title || copy.defaultTitle}
            </h2>

            {/* Description: Medium Gray, Regular Weight */}
            {description && (
               <p id={descriptionId} className="text-xs sm:text-base text-gray-500 font-medium">
                  {description}
               </p>
            )}
         </div>
      </div>
   );
};
