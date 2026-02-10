import { Check, X } from 'lucide-react';

import type { FeaturesConfigProps } from '@/views/lenderBenefits/config/featuresConfig';

export const FeatureRow = ({ feature }: { feature: FeaturesConfigProps }) => {
   return (
      <div className="flex flex-wrap gap-2 justify-between mt-5 max-w-full w-[1268px]">
         <div className="flex flex-col justify-center items-center w-[70%] p-10 bg-white rounded-2xl max-md:pr-5 max-md:max-w-full">
            <div className="text-2xl leading-none text-neutral-900">{feature.title}</div>
            <div className="mt-5 text-lg text-center leading-none text-neutral-700 max-md:max-w-full">{feature.description}</div>
         </div>
         <div className="flex flex-col justify-center items-center px-9 bg-white rounded-2xl h-[167px] w-[167px] max-md:px-5">
            <div className="flex items-center justify-center w-[46px] h-[45px] bg-green-500 rounded-lg">
               <Check className="w-[32px] h-[32px] text-white stroke-[3]" />
            </div>
         </div>
         <div className="flex flex-col justify-center items-center px-9 bg-white rounded-2xl h-[167px] w-[167px] max-md:px-5">
            <div className="flex items-center justify-center w-[45px] h-[45px] bg-pink-200 rounded-lg">
               <X className="w-[32px] h-[32px] text-red-600 stroke-[3]" />
            </div>
         </div>
      </div>
   );
};
