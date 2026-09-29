import { useCallback, useEffect, useRef, useState } from 'react';

import { any, CredentialRequest, type CredentialType, IDKit, type IDKitResult, type RpContext } from '@worldcoin/idkit';
import posthog from 'posthog-js';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { handleApiError, isApiError } from '@/lib/apiHandler';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { openSupportChat } from '@/lib/support/liveChat';
import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import type { ApiResponse } from '@/types/apiTypes';
import { SUCCESS_CODES } from '@/types/successCodes';
import { getToastKeyFromSuccessCode } from '@/types/successToastMapping';
import { SUPPORT_FACEBOOK_URL, WORLD_ID_VERIFICATION_SUPPORT_URL } from '@/views/support/constants';

import {
   buildWorldIdReturnToUrl,
   getRequestUsableUntilMs,
   isPreparedRequestStale,
   needsCurrentTabWorldAppLaunch,
   REQUEST_KEEP_WARM_LEAD_MS,
   type PreparedWorldIdRequest
} from '@/components/worldId/worldIdLaunch';
import { getWorldIdFailureOutcome } from '@/components/worldId/worldIdErrors';

const WORLD_ID_ACTION_ID = 'verify-borrower';
const WORLD_ID_ENVIRONMENT = (import.meta.env.VITE_WORLD_ID_ENVIRONMENT ||
   (import.meta.env.MODE === 'production' ? 'production' : 'staging')) as 'production' | 'staging';
const WORLD_ID_APP_ID = (WORLD_ID_ENVIRONMENT === 'production'
   ? import.meta.env.VITE_WORLD_ID_APP_ID_PROD
   : import.meta.env.VITE_WORLD_ID_APP_ID_STAGING) as `app_${string}` | undefined;
const SUCCESS_CONFIRMATION_MS = 1500;
const STATUS_REFRESH_RETRIES = 30;
const STATUS_REFRESH_DELAY_MS = 1000;
const POLL_TIMEOUT_MS = 15 * 60 * 1000;
const DESKTOP_LAUNCH_FALLBACK_DELAY_MS = 4000;
// On mobile the app handoff is instant when it happens at all (no network involved), so a
// shorter window is enough to detect that the universal link silently did nothing.
const MOBILE_LAUNCH_FALLBACK_DELAY_MS = 3000;

export type VerificationFeedbackState = 'idle' | 'processing' | 'success' | 'error';
export type VerificationProcessingStep = 'confirming' | 'syncing';
export type VerificationLaunchState = 'idle' | 'preparing' | 'ready' | 'opening' | 'fallback';

export const LONG_PROCESSING_SECONDS = 10;

const wait = (ms: number) =>
   new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
   });

// True while this page is in the background or being left (the tap sent the tab to World App or
// to World's website). A status check cut off then is expected, not a failure.
const isPageAway = () =>
   typeof document !== 'undefined' && (document.visibilityState === 'hidden' || pageUnloading);
let pageUnloading = false;
if (typeof window !== 'undefined') {
   window.addEventListener('pagehide', () => {
      pageUnloading = true;
   });
   window.addEventListener('pageshow', () => {
      pageUnloading = false;
   });
}

// Resolves once the person is back on this page.
const waitUntilBack = () =>
   new Promise<void>((resolve) => {
      if (!isPageAway()) {
         resolve();
         return;
      }
      const done = () => {
         if (isPageAway()) return;
         document.removeEventListener('visibilitychange', done);
         window.removeEventListener('pageshow', done);
         resolve();
      };
      document.addEventListener('visibilitychange', done);
      window.addEventListener('pageshow', done);
   });

type PrepareErrorPresentation = 'notify' | 'quiet';

