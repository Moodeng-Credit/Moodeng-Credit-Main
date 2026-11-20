import posthog from 'posthog-js';

// One PostHog event ("prescreen_step") per screen of /screen, so we can see exactly where people stop
// (the photo step in Messenger's browser, the medical question…), not just how many finish.
export const trackPrescreenStep = (step: string, props: Record<string, unknown> = {}) => {
   try {
      posthog.capture('prescreen_step', { step, page: window.location.pathname, ...props }, { send_instantly: true });
   } catch {
      // analytics must never break the form
   }
};
