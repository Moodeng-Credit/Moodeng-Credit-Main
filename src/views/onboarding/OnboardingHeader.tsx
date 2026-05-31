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
            {!hideBack ? (
               <button
                  type="button"
                  onClick={handleBack}
                  aria-label={copy.goBack}
                  className="size-6 inline-flex items-center justify-center shrink-0"
               >
                  <span
                     className="block size-6 bg-md-primary-2000 dark:bg-md-neutral-100"
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
            ) : null}
            {title ? (
               <h1 className="truncate text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-md-primary-2000 dark:text-md-neutral-100">
                  {title}
               </h1>
            ) : null}
         </div>
         <button
            type="button"
            aria-label={copy.help}
            onClick={() => navigate('/support')}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md-pill bg-white shadow-md-card dark:border dark:border-md-primary-900/40 dark:bg-[#191023]"
         >
            <span
               className="block size-6 bg-md-primary-1200 dark:bg-md-primary-900"
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
