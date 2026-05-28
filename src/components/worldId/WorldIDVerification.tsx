import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { CredentialRequest, IDKitErrorCodes, IDKitRequestWidget, type IDKitResult, type RpContext } from '@worldcoin/idkit';
import { AlertTriangle, CheckCircle2, LoaderCircle, LockKeyhole, MessageCircle, Shield } from 'lucide-react';
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
import { TELEGRAM_SUPPORT_URL } from '@/views/support/constants';

interface WorldIDVerificationProps {
   children: (props: { open: () => void }) => ReactNode;
   onSuccess?: () => void;
   className?: string;
   showSuccessToast?: boolean;
   showSuccessFeedback?: boolean;
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
   showHelpPanel: boolean;
   onTryAgain: () => void;
   onDismiss: () => void;
   onNeedHelp: () => void;
   onCloseHelp: () => void;
   onContactSupport: () => void;
}

function VerificationFeedbackOverlay({
   state,
   processingStep,
   processingElapsedSeconds,
   showHelpPanel,
   onTryAgain,
   onDismiss,
   onNeedHelp,
   onCloseHelp,
   onContactSupport
}: VerificationFeedbackOverlayProps) {
   if (state === 'idle') return null;

   const isProcessing = state === 'processing';
   const isSuccess = state === 'success';
   const isShowingHelp = isProcessing && showHelpPanel;
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
         : 'This usually takes less than 10 seconds.\nKeep this screen open.\nNo further action is needed.'
      : isSuccess
        ? 'Your World ID is linked to Moodeng.'
        : 'Please try again or return to the previous step.';
   const iconClassName = isProcessing ? 'animate-spin text-md-primary-1200' : isSuccess ? 'text-md-green-900' : 'text-md-red-600';
   const iconBackgroundClassName = isSuccess ? 'bg-md-green-100' : state === 'error' ? 'bg-md-red-100' : 'bg-md-primary-100';
   const progressPercent = isSuccess
      ? 100
      : state === 'error'
        ? 100
        : processingStep === 'syncing'
          ? Math.min(92, 80 + processingElapsedSeconds)
          : Math.min(64, 38 + processingElapsedSeconds * 3);
   const statusLabel = isSuccess
      ? 'Verification complete'
      : state === 'error'
        ? 'Verification interrupted'
        : processingStep === 'syncing'
          ? 'Finalizing verification...'
          : 'Confirming verification...';
   const panelDescription = isSuccess
      ? 'Your status has been updated securely.'
      : state === 'error'
        ? 'The verification did not finish. Try again when you are ready.'
        : 'Your verification is being processed securely.';
   const progressBarClassName = state === 'error' ? 'bg-md-red-600' : isSuccess ? 'bg-md-green-900' : 'bg-md-primary-1200';

   return (
      <div
         className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-md-primary-2000/65 px-md-4 font-sans backdrop-blur-[6px]"
         role="alertdialog"
         aria-modal="true"
      >
         <div className="w-full max-w-[430px] overflow-hidden rounded-[28px] border border-md-primary-100 bg-white text-center shadow-[0_28px_90px_rgba(44,19,82,0.22)]">
            <div className="flex flex-col items-center gap-md-4 px-md-5 py-md-5 sm:px-md-5 sm:py-md-5">
               <div className={`flex h-16 w-16 items-center justify-center rounded-full ${isShowingHelp ? 'bg-md-primary-100' : iconBackgroundClassName}`}>
                  {isShowingHelp ? (
                     <MessageCircle className="h-8 w-8 text-md-primary-1200" aria-hidden="true" />
                  ) : (
                     <Icon className={`h-8 w-8 ${iconClassName}`} aria-hidden="true" />
                  )}
               </div>

               <div className="flex flex-col items-center gap-md-2">
                  <h2 className="max-w-[340px] text-md-h4 font-semibold tracking-normal text-md-heading max-[374px]:text-md-h5">
                     {isShowingHelp ? 'Need help verifying?' : title}
                  </h2>
                  <p className="max-w-[350px] whitespace-pre-line text-md-b1 font-normal tracking-normal text-md-neutral-1000 max-[374px]:text-md-b2">
                     {isShowingHelp ? 'Verification may still finish.\nFor help, message us on Telegram.' : description}
                  </p>
               </div>

               {isShowingHelp ? (
                  <div className="w-full rounded-[12px] border border-md-primary-100 bg-md-neutral-200 p-3 text-left antialiased shadow-[0_2px_4px_rgba(27,28,29,0.04)]">
                     <div className="grid min-h-[76px] grid-cols-[40px_minmax(0,1fr)] items-center gap-[10px]">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-md-primary-300 bg-white text-md-primary-1200">
                           <Shield className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                           <p className="text-[16px] font-[510] leading-6 tracking-normal text-md-heading">Telegram support</p>
                           <p className="mt-0.5 text-[12px] font-normal leading-[18px] tracking-normal text-md-neutral-700">
                              Fastest way to reach Moodeng if World ID finished but your status does not update.
                           </p>
                        </div>
                     </div>
                  </div>
               ) : (
                  <div className="w-full rounded-[22px] border border-md-primary-100 bg-md-neutral-100/80 p-md-4 shadow-[0_2px_4px_rgba(27,28,29,0.04)]">
                     <div className="flex items-center gap-md-3 text-left">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md-lg border border-md-primary-300 bg-white text-md-primary-1200">
                           <LockKeyhole className="h-6 w-6" aria-hidden="true" />
                        </div>
                        <p className="min-w-0 text-md-b1 font-medium tracking-normal text-md-neutral-1500 max-[374px]:text-md-b2">{statusLabel}</p>
                     </div>

                     <div
                        className="mx-auto mt-md-3 h-2.5 w-full overflow-hidden rounded-md-pill bg-md-primary-100"
                        role="progressbar"
                        aria-label={statusLabel}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(progressPercent)}
                     >
                        <div
                           className={`h-full rounded-md-pill transition-[width] duration-500 ease-out ${progressBarClassName}`}
                           style={{ width: `${progressPercent}%` }}
                        />
                     </div>

                     <div className="mt-md-3 border-t border-md-primary-100 pt-md-3">
                        <div className="flex items-center justify-center gap-md-2 text-center">
                           <Shield className="h-5 w-5 shrink-0 text-md-primary-1200" aria-hidden="true" />
                           <p className="text-md-b2 font-medium tracking-normal text-md-neutral-1200">{panelDescription}</p>
                        </div>
                     </div>
                  </div>
               )}

               {isShowingHelp ? (
                  <div className="grid w-full grid-cols-2 gap-md-2">
                     <button
                        type="button"
                        onClick={onCloseHelp}
                        className="inline-flex items-center justify-center rounded-md-lg border border-md-neutral-500 bg-white px-md-3 py-md-3 text-md-b2 font-semibold tracking-normal text-md-heading"
                     >
                        Keep waiting
                     </button>
                     <button
                        type="button"
                        onClick={onContactSupport}
                        className="inline-flex items-center justify-center rounded-md-lg bg-md-primary-1200 px-md-3 py-md-3 text-md-b2 font-semibold tracking-normal text-white"
                     >
                        Open Telegram
                     </button>
                  </div>
               ) : isProcessing ? (
                  <button
                     type="button"
                     onClick={onNeedHelp}
                     className="text-md-b2 font-semibold tracking-normal text-md-neutral-1200 underline underline-offset-4"
                  >
                     Having trouble?
                  </button>
               ) : null}

               {state === 'error' ? (
                  <div className="grid w-full grid-cols-2 gap-md-2">
                     <button
                        type="button"
                        onClick={onDismiss}
                        className="inline-flex items-center justify-center rounded-md-lg border border-md-neutral-500 bg-white px-md-3 py-md-3 text-md-b2 font-semibold tracking-normal text-md-heading"
                     >
                        Back
                     </button>
                     <button
                        type="button"
                        onClick={onTryAgain}
                        className="inline-flex items-center justify-center rounded-md-lg bg-md-primary-1200 px-md-3 py-md-3 text-md-b2 font-semibold tracking-normal text-white"
                     >
                        Try again
                     </button>
                  </div>
               ) : null}
            </div>
         </div>
      </div>
   );
}

