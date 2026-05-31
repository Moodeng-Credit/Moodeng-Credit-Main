import { useNavigate } from 'react-router-dom';

import { useLocalization } from '@/i18n/LocalizationProvider';
import type { LocaleCode } from '@/i18n/translations';

type OnboardingHeaderProps = {
   title?: string;
   onBack?: () => void;
   hideBack?: boolean;
};

const HEADER_COPY = {
   en: {
      goBack: 'Go back',
      help: 'Help'
   },
   fil: {
      goBack: 'Bumalik',
      help: 'Tulong'
   },
   id: {
      goBack: 'Kembali',
      help: 'Bantuan'
   },
   th: {
      goBack: 'กลับ',
      help: 'ช่วยเหลือ'
   },
   vi: {
      goBack: 'Quay lại',
      help: 'Trợ giúp'
   }
} satisfies Record<LocaleCode, { goBack: string; help: string }>;

export function OnboardingHeader({ title, onBack, hideBack = false }: OnboardingHeaderProps) {
   const navigate = useNavigate();
   const { locale } = useLocalization();
   const copy = HEADER_COPY[locale] ?? HEADER_COPY.en;

   const handleBack = () => {
      if (onBack) {
         onBack();
         return;
      }
      navigate(-1);
   };

   return (
      <div className="flex items-center justify-between px-md-5 py-md-3 w-full">
         <div className="flex items-center gap-md-3 flex-1 min-w-0">
            {!hideBack && (
               <button
                  type="button"
                  onClick={handleBack}
                  aria-label={copy.goBack}
                  className="size-6 inline-flex items-center justify-center shrink-0"
               >
                  <span
                     className="block size-6 bg-md-primary-2000"
                     style={{
                        WebkitMaskImage: "url('/icons/arrow-left.svg')",
                        maskImage: "url('/icons/arrow-left.svg')",
                        WebkitMaskRepeat: 'no-repeat',
                        maskRepeat: 'no-repeat',
                        WebkitMaskPosition: 'center',
                        maskPosition: 'center',
                        WebkitMaskSize: 'contain',
                        maskSize: 'contain'
                     }}
                  />
               </button>
            )}
            {title && <h1 className="text-[28px] leading-[1.1] tracking-[-0.02em] font-semibold text-md-primary-2000 truncate">{title}</h1>}
         </div>
         <button
            type="button"
            aria-label={copy.help}
            onClick={() => navigate('/support')}
            className="h-12 w-12 inline-flex items-center justify-center bg-white rounded-md-pill shadow-md-card shrink-0"
         >
            <span
               className="block size-6 bg-md-primary-1200"
               style={{
                  WebkitMaskImage: "url('/icons/question_light.svg')",
                  maskImage: "url('/icons/question_light.svg')",
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain'
               }}
            />
         </button>
      </div>
   );
}
