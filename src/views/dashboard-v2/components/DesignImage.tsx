import { type CSSProperties, useState } from 'react';

import clsx from 'clsx';

interface DesignImageProps {
   src: string;
   alt?: string;
   className?: string;
   style?: CSSProperties;
}

/**
 * Figma art for the dashboard preview. Until the exported file exists in `public/dashboard-v2/`,
 * a soft lavender placeholder holds its slot so the layout still reads correctly.
 */
export default function DesignImage({ src, alt = '', className, style }: DesignImageProps) {
   const [failedSrc, setFailedSrc] = useState<string | null>(null);

   if (failedSrc === src) {
      return (
         <span
            aria-hidden={alt ? undefined : true}
            role={alt ? 'img' : undefined}
            aria-label={alt || undefined}
            className={clsx('block rounded-md-md bg-[#ebe6f7]/70 outline outline-1 outline-dashed outline-[#c9bfe6]', className)}
            style={style}
         />
      );
   }

   return (
      <img src={src} alt={alt} className={clsx('block', className)} style={style} onError={() => setFailedSrc(src)} draggable={false} />
   );
}
