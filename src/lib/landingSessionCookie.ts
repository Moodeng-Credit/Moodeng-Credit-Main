// The home page (public/landing/) is static, so it can't ask who's signed in. This cookie tells it what to
// show a signed-in visitor (public/landing/continue-banner.js); src/components/landing/LandingSessionCookie.tsx sets it:
//   continue — still signing up / onboarding / applying (or a guest, who can't sign back in): "Continue where you left off"
//   signout  — all set: "Sign in" becomes "Sign out", no banner
export const LANDING_SESSION_COOKIE = 'md_landing';

export type LandingSessionState = 'continue' | 'signout';

export const setLandingSessionCookie = (state: LandingSessionState): void => {
   const secure = window.location.protocol === 'https:' ? '; Secure' : '';
   document.cookie = `${LANDING_SESSION_COOKIE}=${state}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
};

export const clearLandingSessionCookie = (): void => {
   if (typeof document !== 'undefined') document.cookie = `${LANDING_SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
};