export default function WorldIDVerification({
   children,
   onSuccess,
   className = '',
   showSuccessToast = true,
   showSuccessFeedback = true
}: WorldIDVerificationProps) {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const { showToastByConfig } = useToast();
   const [isIDKitOpen, setIsIDKitOpen] = useState(false);
   const [rpContext, setRpContext] = useState<RpContext | null>(null);
   const [showAlreadyUsedModal, setShowAlreadyUsedModal] = useState(false);
   const [verificationFeedbackState, setVerificationFeedbackState] = useState<VerificationFeedbackState>('idle');
   const [verificationProcessingStep, setVerificationProcessingStep] = useState<VerificationProcessingStep>('confirming');
   const [processingElapsedSeconds, setProcessingElapsedSeconds] = useState(0);
   const [showVerificationHelp, setShowVerificationHelp] = useState(false);
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
      setShowVerificationHelp(false);
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
            setShowVerificationHelp(false);
            setVerificationFeedbackState('error');
         }
         console.error('[WorldID] handleVerify error:', error);
         throw error;
      }
   };

   const handleSuccess = () => {
      if ('vibrate' in window.navigator && typeof window.navigator.vibrate === 'function') {
         window.navigator.vibrate(50);
      }

      if (successTimerRef.current !== null) {
         window.clearTimeout(successTimerRef.current);
      }

      const finishSuccessfulVerification = () => {
         setVerificationFeedbackState('idle');
         setShowVerificationHelp(false);
         if (onSuccess) {
            onSuccess();
         } else {
            navigate('/onboarding/congratulations');
         }
         if (showSuccessToast) {
            showToastByConfig(getToastKeyFromSuccessCode(SUCCESS_CODES.AUTH_VERIFY_SUCCESS)!);
         }
      };

      if (!showSuccessFeedback) {
         finishSuccessfulVerification();
         return;
      }

      setVerificationFeedbackState('success');
      successTimerRef.current = window.setTimeout(finishSuccessfulVerification, SUCCESS_CONFIRMATION_MS);
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
         setShowVerificationHelp(false);
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

   const handleContactSupport = useCallback(() => {
      window.open(TELEGRAM_SUPPORT_URL, '_blank', 'noopener,noreferrer');
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
            showHelpPanel={showVerificationHelp}
            onTryAgain={() => void handleStartIDKit()}
            onDismiss={() => {
               setShowVerificationHelp(false);
               setVerificationFeedbackState('idle');
            }}
            onNeedHelp={() => setShowVerificationHelp(true)}
            onCloseHelp={() => setShowVerificationHelp(false)}
            onContactSupport={handleContactSupport}
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
