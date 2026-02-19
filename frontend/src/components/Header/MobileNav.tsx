import { Link } from 'react-router-dom';

import ActionButton from '@/components/ui/ActionButton';

import { useClickOutside } from '@/hooks/useClickOutside';

import type { ActionButtonConfig } from '@/types/actionButtonTypes';

interface MobileNavProps {
   buttons: ActionButtonConfig[];
   isOpen: boolean;
   onClose: () => void;
   username?: string | null;
   dashboardHref?: string;
}

export default function MobileNav({ buttons, isOpen, onClose, username, dashboardHref = '/dashboard' }: MobileNavProps) {
   const navRef = useClickOutside<HTMLElement>(onClose, isOpen);

   if (!isOpen) return null;

   return (
      <nav
         ref={navRef}
         className="absolute top-full left-0 w-full md:hidden z-[60] bg-white/10 dark:bg-black/25 backdrop-blur-xl border-t border-white/20 dark:border-white/10 shadow-xl"
         role="navigation"
         aria-label="Mobile navigation"
      >
         <div className="flex flex-col p-4 space-y-4">
            {username ? (
               <Link
                  to={dashboardHref}
                  onClick={onClose}
                  className="text-gray-800 dark:text-gray-200 text-center text-[22px] cursor-pointer hover:text-[#6d57ff] transition-colors font-normal"
               >
                  Dashboard
               </Link>
            ) : null}
            {buttons.map((button) => (
               <ActionButton key={button.href} button={button} onClick={onClose} />
            ))}
         </div>
      </nav>
   );
}
