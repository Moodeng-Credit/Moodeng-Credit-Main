import { Link, useLocation, useNavigate } from 'react-router-dom';

import BorrowerVerificationBadge from '@/components/BorrowerVerificationBadge';
import UserAvatar from '@/components/UserAvatar';
import { getMemberSinceText } from '@/utils/dateFormatters';
import type { User } from '@/types/authTypes';

interface UserGreetingProps {
   user: User;
}

export default function UserGreeting({ user }: UserGreetingProps) {
   const navigate = useNavigate();
   const location = useLocation();
   const firstName = user.displayName?.split(' ')[0] || user.username?.split(' ')[0] || 'there';
   const isVerified = user.isWorldId === 'ACTIVE';
   const memberSince = user.createdAt ? getMemberSinceText(user.createdAt) : '';
   const accountEditPath = (edit: 'avatar' | 'name') => {
      const params = new URLSearchParams(location.search);
      params.set('edit', edit);
      return `/account/settings?${params.toString()}`;
   };

   return (
      <div className="flex items-start gap-3">
         <button
            type="button"
            onClick={() => navigate(accountEditPath('avatar'))}
            className="w-12 h-12 rounded-full border-2 border-md-primary-500 overflow-hidden shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2"
            aria-label="Edit profile photo"
         >
            <UserAvatar size={48} alt={firstName} clickable={false} />
         </button>
         <div className="flex flex-col gap-0.5 min-w-0">
            <button
               type="button"
               onClick={() => navigate(accountEditPath('name'))}
               className="text-left text-md-h5 font-semibold text-md-heading underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2 rounded-sm"
               aria-label="Edit display name"
            >
               Hello, {firstName}
            </button>
            <div className="flex items-center gap-2 flex-wrap">
               <BorrowerVerificationBadge />
               {!isVerified && (
                  <Link to="/verify-world-id" className="text-md-b4 font-medium text-md-primary-900">
                     Verify World ID &gt;
                  </Link>
               )}
            </div>
            {memberSince && (
               <p className="text-md-b4 text-md-neutral-700">Member since {memberSince}</p>
            )}
         </div>
      </div>
   );
}
