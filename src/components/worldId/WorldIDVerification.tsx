import { type ReactNode, useCallback, useRef, useState } from 'react';

import { CredentialRequest, IDKitErrorCodes, IDKitRequestWidget, type IDKitResult, type RpContext } from '@worldcoin/idkit';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { AlreadyUsedModal } from '@/components/worldId/modal/AlreadyUsedModal';
import { VerificationModal } from '@/components/worldId/VerificationModal';

import { handleApiError, isApiError } from '@/lib/apiHandler';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
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

const WORLD_ID_ACTION_ID = 'verify-borrower';
const WORLD_ID_ACTION_DESCRIPTION = 'Verify a borrower as a unique human before borrowing.';
const WORLD_ID_ENVIRONMENT = (import.meta.env.VITE_WORLD_ID_ENVIRONMENT ||
   (import.meta.env.MODE === 'production' ? 'production' : 'staging')) as 'production' | 'staging';

export default function WorldIDVerification({ children, onSuccess, className = '' }: WorldIDVerificationProps) {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const { showToastByConfig } = useToast();
   const [isModalOpen, setIsModalOpen] = useState(false);
   const [isIDKitOpen, setIsIDKitOpen] = useState(false);
   const [rpContext, setRpContext] = useState<RpContext | null>(null);
   const [showAlreadyUsedModal, setShowAlreadyUsedModal] = useState(false);
   // Prevents handleSuccess from navigating when handleVerify already showed the AlreadyUsedModal
   const alreadyUsedRef = useRef(false);

   const action = (import.meta.env.VITE_WORLD_ID_ACTION_ID || WORLD_ID_ACTION_ID) as string;
   const app_id = import.meta.env.VITE_WORLD_ID_APP_ID as `app_${string}` | undefined;
   const apiUrl = import.meta.env.VITE_API_URL as string | undefined;

   const getSessionAccessToken = async () => {
      const supabase = getSupabaseBrowserClient();
      const {
         data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
         throw new Error('You must be logged in to verify your World ID.');
      }

      return session.access_token;
   };

   const fetchRpContext = async () => {
      if (!apiUrl) {
         throw new Error('VITE_API_URL is not configured.');
      }

      const accessToken = await getSessionAccessToken();
      const res = await fetch(`${apiUrl}/verify-worldid`, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
         },
         body: JSON.stringify({ type: 'rp-signature', action })
      });
      const result = (await res.json()) as ApiResponse & { rp_context?: RpContext };

      if (!res.ok || !result.success || !result.rp_context) {
         if (isApiError(result) && result.errorCode === 'WORLDID_ALREADY_USED') {
            setShowAlreadyUsedModal(true);
            throw new Error('WORLDID_ALREADY_USED');
         }
         showToastByConfig(handleApiError(result));
         throw new Error(isApiError(result) ? result.error : 'Failed to prepare World ID verification.');
      }

      return result.rp_context;
   };

   const handleVerify = async (proof: IDKitResult) => {
      try {
         if (!apiUrl) {
            throw new Error('VITE_API_URL is not configured.');
         }

         const accessToken = await getSessionAccessToken();
         const res = await fetch(`${apiUrl}/verify-worldid`, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
               Authorization: `Bearer ${accessToken}`
            },
            body: JSON.stringify({ type: 'verify', proof })
         });

         const result = (await res.json()) as ApiResponse;

         if (!res.ok || !result.success) {
            if (isApiError(result) && result.errorCode === 'WORLDID_ALREADY_USED') {
               alreadyUsedRef.current = true;
               setShowAlreadyUsedModal(true);
               return;
            }
            showToastByConfig(handleApiError(result));
            throw new Error(isApiError(result) ? result.error : 'Verification failed.');
         }

         await dispatch(fetchUser())
            .unwrap()
            .catch((error: Error) => {
               console.error('Error refreshing user data:', error.message || error);
            });
      } catch (error) {
         console.error('World ID verification error:', error);
         throw error; // IDKit will display the error message to the user
      }
   };

   const handleSuccess = () => {
      if (alreadyUsedRef.current) {
         alreadyUsedRef.current = false;
         return;
      }
      onSuccess?.();
      navigate('/onboarding/congratulations');
      showToastByConfig(getToastKeyFromSuccessCode(SUCCESS_CODES.AUTH_VERIFY_SUCCESS)!);
   };

   const handleError = (errorCode: IDKitErrorCodes) => {
      if (errorCode === IDKitErrorCodes.NullifierReplayed || errorCode === IDKitErrorCodes.MaxVerificationsReached) {
         setShowAlreadyUsedModal(true);
      } else if (
         errorCode !== IDKitErrorCodes.UserRejected &&
         errorCode !== IDKitErrorCodes.Cancelled &&
         errorCode !== IDKitErrorCodes.VerificationRejected
      ) {
         showToastByConfig('server_error');
      }
   };

   const handleCloseModal = useCallback(() => {
      setIsModalOpen(false);
   }, []);

   const handleStartIDKit = async () => {
      if (!app_id) {
         throw new Error('VITE_WORLD_ID_APP_ID is not configured.');
      }

      handleCloseModal();
      const nextRpContext = await fetchRpContext();
      setRpContext(nextRpContext);
      setIsIDKitOpen(true);
   };

   return (
      <>
         <span className={className}>{children({ open: () => setIsModalOpen(true) })}</span>

         <VerificationModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            onVerify={() => {
               handleStartIDKit().catch((error: Error) => {
                  if (error.message === 'WORLDID_ALREADY_USED') return;
                  console.error('World ID preparation error:', error.message || error);
                  showToastByConfig('server_error');
               });
            }}
            onCheckStatus={handleCloseModal}
         />

         <AlreadyUsedModal isOpen={showAlreadyUsedModal} onClose={() => setShowAlreadyUsedModal(false)} />

         {app_id && rpContext ? (
            <IDKitRequestWidget
               open={isIDKitOpen}
               onOpenChange={setIsIDKitOpen}
               app_id={app_id}
               action={action}
               action_description={WORLD_ID_ACTION_DESCRIPTION}
               rp_context={rpContext}
               allow_legacy_proofs={false}
               environment={WORLD_ID_ENVIRONMENT}
               constraints={CredentialRequest('proof_of_human')}
               return_to={window.location.href}
               onSuccess={handleSuccess}
               onError={handleError}
               handleVerify={handleVerify}
            />
         ) : null}
      </>
   );
}
