import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { CredentialRequest, IDKitErrorCodes, IDKitRequestWidget, type IDKitResult, type RpContext } from '@worldcoin/idkit';
import { AlertTriangle, CheckCircle2, LoaderCircle, ShieldCheck } from 'lucide-react';
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
const WORLD_ID_APP_ID = (WORLD_ID_ENVIRONMENT === 'production'
   ? import.meta.env.VITE_WORLD_ID_APP_ID_PROD
   : import.meta.env.VITE_WORLD_ID_APP_ID_STAGING) as `app_${string}` | undefined;
const SUCCESS_CONFIRMATION_MS = 1500;
const STATUS_REFRESH_RETRIES = 30;
const STATUS_REFRESH_DELAY_MS = 1000;
const LONG_PROCESSING_SECONDS = 10;

type VerificationFeedbackState = 'idle' | 'processing' | 'success' | 'error';
type VerificationProcessingStep = 'confirming' | 'syncing';

const wait = (ms: number) =>
   new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
   });

interface VerificationFeedbackOverlayProps {
   state: VerificationFeedbackState;
   processingStep: VerificationProcessingStep;
   processingElapsedSeconds: number;
   onTryAgain: () => void;
   onDismiss: () => void;
}

function VerificationFeedbackOverlay({
   state,
   processingStep,
   processingElapsedSeconds,
   onTryAgain,
   onDismiss
}: VerificationFeedbackOverlayProps) {
   if (state === 'idle') return null;

   const isProcessing = state === 'processing';
   const isSuccess = state === 'success';
   const Icon = isProcessing ? LoaderCircle : isSuccess ? CheckCircle2 : AlertTriangle;
   const isTakingLonger = isProcessing && processingElapsedSeconds >= LONG_PROCESSING_SECONDS;
   const title = isProcessing
      ? isTakingLonger
         ? 'Still verifying your World ID...'
         : 'Verifying your World ID...'
      : isSuccess
        ? 'Verification Successful'
        : 'Verification is taking too long';
   const description = isProcessing
      ? isTakingLonger
         ? 'This is taking longer than usual. Keep this screen open while Moodeng finishes syncing.'
         : 'This usually takes around 10 seconds. Keep this screen open - no further action is needed.'
      : isSuccess
        ? 'Your World ID is linked to Moodeng.'
        : 'Please try again or return to the previous step.';
   const iconClassName = isProcessing ? 'animate-spin text-md-primary-1200' : isSuccess ? 'text-md-green-900' : 'text-md-red-600';
   const stepStatuses = [
      { label: 'World ID proof received', status: 'complete' },
      {
         label: 'Confirming verification',
         status: state === 'success' || processingStep === 'syncing' ? 'complete' : 'current'
      },
      {
         label: 'Updating Moodeng status',
         status: state === 'success' ? 'complete' : processingStep === 'syncing' || state === 'error' ? 'current' : 'pending'
      }
   ] as const;

   return (
      <div
         className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-md-primary-2000/60 px-md-4 backdrop-blur-sm"
         role="alertdialog"
         aria-modal="true"
      >
         <div className="w-full max-w-[380px] rounded-md-md bg-white p-md-5 text-center shadow-2xl">
            <div className="mx-auto mb-md-3 flex h-12 w-12 items-center justify-center rounded-full bg-md-neutral-200">
               <Icon className={`h-7 w-7 ${iconClassName}`} aria-hidden="true" />
            </div>
            <h2 className="text-md-h5 font-semibold text-md-heading">{title}</h2>
            <p className="mt-md-1 text-md-b2 font-medium text-md-neutral-700">{description}</p>

            <div className="mt-md-4 space-y-md-1 text-left">
               {stepStatuses.map((step, index) => (
                  <div key={step.label} className="flex items-center gap-md-2 rounded-md-md bg-md-primary-100 px-md-2 py-md-1">
                     <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-md-b4 font-semibold text-md-primary-1200">
                        {step.status === 'complete' ? (
                           <CheckCircle2 className="h-4 w-4 text-md-green-900" aria-hidden="true" />
                        ) : step.status === 'current' ? (
                           <LoaderCircle className="h-4 w-4 animate-spin text-md-primary-1200" aria-hidden="true" />
                        ) : (
                           index + 1
                        )}
                     </span>
                     <span className="text-md-b3 font-semibold text-md-heading">{step.label}</span>
                  </div>
               ))}
            </div>

            <div className="mt-md-4 inline-flex items-center gap-md-1 rounded-md-pill bg-md-neutral-200 px-md-2 py-md-1 text-md-b3 font-semibold text-md-neutral-1200">
               <ShieldCheck className="h-4 w-4 text-md-primary-1200" aria-hidden="true" />
               Securely processed with World ID
            </div>

            {state === 'error' ? (
               <div className="mt-md-4 grid grid-cols-2 gap-md-2">
                  <button
                     type="button"
                     onClick={onDismiss}
                     className="inline-flex items-center justify-center rounded-md-md border border-md-neutral-500 bg-white px-md-3 py-md-2 text-md-b2 font-semibold text-md-heading"
                  >
                     Back
                  </button>
                  <button
                     type="button"
                     onClick={onTryAgain}
                     className="inline-flex items-center justify-center rounded-md-md bg-md-primary-1200 px-md-3 py-md-2 text-md-b2 font-semibold text-white"
                  >
                     Try again
                  </button>
               </div>
            ) : null}
         </div>
      </div>
   );
}

