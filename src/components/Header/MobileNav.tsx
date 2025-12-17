import Link from 'next/link';

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
         className="absolute top-full left-0 w-full bg-[#171420] border-t border-gray-700 md:hidden z-[60]"
         role="navigation"
         aria-label="Mobile navigation"
      >
         <div className="flex flex-col p-4 space-y-4">
            {username ? (
               <Link
                  href={dashboardHref}
                  onClick={onClose}
                  className="text-white text-center text-[22px] cursor-pointer hover:text-gray-300 transition-colors font-normal"
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
