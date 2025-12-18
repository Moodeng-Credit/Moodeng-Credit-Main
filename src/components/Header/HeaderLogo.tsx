import Image from 'next/image';
import Link from 'next/link';

import { logoImageSrc } from '@/config/navigationConfig';

interface HeaderLogoProps {
   href?: string;
   onClick?: () => void;
}

export default function HeaderLogo({ href = '/', onClick }: HeaderLogoProps) {
   return (
      <Link href={href} onClick={onClick} className="flex items-center gap-1 cursor-pointer">
         <Image className="h-[46.95px] w-[42px] object-cover" alt="Moodeng Credit logo" src={logoImageSrc} width={42} height={47} />
         <span className="[font-family:'PP_Telegraf-Ultrabold',Helvetica] font-normal text-white text-2xl tracking-[0] leading-[34px] whitespace-nowrap hidden md:block">
            Moodeng Credit
         </span>
      </Link>
   );
}
