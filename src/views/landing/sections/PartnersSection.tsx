import { type FC } from 'react';



import PartnerLogo from '@/components/ui/PartnerLogo';

import { type PartnerLogoType, partnersConfig } from '@/views/landing/config/partnersConfig';

const PartnersSection: FC = () => {
   return (
      <div className="w-full py-8 md:py-16 px-4 md:px-8 lg:px-16">
         <div className="max-w-7xl mx-auto">
            <h2 className="text-left [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#f6f6f6] text-xl md:text-2xl lg:text-3xl tracking-[0] mb-8 md:mb-12">
               {partnersConfig.title}
            </h2>

            <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12 w-full">
               {/* Partners Row */}
               <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 md:gap-6 flex-1">
                  {partnersConfig.partners.map((partner: PartnerLogoType) => (
                     <PartnerLogo key={`${partner.name}`} partner={partner} />
                  ))}
               </div>

               {/* Stats Section */}
               <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8">
                  {/* Avatar Stack */}
                  <div className="flex gap-3 md:gap-4 order-2 md:order-1">
                     {partnersConfig.stats.avatars.map((avatar: string, index: number) => (
                        <img
                           key={`${avatar}`}
                           className="w-10 h-10 md:w-16 md:h-16 rounded-full border-2 border-[#f6f6f6]"
                           alt={`User ${index + 1}`}
                           src={avatar}
                           width={64}
                           height={64}
                        />
                     ))}
                  </div>

                  {/* Stats Text */}
                  <div className="flex flex-row items-center gap-2 md:gap-4 order-1 md:order-2">
                     <span className="opacity-70 [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#f6f6f6] text-2xl md:text-[38px] tracking-[0] leading-[48px]">
                        {partnersConfig.stats.number}
                     </span>
                     <span className="opacity-70 [font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#f6f6f6] text-lg md:text-2xl tracking-[0] leading-8">
                        More
                     </span>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
};

export default PartnersSection;
