import { Link, useLocation } from 'react-router-dom';
import { FileText, DollarSign, LayoutDashboard, History, User } from 'lucide-react';

interface NavItem {
   label: string;
   path: string;
   icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
   {
      label: 'Request Board',
      path: '/dashboard',
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
         className="fixed bottom-0 left-0 right-0 bg-[#171420] border-t border-gray-700 z-50 md:hidden"
         role="navigation"
         aria-label="Bottom navigation"
      >
         <div className="flex justify-around items-center h-16">
            {navItems.map((item) => {
               const Icon = item.icon;
               // For /profile paths, also check the hash
               const isActive = 
                  location.pathname === item.path.split('#')[0] && 
                  (!item.path.includes('#') || location.hash === '#' + item.path.split('#')[1]);
               
               return (
                  <Link
                     key={item.path + item.label}
                     to={item.path}
                     className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                        isActive 
                           ? 'text-[#6d57ff]' 
                           : 'text-gray-400 hover:text-gray-200'
                     }`}
                     aria-current={isActive ? 'page' : undefined}
                  >
                     <Icon className="w-6 h-6 mb-1" />
                     <span className="text-xs">{item.label}</span>
                  </Link>
               );
            })}
         </div>
      </nav>
   );
}
