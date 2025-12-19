import { type JSX } from 'react';



import { featuresConfig } from '@/views/lenderBenefits/config/featuresConfig';
import { FeatureRow } from '@/views/lenderBenefits/sections/FeatureRow';

const FeaturesHeaderRow = (): JSX.Element => {
   return (
      <div className="flex flex-wrap gap-5 justify-between mt-16 mb-8 max-w-full text-white whitespace-nowrap w-[1268px] max-md:mt-10">
         <div className="overflow-hidden w-[70%] px-5 py-8 text-3xl text-center leading-none bg-orange-600 rounded-2xl max-md:max-w-full">
            Features
         </div>
         <div className="flex overflow-hidden px-2.5 py-7 text-2xl leading-none bg-blue-600 rounded-2xl">
            <img
               alt=""
               loading="lazy"
               src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/c94bcfa4f537ec96f9e5bcd32dbc5c90aee846a5af5d522c7adba5139ea41450?apiKey=e485b3dc4b924975b4554885e21242bb"
               className="object-contain shrink-0 aspect-[0.93] w-[42px]"
               width={100}
               height={45}
            />
            <div className="my-auto basis-auto">Moodeng</div>
         </div>
         <img
            alt=""
            loading="lazy"
            src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/dcdd6ee08cc4161b88a9fcad93b15016ea984db92f39e024fbe49b8e356bb14c?apiKey=e485b3dc4b924975b4554885e21242bb"
            className="object-contain shrink-0 max-w-full rounded-2xl aspect-[1.74] w-[169px]"
            width={100}
            height={97}
         />
      </div>
   );
};

export default function FeaturesSection(): JSX.Element {
   return (
      <div id="features" className="flex flex-col items-center mt-20 max-w-full rounded-none w-[1425px] max-md:mt-10">
         <div className="self-stretch px-16 py-8 text-5xl text-center text-black bg-amber-400 leading-[50px] rounded-[60px] w-full max-md:px-5 max-md:max-w-full max-md:text-4xl max-md:leading-10">
            Moodeng: Revolutionizing Peer-to-Peer Lending vs. Tradfi
         </div>
         <FeaturesHeaderRow />
         {featuresConfig.map((feature) => (
            <FeatureRow key={feature.title} feature={feature} />
         ))}
      </div>
   );
}
