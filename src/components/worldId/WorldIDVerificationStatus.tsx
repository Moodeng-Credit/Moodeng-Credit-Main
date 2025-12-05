'use client';

import { useState } from 'react';

import { useSelector } from 'react-redux';

import WorldIDVerification from '@/components/worldId/WorldIDVerification';

import { useCurrentUser } from '@/hooks/api';

import type { RootState } from '@/store/store';
import { WorldId } from '@/types/authTypes';

interface WorldIDVerificationStatusProps {
   className?: string;
}

export default function WorldIDVerificationStatus({ className = '' }: WorldIDVerificationStatusProps) {
   const user = useSelector((state: RootState) => state.auth.user);
   const [isUnverifying, setIsUnverifying] = useState(false);
   const isVerified = user.isWorldId === WorldId.ACTIVE;
   const { refetch: refetchCurrentUser } = useCurrentUser();

   const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

   const handleUnverify = async () => {
      setIsUnverifying(true);
      try {
         const response = await fetch('/api/auth/test-unverify', {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json'
            }
         });

         if (!response.ok) {
            throw new Error('Failed to unverify user');
         }
         // Refresh user data to update verification status
         refetchCurrentUser();
      } catch (error) {
         console.error('Error unverifying user:', error);
      } finally {
         setIsUnverifying(false);
      }
   };

   return (
      <div className={`grid grid-cols-12 gap-3 ${className}`}>
         <div className="col-span-3">
            <label className="text-[#0a1a5f] font-semibold text-[10px] leading-[12px] select-none block">World ID</label>
            <p className="text-[8px] text-[#4a4a4a] font-normal leading-[10px] mt-1">
               To confirm your identity and show it's really you, we use World ID. This helps keep our community safe, avoids bots, and
               builds trust for borrowers.
            </p>
         </div>
         <div className="col-span-6 flex flex-col gap-1">
            {isVerified ? (
               <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-[12px] text-[#4caf50] font-normal leading-[10px]">
                     <i className="fas fa-check-circle"></i>
                     <span>Human Verified with World ID</span>
                  </div>
                  {isDevMode ? (
                     <button
                        type="button"
                        onClick={handleUnverify}
                        disabled={isUnverifying}
                        className="bg-[#f44336] text-white rounded px-3 py-1 text-[10px] font-semibold leading-[12px] w-full hover:bg-[#d32f2f] transition disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                        {isUnverifying ? 'Un-verifying...' : 'Un-verify (Test)'}
                     </button>
                  ) : null}
               </div>
            ) : (
               <WorldIDVerification>
                  {({ open }) => (
                     <button
                        type="button"
                        onClick={open}
                        className="bg-[#4caf50] text-white rounded px-3 py-1 text-[10px] font-semibold leading-[12px] w-full hover:bg-[#3a9d3a] transition"
                     >
                        Verify
                     </button>
                  )}
               </WorldIDVerification>
            )}
         </div>
      </div>
   );
}
