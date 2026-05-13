import { type CSSProperties, type JSX } from 'react';

import { Check } from 'lucide-react';

import ActionButton from '@/components/ui/ActionButton';

import { type CardData } from '@/views/lenderBenefits/config/mostNeededConfig';

interface MostNeededCardProps {
   data: CardData;
}

export default function MostNeededCard({ data }: MostNeededCardProps): JSX.Element {
   const buttonConfig = data.ctaButtonConfig ? data.ctaButtonConfig : [];
   const accentStyle = {
      '--market-accent': data.accentColor,
      '--market-accent-soft': data.accentSoftColor
   } as CSSProperties;

   return (
      <div
         className="lender-market-card flex h-full w-full flex-col rounded-[28px] bg-neutral-100 px-6 py-7 shadow-lg max-md:px-5"
         style={accentStyle}
      >
         <div className="lender-market-card__region">
            <div className="lender-market-card__symbols" aria-hidden="true">
               {data.regionSymbols.map((symbol) => (
                  <span key={`${symbol.label}-${symbol.value}`}>
                     {symbol.type === 'image' ? (
                        <img src={symbol.value} alt="" width={32} height={32} loading="lazy" />
                     ) : (
                        symbol.value
                     )}
                  </span>
               ))}
            </div>
            <div>
               <strong>{data.regionLabel}</strong>
               <small>{data.regionDetail}</small>
            </div>
         </div>

         <div className="mt-5">
            <div className={`text-xl font-semibold uppercase leading-tight tracking-[0.04em] ${data.titleColor}`}>{data.title}</div>
            <div className="mt-3 flex items-baseline gap-2">
               <div className={`text-5xl font-semibold leading-none max-md:text-4xl ${data.mainNumberColor}`}>{data.mainNumber}</div>
               {data.subtitle ? <div className="text-xl font-semibold leading-none text-zinc-700">{data.subtitle}</div> : null}
            </div>
         </div>

         <div className="mt-6 space-y-4">
            {data.features.map((feature) => (
               <div key={feature.title} className="space-y-1">
                  <div className="flex gap-2.5 items-center">
                     <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${data.titleColor.replace('text-', 'bg-')}`}
                     >
                        <Check className="w-4 h-4 text-white" />
                     </div>
                     <div className="text-lg font-semibold leading-tight">{feature.title}</div>
                  </div>
                  <div className="pl-9 text-sm leading-5 text-zinc-600">{feature.description}</div>
               </div>
            ))}
         </div>

         {data.opportunitySection ? (
            <div className="mt-7 border-t border-zinc-200 pt-5">
               <div className={`flex items-center gap-4 text-lg font-semibold leading-tight ${data.opportunitySection.titleColor}`}>
                  <div className="shrink-0">{data.opportunitySection.title}</div>
                  <div className={`h-0.5 w-full ${data.opportunitySection.titleColor.replace('text-', 'bg-')}`} />
               </div>

               <div className="mt-4 space-y-3">
                  {data.opportunitySection.items.map((item) => (
                     <div key={item.title} className="space-y-1">
                        <div className="flex gap-2.5 items-center">
                           <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${data.opportunitySection.titleColor.replace('text-', 'bg-')}`}
                           >
                              <Check className="w-4 h-4 text-white" />
                           </div>
                           <div className="text-lg font-semibold leading-tight">{item.title}</div>
                        </div>
                        {item.description ? <div className="pl-9 text-sm leading-5 text-zinc-600">{item.description}</div> : null}
                     </div>
                  ))}
               </div>
            </div>
         ) : null}

         {buttonConfig.length > 0 ? (
            <div className="mt-7 flex justify-center">
               {buttonConfig.map((button) => (
                  <ActionButton key={button.text} button={button} />
               ))}
            </div>
         ) : null}
      </div>
   );
}
