import Link from 'next/link';

import { type NavLink } from '@/config/navigationConfig';

interface DesktopNavProps {
   links: NavLink[];
}

export default function DesktopNav({ links }: DesktopNavProps) {
   return (
      <nav className="hidden md:flex items-center gap-8 xl:gap-12" role="navigation">
         {links.map((link) => (
            <Link
               key={link.href + link.text}
               href={link.href}
               className="text-xl text-nowrap"
               target={link.isExternal ? '_blank' : undefined}
               rel={link.isExternal ? 'noreferrer' : undefined}
            >
               {link.text}
            </Link>
         ))}
      </nav>
   );
}
