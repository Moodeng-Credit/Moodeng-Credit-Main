import { useState } from 'react';

import type { NavItem } from '@/views/profile/types';

interface MobileNavProps {
   navItems: NavItem[];
   infoNavItems: NavItem[];
   onNavItemClick: (label: string) => void;
}

export default function MobileNav({ navItems, infoNavItems, onNavItemClick }: MobileNavProps) {
   const [isOpen, setIsOpen] = useState(false);

   const handleNavClick = (label: string) => {
      onNavItemClick(label);
      setIsOpen(false);
   };

   return (
      <>
         {/* Menu Button */}
         <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden fixed bottom-6 right-6 z-50 bg-[#1D4ED8] text-white p-4 rounded-full shadow-lg hover:bg-[#1e40af] transition-colors"
            aria-label="Toggle menu"
         >
            <i className={`fas ${isOpen ? 'fa-times' : 'fa-bars'} text-lg`}></i>
         </button>

         {/* Overlay */}
         {isOpen ? <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setIsOpen(false)} /> : null}

         {/* Slide-out Menu */}
         <nav
            className={`md:hidden fixed top-0 left-0 h-full w-64 bg-[#b9c8f9] z-40 transform transition-transform duration-300 ease-in-out ${
               isOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
         >
            <div className="pt-10 px-6 space-y-6 overflow-y-auto h-full">
               <ul className="space-y-4">
                  {navItems.map((item) => (
                     <li key={item.label}>
                        <button
                           onClick={() => handleNavClick(item.label)}
                           className={`w-full flex items-center space-x-3 font-semibold text-xs leading-4 ${
                              item.active ? 'text-white bg-[#1D4ED8] rounded-md' : 'text-[#1D4ED8]'
                           }`}
                        >
                           <div className={`p-2 rounded ${item.active ? '' : 'bg-white'}`}>
                              <i className={`fas ${item.icon} text-sm ${item.active ? 'text-white' : 'text-[#1D4ED8]'}`}></i>
                           </div>
                           <span>{item.label}</span>
                        </button>
                     </li>
                  ))}
               </ul>
               <div className="mt-10">
                  <p className="text-[#1D4ED8] font-semibold text-xs leading-4 mb-4">Information</p>
                  <ul className="space-y-4">
                     {infoNavItems.map((item) => (
                        <li key={item.label}>
                           <button
                              onClick={() => handleNavClick(item.label)}
                              className={`w-full flex items-center space-x-3 font-semibold text-xs leading-4 ${
                                 item.active ? 'text-white bg-[#1D4ED8] rounded-md' : 'text-[#1D4ED8]'
                              }`}
                           >
                              <div className={`p-2 rounded ${item.active ? '' : 'bg-white'}`}>
                                 <i className={`fas ${item.icon} text-sm ${item.active ? 'text-white' : 'text-[#1D4ED8]'}`}></i>
                              </div>
                              <span>{item.label}</span>
                           </button>
                        </li>
                     ))}
                  </ul>
               </div>
            </div>
         </nav>
      </>
   );
}
