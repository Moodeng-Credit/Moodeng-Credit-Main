import { NavLink } from 'react-router-dom';

import { useIsBorrower } from '@/hooks/useIsBorrower';

interface NavTab {
   label: string;
   path: string;
   icon: string;
}

const BORROWER_TABS: NavTab[] = [
   { label: 'Request Board', path: '/request-board', icon: 'request-board.png' },
   { label: 'Repay', path: '/repay', icon: 'repay.png' },
   { label: 'Dashboard', path: '/dashboard', icon: 'dashboard.png' },
   { label: 'History', path: '/history', icon: 'history.png' },
   { label: 'Account', path: '/account', icon: 'account.png' }
];

const LENDER_TABS: NavTab[] = [
   { label: 'Request Board', path: '/request-board', icon: 'request-board.png' },
   { label: 'Dashboard', path: '/lender/dashboard', icon: 'dashboard.png' },
   { label: 'History', path: '/history', icon: 'history.png' },
   { label: 'Account', path: '/account', icon: 'account.png' }
];

const MASK_BASE: React.CSSProperties = {
   WebkitMaskSize: 'contain',
   maskSize: 'contain',
   WebkitMaskRepeat: 'no-repeat',
   maskRepeat: 'no-repeat',
   WebkitMaskPosition: 'center',
   maskPosition: 'center',
};

export default function BottomNav() {
   const isBorrower = useIsBorrower();
   const tabs = isBorrower ? BORROWER_TABS : LENDER_TABS;

   return (
      <nav className="fixed bottom-[15px] left-1/2 -translate-x-1/2 w-[calc(100%-40px)] max-w-[400px] bg-md-neutral-100 rounded-md-pill shadow-md-nav px-5 py-4 z-50">
         <div className="flex items-start justify-center h-[52px]">
            {tabs.map((tab) => (
               <NavLink
                  key={tab.path}
                  to={tab.path}
                  end={tab.path !== '/account'}
                  className="flex-1 flex flex-col items-center gap-1 self-stretch"
               >
                  {({ isActive }) => {
                     const showBg = isActive && isBorrower;
                     return (
                        <>
                           <div
                              className={`w-9 h-9 flex items-center justify-center shrink-0 ${
                                 showBg ? 'bg-md-primary-900 rounded-md-md' : ''
                              }`}
                           >
                              <div
                                 className={`w-6 h-6 shrink-0 ${
                                    showBg
                                       ? 'bg-white'
                                       : isActive
                                         ? 'bg-md-primary-900'
                                         : 'bg-md-neutral-1000'
                                 }`}
                                 style={{
                                    ...MASK_BASE,
                                    WebkitMaskImage: `url('/icons/${tab.icon}')`,
                                    maskImage: `url('/icons/${tab.icon}')`,
                                 }}
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
                     );
                  }}
               </NavLink>
            ))}
         </div>
      </nav>
   );
}
