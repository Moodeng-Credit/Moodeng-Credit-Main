import Image from 'next/image';
import Link from 'next/link';

import { logoImageSrc } from '@/config/navigationConfig';

export default function HeaderLogo({ href }: { href: string }) {
   return (
      <Link href={href} className="flex items-center gap-4 cursor-pointer">
         <Image className="h-[46.95px] w-[42px] object-cover" alt="Moodeng Credit logo" src={logoImageSrc} width={42} height={47} />
         <div className="[font-family:'PP_Telegraf-Ultrabold',Helvetica] font-normal text-[#2154E8] text-2xl tracking-[0] leading-[34px] whitespace-nowrap cursor-pointer hidden lg:block translate-y-1">
            Moodeng Credit
         </div>
      </Link>
   );
}
