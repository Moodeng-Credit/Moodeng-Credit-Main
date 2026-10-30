// The home page (public/landing/) is static, so it can't ask who's signed in. This cookie tells it what to
// show a signed-in visitor (public/landing/continue-banner.js); src/components/landing/LandingSessionCookie.tsx sets it:
//   continue — still signing up / onboarding / applying (or a guest, who can't sign back in): "Continue where you left off"
//   signout  — all set: "Sign in" becomes "Sign out", no banner
// md_role=lender swaps "Get a loan" for "Fund loans".
export const LANDING_SESSION_COOKIE = 'md_landing';
export const LANDING_ROLE_COOKIE = 'md_role';

export type LandingSessionState = 'continue' | 'signout';

export const setLandingSessionCookie = (state: LandingSessionState, role?: string): void => {
   const secure = window.location.protocol === 'https:' ? '; Secure' : '';
   document.cookie = `${LANDING_SESSION_COOKIE}=${state}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
   document.cookie = role
      ? `${LANDING_ROLE_COOKIE}=${role}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`
      : `${LANDING_ROLE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
};

export const clearLandingSessionCookie = (): void => {
   if (typeof document === 'undefined') return;
   document.cookie = `${LANDING_SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
   document.cookie = `${LANDING_ROLE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
};
