import { Landmark, type LucideIcon } from 'lucide-react';
import { type JSX } from 'react';

import { featuresConfig } from '@/views/lenderBenefits/config/featuresConfig';
import { FeatureRow } from '@/views/lenderBenefits/sections/FeatureRow';

const MoodengFeatureLogo = (): JSX.Element => {
   return (
      <span className="lender-feature-column-logo lender-feature-column-logo--moodeng" aria-hidden="true">
         <img src="/hippos/referral-boost.png" alt="" />
      </span>
   );
};

const TradFiFeatureLogo = ({ Icon }: { Icon: LucideIcon }): JSX.Element => {
   return (
      <span className="lender-feature-column-logo lender-feature-column-logo--tradfi" aria-hidden="true">
         <Icon className="size-5 stroke-[2.5]" />
      </span>
   );
};

const FeaturesHeaderRow = (): JSX.Element => {
   return (
      <div className="lender-feature-header mt-16 mb-8 w-[1268px] max-w-full text-white max-md:mt-8">
         <div className="lender-feature-heading bg-orange-600">Features</div>
         <div className="lender-feature-column-label bg-blue-600">
            <MoodengFeatureLogo />
            <strong>Moodeng</strong>
         </div>
         <div className="lender-feature-column-label bg-zinc-700">
            <TradFiFeatureLogo Icon={Landmark} />
            <strong>TradFi</strong>
         </div>
      </div>
   );
};

export default function FeaturesSection(): JSX.Element {
   return (
      <div
         id="features"
         className="lender-features-section flex flex-col items-center mt-20 mb-24 max-w-full rounded-none w-[1425px] max-md:mt-10 max-md:mb-16"
      >
         <div className="self-stretch px-16 py-8 text-5xl text-center text-black bg-amber-400 leading-[50px] rounded-[60px] w-full max-md:px-5 max-md:max-w-full max-md:text-4xl max-md:leading-10">
            Moodeng vs. TradFi lending
         </div>
         <FeaturesHeaderRow />
         {featuresConfig.map((feature) => (
            <FeatureRow key={feature.title} feature={feature} />
         ))}
      </div>
   );
}
