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

const DEBUG = true;
const log = (...args: unknown[]) => { if (DEBUG) console.log('[WorldID]', ...args); };

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

   // Log all localStorage keys relevant to WorldID on every mount
   useEffect(() => {
      log('MOUNT — localStorage snapshot:', {
         [WORLD_ID_IN_PROGRESS_KEY]: localStorage.getItem(WORLD_ID_IN_PROGRESS_KEY),
         [WORLD_ID_ALREADY_USED_STORAGE_KEY]: localStorage.getItem(WORLD_ID_ALREADY_USED_STORAGE_KEY),
         [WORLD_ID_RP_CONTEXT_KEY]: localStorage.getItem(WORLD_ID_RP_CONTEXT_KEY) ? '<present>' : null,
      });
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   const showAlreadyUsedWarning = useCallback(
      ({ persist = false }: { persist?: boolean } = {}) => {
         log('showAlreadyUsedWarning — persist:', persist);
         if (persist) {
            localStorage.setItem(WORLD_ID_ALREADY_USED_STORAGE_KEY, WORLD_ID_ALREADY_USED_STORAGE_VALUE);
         }
         setShowAlreadyUsedModal(true);
         showToastByConfig('worldid_already_used');
      },
      [showToastByConfig]
   );

   useEffect(() => {
      const val = localStorage.getItem(WORLD_ID_ALREADY_USED_STORAGE_KEY);
      log('already-used effect — key value:', val);
      if (val === WORLD_ID_ALREADY_USED_STORAGE_VALUE) {
         localStorage.removeItem(WORLD_ID_ALREADY_USED_STORAGE_KEY);
         log('already-used effect — showing warning (page-reload path)');
         showAlreadyUsedWarning();
      }
   }, [showAlreadyUsedWarning]);

   // Mobile page-reload recovery: World App redirect reloads the browser, destroying
   // IDKit state. Restore the persisted rp_context so IDKit re-mounts with the SAME
   // relay session and resumes polling — handleVerify then fires normally.
   // Guard: only restore when IN_PROGRESS_KEY is also set; without it the rpContext
   // is stale (leftover from a previous aborted session) and restoring it causes an
   // immediate "Something went wrong" error from IDKit.
   // React runs child effects before parent effects, so this fires before
   // verify-world-id/page.tsx removes IN_PROGRESS_KEY in its own mount effect.
   useEffect(() => {
      const raw = localStorage.getItem(WORLD_ID_RP_CONTEXT_KEY);
      const inProgress = localStorage.getItem(WORLD_ID_IN_PROGRESS_KEY);
      log('rp-context restore effect — rp_context present:', !!raw, '| in_progress:', inProgress);
      if (!raw) return;
      if (!inProgress) {
         log('rp-context restore effect — no in_progress key; stale rp_context, clearing');
         localStorage.removeItem(WORLD_ID_RP_CONTEXT_KEY);
         return;
      }
      try {
         const parsed = JSON.parse(raw) as { context: RpContext; ts: number };
         const ageMs = Date.now() - parsed.ts;
         log('rp-context restore effect — age:', ageMs, 'ms');
         if (ageMs > 120_000) {
            log('rp-context restore effect — expired (>2 min), clearing stale keys');
            localStorage.removeItem(WORLD_ID_RP_CONTEXT_KEY);
            localStorage.removeItem(WORLD_ID_IN_PROGRESS_KEY);
            return;
         }
         log('rp-context restore effect — fresh, restoring IDKit open');
         setRpContext(parsed.context);
         setIsIDKitOpen(true);
      } catch (e) {
         log('rp-context restore effect — parse FAILED, clearing key:', e);
         localStorage.removeItem(WORLD_ID_RP_CONTEXT_KEY);
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

      log('fetchRpContext — requesting rp-signature');
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
      log('fetchRpContext — response:', res.status, JSON.stringify(result));

      if (!res.ok || !result.success || !result.rp_context) {
         if (isApiError(result) && result.errorCode === 'WORLDID_ALREADY_USED') {
            log('fetchRpContext — WORLDID_ALREADY_USED from rp-signature');
            setShowAlreadyUsedModal(true);
            showToastByConfig('worldid_already_used');
            throw new Error('WORLDID_ALREADY_USED');
         }
         log('fetchRpContext — other error:', result);
         showToastByConfig(handleApiError(result));
         throw new Error(isApiError(result) ? result.error : 'Failed to prepare World ID verification.');
      }

      log('fetchRpContext — success, rp_context received');
      return result.rp_context;
   }, [action, apiUrl, getSessionAccessToken, showToastByConfig]);

   const handleVerify = async (proof: IDKitResult) => {
      log('handleVerify — called with proof nullifier_hash:', (proof as unknown as Record<string, unknown>).nullifier_hash ?? '<missing>');
      try {
         if (!apiUrl) {
            throw new Error('VITE_API_URL is not configured.');
         }

         const accessToken = await getSessionAccessToken();
         log('handleVerify — posting type:verify to API');
         const res = await fetch(`${apiUrl}/verify-worldid`, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
               Authorization: `Bearer ${accessToken}`
            },
            body: JSON.stringify({ type: 'verify', proof })
         });

         const result = (await res.json()) as ApiResponse;
         log('handleVerify — response:', res.status, JSON.stringify(result));

         if (!res.ok || !result.success) {
            if (isApiError(result) && result.errorCode === 'WORLDID_ALREADY_USED') {
               log('handleVerify — WORLDID_ALREADY_USED detected; setting localStorage + alreadyUsedRef, closing IDKit');
               // Persist to localStorage FIRST — if the mobile return_to redirect causes a
               // page reload before handleError fires, the useEffect on the next mount picks
               // this up and still shows the AlreadyUsedModal.
               localStorage.setItem(WORLD_ID_ALREADY_USED_STORAGE_KEY, WORLD_ID_ALREADY_USED_STORAGE_VALUE);
               alreadyUsedRef.current = true;
               setIsIDKitOpen(false);
               throw new Error('WORLDID_ALREADY_USED');
            }
            log('handleVerify — other API error:', result);
            showToastByConfig(handleApiError(result));
            throw new Error(isApiError(result) ? result.error : 'Verification failed.');
         }

         log('handleVerify — success; dispatching fetchUser');
         await dispatch(fetchUser())
            .unwrap()
            .catch((error: Error) => {
               console.error('Error refreshing user data:', error.message || error);
            });
         log('handleVerify — fetchUser complete');
      } catch (error) {
         console.error('[WorldID] handleVerify — caught error:', error);
         throw error; // IDKit will display the error message to the user
      }
   };

   const handleSuccess = () => {
      log('handleSuccess — called; clearing localStorage, navigating');
      localStorage.removeItem(WORLD_ID_IN_PROGRESS_KEY);
      localStorage.removeItem(WORLD_ID_RP_CONTEXT_KEY);
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
      log('handleError — errorCode:', errorCode, '| alreadyUsedRef:', alreadyUsedRef.current);
      localStorage.removeItem(WORLD_ID_IN_PROGRESS_KEY);
      localStorage.removeItem(WORLD_ID_RP_CONTEXT_KEY);
      if (
         errorCode === IDKitErrorCodes.NullifierReplayed ||
         errorCode === IDKitErrorCodes.MaxVerificationsReached ||
         (errorCode === IDKitErrorCodes.FailedByHostApp && alreadyUsedRef.current)
      ) {
         alreadyUsedRef.current = false;
         // In-session path: modal shown now, so clear the localStorage fallback.
         localStorage.removeItem(WORLD_ID_ALREADY_USED_STORAGE_KEY);
         log('handleError — showing AlreadyUsedModal');
         showAlreadyUsedWarning();
      } else if (
         errorCode === IDKitErrorCodes.UserRejected ||
         errorCode === IDKitErrorCodes.Cancelled ||
         errorCode === IDKitErrorCodes.VerificationRejected
      ) {
         log('handleError — user cancelled / rejected');
         showToastByConfig('worldid_not_completed');
      } else if (errorCode !== IDKitErrorCodes.FailedByHostApp) {
         log('handleError — unexpected error, showing server_error toast');
         showToastByConfig('server_error');
      } else {
         log('handleError — FailedByHostApp but alreadyUsedRef is false; no action');
      }
   };

   const handleStartIDKit = useCallback(async () => {
      log('handleStartIDKit — called; isPreparingIDKit:', isPreparingIDKit, '| isIDKitOpen:', isIDKitOpen);
      if (isPreparingIDKit || isIDKitOpen) {
         log('handleStartIDKit — skipped (already preparing or open)');
         return;
      }
      try {
         if (!app_id) {
            throw new Error('VITE_WORLD_ID_APP_ID is not configured.');
         }
         setIsPreparingIDKit(true);
         const nextRpContext = await fetchRpContext();
         log('handleStartIDKit — rp_context fetched; saving to localStorage and opening IDKit');
         localStorage.setItem(WORLD_ID_IN_PROGRESS_KEY, '1');
         localStorage.setItem(WORLD_ID_RP_CONTEXT_KEY, JSON.stringify({ context: nextRpContext, ts: Date.now() }));
         setRpContext(nextRpContext);
         setIsIDKitOpen(true);
         log('handleStartIDKit — IDKit opened');
      } catch (error) {
         if (error instanceof Error && error.message === 'WORLDID_ALREADY_USED') {
            log('handleStartIDKit — WORLDID_ALREADY_USED from fetchRpContext; modal already shown');
            return;
         }
         console.error('[WorldID] handleStartIDKit — error:', error instanceof Error ? error.message : error);
         showToastByConfig('server_error');
      } finally {
         setIsPreparingIDKit(false);
      }
   }, [app_id, fetchRpContext, isIDKitOpen, isPreparingIDKit, showToastByConfig]);

   const handleIDKitOpenChange = useCallback((open: boolean) => {
      log('handleIDKitOpenChange — open:', open);
      setIsIDKitOpen(open);
      if (!open) {
         localStorage.removeItem(WORLD_ID_IN_PROGRESS_KEY);
         localStorage.removeItem(WORLD_ID_RP_CONTEXT_KEY);
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
