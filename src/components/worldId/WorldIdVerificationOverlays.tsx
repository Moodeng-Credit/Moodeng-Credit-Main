import { AlertTriangle, CheckCircle2, ExternalLink, Globe2, LoaderCircle, LockKeyhole, Shield, X } from 'lucide-react';

import {
   LONG_PROCESSING_SECONDS,
   type VerificationFeedbackState,
   type VerificationLaunchState,
   type VerificationProcessingStep
} from '@/components/worldId/useWorldIdVerification';

interface VerificationLaunchOverlayProps {
   state: VerificationLaunchState;
   /** Completes "World App will open to …", e.g. "verify you" or "verify your passport or ID". */
   launchPurpose: string;
   idPrefix: string;
   onOpen: () => void;
   onCancel: () => void;
}

export function VerificationLaunchOverlay({ state, launchPurpose, idPrefix, onOpen, onCancel }: VerificationLaunchOverlayProps) {
   if (state === 'idle') return null;

   const showsOpenButton = state === 'ready' || state === 'fallback';
   const isSpinner = state === 'opening' || state === 'preparing';

   const title =
      state === 'preparing'
         ? 'Getting World ID ready...'
         : state === 'ready'
           ? 'Continue in World App'
           : state === 'fallback'
             ? "World ID didn't open?"
             : 'Opening World ID...';
   const description =
      state === 'preparing'
         ? 'One moment — setting up your secure verification.'
         : state === 'ready'
           ? `Everything is ready. Tap "Open World App" to ${launchPurpose}. If you don't have World App yet, you'll be guided to install it — then return here to finish.`
           : state === 'fallback'
             ? "Tap \"Open World ID\" to launch World App. If you don't have World App yet, you'll be guided to install it — then return here to finish."
             : `World App will open to ${launchPurpose}. Keep this screen open — you'll come back here to finish.`;

   return (
      <div
         className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-md-primary-2000/65 px-md-4 font-sans backdrop-blur-[6px]"
         role={showsOpenButton ? 'alertdialog' : 'status'}
         aria-modal="true"
         aria-live="polite"
         aria-labelledby={`${idPrefix}-launch-title`}
         aria-describedby={`${idPrefix}-launch-description`}
      >
         <div className="w-full max-w-[398px] rounded-md-lg border border-md-neutral-400 bg-md-neutral-100 px-md-4 py-md-5 text-center shadow-md-card">
            {isSpinner ? (
               <div className="relative mx-auto h-16 w-16" aria-label={title} role="status">
                  <div className="absolute inset-0 rounded-full border-[5px] border-md-primary-200 border-t-md-primary-1200 animate-spin" />
                  <div className="absolute inset-3 flex items-center justify-center rounded-full bg-md-primary-100 text-md-primary-1200">
                     <Globe2 className="h-7 w-7" aria-hidden="true" />
                  </div>
               </div>
            ) : (
               <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-md-primary-300 bg-md-primary-100 text-md-primary-1200">
                  <ExternalLink className="h-8 w-8" aria-hidden="true" />
               </div>
            )}

            <div className="mt-md-3 flex flex-col gap-md-1">
               <h2 id={`${idPrefix}-launch-title`} className="text-[24px] font-[590] leading-[1.2] tracking-normal text-md-heading">
                  {title}
               </h2>
               <p id={`${idPrefix}-launch-description`} className="text-md-b2 font-normal leading-[1.5] tracking-normal text-md-neutral-1200">
                  {description}
               </p>
            </div>

            {showsOpenButton ? (
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
                     onClick={onOpen}
                     className="inline-flex min-h-12 items-center justify-center gap-md-1 rounded-md-lg bg-md-primary-1200 px-md-3 py-md-3 text-md-b2 font-semibold tracking-normal text-md-neutral-100"
                  >
                     {state === 'ready' ? 'Open World App' : 'Open World ID'}
                     <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </button>
               </div>
            ) : (
               <>
                  <p className="mt-md-3 text-md-b3 font-normal tracking-normal text-md-neutral-1200">This may take a few seconds.</p>
                  <button
                     type="button"
                     onClick={onCancel}
                     className="mt-md-3 inline-flex min-h-10 w-full items-center justify-center rounded-md-lg border border-md-neutral-600 bg-md-neutral-100 px-md-3 py-md-2 text-md-b2 font-semibold tracking-normal text-md-heading"
                  >
                     Cancel
                  </button>
               </>
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

export function VerificationFeedbackOverlay({
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
                  <div className="flex w-full flex-col gap-md-2">
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
                     {!isShowingHelp ? (
                        <button
                           type="button"
                           onClick={onNeedHelp}
                           className="inline-flex min-h-12 w-full items-center justify-center rounded-md-lg px-md-3 py-md-2 text-md-b2 font-semibold tracking-normal text-md-primary-1600 underline underline-offset-2"
                        >
                           Still stuck? Contact support
                        </button>
                     ) : null}
                  </div>
               ) : null}
            </div>
         </div>
      </div>
   );
}
