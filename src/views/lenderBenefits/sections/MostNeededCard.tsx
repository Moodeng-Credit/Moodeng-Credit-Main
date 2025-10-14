import { type JSX } from 'react';

import Image from 'next/image';

import { Check } from 'lucide-react';

import ActionButton from '@/components/ui/ActionButton';

import { type CardData } from '@/views/lenderBenefits/config/mostNeededConfig';

interface MostNeededCardProps {
   data: CardData;
}

export default function MostNeededCard({ data }: MostNeededCardProps): JSX.Element {
   const buttonConfig = data.ctaButtonConfig ? data.ctaButtonConfig : [];

   return (
      <div className="flex flex-col h-full px-8 py-12 shadow-2xl bg-neutral-100 rounded-[60px] w-full max-md:px-5">
         {/* Icon */}
         <Image loading="lazy" src={data.icon} alt="" className="object-contain w-16 aspect-square" width={64} height={64} />

         {/* Title and Number Section */}
         <div className="mt-5">
            <div className={`text-2xl leading-none uppercase ${data.titleColor}`}>{data.title}</div>
            <div className="flex gap-1.5 mt-2.5">
               <div className={`text-6xl leading-none max-md:text-4xl ${data.mainNumberColor}`}>{data.mainNumber}</div>
               {data.subtitle ? <div className="flex-auto self-start mt-4 text-3xl leading-none">{data.subtitle}</div> : null}
            </div>
         </div>

         {/* Features Section */}
         <div className="mt-5 space-y-2.5 h-[430px] ">
            {data.features.map((feature) => (
               <div key={feature.title} className="space-y-1">
                  <div className="flex gap-2.5 items-center">
                     <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${data.titleColor.replace('text-', 'bg-')}`}
                     >
                        <Check className="w-4 h-4 text-white" />
                     </div>
                     <div className="text-[22px] leading-tight">{feature.title}</div>
                  </div>
                  <div className="pl-9 text-base text-zinc-600">{feature.description}</div>
               </div>
            ))}
         </div>

         {/* Opportunity Section - positioned at bottom */}
         {data.opportunitySection ? (
            <div className="mt-8">
               <div className={`flex gap-4 items-center text-[22px] leading-tight ${data.opportunitySection.titleColor}`}>
                  <div className="grow">{data.opportunitySection.title}</div>
                  <div className={`h-0.5 w-full ${data.opportunitySection.titleColor.replace('text-', 'bg-')}`} />
               </div>

               <div className="mt-2.5 space-y-2.5">
                  {data.opportunitySection.items.map((item) => (
                     <div key={item.title} className="space-y-1">
                        <div className="flex gap-2.5 items-center">
                           <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${data.opportunitySection.titleColor.replace('text-', 'bg-')}`}
                           >
                              <Check className="w-4 h-4 text-white" />
                           </div>
                           <div className="text-[22px] leading-tight">{item.title}</div>
                        </div>
                        {item.description ? <div className="pl-9 text-base text-zinc-600">{item.description}</div> : null}
                     </div>
                  ))}
               </div>
            </div>
         ) : null}

         {/* CTA Button */}
         {buttonConfig.length > 0 ? (
            <div className="flex justify-center mt-8">
               {buttonConfig.map((button) => (
                  <ActionButton key={button.text} button={button} />
               ))}
            </div>
         ) : null}
      </div>
   );
}
