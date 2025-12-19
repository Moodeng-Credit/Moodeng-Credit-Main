

import { useState } from 'react';

import { useSelector } from 'react-redux';

import AuthButtons from '@/components/Header/AuthButtons';
import DesktopNav from '@/components/Header/DesktopNav';
import HeaderLogo from '@/components/Header/HeaderLogo';
import MobileNav from '@/components/Header/MobileNav';
import UserMenu from '@/components/Header/UserMenu';

import { navigationButtons } from '@/config/buttonConfig';
import type { RootState } from '@/store/store';

export default function Header() {
   const username = useSelector((state: RootState) => state.auth.username);
   const [isMenuOpen, setIsMenuOpen] = useState(false);
   const [showUserMenu, setShowUserMenu] = useState(false);

   const closeMenu = () => setIsMenuOpen(false);
   const toggleUserMenu = () => setShowUserMenu(!showUserMenu);
   const toggleMobileMenu = () => setIsMenuOpen(!isMenuOpen);
   const closeUserMenu = () => setShowUserMenu(false);

   return (
      <header className="relative w-full bg-[#171420] flex items-center py-4 z-50" role="banner">
         <div className="flex w-full items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-2 md:gap-4">
               <HeaderLogo to="/" onClick={closeMenu} />
               <DesktopNav buttons={navigationButtons} />
            </div>

            <div className="flex items-center gap-4">
               {username ? (
                  <UserMenu
                     dashboardTo="/dashboard"
                     showMenu={showUserMenu}
                     onToggleMenu={toggleUserMenu}
                     onClose={closeUserMenu}
                  />
               ) : (
                  <AuthButtons />
               )}

               {/* Mobile menu toggle */}
               <button
                  className="md:hidden text-white text-2xl"
                  onClick={toggleMobileMenu}
                  aria-label="Toggle navigation menu"
                  aria-expanded={isMenuOpen}
               >
                  ☰
               </button>
            </div>
         </div>

         <MobileNav
            buttons={navigationButtons}
            isOpen={isMenuOpen}
            onClose={closeMenu}
            username={username}
            dashboardTo="/dashboard"
         />
      </header>
   );
}
