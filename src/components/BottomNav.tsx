import { ClipboardList, Clock, LayoutGrid, RotateCcw, User } from 'lucide-react';
import { useSelector } from 'react-redux';
import { NavLink } from 'react-router-dom';

import type { RootState } from '@/store/store';

interface NavTab {
   label: string;
   path: string;
   icon: typeof ClipboardList;
}

const BORROWER_TABS: NavTab[] = [
   { label: 'Request Board', path: '/request-board', icon: ClipboardList },
   { label: 'Repay', path: '/repay', icon: RotateCcw },
   { label: 'Dashboard', path: '/dashboard', icon: LayoutGrid },
   { label: 'History', path: '/history', icon: Clock },
   { label: 'Account', path: '/account', icon: User }
];

const LENDER_TABS: NavTab[] = [
   { label: 'Request Board', path: '/request-board', icon: ClipboardList },
   { label: 'Dashboard', path: '/dashboard', icon: LayoutGrid },
   { label: 'History', path: '/history', icon: Clock },
   { label: 'Account', path: '/account', icon: User }
];

export default function BottomNav() {
   const userRole = useSelector((state: RootState) => state.auth.user?.userRole);
   const isBorrower = (userRole ?? 'borrower') !== 'lender';
   const tabs = isBorrower ? BORROWER_TABS : LENDER_TABS;

   return (
      <nav className="fixed bottom-[15px] left-1/2 -translate-x-1/2 w-[calc(100%-40px)] max-w-[400px] bg-md-neutral-100 rounded-md-pill shadow-md-nav px-5 py-4 z-50">
         <div className="flex items-start justify-center h-[52px]">
            {tabs.map((tab) => (
               <NavLink
                  key={tab.path}
                  to={tab.path}
                  className="flex-1 flex flex-col items-center gap-1 self-stretch"
               >
                  {({ isActive }) => (
                     <>
                        <div
                           className={`w-9 h-9 flex items-center justify-center shrink-0 ${
                              isActive ? 'bg-md-primary-900 rounded-md-md' : 'rounded-full'
                           }`}
                        >
                           <tab.icon
                              className={`w-6 h-6 ${isActive ? 'text-white' : 'text-md-neutral-1000'}`}
                              strokeWidth={1.5}
                           />
                        </div>
                        <span
                           className={`text-md-b4 font-medium text-center w-full ${
                              isActive ? 'text-md-primary-900' : 'text-md-neutral-1000'
                           }`}
                        >
                           {tab.label}
                        </span>
                     </>
                  )}
               </NavLink>
            ))}
         </div>
      </nav>
   );
}
