import { Link, useLocation } from 'react-router-dom';
import { FileText, DollarSign, LayoutDashboard, History, User } from 'lucide-react';

interface NavItem {
   label: string;
   path: string;
   icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
   {
      label: 'Board',
      path: '/lender-board',
      icon: FileText
   },
   {
      label: 'Repay',
      path: '/repay',
      icon: DollarSign
   },
   {
      label: 'Dashboard',
      path: '/profile',
      icon: LayoutDashboard
   },
   {
      label: 'History',
      path: '/history',
      icon: History
   },
   {
      label: 'Account',
      path: '/profile#settings',
      icon: User
   }
];

export default function BottomNavigation() {
   const location = useLocation();

   return (
      <nav
         className="fixed bottom-4 left-4 right-4 z-50 md:hidden rounded-2xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.12)] dark:bg-gray-900 dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
         role="navigation"
         aria-label="Bottom navigation"
      >
         <div className="flex justify-around items-center h-14 px-1 pb-1 pt-2">
            {navItems.map((item) => {
               const Icon = item.icon;
               const isActive =
                  location.pathname === item.path.split('#')[0] &&
                  (!item.path.includes('#') || location.hash === '#' + item.path.split('#')[1]);

               return (
                  <Link
                     key={item.path}
                     to={item.path}
                     className="flex flex-col items-center justify-center flex-1 h-full transition-colors rounded-xl py-1"
                     aria-current={isActive ? 'page' : undefined}
                  >
                     <Icon
                        className={`w-5 h-5 mb-0.5 transition-colors ${
                           isActive ? 'text-[#6d57ff]' : 'text-gray-600 dark:text-gray-400'
                        }`}
                     />
                     <span
                        className={`text-[10px] font-medium ${
                           isActive ? 'text-[#6d57ff]' : 'text-gray-600 dark:text-gray-400'
                        }`}
                     >
                        {item.label}
                     </span>
                  </Link>
               );
            })}
         </div>
      </nav>
   );
}