export interface WorldIdVerificationConfig {
   /**
    * World ID credentials to accept ('proof_of_human' = Orb, 'passport' = Passport/ID). More than
    * one becomes an any-of request: World App proves whichever the person has. Must be referentially stable.
    */
   credentials: readonly CredentialType[];
   actionDescription: string;
   /** Extra fields merged into the `{ type: 'verify', proof }` backend payload. Must be referentially stable. */
   verifyExtraBody?: Record<string, unknown>;
   /** Which status field on the refreshed user marks this credential as verified. Must be referentially stable. */
   isVerificationActive: (user: { isWorldId?: string; isWorldIdPassport?: string }) => boolean;
   logTag: string;
   onSuccess?: () => void;
   showSuccessToast?: boolean;
   showSuccessFeedback?: boolean;
}

export function useWorldIdVerification({
   credentials,
   actionDescription,
   verifyExtraBody,
   isVerificationActive,
   logTag,
   onSuccess,
   showSuccessToast = true,
   showSuccessFeedback = true
}: WorldIdVerificationConfig) {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const { showToastByConfig } = useToast();
   const [showAlreadyUsedModal, setShowAlreadyUsedModal] = useState(false);
   const [verificationLaunchState, setVerificationLaunchState] = useState<VerificationLaunchState>('idle');
   const [verificationFeedbackState, setVerificationFeedbackState] = useState<VerificationFeedbackState>('idle');
   const [verificationProcessingStep, setVerificationProcessingStep] = useState<VerificationProcessingStep>('confirming');
   const [processingElapsedSeconds, setProcessingElapsedSeconds] = useState(0);
   const [showVerificationHelp, setShowVerificationHelp] = useState(false);
   const [requestReadyNonce, setRequestReadyNonce] = useState(0);
   const alreadyUsedRef = useRef(false);
   const preparingRef = useRef(false);
   const successTimerRef = useRef<number | null>(null);
   const preparedRequestRef = useRef<PreparedWorldIdRequest | null>(null);
   const prepareRequestPromiseRef = useRef<Promise<PreparedWorldIdRequest> | null>(null);
   const launchFallbackTimerRef = useRef<number | null>(null);
   const temporaryLaunchWindowRef = useRef<Window | null>(null);
   const pollRunRef = useRef(0);
   const launchRunRef = useRef(0);
   const didLaunchExternalFlowRef = useRef(false);
   const detachLaunchListenersRef = useRef<(() => void) | null>(null);
   const launchStateRef = useRef<VerificationLaunchState>('idle');

   launchStateRef.current = verificationLaunchState;

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

   const clearLaunchFallbackTimer = useCallback(() => {
      if (launchFallbackTimerRef.current !== null) {
         window.clearTimeout(launchFallbackTimerRef.current);
         launchFallbackTimerRef.current = null;
      }
   }, []);

   const detachLaunchListeners = useCallback(() => {
      detachLaunchListenersRef.current?.();
      detachLaunchListenersRef.current = null;
   }, []);

   useEffect(() => {
      return () => {
         pollRunRef.current += 1;
         launchRunRef.current += 1;
         if (successTimerRef.current !== null) {
            window.clearTimeout(successTimerRef.current);
         }
         if (launchFallbackTimerRef.current !== null) {
            window.clearTimeout(launchFallbackTimerRef.current);
         }
         detachLaunchListenersRef.current?.();
         detachLaunchListenersRef.current = null;
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

   const refreshUserUntilVerificationActive = useCallback(async () => {
      for (let attempt = 0; attempt < STATUS_REFRESH_RETRIES; attempt += 1) {
         if (attempt > 0) {
            await wait(STATUS_REFRESH_DELAY_MS);
         }

         const refreshedUser = await dispatch(fetchUser()).unwrap();

         if (isVerificationActive(refreshedUser)) {
            return;
         }
      }

      throw new Error('World ID verification was accepted, but the account status did not update.');
   }, [dispatch, isVerificationActive]);

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
            throw new Error('WORLDID_ALREADY_USED');
         }
         const error = new Error(isApiError(result) ? result.error : 'Failed to prepare World ID verification.') as Error & {
            toastKey?: ReturnType<typeof handleApiError>;
         };
         error.toastKey = handleApiError(result);
         throw error;
      }

      return result.rp_context;
   }, [action, apiUrl, getSessionAccessToken]);

   // Toasts/modals for a failed prepare are decided by the caller: taps notify the user, while
   // background refreshes stay quiet (except "already used", which is worth surfacing anytime).
   const presentPrepareError = useCallback(
      (error: unknown, presentation: PrepareErrorPresentation) => {
         if (error instanceof Error && error.message === 'WORLDID_ALREADY_USED') {
            showAlreadyUsedWarning();
            return;
         }
         if (presentation === 'quiet') return;
         const toastKey = error instanceof Error ? (error as Error & { toastKey?: Parameters<typeof showToastByConfig>[0] }).toastKey : undefined;
         showToastByConfig(toastKey ?? 'server_error');
      },
      [showAlreadyUsedWarning, showToastByConfig]
   );

   const createWorldIdRequest = useCallback(async (): Promise<PreparedWorldIdRequest> => {
      if (!app_id) {
         throw new Error('VITE_WORLD_ID_APP_ID is not configured.');
      }

      const nextRpContext = await fetchRpContext();
      const request = await IDKit.request({
         app_id,
         action,
         action_description: actionDescription,
         rp_context: nextRpContext,
         allow_legacy_proofs: false,
         environment: WORLD_ID_ENVIRONMENT,
         return_to: buildWorldIdReturnToUrl(window.location.href)
      }).constraints(
         credentials.length === 1
            ? CredentialRequest(credentials[0])
            : any(...credentials.map((credential) => CredentialRequest(credential)))
      );

      return {
         connectorURI: request.connectorURI,
         pollOnce: () => request.pollOnce(),
         usableUntilMs: getRequestUsableUntilMs(nextRpContext.expires_at)
      };
   }, [action, actionDescription, app_id, credentials, fetchRpContext]);

   const prepareWorldIdRequest = useCallback(() => {
      const cached = preparedRequestRef.current;
      if (cached && !isPreparedRequestStale(cached)) {
         return Promise.resolve(cached);
      }
      // The rp signature only lives 5 minutes: never hand out (or keep) a stale request, or the
      // user launches World App into a verification that is already dead.
      preparedRequestRef.current = null;

      if (!prepareRequestPromiseRef.current) {
         prepareRequestPromiseRef.current = createWorldIdRequest()
            .then((request) => {
               preparedRequestRef.current = request;
               prepareRequestPromiseRef.current = null;
               setRequestReadyNonce((nonce) => nonce + 1);
               return request;
            })
            .catch((error) => {
               prepareRequestPromiseRef.current = null;
               throw error;
            });
      }

      return prepareRequestPromiseRef.current;
   }, [createWorldIdRequest]);

   // Pre-warm a request at mount so the common case stays a single tap: the launch must happen
   // synchronously inside the tap gesture, which is only possible with a cached request.
   useEffect(() => {
      if (!app_id || !apiUrl) return undefined;

      let isMounted = true;
      void prepareWorldIdRequest().catch((error) => {
         if (isMounted) {
            presentPrepareError(error, 'quiet');
            console.error(`[${logTag}] prepareWorldIdRequest error:`, error instanceof Error ? error.message : error);
         }
      });

      return () => {
         isMounted = false;
      };
   }, [apiUrl, app_id, logTag, prepareWorldIdRequest, presentPrepareError]);

   // Keep the cached request warm: refresh it shortly before its rp signature expires, and when
   // the tab becomes visible again after sitting in the background past the expiry.
   useEffect(() => {
      const prepared = preparedRequestRef.current;
      if (!prepared) return undefined;

      const refresh = () => {
         if (launchStateRef.current !== 'idle') return;
         void prepareWorldIdRequest().catch((error) => presentPrepareError(error, 'quiet'));
      };

      const delay = Math.max(prepared.usableUntilMs - Date.now() - REQUEST_KEEP_WARM_LEAD_MS, 0);
      const timer = window.setTimeout(() => {
         if (document.visibilityState !== 'visible') return;
         preparedRequestRef.current = null;
         refresh();
      }, delay);

      const handleVisible = () => {
         if (document.visibilityState !== 'visible') return;
         const cached = preparedRequestRef.current;
         if (cached && !isPreparedRequestStale(cached)) return;
         refresh();
      };
      document.addEventListener('visibilitychange', handleVisible);

      return () => {
         window.clearTimeout(timer);
         document.removeEventListener('visibilitychange', handleVisible);
      };
   }, [prepareWorldIdRequest, presentPrepareError, requestReadyNonce]);

   const handleVerify = useCallback(
      async (proof: IDKitResult) => {
         clearLaunchFallbackTimer();
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
               body: JSON.stringify({ type: 'verify', proof, ...verifyExtraBody })
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
               // A genuine verification failure — proactively open support with context.
               openSupportChat('I had a problem with verification');
               throw new Error(isApiError(result) ? result.error : 'Verification failed.');
            }

            setVerificationProcessingStep('syncing');
            await refreshUserUntilVerificationActive();
         } catch (error) {
            if (!(error instanceof Error && error.message === 'WORLDID_ALREADY_USED')) {
               setShowVerificationHelp(false);
               setVerificationFeedbackState('error');
            }
            console.error(`[${logTag}] handleVerify error:`, error);
            throw error;
         }
      },
      [apiUrl, clearLaunchFallbackTimer, getSessionAccessToken, logTag, refreshUserUntilVerificationActive, showAlreadyUsedWarning, showToastByConfig, verifyExtraBody]
   );

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

   const handleError = useCallback(
      // A plain string: codes come from World App and our own poll loop (see worldIdErrors.ts).
      (errorCode: string) => {
         const isFinishingVerification = verificationFeedbackState === 'processing' || verificationFeedbackState === 'success';
         // Record why World App said no: before this, every failure looked like "Server Error"
         // and there was no way to tell a missing Orb/passport from a broken setup.
         console.warn(`[${logTag}] World ID request failed:`, errorCode);
         if (import.meta.env.PROD) {
            posthog.capture('worldid_request_failed', { error_code: errorCode, credentials: credentials.join(',') });
         }

         const outcome = getWorldIdFailureOutcome(errorCode, { alreadyUsed: alreadyUsedRef.current, isFinishingVerification });
         if (outcome.kind === 'already_used') {
            alreadyUsedRef.current = false;
            showAlreadyUsedWarning();
         } else if (outcome.kind === 'toast') {
            showToastByConfig(outcome.toastKey);
         }
      },
      [credentials, logTag, showAlreadyUsedWarning, showToastByConfig, verificationFeedbackState]
   );

   const showLaunchFallback = useCallback(() => {
      clearLaunchFallbackTimer();
      if (!didLaunchExternalFlowRef.current) {
         temporaryLaunchWindowRef.current?.close();
         temporaryLaunchWindowRef.current = null;
         setVerificationLaunchState('fallback');
      }
   }, [clearLaunchFallbackTimer]);

   const openExternalWorldId = useCallback(
      (connectorURI: string) => {
         try {
            const openedWindow = window.open(connectorURI, '_blank');
            if (!openedWindow) return false;
            openedWindow.opener = null;
            didLaunchExternalFlowRef.current = true;
            clearLaunchFallbackTimer();
            return true;
         } catch (error) {
            console.error(`[${logTag}] openExternalWorldId error:`, error);
            return false;
         }
      },
      [clearLaunchFallbackTimer, logTag]
   );

   const beginPollingWorldIdRequest = useCallback(
      (request: PreparedWorldIdRequest) => {
         const runId = pollRunRef.current + 1;
         pollRunRef.current = runId;

         void (async () => {
            const startedAt = Date.now();
            while (pollRunRef.current === runId) {
               if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
                  setVerificationLaunchState('idle');
                  handleError('timeout');
                  preparedRequestRef.current = null;
                  prepareRequestPromiseRef.current = null;
                  // Re-warm so the next tap can launch World App directly (mobile needs a cached request).
                  void prepareWorldIdRequest().catch((error) => presentPrepareError(error, 'quiet'));
                  return;
               }

               let nextStatus: Awaited<ReturnType<PreparedWorldIdRequest['pollOnce']>>;
               try {
                  nextStatus = await request.pollOnce();
               } catch (error) {
                  // Leaving for World App (or World's website when the app isn't installed) can cut
                  // the status check off mid-request. That's expected: wait until they're back and
                  // keep checking, instead of showing a connection error they didn't cause.
                  if (!isPageAway()) throw error;
                  await waitUntilBack();
                  continue;
               }

               if (pollRunRef.current !== runId) {
                  return;
               }

               if (nextStatus.type === 'confirmed') {
                  if (!nextStatus.result) {
                     setVerificationLaunchState('idle');
                     handleError('unexpected_response');
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
                  handleError(nextStatus.error ?? 'generic_error');
                  preparedRequestRef.current = null;
                  prepareRequestPromiseRef.current = null;
                  void prepareWorldIdRequest().catch((error) => presentPrepareError(error, 'quiet'));
                  return;
               }

               await wait(STATUS_REFRESH_DELAY_MS);
            }
         })().catch((error) => {
            if (pollRunRef.current === runId) {
               setVerificationLaunchState('idle');
               console.error(`[${logTag}] beginPollingWorldIdRequest error:`, error);
               showToastByConfig('worldid_connection_error', { supportTopic: "World ID verification isn't working" });
            }
         });
      },
      [clearLaunchFallbackTimer, handleError, handleSuccess, handleVerify, logTag, prepareWorldIdRequest, presentPrepareError, showToastByConfig]
   );

   /**
    * Mobile launch. MUST run synchronously inside the user's tap: Chrome (Android App Links) and
    * Safari (universal links) only hand an https link to the installed app for user-activated
    * navigations. Navigating after an async gap loads the world.org web page instead, which
    * pushes "Install World App" even when it is installed — the old first-tap bug.
    */
   const launchInCurrentTab = useCallback(
      (request: PreparedWorldIdRequest) => {
         didLaunchExternalFlowRef.current = false;
         clearLaunchFallbackTimer();
         detachLaunchListeners();

         // Bind imperatively (not via effect) so the handoff signals can't race the navigation:
         // - visibilitychange→hidden: World App intercepted the link; this page stays alive.
         // - pagehide: the browser is actually leaving the page (no app handoff); nothing to do.
         // Either way the "nothing happened" fallback below must not fire.
         const markLaunched = () => {
            didLaunchExternalFlowRef.current = true;
            clearLaunchFallbackTimer();
            detachLaunchListeners();
         };
         const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
               markLaunched();
            }
         };
         window.addEventListener('pagehide', markLaunched);
         document.addEventListener('visibilitychange', handleVisibilityChange);
         detachLaunchListenersRef.current = () => {
            window.removeEventListener('pagehide', markLaunched);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
         };

         // If neither signal arrives, the universal link silently did nothing: offer a manual
         // "Open World ID" button (a fresh tap gesture) instead of leaving a dead spinner.
         launchFallbackTimerRef.current = window.setTimeout(showLaunchFallback, MOBILE_LAUNCH_FALLBACK_DELAY_MS);

         setVerificationLaunchState('opening');
         // Start polling before navigating: when World App intercepts the universal link the
         // browser keeps this page alive and polling continues to completion.
         beginPollingWorldIdRequest(request);
         window.location.href = request.connectorURI;
      },
      [beginPollingWorldIdRequest, clearLaunchFallbackTimer, detachLaunchListeners, showLaunchFallback]
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

      if (needsCurrentTabWorldAppLaunch()) {
         const prepared = preparedRequestRef.current;
         if (prepared && !isPreparedRequestStale(prepared)) {
            launchInCurrentTab(prepared);
            preparingRef.current = false;
            return;
         }

         // No usable cached request. Do NOT navigate when the prepare finishes — by then the
         // tap's user activation is gone and the OS won't open World App (see launchInCurrentTab).
         // Prepare now, then ask for one more explicit tap via the 'ready' card.
         setVerificationLaunchState('preparing');
         const runId = ++launchRunRef.current;
         prepareWorldIdRequest()
            .then(() => {
               if (launchRunRef.current !== runId) return;
               setVerificationLaunchState('ready');
            })
            .catch((error) => {
               if (launchRunRef.current !== runId) return;
               setVerificationLaunchState('idle');
               presentPrepareError(error, 'notify');
               console.error(`[${logTag}] mobile launch error:`, error instanceof Error ? error.message : error);
            })
            .finally(() => {
               preparingRef.current = false;
            });
         return;
      }

      setVerificationLaunchState('opening');
      clearLaunchFallbackTimer();
      launchFallbackTimerRef.current = window.setTimeout(showLaunchFallback, DESKTOP_LAUNCH_FALLBACK_DELAY_MS);

      const preparedRequest = preparedRequestRef.current;
      if (preparedRequest && !isPreparedRequestStale(preparedRequest)) {
         launchPreparedWorldIdRequest(preparedRequest);
         preparingRef.current = false;
         return;
      }

      // Desktop cold start: open a placeholder tab synchronously (allowed inside the gesture)
      // and point it at the connector URL once the request exists. Redirecting a window we own
      // is permitted even after the async gap.
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
         console.error(`[${logTag}] placeholder launch window error:`, error);
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
            presentPrepareError(error, 'notify');
            console.error(`[${logTag}] handleStartWorldIdLaunch error:`, error instanceof Error ? error.message : error);
         })
         .finally(() => {
            preparingRef.current = false;
         });
   }, [
      beginPollingWorldIdRequest,
      clearLaunchFallbackTimer,
      launchInCurrentTab,
      launchPreparedWorldIdRequest,
      logTag,
      prepareWorldIdRequest,
      presentPrepareError,
      showLaunchFallback,
      verificationLaunchState
   ]);

   const handleCancelWorldIdLaunch = useCallback(() => {
      pollRunRef.current += 1;
      launchRunRef.current += 1;
      preparingRef.current = false;
      clearLaunchFallbackTimer();
      detachLaunchListeners();
      temporaryLaunchWindowRef.current = null;
      setVerificationLaunchState('idle');
   }, [clearLaunchFallbackTimer, detachLaunchListeners]);

   const handleDismissFeedback = useCallback(() => {
      setShowVerificationHelp(false);
      setVerificationFeedbackState('idle');
   }, []);

   const handleContactSupport = useCallback(() => {
      window.open(WORLD_ID_VERIFICATION_SUPPORT_URL, '_blank', 'noopener,noreferrer');
   }, []);

   const handleOpenFacebookSupport = useCallback(() => {
      window.open(SUPPORT_FACEBOOK_URL, '_blank', 'noopener,noreferrer');
   }, []);

   return {
      openWorldId: handleStartWorldIdLaunch,
      cancelLaunch: handleCancelWorldIdLaunch,
      launchState: verificationLaunchState,
      feedbackState: verificationFeedbackState,
      processingStep: verificationProcessingStep,
      processingElapsedSeconds,
      showVerificationHelp,
      setShowVerificationHelp,
      dismissFeedback: handleDismissFeedback,
      showAlreadyUsedModal,
      setShowAlreadyUsedModal,
      contactSupport: handleContactSupport,
      openFacebookSupport: handleOpenFacebookSupport
   };
}
