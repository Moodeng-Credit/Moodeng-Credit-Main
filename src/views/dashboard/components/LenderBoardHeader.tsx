import { useSelector } from 'react-redux';

import WorldIDVerification from '@/components/worldId/WorldIDVerification';

import type { RootState } from '@/store/store';

export default function LenderBoardHeader() {
   const user = useSelector((state: RootState) => state.auth.user);
   const isVerified = user?.isWorldId === 'ACTIVE';
   
   // Get first name from username (split by space or use first part)
   const getFirstName = () => {
      if (!user?.username) return 'User';
      const parts = user.username.split(/[\s_-]/);
      return parts[0] || 'User';
   };

   // Generate initials for avatar
   const getInitials = () => {
      if (!user?.username) return 'U';
      const parts = user.username.split(/[\s_-]/);
      if (parts.length >= 2) {
         return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return user.username.substring(0, 2).toUpperCase();
   };

   return (
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
         <div className="flex items-center gap-3">
            {/* Profile Picture */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
               {getInitials()}
            </div>
            
            {/* User Info */}
            <div className="flex flex-col">
               <h2 className="text-base font-medium text-gray-900">
                  Hello, {getFirstName()}
               </h2>
               
               {/* Verification Status */}
               <div className="flex items-center gap-2 mt-1">
                  {isVerified ? (
                     <span className="flex items-center gap-1 text-sm text-green-600">
                        <i className="fas fa-check-circle text-xs"></i>
                        <span className="font-medium">Verified</span>
                     </span>
                  ) : (
                     <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-sm text-red-600">
                           <i className="fas fa-times-circle text-xs"></i>
                           <span className="font-medium">Not Verified</span>
                        </span>
                        <WorldIDVerification>
                           {({ open }) => (
                              <button
                                 onClick={open}
                                 className="text-sm text-blue-600 hover:text-blue-700 font-medium underline"
                              >
                                 Verify World ID &gt;
                              </button>
                           )}
                        </WorldIDVerification>
                     </div>
                  )}
               </div>
            </div>
         </div>
      </div>
   );
}
