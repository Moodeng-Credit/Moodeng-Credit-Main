import { Link } from 'react-router-dom';

import BorrowerVerificationBadge from '@/components/BorrowerVerificationBadge';
import { getMemberSinceText } from '@/utils/dateFormatters';
import type { User } from '@/types/authTypes';

interface UserGreetingProps {
   user: User;
}

export default function UserGreeting({ user }: UserGreetingProps) {
   const firstName = user.displayName?.split(' ')[0] || user.username?.split(' ')[0] || 'there';
   const isVerified = user.isWorldId === 'ACTIVE';
   const memberSince = user.createdAt ? getMemberSinceText(user.createdAt) : '';

   return (
      <div className="flex items-start gap-3">
         <div className="w-12 h-12 rounded-full border-2 border-md-primary-500 overflow-hidden shrink-0">
            {user.avatarUrl ? (
               <img src={user.avatarUrl} alt={firstName} className="w-full h-full object-cover" />
            ) : (
               <img src="/icons/avatar-placeholder.png" alt={firstName} className="w-full h-full object-cover" />
            )}
         </div>
         <div className="flex flex-col gap-0.5 min-w-0">
            <p className="text-md-h5 font-semibold text-md-heading">Hello, {firstName}</p>
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
