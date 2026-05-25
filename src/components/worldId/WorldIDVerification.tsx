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
const WORLD_ID_IN_PROGRESS_KEY = 'moodeng_idkit_in_progress';
// Persists the relay rp_context across page reloads so IDKit can resume polling
// after the mobile World App redirect reloads the browser (relay session stays live
// for 900 s; we restore here so handleVerify still runs and detects WORLDID_ALREADY_USED).
const WORLD_ID_RP_CONTEXT_KEY = 'moodeng_idkit_rp_context';

export default function WorldIDVerification({ children, onSuccess, className = '', showSuccessToast = true }: WorldIDVerificationProps) {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const { showToastByConfig } = useToast();
   const [isIDKitOpen, setIsIDKitOpen] = useState(false);
   const [isPreparingIDKit, setIsPreparingIDKit] = useState(false);
   const [rpContext, setRpContext] = useState<RpContext | null>(null);
   const [showAlreadyUsedModal, setShowAlreadyUsedModal] = useState(false);
   // Set to true in handleVerify when WORLDID_ALREADY_USED is detected, read in handleError.
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

   // Mobile page-reload recovery: World App redirect reloads the browser, destroying
   // IDKit state. Restore the persisted rp_context so IDKit re-mounts with the SAME
   // relay session and resumes polling — handleVerify then fires normally.
   useEffect(() => {
      const raw = sessionStorage.getItem(WORLD_ID_RP_CONTEXT_KEY);
      if (!raw) return;
      try {
         const restoredContext = JSON.parse(raw) as RpContext;
         setRpContext(restoredContext);
         setIsIDKitOpen(true);
      } catch {
         sessionStorage.removeItem(WORLD_ID_RP_CONTEXT_KEY);
      }
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

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
         if (isApiError(result) && result.errorCode === 'WORLDID_ALREADY_USED') {
            setShowAlreadyUsedModal(true);
            showToastByConfig('worldid_already_used');
            throw new Error('WORLDID_ALREADY_USED');
         }
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
               // Persist to sessionStorage FIRST — if the mobile return_to redirect causes a
               // page reload before handleError fires, the useEffect on the next mount picks
               // this up and still shows the AlreadyUsedModal.
               sessionStorage.setItem(WORLD_ID_ALREADY_USED_STORAGE_KEY, WORLD_ID_ALREADY_USED_STORAGE_VALUE);
               alreadyUsedRef.current = true;
               setIsIDKitOpen(false);
               throw new Error('WORLDID_ALREADY_USED');
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
      sessionStorage.removeItem(WORLD_ID_IN_PROGRESS_KEY);
      sessionStorage.removeItem(WORLD_ID_RP_CONTEXT_KEY);
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
      sessionStorage.removeItem(WORLD_ID_IN_PROGRESS_KEY);
      sessionStorage.removeItem(WORLD_ID_RP_CONTEXT_KEY);
      if (
         errorCode === IDKitErrorCodes.NullifierReplayed ||
         errorCode === IDKitErrorCodes.MaxVerificationsReached ||
         (errorCode === IDKitErrorCodes.FailedByHostApp && alreadyUsedRef.current)
      ) {
         alreadyUsedRef.current = false;
         // In-session path: modal shown now, so clear the sessionStorage fallback.
         sessionStorage.removeItem(WORLD_ID_ALREADY_USED_STORAGE_KEY);
         showAlreadyUsedWarning();
      } else if (
         errorCode === IDKitErrorCodes.UserRejected ||
         errorCode === IDKitErrorCodes.Cancelled ||
         errorCode === IDKitErrorCodes.VerificationRejected
      ) {
         showToastByConfig('worldid_not_completed');
      } else if (errorCode !== IDKitErrorCodes.FailedByHostApp) {
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
         sessionStorage.setItem(WORLD_ID_IN_PROGRESS_KEY, '1');
         sessionStorage.setItem(WORLD_ID_RP_CONTEXT_KEY, JSON.stringify(nextRpContext));
         setRpContext(nextRpContext);
         setIsIDKitOpen(true);
      } catch (error) {
         if (error instanceof Error && error.message === 'WORLDID_ALREADY_USED') return;
         console.error('World ID preparation error:', error instanceof Error ? error.message : error);
         showToastByConfig('server_error');
      } finally {
         setIsPreparingIDKit(false);
      }
   }, [app_id, fetchRpContext, isIDKitOpen, isPreparingIDKit, showToastByConfig]);

   const handleIDKitOpenChange = useCallback((open: boolean) => {
      setIsIDKitOpen(open);
      if (!open) {
         sessionStorage.removeItem(WORLD_ID_IN_PROGRESS_KEY);
         sessionStorage.removeItem(WORLD_ID_RP_CONTEXT_KEY);
      }
   }, []);

   const trigger = className ? <span className={className}>{children({ open: () => void handleStartIDKit() })}</span> : children({ open: () => void handleStartIDKit() });

   return (
      <>
         {trigger}

         <AlreadyUsedModal isOpen={showAlreadyUsedModal} onClose={() => setShowAlreadyUsedModal(false)} />

         {app_id && rpContext ? (
            <IDKitRequestWidget
               open={isIDKitOpen}
               onOpenChange={handleIDKitOpenChange}
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
