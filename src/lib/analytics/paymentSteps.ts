import posthog from 'posthog-js';

// One PostHog event ("payment_step") per step of sending money — lend tapped, payment started,
// approved in the wallet, recorded, or exactly how it stopped. A stalled payment never reaches our
// server until it is approved, so without this there is no way to tell afterwards where it stopped
// (Coinbase window never answered, the person cancelled, the page reloaded onto a new build…).
// Sent instantly: the step right before a reload or a closed tab is the one that matters most.
export type PaymentStep =
   | 'tapped'
   | 'started'
   | 'approved'
   | 'failed'
   | 'stopped'
   | 'cancelled'
   | 'recorded'
   | 'still_confirming'
   | 'record_failed'
   | 'stale_build_reload';

export const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err)).slice(0, 300);

export const trackPaymentStep = (step: PaymentStep, props: Record<string, unknown> = {}) => {
   posthog.capture('payment_step', { step, page: window.location.pathname, ...props }, { send_instantly: true });
};
