import { Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';

import { getMemberSinceText } from '@/utils/dateFormatters';

import { type User, WorldId } from '@/types/authTypes';

interface UserGreetingProps {
   user: User;
}

export default function UserGreeting({ user }: UserGreetingProps) {
   const name = user.displayName?.trim() || user.username || 'Borrower';
   const firstName = name.split(' ')[0] || name;
   const isVerified = user.isWorldId === WorldId.ACTIVE;
   const memberSince = user.createdAt ? getMemberSinceText(user.createdAt) : '';

   return (
      <section className="rounded-[24px] bg-white px-md-4 py-md-4 shadow-md-card">
         <div className="flex items-center gap-md-3">
            <div className="flex h-[70px] w-[70px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#efe8ff]">
               <img alt="" className="h-full w-full object-cover" src={user.avatarUrl || '/icons/avatar-placeholder.png'} />
            </div>
            <div className="min-w-0 flex-1">
               <p className="truncate text-md-h5 font-semibold text-md-heading">Hello, {firstName}</p>
               <div className="mt-md-1 flex flex-wrap items-center gap-md-1">
                  <span
                     className={`inline-flex items-center gap-1 rounded-md-pill border px-md-2 py-1 text-md-b3 font-semibold ${
                        isVerified ? 'border-[#bfe8cf] bg-md-green-100 text-md-green-900' : 'border-[#d6d0df] bg-white text-md-neutral-1400'
                     }`}
                  >
                     <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full ${
                           isVerified ? 'bg-md-green-900 text-white' : 'bg-md-neutral-1900 text-white'
                        }`}
                     >
                        {isVerified ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
                     </span>
                     {isVerified ? 'Verified Borrower' : 'Not Verified'}
                  </span>
                  {!isVerified ? (
                     <Link className="text-md-b3 font-semibold text-md-primary-900 underline" to="/verify-world-id">
                        Verify
                     </Link>
                  ) : null}
               </div>
               {memberSince ? <p className="mt-md-1 text-md-b3 text-md-neutral-1200">Member since {memberSince}</p> : null}
            </div>
         </div>
      </section>
   );
}
