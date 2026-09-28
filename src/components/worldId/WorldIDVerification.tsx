import type { ReactNode } from 'react';

import type { CredentialType } from '@worldcoin/idkit';

import { AlreadyUsedModal } from '@/components/worldId/modal/AlreadyUsedModal';

import { useWorldIdVerification } from '@/components/worldId/useWorldIdVerification';
import { VerificationFeedbackOverlay, VerificationLaunchOverlay } from '@/components/worldId/WorldIdVerificationOverlays';

interface WorldIDVerificationProps {
   children: (props: { open: () => void }) => ReactNode;
   onSuccess?: () => void;
   className?: string;
   showSuccessToast?: boolean;
   showSuccessFeedback?: boolean;
}

const WORLD_ID_ACTION_DESCRIPTION = 'Verify a borrower as a unique human before borrowing.';

// Orb (Proof of Human) or a passport added in World App: World App proves whichever the person
// has. The server checks the credential in the proof and records either as is_world_id = ACTIVE.
const WORLD_ID_CREDENTIALS: readonly CredentialType[] = ['proof_of_human', 'passport'];

const isOrbVerificationActive = (user: { isWorldId?: string }) => user.isWorldId === 'ACTIVE';

export default function WorldIDVerification({
   children,
   onSuccess,
   className = '',
   showSuccessToast = true,
   showSuccessFeedback = true
}: WorldIDVerificationProps) {
   const verification = useWorldIdVerification({
      credentials: WORLD_ID_CREDENTIALS,
      actionDescription: WORLD_ID_ACTION_DESCRIPTION,
      isVerificationActive: isOrbVerificationActive,
      logTag: 'WorldID',
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
            launchPurpose="verify you"
            idPrefix="world-id"
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
