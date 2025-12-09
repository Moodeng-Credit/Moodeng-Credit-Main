'use client';

import { useState } from 'react';

import { Menu } from 'lucide-react';
import { useSelector } from 'react-redux';

import AuthButtons from '@/components/Header/AuthButtons';
import DesktopNav from '@/components/Header/DesktopNav';
import HeaderLogo from '@/components/Header/HeaderLogo';
import MobileNav from '@/components/Header/MobileNav';
import UserMenu from '@/components/Header/UserMenu';

import { headerLinks } from '@/config/navigationConfig';
import type { RootState } from '@/store/store';

export default function Header() {
   const username = useSelector((state: RootState) => state.auth.username);
   const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
   const [showUserMenu, setShowUserMenu] = useState(false);

   const closeMenu = () => setIsMobileMenuOpen(false);
   const toggleUserMenu = () => setShowUserMenu(!showUserMenu);
   const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
   const closeUserMenu = () => setShowUserMenu(false);

   return (
      <header className="relative w-full flex items-center py-4 z-50" role="banner">
         <div className="flex w-full items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-2 md:gap-4 lg:gap-8 xl:gap-12">
               <HeaderLogo href="/" />
               <div className="hidden md:block h-8 w-px bg-black/50"></div>
               <DesktopNav links={headerLinks} />
            </div>

            <div className="flex items-center gap-4">
               {username ? <UserMenu showMenu={showUserMenu} onToggleMenu={toggleUserMenu} onClose={closeUserMenu} /> : <AuthButtons />}

               {/* Mobile menu toggle */}
               <button
                  className="md:hidden"
                  onClick={toggleMobileMenu}
                  aria-label="Toggle navigation menu"
                  aria-expanded={isMobileMenuOpen}
               >
                  <Menu />
               </button>
            </div>
         </div>

         <MobileNav links={headerLinks} isOpen={isMobileMenuOpen} onClose={closeMenu} username={username} />
      </header>
   );
}
