import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { CredentialRequest, IDKit, IDKitErrorCodes, type IDKitResult, type RpContext } from '@worldcoin/idkit';
import { AlertTriangle, CheckCircle2, ExternalLink, Globe2, LoaderCircle, LockKeyhole, Shield, X } from 'lucide-react';
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
import { SUPPORT_FACEBOOK_URL, WORLD_ID_VERIFICATION_SUPPORT_URL } from '@/views/support/constants';

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
const LAUNCH_FALLBACK_DELAY_MS = 4000;

type VerificationFeedbackState = 'idle' | 'processing' | 'success' | 'error';
type VerificationProcessingStep = 'confirming' | 'syncing';
type VerificationLaunchState = 'idle' | 'opening' | 'fallback';
type WorldIdRequestStatus = {
   type: string;
   result?: IDKitResult;
   error?: IDKitErrorCodes;
};
type PreparedWorldIdRequest = {
   connectorURI: string;
   pollOnce: () => Promise<WorldIdRequestStatus>;
};

const wait = (ms: number) =>
   new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
   });

interface VerificationLaunchOverlayProps {
   state: VerificationLaunchState;
   onRetryOpen: () => void;
   onCancel: () => void;
}

function VerificationLaunchOverlay({ state, onRetryOpen, onCancel }: VerificationLaunchOverlayProps) {
   if (state === 'idle') return null;

   const isFallback = state === 'fallback';

   return (
      <div
         className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-md-primary-2000/65 px-md-4 font-sans backdrop-blur-[6px]"
         role={isFallback ? 'alertdialog' : 'status'}
         aria-modal="true"
         aria-live="polite"
         aria-labelledby="world-id-launch-title"
         aria-describedby="world-id-launch-description"
      >
         <div className="w-full max-w-[398px] rounded-md-lg border border-md-neutral-400 bg-md-neutral-100 px-md-4 py-md-5 text-center shadow-md-card">
            {isFallback ? (
               <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-md-primary-300 bg-md-primary-100 text-md-primary-1200">
                  <ExternalLink className="h-8 w-8" aria-hidden="true" />
               </div>
            ) : (
               <div className="relative mx-auto h-16 w-16" aria-label="Opening World ID" role="status">
                  <div className="absolute inset-0 rounded-full border-[5px] border-md-primary-200 border-t-md-primary-1200 animate-spin" />
                  <div className="absolute inset-3 flex items-center justify-center rounded-full bg-md-primary-100 text-md-primary-1200">
                     <Globe2 className="h-7 w-7" aria-hidden="true" />
                  </div>
               </div>
            )}

            <div className="mt-md-3 flex flex-col gap-md-1">
               <h2 id="world-id-launch-title" className="text-[24px] font-[590] leading-[1.2] tracking-normal text-md-heading">
                  {isFallback ? "World ID didn't open?" : 'Opening World ID...'}
               </h2>
               <p id="world-id-launch-description" className="text-md-b2 font-normal leading-[1.5] tracking-normal text-md-neutral-1200">
                  {isFallback
                     ? 'Your browser may have blocked the external window. Open World ID manually to continue.'
                     : "You'll verify with World ID in an external app or window. You'll return to Moodeng to finish."}
               </p>
            </div>

            {isFallback ? (
               <div className="mt-md-4 grid w-full grid-cols-2 gap-md-2 border-t border-md-neutral-400 pt-md-3">
                  <button
                     type="button"
                     onClick={onCancel}
                     className="inline-flex min-h-12 items-center justify-center rounded-md-lg border border-md-neutral-600 bg-md-neutral-100 px-md-3 py-md-3 text-md-b2 font-semibold tracking-normal text-md-heading"
                  >
                     Cancel
                  </button>
                  <button
                     type="button"
                     onClick={onRetryOpen}
                     className="inline-flex min-h-12 items-center justify-center gap-md-1 rounded-md-lg bg-md-primary-1200 px-md-3 py-md-3 text-md-b2 font-semibold tracking-normal text-md-neutral-100"
                  >
                     Open World ID
                     <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </button>
               </div>
            ) : (
               <p className="mt-md-3 text-md-b3 font-normal tracking-normal text-md-neutral-1200">This may take a few seconds.</p>
            )}
         </div>
      </div>
   );
}

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
   onOpenFacebookSupport: () => void;
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
   onContactSupport,
   onOpenFacebookSupport
}: VerificationFeedbackOverlayProps) {
   if (state === 'idle') return null;

   const isProcessing = state === 'processing';
   const isSuccess = state === 'success';
   const isShowingHelp = isProcessing && showHelpPanel;
   const Icon = isProcessing ? LoaderCircle : isSuccess ? CheckCircle2 : AlertTriangle;
   const isTakingLonger = isProcessing && processingElapsedSeconds >= LONG_PROCESSING_SECONDS;
   const title = isProcessing
      ? isTakingLonger
         ? 'Still verifying your World ID'
         : 'Verifying your World ID'
      : isSuccess
        ? 'Verification Successful'
        : 'Verification is taking too long';
   const description = isProcessing
      ? isTakingLonger
         ? 'This is taking longer than usual. Keep this screen open while Moodeng finishes syncing.'
         : 'This usually takes less than 10 seconds. Keep this screen open.'
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
          ? 'Finalizing verification'
          : 'Confirming verification';
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
         <div className="w-full max-w-[398px] overflow-hidden rounded-md-lg border border-md-neutral-400 bg-md-neutral-100 text-left shadow-md-card">
            <div className="flex min-h-[56px] items-center justify-between border-b border-md-neutral-400 px-md-3 py-md-3">
               <h2 className="min-w-0 text-[20px] font-[590] leading-[1.2] tracking-normal text-md-heading">
                  {isShowingHelp ? 'Need help verifying?' : title}
               </h2>
               {isShowingHelp ? (
                  <button
                     type="button"
                     onClick={onCloseHelp}
                     aria-label="Close verification help"
                     className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md-md text-md-neutral-1500"
                  >
                     <X className="h-5 w-5" aria-hidden="true" />
                  </button>
               ) : (
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md-md ${iconBackgroundClassName}`}>
                     <Icon className={`h-5 w-5 ${iconClassName}`} aria-hidden="true" />
                  </div>
               )}
            </div>

            <div className="flex flex-col gap-md-3 p-md-3">
               <p className="text-md-b2 font-normal tracking-normal text-md-neutral-1200">
                  {isShowingHelp
                     ? 'If World ID finished but Moodeng did not update, choose a support channel.'
                     : description}
               </p>

               {isShowingHelp ? (
                  <>
                     <div className="flex flex-col gap-md-1">
                        <p className="text-md-b2 font-semibold tracking-normal text-md-heading">Contact us via</p>
                        <div className="grid w-full grid-cols-2 gap-md-2">
                           <button
                              type="button"
                              onClick={onContactSupport}
                              className="inline-flex min-h-[56px] items-center justify-center gap-md-1 rounded-md-lg px-md-3 py-md-3 text-md-b1 font-semibold tracking-normal text-md-neutral-100 shadow-md-card transition-all duration-150 hover:brightness-105 active:scale-[0.97] active:brightness-95"
                              style={{ backgroundColor: '#0088CC' }}
                           >
                              <img src="/icons/telegram-classic-filled.png" alt="" className="h-5 w-5 shrink-0" />
                              Telegram
                           </button>
                           <button
                              type="button"
                              onClick={onOpenFacebookSupport}
                              className="inline-flex min-h-[56px] items-center justify-center gap-md-1 rounded-md-lg px-md-3 py-md-3 text-md-b1 font-semibold tracking-normal text-md-neutral-100 shadow-md-card transition-all duration-150 hover:brightness-105 active:scale-[0.97] active:brightness-95"
                              style={{ backgroundColor: '#1877F2' }}
                           >
                              <span
                                 className="h-5 w-5 shrink-0 bg-md-neutral-100"
                                 aria-hidden="true"
                                 style={{
                                    WebkitMaskImage: "url('/icons/facebook.svg')",
                                    maskImage: "url('/icons/facebook.svg')",
                                    WebkitMaskSize: 'contain',
                                    maskSize: 'contain',
                                    WebkitMaskRepeat: 'no-repeat',
                                    maskRepeat: 'no-repeat',
                                    WebkitMaskPosition: 'center',
                                    maskPosition: 'center'
                                 }}
                              />
                              Facebook
                           </button>
                        </div>
                     </div>
                     <button
                        type="button"
                        onClick={onCloseHelp}
                        className="inline-flex min-h-10 w-full items-center justify-center rounded-md-lg border border-md-primary-100 bg-md-primary-100 px-md-3 py-md-2 text-md-b2 font-semibold tracking-normal text-md-primary-1600"
                     >
                        Keep waiting
                     </button>
                  </>
               ) : (
                  <>
                     <div className="flex flex-col gap-md-1">
                        <p className="text-md-b2 font-semibold tracking-normal text-md-heading">Verification status</p>
                        <div className="rounded-md-input border border-md-neutral-600 bg-md-neutral-100 px-md-3 py-md-2 shadow-md-card">
                           <div className="flex items-center gap-md-2">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md-md border border-md-primary-300 bg-md-primary-100 text-md-primary-1200">
                                 <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                              </div>
                              <div className="min-w-0">
                                 <p className="text-md-b1 font-semibold tracking-normal text-md-heading">{statusLabel}</p>
                                 <p className="mt-0.5 text-md-b3 font-normal tracking-normal text-md-neutral-1200">{panelDescription}</p>
                              </div>
                           </div>

                           <div
                              className="mt-md-2 h-2 w-full overflow-hidden rounded-md-pill bg-md-primary-100"
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
                        </div>
                     </div>

                     <div className="flex items-center gap-md-1 text-md-b3 font-normal tracking-normal text-md-neutral-1200">
                        <Shield className="h-4 w-4 shrink-0 text-md-primary-1200" aria-hidden="true" />
                        <span>{isProcessing ? 'No further action is needed.' : 'Your verification status is protected.'}</span>
                     </div>
                  </>
               )}

               {!isShowingHelp && isProcessing ? (
                  <button
                     type="button"
                     onClick={onNeedHelp}
                     className="inline-flex min-h-12 w-full items-center justify-center rounded-md-lg border border-md-primary-100 bg-md-primary-100 px-md-3 py-md-2 text-md-b2 font-semibold tracking-normal text-md-primary-1600"
                  >
                     Having trouble?
                  </button>
               ) : null}

               {state === 'error' ? (
                  <div className="grid w-full grid-cols-2 gap-md-2">
                     <button
                        type="button"
                        onClick={onDismiss}
                        className="inline-flex min-h-12 items-center justify-center rounded-md-lg border border-md-neutral-600 bg-md-neutral-100 px-md-3 py-md-3 text-md-b2 font-semibold tracking-normal text-md-heading"
                     >
                        Back
                     </button>
                     <button
                        type="button"
                        onClick={onTryAgain}
                        className="inline-flex min-h-12 items-center justify-center rounded-md-lg bg-md-primary-1200 px-md-3 py-md-3 text-md-b2 font-semibold tracking-normal text-md-neutral-100"
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
   const [showAlreadyUsedModal, setShowAlreadyUsedModal] = useState(false);
   const [verificationLaunchState, setVerificationLaunchState] = useState<VerificationLaunchState>('idle');
   const [verificationFeedbackState, setVerificationFeedbackState] = useState<VerificationFeedbackState>('idle');
   const [verificationProcessingStep, setVerificationProcessingStep] = useState<VerificationProcessingStep>('confirming');
   const [processingElapsedSeconds, setProcessingElapsedSeconds] = useState(0);
   const [showVerificationHelp, setShowVerificationHelp] = useState(false);
   const alreadyUsedRef = useRef(false);
   const preparingRef = useRef(false);
   const successTimerRef = useRef<number | null>(null);
   const preparedRequestRef = useRef<PreparedWorldIdRequest | null>(null);
   const prepareRequestPromiseRef = useRef<Promise<PreparedWorldIdRequest> | null>(null);
   const launchFallbackTimerRef = useRef<number | null>(null);
   const temporaryLaunchWindowRef = useRef<Window | null>(null);
   const pollRunRef = useRef(0);
   const didLaunchExternalFlowRef = useRef(false);

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
         pollRunRef.current += 1;
         if (successTimerRef.current !== null) {
            window.clearTimeout(successTimerRef.current);
         }
         if (launchFallbackTimerRef.current !== null) {
            window.clearTimeout(launchFallbackTimerRef.current);
         }
         temporaryLaunchWindowRef.current = null;
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

   useEffect(() => {
      if (verificationLaunchState !== 'opening') return undefined;

      const markExternalFlowStarted = () => {
         didLaunchExternalFlowRef.current = true;
         if (launchFallbackTimerRef.current !== null) {
            window.clearTimeout(launchFallbackTimerRef.current);
            launchFallbackTimerRef.current = null;
         }
      };
      const handleVisibilityChange = () => {
         if (document.visibilityState === 'hidden') {
            markExternalFlowStarted();
         }
      };

      window.addEventListener('pagehide', markExternalFlowStarted);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
         window.removeEventListener('pagehide', markExternalFlowStarted);
         document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
   }, [verificationLaunchState]);

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

   const createWorldIdRequest = useCallback(async () => {
      if (!app_id) {
         throw new Error('VITE_WORLD_ID_APP_ID is not configured.');
      }

      const nextRpContext = await fetchRpContext();
      const request = await IDKit.request({
         app_id,
         action,
         action_description: WORLD_ID_ACTION_DESCRIPTION,
         rp_context: nextRpContext,
         allow_legacy_proofs: false,
         environment: WORLD_ID_ENVIRONMENT
      }).constraints(CredentialRequest('proof_of_human'));

      return request as PreparedWorldIdRequest;
   }, [action, app_id, fetchRpContext]);

   const prepareWorldIdRequest = useCallback(() => {
      if (preparedRequestRef.current) {
         return Promise.resolve(preparedRequestRef.current);
      }

      if (!prepareRequestPromiseRef.current) {
         prepareRequestPromiseRef.current = createWorldIdRequest()
            .then((request) => {
               preparedRequestRef.current = request;
               return request;
            })
            .catch((error) => {
               prepareRequestPromiseRef.current = null;
               throw error;
            });
      }

      return prepareRequestPromiseRef.current;
   }, [createWorldIdRequest]);

   useEffect(() => {
      if (!app_id || !apiUrl) return undefined;

      let isMounted = true;
      void prepareWorldIdRequest().catch((error) => {
         if (isMounted) {
            console.error('[WorldID] prepareWorldIdRequest error:', error instanceof Error ? error.message : error);
         }
      });

      return () => {
         isMounted = false;
      };
   }, [apiUrl, app_id, prepareWorldIdRequest]);

   const handleVerify = useCallback(async (proof: IDKitResult) => {
      if (launchFallbackTimerRef.current !== null) {
         window.clearTimeout(launchFallbackTimerRef.current);
         launchFallbackTimerRef.current = null;
      }
      setVerificationLaunchState('idle');
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
               showAlreadyUsedWarning();
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
   }, [apiUrl, getSessionAccessToken, refreshUserUntilWorldIdActive, showAlreadyUsedWarning, showToastByConfig]);

   const handleSuccess = useCallback(() => {
      if ('vibrate' in window.navigator && typeof window.navigator.vibrate === 'function') {
         window.navigator.vibrate(50);
      }

      if (successTimerRef.current !== null) {
         window.clearTimeout(successTimerRef.current);
      }

      const finishSuccessfulVerification = () => {
         setVerificationLaunchState('idle');
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
   }, [navigate, onSuccess, showSuccessFeedback, showSuccessToast, showToastByConfig]);

   const handleError = useCallback((errorCode: IDKitErrorCodes) => {
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
   }, [showAlreadyUsedWarning, showToastByConfig, verificationFeedbackState]);

   const clearLaunchFallbackTimer = useCallback(() => {
      if (launchFallbackTimerRef.current !== null) {
         window.clearTimeout(launchFallbackTimerRef.current);
         launchFallbackTimerRef.current = null;
      }
   }, []);

   const showLaunchFallback = useCallback(() => {
      clearLaunchFallbackTimer();
      if (!didLaunchExternalFlowRef.current) {
         temporaryLaunchWindowRef.current?.close();
         temporaryLaunchWindowRef.current = null;
         setVerificationLaunchState('fallback');
      }
   }, [clearLaunchFallbackTimer]);

   const openExternalWorldId = useCallback((connectorURI: string) => {
      try {
         const openedWindow = window.open(connectorURI, '_blank');
         if (!openedWindow) return false;
         openedWindow.opener = null;
         didLaunchExternalFlowRef.current = true;
         clearLaunchFallbackTimer();
         return true;
      } catch (error) {
         console.error('[WorldID] openExternalWorldId error:', error);
         return false;
      }
   }, [clearLaunchFallbackTimer]);

   const beginPollingWorldIdRequest = useCallback(
      (request: PreparedWorldIdRequest) => {
         const runId = pollRunRef.current + 1;
         pollRunRef.current = runId;

         void (async () => {
            const startedAt = Date.now();
            while (pollRunRef.current === runId) {
               if (Date.now() - startedAt > 15 * 60 * 1000) {
                  setVerificationLaunchState('idle');
                  handleError(IDKitErrorCodes.Timeout);
                  return;
               }

               const nextStatus = await request.pollOnce();

               if (pollRunRef.current !== runId) {
                  return;
               }

               if (nextStatus.type === 'confirmed') {
                  if (!nextStatus.result) {
                     setVerificationLaunchState('idle');
                     handleError(IDKitErrorCodes.UnexpectedResponse);
                     return;
                  }

                  clearLaunchFallbackTimer();
                  setVerificationLaunchState('idle');
                  try {
                     await handleVerify(nextStatus.result);
                     handleSuccess();
                  } catch {
                     // handleVerify already maps the error into the existing processing/error UI.
                  } finally {
                     preparedRequestRef.current = null;
                     prepareRequestPromiseRef.current = null;
                  }
                  return;
               }

               if (nextStatus.type === 'failed') {
                  setVerificationLaunchState('idle');
                  handleError(nextStatus.error ?? IDKitErrorCodes.GenericError);
                  preparedRequestRef.current = null;
                  prepareRequestPromiseRef.current = null;
                  void prepareWorldIdRequest().catch(() => undefined);
                  return;
               }

               await wait(STATUS_REFRESH_DELAY_MS);
            }
         })().catch((error) => {
            if (pollRunRef.current === runId) {
               setVerificationLaunchState('idle');
               console.error('[WorldID] beginPollingWorldIdRequest error:', error);
               showToastByConfig('server_error');
            }
         });
      },
      [clearLaunchFallbackTimer, handleError, handleSuccess, handleVerify, prepareWorldIdRequest, showToastByConfig]
   );

   const launchPreparedWorldIdRequest = useCallback(
      (request: PreparedWorldIdRequest) => {
         const didOpen = openExternalWorldId(request.connectorURI);
         if (!didOpen) {
            clearLaunchFallbackTimer();
            setVerificationLaunchState('fallback');
            return false;
         }

         setVerificationLaunchState('opening');
         beginPollingWorldIdRequest(request);
         return true;
      },
      [beginPollingWorldIdRequest, clearLaunchFallbackTimer, openExternalWorldId]
   );

   const handleStartWorldIdLaunch = useCallback(() => {
      if (preparingRef.current || verificationLaunchState === 'opening') return;

      preparingRef.current = true;
      didLaunchExternalFlowRef.current = false;
      setVerificationFeedbackState('idle');
      setVerificationProcessingStep('confirming');
      setShowVerificationHelp(false);
      setVerificationLaunchState('opening');

      if (launchFallbackTimerRef.current !== null) {
         window.clearTimeout(launchFallbackTimerRef.current);
      }
      launchFallbackTimerRef.current = window.setTimeout(showLaunchFallback, LAUNCH_FALLBACK_DELAY_MS);

      const preparedRequest = preparedRequestRef.current;
      if (preparedRequest) {
         launchPreparedWorldIdRequest(preparedRequest);
         preparingRef.current = false;
         return;
      }

      let placeholderWindow: Window | null = null;
      try {
         placeholderWindow = window.open('', '_blank');
         if (placeholderWindow) {
            placeholderWindow.opener = null;
            placeholderWindow.document.title = 'Opening World ID';
            placeholderWindow.document.body.style.fontFamily = 'system-ui, sans-serif';
            placeholderWindow.document.body.style.padding = '24px';
            placeholderWindow.document.body.textContent = 'Opening World ID...';
            temporaryLaunchWindowRef.current = placeholderWindow;
         }
      } catch (error) {
         console.error('[WorldID] placeholder launch window error:', error);
      }

      if (!placeholderWindow) {
         setVerificationLaunchState('fallback');
      }

      prepareWorldIdRequest()
         .then((request) => {
            if (temporaryLaunchWindowRef.current && !temporaryLaunchWindowRef.current.closed) {
               temporaryLaunchWindowRef.current.location.href = request.connectorURI;
               temporaryLaunchWindowRef.current = null;
               didLaunchExternalFlowRef.current = true;
               clearLaunchFallbackTimer();
               beginPollingWorldIdRequest(request);
            }
         })
         .catch((error) => {
            setVerificationLaunchState('idle');
            if (error instanceof Error && error.message === 'WORLDID_ALREADY_USED') return;
            console.error('[WorldID] handleStartWorldIdLaunch error:', error instanceof Error ? error.message : error);
            showToastByConfig('server_error');
         })
         .finally(() => {
            preparingRef.current = false;
         });
   }, [
      beginPollingWorldIdRequest,
      clearLaunchFallbackTimer,
      launchPreparedWorldIdRequest,
      prepareWorldIdRequest,
      showLaunchFallback,
      showToastByConfig,
      verificationLaunchState
   ]);

   const handleCancelWorldIdLaunch = useCallback(() => {
      pollRunRef.current += 1;
      preparingRef.current = false;
      clearLaunchFallbackTimer();
      temporaryLaunchWindowRef.current = null;
      setVerificationLaunchState('idle');
   }, [clearLaunchFallbackTimer]);

   const handleContactSupport = useCallback(() => {
      window.open(WORLD_ID_VERIFICATION_SUPPORT_URL, '_blank', 'noopener,noreferrer');
   }, []);

   const handleOpenFacebookSupport = useCallback(() => {
      window.open(SUPPORT_FACEBOOK_URL, '_blank', 'noopener,noreferrer');
   }, []);

   const trigger = className ? (
      <span className={className}>{children({ open: handleStartWorldIdLaunch })}</span>
   ) : (
      children({ open: handleStartWorldIdLaunch })
   );

   return (
      <>
         {trigger}

         <AlreadyUsedModal isOpen={showAlreadyUsedModal} onClose={() => setShowAlreadyUsedModal(false)} />

         <VerificationLaunchOverlay
            state={verificationLaunchState}
            onRetryOpen={handleStartWorldIdLaunch}
            onCancel={handleCancelWorldIdLaunch}
         />

         <VerificationFeedbackOverlay
            state={verificationFeedbackState}
            processingStep={verificationProcessingStep}
            processingElapsedSeconds={processingElapsedSeconds}
            showHelpPanel={showVerificationHelp}
            onTryAgain={handleStartWorldIdLaunch}
            onDismiss={() => {
               setShowVerificationHelp(false);
               setVerificationFeedbackState('idle');
            }}
            onNeedHelp={() => setShowVerificationHelp(true)}
            onCloseHelp={() => setShowVerificationHelp(false)}
            onContactSupport={handleContactSupport}
            onOpenFacebookSupport={handleOpenFacebookSupport}
         />
      </>
   );
}
