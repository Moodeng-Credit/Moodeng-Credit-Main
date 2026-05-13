import { Check, X } from 'lucide-react';

import type { FeaturesConfigProps } from '@/views/lenderBenefits/config/featuresConfig';

export const FeatureRow = ({ feature }: { feature: FeaturesConfigProps }) => {
   return (
      <div className="lender-feature-row mt-5 w-[1268px] max-w-full">
         <div className="lender-feature-copy bg-white">
            <div className="text-2xl leading-tight text-neutral-900">{feature.title}</div>
            <div className="mt-4 text-lg leading-snug text-neutral-700 max-md:max-w-full">{feature.description}</div>
            <div className="lender-feature-mobile-result" aria-label={`${feature.title} comparison`}>
               <div className="lender-feature-mobile-pill lender-feature-mobile-pill--yes">
                  <span>Moodeng</span>
                  <Check className="size-5 text-white stroke-[3]" />
               </div>
               <div className="lender-feature-mobile-pill lender-feature-mobile-pill--no">
                  <span>TradFi</span>
                  <X className="size-5 text-red-600 stroke-[3]" />
               </div>
            </div>
         </div>
         <div className="lender-feature-status lender-feature-status--desktop bg-white">
            <div className="lender-feature-status__label">Moodeng</div>
            <div className="flex items-center justify-center w-[46px] h-[45px] bg-green-500 rounded-lg max-md:h-10 max-md:w-10">
               <Check className="w-[32px] h-[32px] text-white stroke-[3] max-md:h-7 max-md:w-7" />
            </div>
         </div>
         <div className="lender-feature-status lender-feature-status--desktop bg-white">
            <div className="lender-feature-status__label">TradFi</div>
            <div className="flex items-center justify-center w-[45px] h-[45px] bg-pink-200 rounded-lg max-md:h-10 max-md:w-10">
               <X className="w-[32px] h-[32px] text-red-600 stroke-[3] max-md:h-7 max-md:w-7" />
            </div>
         </div>
      </div>
   );
};
