import { Link } from 'react-router-dom';

import type { ActionButtonConfig } from '@/types/actionButtonTypes';

interface ActionButtonProps {
   button: ActionButtonConfig;
   onClick?: () => void;
}

export default function ActionButton({ button, onClick }: ActionButtonProps) {
   const { text, bgColor, textColor, href, isExternal = false, width = 'w-auto' } = button;

   const buttonClasses = `${width} h-[42px] ${bgColor} rounded-[100px] cursor-pointer flex items-center justify-center transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-lg hover:shadow-black/20 active:scale-95`;
   const textClasses = `${textColor} text-[22px] text-center tracking-[0] leading-[22px] whitespace-nowrap font-normal transition-all duration-300 ease-in-out`;

   if (!href) {
      return (
         <button onClick={onClick} className={buttonClasses} type="button">
            <span className={textClasses}>{text}</span>
         </button>
      );
   }

   if (isExternal) {
      return (
         <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={buttonClasses}>
            <span className={textClasses}>{text}</span>
         </a>
      );
   }

   return (
      <Link to={href} onClick={onClick} className={buttonClasses}>
         <span className={textClasses}>{text}</span>
      </Link>
   );
}
