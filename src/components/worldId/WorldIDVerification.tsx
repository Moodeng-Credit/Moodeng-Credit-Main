'use client';

import { type ReactNode, useState } from 'react';

import { IDKitWidget, type ISuccessResult, VerificationLevel } from '@worldcoin/idkit';
import { useDispatch } from 'react-redux';

import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { VerificationModal } from '@/components/worldId/VerificationModal';

import { handleApiError } from '@/lib/apiHandler';
import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import type { ApiResponse } from '@/types/apiTypes';
import { SUCCESS_CODES } from '@/types/successCodes';
import { getToastKeyFromSuccessCode } from '@/types/successToastMapping';

interface WorldIDVerificationProps {
   children: (props: { open: () => void }) => ReactNode;
   onSuccess?: () => void;
   className?: string;
}

export default function WorldIDVerification({ children, onSuccess, className = '' }: WorldIDVerificationProps) {
   const dispatch = useDispatch<AppDispatch>();
   const { showToastByConfig } = useToast();
   const [isModalOpen, setIsModalOpen] = useState(false);

   const action = process.env.NEXT_PUBLIC_WORLD_ID_ACTION_ID as string;
   const app_id = process.env.NEXT_PUBLIC_WORLD_ID_APP_ID as `app_${string}`;

   const handleVerify = async (proof: ISuccessResult) => {
      try {
         const res = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json'
            },
            body: JSON.stringify(proof)
         });

         const result = (await res.json()) as ApiResponse;

         if (!res.ok && !result.success) {
            showToastByConfig(handleApiError(result));
            throw new Error(result.error || 'Verification failed.');
         }

         console.log('World ID verification successful:', result);

         // Refresh user data to update verification status
         await dispatch(fetchUser())
            .unwrap()
            .then(() => {
               console.log('User data refreshed after World ID verification');
            })
            .catch((error: Error) => {
               console.error('Error refreshing user data:', error.message || error);
            });
      } catch (error) {
         console.error('World ID verification error:', error);
         throw error; // IDKit will display the error message to the user
      }
   };

   const handleSuccess = () => {
      console.log('World ID verification completed successfully');
      showToastByConfig(getToastKeyFromSuccessCode(SUCCESS_CODES.AUTH_VERIFY_SUCCESS)!);
      onSuccess?.();
   };

   return (
      <IDKitWidget
         app_id={app_id}
         action={action}
         onSuccess={handleSuccess}
         handleVerify={handleVerify}
         verification_level={VerificationLevel.Orb}
      >
         {({ open }) => (
            <>
               <span className={className}>{children({ open: () => setIsModalOpen(true) })}</span>

               <VerificationModal
                  isOpen={isModalOpen}
                  onClose={() => setIsModalOpen(false)}
                  onVerify={() => {
                     setIsModalOpen(false);
                     open();
                  }}
                  onCheckStatus={() => setIsModalOpen(false)}
               />
            </>
         )}
      </IDKitWidget>
   );
}
