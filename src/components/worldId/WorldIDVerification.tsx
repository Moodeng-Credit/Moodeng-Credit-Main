import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { CredentialRequest, IDKitErrorCodes, IDKitRequestWidget, type IDKitResult, type RpContext } from '@worldcoin/idkit';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { AlreadyUsedModal } from '@/components/worldId/modal/AlreadyUsedModal';

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
   showSuccessToast?: boolean;
}

const WORLD_ID_ACTION_ID = 'verify-borrower';
const WORLD_ID_ACTION_DESCRIPTION = 'Verify a borrower as a unique human before borrowing.';
const WORLD_ID_ENVIRONMENT = (import.meta.env.VITE_WORLD_ID_ENVIRONMENT ||
   (import.meta.env.MODE === 'production' ? 'production' : 'staging')) as 'production' | 'staging';
const WORLD_ID_ALREADY_USED_STORAGE_KEY = 'moodeng_worldid_error';
const WORLD_ID_ALREADY_USED_STORAGE_VALUE = 'already_used';

export default function WorldIDVerification({ children, onSuccess, className = '', showSuccessToast = true }: WorldIDVerificationProps) {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const { showToastByConfig } = useToast();
   const [isIDKitOpen, setIsIDKitOpen] = useState(false);
   const [isPreparingIDKit, setIsPreparingIDKit] = useState(false);
   const [rpContext, setRpContext] = useState<RpContext | null>(null);
   const [showAlreadyUsedModal, setShowAlreadyUsedModal] = useState(false);
   const alreadyUsedRef = useRef(false);

   const showAlreadyUsedWarning = useCallback(
      ({ persist = false }: { persist?: boolean } = {}) => {
         if (persist) {
            sessionStorage.setItem(WORLD_ID_ALREADY_USED_STORAGE_KEY, WORLD_ID_ALREADY_USED_STORAGE_VALUE);
         }
         setShowAlreadyUsedModal(true);
         showToastByConfig('worldid_already_used');
      },
      [showToastByConfig]
   );

   useEffect(() => {
      if (sessionStorage.getItem(WORLD_ID_ALREADY_USED_STORAGE_KEY) === WORLD_ID_ALREADY_USED_STORAGE_VALUE) {
         sessionStorage.removeItem(WORLD_ID_ALREADY_USED_STORAGE_KEY);
         showAlreadyUsedWarning();
      }
   }, [showAlreadyUsedWarning]);

   const action = (import.meta.env.VITE_WORLD_ID_ACTION_ID || WORLD_ID_ACTION_ID) as string;
   const app_id = import.meta.env.VITE_WORLD_ID_APP_ID as `app_${string}` | undefined;
   const apiUrl = import.meta.env.VITE_API_URL as string | undefined;

   const getSessionAccessToken = useCallback(async () => {
      const supabase = getSupabaseBrowserClient();
      const {
         data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
         throw new Error('You must be logged in to verify your World ID.');
      }

      return session.access_token;
   }, []);

   const fetchRpContext = useCallback(async () => {
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
         showToastByConfig(handleApiError(result));
         throw new Error(isApiError(result) ? result.error : 'Failed to prepare World ID verification.');
      }

      return result.rp_context;
   }, [action, apiUrl, getSessionAccessToken, showToastByConfig]);

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
               showAlreadyUsedWarning({ persist: true });
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
         sessionStorage.removeItem(WORLD_ID_ALREADY_USED_STORAGE_KEY);
         return;
      }
      if (onSuccess) {
         onSuccess();
      } else {
         navigate('/onboarding/congratulations');
      }
      if (showSuccessToast) {
         showToastByConfig(getToastKeyFromSuccessCode(SUCCESS_CODES.AUTH_VERIFY_SUCCESS)!);
      }
   };

   const handleError = (errorCode: IDKitErrorCodes) => {
      if (errorCode !== IDKitErrorCodes.UserRejected) {
         showToastByConfig('server_error');
      }
   };

   const handleStartIDKit = useCallback(async () => {
      if (isPreparingIDKit || isIDKitOpen) {
         return;
      }
      try {
         if (!app_id) {
            throw new Error('VITE_WORLD_ID_APP_ID is not configured.');
         }
         setIsPreparingIDKit(true);
         const nextRpContext = await fetchRpContext();
         setRpContext(nextRpContext);
         setIsIDKitOpen(true);
      } catch (error) {
         console.error('World ID preparation error:', error instanceof Error ? error.message : error);
         showToastByConfig('server_error');
      } finally {
         setIsPreparingIDKit(false);
      }
   }, [app_id, fetchRpContext, isIDKitOpen, isPreparingIDKit, showToastByConfig]);

   const trigger = className ? <span className={className}>{children({ open: () => void handleStartIDKit() })}</span> : children({ open: () => void handleStartIDKit() });

   return (
      <>
         {trigger}

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
