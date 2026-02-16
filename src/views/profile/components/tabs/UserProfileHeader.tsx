import { format, differenceInDays } from 'date-fns';

import WorldIDVerification from '@/components/worldId/WorldIDVerification';

import type { User } from '@/types/authTypes';

interface UserProfileHeaderProps {
   user: User;
}

const UserProfileHeader = ({ user }: UserProfileHeaderProps) => {
   const isVerified = user.isWorldId === 'ACTIVE';
   const memberSince = user.createdAt ? format(new Date(user.createdAt), 'MMMM d, yyyy') : 'Recently';
   const daysActive = user.createdAt ? differenceInDays(new Date(), new Date(user.createdAt)) : 0;

   // Extract first name from username (simple approach: take first part before space or use whole username)
   const firstName = user.username.split(/[\s-_]/)[0] || user.username;

   return (
      <div className="bg-white rounded-xl p-6 space-y-4">
         <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
               {/* Profile Image Placeholder - using Moodeng mascot style */}
               <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-300 to-purple-300 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🦛</span>
               </div>

               <div className="space-y-2">
                  {/* Greeting */}
                  <h1 className="text-2xl font-bold text-gray-900">Hello, {firstName}</h1>

                  {/* Verification Status */}
                  <div className="flex items-center gap-2">
                     {isVerified ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
                           <i className="fa-solid fa-circle-check" />
                           Verified
                        </span>
                     ) : (
                        <>
                           <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-medium">
                              <i className="fa-solid fa-circle-xmark" />
                              Not Verified
                           </span>
                           <WorldIDVerification>
                              {({ open }) => (
                                 <button
                                    onClick={open}
                                    className="text-sm text-purple-600 hover:text-purple-700 font-semibold underline"
                                 >
                                    Verify World ID &gt;
                                 </button>
                              )}
                           </WorldIDVerification>
                        </>
                     )}
                  </div>

                  {/* Membership Info */}
                  <p className="text-sm text-gray-600">
                     Member since {memberSince} ({daysActive} days)
                  </p>
               </div>
            </div>
         </div>
      </div>
   );
};

export default UserProfileHeader;
