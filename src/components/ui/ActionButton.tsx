import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { ActionButtonConfig } from '@/types/actionButtonTypes';

interface ActionButtonProps {
   button: ActionButtonConfig;
   onClick?: () => void;
}

export default function ActionButton({ button, onClick }: ActionButtonProps) {
   const { text, bgColor, textColor, href, isExternal = false, width = 'w-auto' } = button;
   const router = useRouter();

   const handleClick = () => {
      if (onClick) {
         onClick();
      }
      if (href && !isExternal) {
         router.push(href);
      }
   };

   const buttonContent = (
      <div
         onClick={handleClick}
         className={`${width} h-[42px] ${bgColor} rounded-[100px] cursor-pointer flex items-center justify-center transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-lg hover:shadow-black/20 active:scale-95`}
      >
         <div
            className={`${textColor} text-[22px] text-center tracking-[0] leading-[22px] whitespace-nowrap font-normal transition-all duration-300 ease-in-out`}
         >
            {text}
         </div>
      </div>
   );

   // If it's an external link, wrap in Link component
   if (href && isExternal) {
      return (
         <Link href={href} target="_blank" rel="noopener noreferrer">
            {buttonContent}
         </Link>
      );
   }

   return buttonContent;
}
