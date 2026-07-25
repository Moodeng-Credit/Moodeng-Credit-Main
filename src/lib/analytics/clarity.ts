// Microsoft Clarity — free, unlimited session replay + heatmaps with automatic
// frustration detection (rage clicks, dead clicks, quick-backs, excessive
// scroll). Runs alongside PostHog: PostHog owns funnels/events, Clarity owns the
// "where are users struggling" view. Loaded lazily and only in production, gated
// on a real project id so a missing/placeholder env var is a silent no-op.

declare global {
   interface Window {
      clarity?: ((...args: unknown[]) => void) & { q?: unknown[] };
   }
}

const projectId = import.meta.env.VITE_PUBLIC_CLARITY_ID as string | undefined;

// A Clarity project id is a short alphanumeric slug. Guard against the raw
// dotenvx `encrypted:…` ciphertext leaking through as a truthy-but-invalid id
// (same failure mode we guard PostHog against).
const hasValidProjectId =
   Boolean(projectId) && !projectId!.startsWith('encrypted:') && /^[a-z0-9]+$/i.test(projectId!);

export const isClarityEnabled = import.meta.env.PROD && hasValidProjectId;

/** The validated Clarity project id, or null if unset/placeholder. */
export const clarityProjectId: string | null = hasValidProjectId ? projectId! : null;

/**
 * Deep links into the Clarity dashboard for this project (recordings, heatmaps,
 * the frustration overview), or null when no project id is configured. Used by
 * the admin UX-health tab to route straight to the friction data.
 */
export function clarityDashboardUrls(): { dashboard: string; recordings: string; heatmaps: string } | null {
   if (!clarityProjectId) return null;
   const base = `https://clarity.microsoft.com/projects/view/${clarityProjectId}`;
   return {
      dashboard: `${base}/dashboard`,
      recordings: `${base}/impressions`,
      heatmaps: `${base}/heatmaps`
   };
}

let started = false;

/** Injects the Clarity tag exactly once. Safe to call unconditionally. */
export function initClarity(): void {
   if (!isClarityEnabled || started || typeof window === 'undefined') {
      return;
   }
   started = true;

   // Standard Clarity bootstrap: stub the command queue, then async-load the tag.
   window.clarity =
      window.clarity ||
      function (...args: unknown[]) {
         (window.clarity!.q = window.clarity!.q || []).push(args);
      };

   const script = document.createElement('script');
   script.async = true;
   script.src = `https://www.clarity.ms/tag/${projectId}`;
   const first = document.getElementsByTagName('script')[0];
   first?.parentNode?.insertBefore(script, first);
}

/**
 * Tie the current Clarity session to a user so recordings are searchable by the
 * same id we use in PostHog. Pass no id to clear on logout.
 */
export function identifyClarity(userId?: string): void {
   if (!isClarityEnabled || typeof window === 'undefined' || !window.clarity) {
      return;
   }
   if (userId) {
      window.clarity('identify', userId);
   }
}
