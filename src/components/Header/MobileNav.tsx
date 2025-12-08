import Link from 'next/link';

import { useClickOutside } from '@/hooks/useClickOutside';

import { type NavLink } from '@/config/navigationConfig';

interface MobileNavProps {
   links: NavLink[];
   isOpen: boolean;
   onClose: () => void;
   username?: string | null;
}

export default function MobileNav({ links, isOpen, onClose, username }: MobileNavProps) {
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
               <Link href="/dashboard" className="text-white text-center text-xl hover:text-gray-300 transition-colors">
                  Dashboard
               </Link>
            ) : null}
            {links.map((link) => (
               <Link
                  onClick={onClose}
                  key={link.href + link.text}
                  href={link.href}
                  className="text-xl text-white text-center hover:text-gray-300 transition-colors"
                  target={link.isExternal ? '_blank' : undefined}
                  rel={link.isExternal ? 'noreferrer' : undefined}
               >
                  {link.text}
               </Link>
            ))}
         </div>
      </nav>
   );
}
