import Image from 'next/image';

import { logoImageSrc } from '@/config/navigationConfig';

interface HeaderLogoProps {
   onClick: () => void;
}

export default function HeaderLogo({ onClick }: HeaderLogoProps) {
   return (
      <div onClick={onClick} className="flex items-center gap-1 cursor-pointer">
         <Image className="h-[46.95px] w-[42px] object-cover" alt="Moodeng Credit logo" src={logoImageSrc} width={42} height={47} />
         <div className="[font-family:'PP_Telegraf-Ultrabold',Helvetica] font-normal text-white text-2xl tracking-[0] leading-[34px] whitespace-nowrap cursor-pointer hidden md:block">
            Moodeng Credit
         </div>
      </div>
   );
}
