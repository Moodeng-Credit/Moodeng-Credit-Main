import { type FC } from 'react';

import Image from 'next/image';

import type { PartnerLogoType } from '@/views/landing/config/partnersConfig';

interface PartnerLogoProps {
   partner: PartnerLogoType;
}

const PartnerLogo: FC<PartnerLogoProps> = ({ partner }) => {
   const { width, height } = partner;
   const defaultWidth = 150;
   const defaultHeight = 150;
   return (
      <div className="flex items-center justify-center">
         <Image
            className={`${partner.className || ''}`}
            alt={partner.alt}
            src={partner.src}
            width={width || defaultWidth}
            height={height || defaultHeight}
         />
      </div>
   );
};

export default PartnerLogo;
