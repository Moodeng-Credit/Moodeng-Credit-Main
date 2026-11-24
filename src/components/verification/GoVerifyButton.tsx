import type { ReactNode } from 'react';

import posthog from 'posthog-js';

import { useVerificationJourney } from '@/hooks/useVerificationJourney';

/**
 * Wraps a "Not verified" label so a tap takes the borrower to their next verification step
 * (pre-screening, Facebook, wallet, ID check or its status: useVerificationJourney decides).
 * PostHog, Nov 2026: about 10 people a week tapped these labels on the dashboard, Account and
 * settings and nothing happened.
 */
export default function GoVerifyButton({
   where,
   className,
   ariaLabel = 'Get verified',
   children
}: {
   where: string;
   className?: string;
   ariaLabel?: string;
   children: ReactNode;
}) {
   const journey = useVerificationJourney();
   return (
      <button
         aria-label={ariaLabel}
         className={className}
         onClick={() => {
            if (journey.isLoading) return;
            try {
               posthog.capture('verify_label_tapped', { where, stage: journey.stage });
            } catch {
               // Analytics unavailable: the tap still works.
            }
            journey.go();
         }}
         type="button"
      >
         {children}
      </button>
   );
}
