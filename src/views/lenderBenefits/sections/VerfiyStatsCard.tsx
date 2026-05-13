import { type CSSProperties, type JSX } from 'react';

import { type VerifyStatsCardProps } from '@/views/lenderBenefits/config/verifyStatsConfig';

export const VerifyStatsCard = ({ card }: { card: VerifyStatsCardProps }): JSX.Element => {
   const Icon = card.icon;
   const cardStyle = {
      '--verify-accent': card.accentColor,
      '--verify-accent-soft': card.accentSoftColor
   } as CSSProperties;

   return (
      <div className="flex flex-col w-[33%] max-md:ml-0 max-md:w-full">
         <div className="lender-verify-card flex h-full flex-col rounded-[28px] p-6 max-md:mt-2.5" style={cardStyle}>
            <div className="lender-verify-card__icon">
               <Icon className="size-8" />
            </div>
            <div className="mt-6 flex flex-col items-start text-black">
               <div className={`text-lg font-semibold leading-tight ${card.titleColor}`}>{card.title}</div>
               <div className="mt-3 text-2xl font-semibold leading-none">{card.subtitle}</div>
               <div className="mt-4 text-base leading-7 text-zinc-600">{card.description}</div>
            </div>
         </div>
      </div>
   );
};
