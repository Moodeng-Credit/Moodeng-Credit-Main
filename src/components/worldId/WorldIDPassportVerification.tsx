import type { ReactNode } from 'react';

import { AlreadyUsedModal } from '@/components/worldId/modal/AlreadyUsedModal';

import { useWorldIdVerification } from '@/components/worldId/useWorldIdVerification';
import { VerificationFeedbackOverlay, VerificationLaunchOverlay } from '@/components/worldId/WorldIdVerificationOverlays';

interface WorldIDPassportVerificationProps {
   children: (props: { open: () => void }) => ReactNode;
   onSuccess?: () => void;
   className?: string;
   showSuccessToast?: boolean;
   showSuccessFeedback?: boolean;
}

// Same World ID action as the Orb flow — Passport is just an alternate credential
// used to complete the same verification. Only the credential constraint differs.
const WORLD_ID_ACTION_DESCRIPTION = 'Verify a borrower as a unique human with your passport before borrowing.';

// World ID credential method reported to the backend so it can record how the user verified.
const PASSPORT_VERIFY_BODY = { method: 'passport' };

// Passport verification updates its own status column, independent of the Orb status.
const isPassportVerificationActive = (user: { isWorldIdPassport?: string }) => user.isWorldIdPassport === 'ACTIVE';

export default function WorldIDPassportVerification({
   children,
   onSuccess,
   className = '',
   showSuccessToast = true,
   showSuccessFeedback = true
}: WorldIDPassportVerificationProps) {
   const verification = useWorldIdVerification({
      credential: 'passport',
      actionDescription: WORLD_ID_ACTION_DESCRIPTION,
      verifyExtraBody: PASSPORT_VERIFY_BODY,
      isVerificationActive: isPassportVerificationActive,
      logTag: 'WorldIDPassport',
      onSuccess,
      showSuccessToast,
      showSuccessFeedback
   });

   const trigger = className ? (
      <span className={className}>{children({ open: verification.openWorldId })}</span>
   ) : (
      children({ open: verification.openWorldId })
   );

   return (
      <>
         {trigger}

         <AlreadyUsedModal isOpen={verification.showAlreadyUsedModal} onClose={() => verification.setShowAlreadyUsedModal(false)} />

         <VerificationLaunchOverlay
            state={verification.launchState}
            launchPurpose="verify your passport or ID"
            idPrefix="world-id-passport"
            onOpen={verification.openWorldId}
            onCancel={verification.cancelLaunch}
         />

         <VerificationFeedbackOverlay
            state={verification.feedbackState}
            processingStep={verification.processingStep}
            processingElapsedSeconds={verification.processingElapsedSeconds}
            showHelpPanel={verification.showVerificationHelp}
            onTryAgain={verification.openWorldId}
            onDismiss={verification.dismissFeedback}
            onNeedHelp={() => verification.setShowVerificationHelp(true)}
            onCloseHelp={() => verification.setShowVerificationHelp(false)}
            onContactSupport={verification.contactSupport}
            onOpenFacebookSupport={verification.openFacebookSupport}
         />
      </>
   );
}
