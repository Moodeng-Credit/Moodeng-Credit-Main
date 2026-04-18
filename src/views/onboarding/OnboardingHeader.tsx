import { useNavigate } from 'react-router-dom';

type OnboardingHeaderProps = {
   title?: string;
   onBack?: () => void;
   hideBack?: boolean;
};

export function OnboardingHeader({ title, onBack, hideBack = false }: OnboardingHeaderProps) {
   const navigate = useNavigate();

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
                  aria-label="Go back"
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
            {title && (
               <h1 className="text-[28px] leading-[1.1] tracking-[-0.02em] font-semibold text-md-primary-2000 truncate">
                  {title}
               </h1>
            )}
         </div>
         <button
            type="button"
            aria-label="Help"
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