export default function WorldIDVerification({ children, onSuccess, className = '', showSuccessToast = true }: WorldIDVerificationProps) {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const { showToastByConfig } = useToast();
   const [isIDKitOpen, setIsIDKitOpen] = useState(false);
   const [rpContext, setRpContext] = useState<RpContext | null>(null);
   const [showAlreadyUsedModal, setShowAlreadyUsedModal] = useState(false);
   const [verificationFeedbackState, setVerificationFeedbackState] = useState<VerificationFeedbackState>('idle');
   const [verificationProcessingStep, setVerificationProcessingStep] = useState<VerificationProcessingStep>('confirming');
   const [processingElapsedSeconds, setProcessingElapsedSeconds] = useState(0);
   const alreadyUsedRef = useRef(false);
   const preparingRef = useRef(false);
   const successTimerRef = useRef<number | null>(null);

   const showAlreadyUsedWarning = useCallback(() => {
      setShowAlreadyUsedModal(true);
      showToastByConfig('worldid_already_used');
   }, [showToastByConfig]);

   const action = (import.meta.env.VITE_WORLD_ID_ACTION_ID || WORLD_ID_ACTION_ID) as string;
   const app_id = WORLD_ID_APP_ID;
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

   useEffect(() => {
      return () => {
         if (successTimerRef.current !== null) {
            window.clearTimeout(successTimerRef.current);
         }
      };
   }, []);

   useEffect(() => {
      if (verificationFeedbackState !== 'processing') {
         setProcessingElapsedSeconds(0);
         return undefined;
      }

      setProcessingElapsedSeconds(0);
      const interval = window.setInterval(() => {
         setProcessingElapsedSeconds((elapsedSeconds) => elapsedSeconds + 1);
      }, 1000);

      return () => window.clearInterval(interval);
   }, [verificationFeedbackState]);

   const refreshUserUntilWorldIdActive = useCallback(async () => {
      for (let attempt = 0; attempt < STATUS_REFRESH_RETRIES; attempt += 1) {
         if (attempt > 0) {
            await wait(STATUS_REFRESH_DELAY_MS);
         }

         const refreshedUser = await dispatch(fetchUser()).unwrap();

         if (refreshedUser.isWorldId === 'ACTIVE') {
            return;
         }
      }

      throw new Error('World ID verification was accepted, but the account status did not update.');
   }, [dispatch]);

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
      setVerificationProcessingStep('confirming');
      setVerificationFeedbackState('processing');
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
               setVerificationFeedbackState('idle');
               setIsIDKitOpen(false);
               throw new Error('WORLDID_ALREADY_USED');
            }
            showToastByConfig(handleApiError(result));
            throw new Error(isApiError(result) ? result.error : 'Verification failed.');
         }

         setVerificationProcessingStep('syncing');
         await refreshUserUntilWorldIdActive();
      } catch (error) {
         if (!(error instanceof Error && error.message === 'WORLDID_ALREADY_USED')) {
            setVerificationFeedbackState('error');
         }
         console.error('[WorldID] handleVerify error:', error);
         throw error;
      }
   };

   const handleSuccess = () => {
      setVerificationFeedbackState('success');

      if ('vibrate' in window.navigator && typeof window.navigator.vibrate === 'function') {
         window.navigator.vibrate(50);
      }

      if (successTimerRef.current !== null) {
         window.clearTimeout(successTimerRef.current);
      }

      successTimerRef.current = window.setTimeout(() => {
         setVerificationFeedbackState('idle');
         if (onSuccess) {
            onSuccess();
         } else {
            navigate('/onboarding/congratulations');
         }
         if (showSuccessToast) {
            showToastByConfig(getToastKeyFromSuccessCode(SUCCESS_CODES.AUTH_VERIFY_SUCCESS)!);
         }
      }, SUCCESS_CONFIRMATION_MS);
   };

   const handleError = (errorCode: IDKitErrorCodes) => {
      const isFinishingVerification = verificationFeedbackState === 'processing' || verificationFeedbackState === 'success';

      if (
         errorCode === IDKitErrorCodes.NullifierReplayed ||
         errorCode === IDKitErrorCodes.MaxVerificationsReached ||
         (errorCode === IDKitErrorCodes.FailedByHostApp && alreadyUsedRef.current)
      ) {
         alreadyUsedRef.current = false;
         showAlreadyUsedWarning();
      } else if (
         errorCode === IDKitErrorCodes.UserRejected ||
         errorCode === IDKitErrorCodes.Cancelled ||
         errorCode === IDKitErrorCodes.VerificationRejected
      ) {
         if (!isFinishingVerification) {
            showToastByConfig('worldid_not_completed');
         }
      } else if (errorCode !== IDKitErrorCodes.FailedByHostApp) {
         showToastByConfig('server_error');
      }
   };

   const handleStartIDKit = useCallback(async () => {
      if (preparingRef.current) return;
      try {
         if (!app_id) {
            throw new Error('VITE_WORLD_ID_APP_ID is not configured.');
         }
         preparingRef.current = true;
         setVerificationFeedbackState('idle');
         setVerificationProcessingStep('confirming');
         const nextRpContext = await fetchRpContext();
         setRpContext(nextRpContext);
         setIsIDKitOpen(true);
      } catch (error) {
         if (error instanceof Error && error.message === 'WORLDID_ALREADY_USED') return;
         console.error('[WorldID] handleStartIDKit error:', error instanceof Error ? error.message : error);
         showToastByConfig('server_error');
      } finally {
         preparingRef.current = false;
      }
   }, [app_id, fetchRpContext, showToastByConfig]);

   const handleIDKitOpenChange = useCallback((open: boolean) => {
      setIsIDKitOpen(open);
   }, []);

   const trigger = className ? <span className={className}>{children({ open: () => void handleStartIDKit() })}</span> : children({ open: () => void handleStartIDKit() });

   return (
      <>
         {trigger}

         <AlreadyUsedModal isOpen={showAlreadyUsedModal} onClose={() => setShowAlreadyUsedModal(false)} />

         <VerificationFeedbackOverlay
            state={verificationFeedbackState}
            processingStep={verificationProcessingStep}
            processingElapsedSeconds={processingElapsedSeconds}
            onTryAgain={() => void handleStartIDKit()}
            onDismiss={() => setVerificationFeedbackState('idle')}
         />

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
               onSuccess={handleSuccess}
               onError={handleError}
               handleVerify={handleVerify}
            />
         ) : null}
      </>
   );
}
