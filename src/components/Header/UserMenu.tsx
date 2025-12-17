import Link from 'next/link';

import UserNetwork from '@/components/UserNetwork';

import { useClickOutside } from '@/hooks/useClickOutside';

interface UserMenuProps {
   dashboardHref?: string;
   showMenu: boolean;
   onToggleMenu: () => void;
   onClose: () => void;
}

export default function UserMenu({ dashboardHref = '/dashboard', showMenu, onToggleMenu, onClose }: UserMenuProps) {
   const dropdownRef = useClickOutside<HTMLDivElement>(onClose);

   return (
      <div className="flex items-center space-x-4 relative" ref={dropdownRef}>
         <Link
            href={dashboardHref}
            className="bg-[#6d57ff] text-white px-4 py-2 rounded-full cursor-pointer hover:bg-[#5a4ae5] transition-colors hidden sm:block"
         >
            <span className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-sm">App</span>
         </Link>
         <button
            aria-label="Notifications"
            className="bg-blue-600 text-white px-3 py-2 rounded-full hover:bg-blue-700 transition cursor-pointer"
         >
            <i className="fas fa-bell"></i>
         </button>
         <button
            aria-label="User profile"
            onClick={onToggleMenu}
            className="bg-blue-600 text-white px-3 py-2 rounded-full hover:bg-blue-700 transition cursor-pointer"
         >
            <i className="fas fa-user"></i>
         </button>
         {showMenu ? <UserNetwork /> : null}
      </div>
   );
}
