import { useState } from 'react';

import type { NavItem } from '@/views/profile/types';

interface SidebarProps {
   navItems: NavItem[];
   infoNavItems: NavItem[];
   onNavItemClick: (label: string) => void;
}

export default function Sidebar({ navItems, infoNavItems, onNavItemClick }: SidebarProps) {
   const [isCollapsed, setIsCollapsed] = useState(false);

   return (
      <aside
         className={`hidden md:flex bg-[#b9c8f9] ${isCollapsed ? 'w-20' : 'w-56'} flex-col justify-between select-none transition-all duration-300`}
      >
         <nav className="pt-10 px-6 space-y-6">
            <ul className="space-y-4">
               {navItems.map((item) => (
                  <li key={item.label}>
                     <a
                        href="#"
                        onClick={() => onNavItemClick(item.label)}
                        className={`flex items-center space-x-3 font-semibold text-xs leading-4 ${
                           item.active ? 'text-white bg-[#1D4ED8] rounded-md' : 'text-[#1D4ED8]'
                        }`}
                        title={isCollapsed ? item.label : undefined}
                     >
                        <div className={`p-2 rounded ${item.active ? '' : 'bg-white'}`}>
                           <i className={`fas ${item.icon} text-sm ${item.active ? 'text-white' : 'text-[#1D4ED8]'}`}></i>
                        </div>
                        {!isCollapsed ? <span>{item.label}</span> : null}
                     </a>
                  </li>
               ))}
            </ul>
            <div className="mt-10">
               {!isCollapsed ? <p className="text-[#1D4ED8] font-semibold text-xs leading-4 mb-4">Information</p> : null}
               <ul className="space-y-4">
                  {infoNavItems.map((item) => (
                     <li key={item.label}>
                        <a
                           href="#"
                           onClick={() => onNavItemClick(item.label)}
                           className={`flex items-center space-x-3 font-semibold text-xs leading-4 ${
                              item.active ? 'text-white bg-[#1D4ED8] rounded-md' : 'text-[#1D4ED8]'
                           }`}
                           title={isCollapsed ? item.label : undefined}
                        >
                           <div className={`p-2 rounded ${item.active ? '' : 'bg-white'}`}>
                              <i className={`fas ${item.icon} text-sm ${item.active ? 'text-white' : 'text-[#1D4ED8]'}`}></i>
                           </div>
                           {!isCollapsed ? <span>{item.label}</span> : null}
                        </a>
                     </li>
                  ))}
               </ul>
            </div>
            {!isCollapsed ? <p className="text-[#1D4ED8] font-semibold text-xs leading-4 mb-4 mt-10">View more</p> : null}
            <button
               onClick={() => setIsCollapsed(!isCollapsed)}
               className="flex items-center space-x-3 text-[#1D4ED8] font-semibold text-xs leading-4"
               title={isCollapsed ? 'Menu' : undefined}
            >
               <div className="bg-white p-2 rounded">
                  <i className="fas fa-bars text-[#1D4ED8] text-sm"></i>
               </div>
               {!isCollapsed ? <span>Menu</span> : null}
            </button>
         </nav>
         <div className="relative w-full flex justify-center items-center">
            <img
               alt="hippo"
               className="w-full object-contain transition-all duration-300"
               draggable={false}
               height="256"
               src="/board-image.png"
               width="256"
            />
         </div>
      </aside>
   );
}
