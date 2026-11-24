/**
 * "Connect Facebook" for existing accounts (2026-11-24, George: Facebook first, but phone/email/Google
 * borrowers must never be stranded). A signed-in borrower attaches Facebook to the account they already
 * have (supabase.auth.linkIdentity), so next time "Continue with Facebook" opens THIS account instead of
 * making a new, empty one. Supabase lets one Facebook belong to one account only.
 *
 * Needs Supabase → Authentication → Sign In / Providers → "Allow manual linking" ON.
 *
 * The OAuth trip leaves the page, comes back through /auth/confirm (which lands signed-in people on
 * /dashboard), and query strings are dropped from the redirect URL in production — so the "a connect was
 * in flight" marker and any error Supabase sent back ride in sessionStorage.
 */
export const FACEBOOK_CONNECT_PENDING_KEY = 'moodeng:fb-connect-pending';
export const FACEBOOK_CONNECT_ERROR_KEY = 'moodeng:fb-connect-error';

export type FacebookConnectLanguage = 'en' | 'fil';

export function markFacebookConnectPending(): void {
   try {
      sessionStorage.setItem(FACEBOOK_CONNECT_PENDING_KEY, String(Date.now()));
      sessionStorage.removeItem(FACEBOOK_CONNECT_ERROR_KEY);
   } catch {
      // Storage blocked: the card simply won't show a result message after the trip.
   }
}

export function isFacebookConnectPending(): boolean {
   try {
      return Boolean(sessionStorage.getItem(FACEBOOK_CONNECT_PENDING_KEY));
   } catch {
      return false;
   }
}

/** Called by /auth/confirm when Supabase redirects back with an error while a connect was in flight. */
export function rememberFacebookConnectError(message: string): void {
   try {
      if (sessionStorage.getItem(FACEBOOK_CONNECT_PENDING_KEY)) sessionStorage.setItem(FACEBOOK_CONNECT_ERROR_KEY, message);
   } catch {
      // ignore
   }
}

/** Reads and clears the in-flight marker + error (one result per trip). */
export function takeFacebookConnectResult(): { pending: boolean; error: string | null } {
   try {
      const pending = Boolean(sessionStorage.getItem(FACEBOOK_CONNECT_PENDING_KEY));
      const error = sessionStorage.getItem(FACEBOOK_CONNECT_ERROR_KEY);
      sessionStorage.removeItem(FACEBOOK_CONNECT_PENDING_KEY);
      sessionStorage.removeItem(FACEBOOK_CONNECT_ERROR_KEY);
      return { pending, error };
   } catch {
      return { pending: false, error: null };
   }
}

/** Supabase's refusal when this Facebook already belongs to another Moodeng account. */
export function isFacebookTakenError(message: string | null | undefined): boolean {
   return /already (been )?linked|identity_already_exists|already exists/i.test(message ?? '');
}

export const FACEBOOK_CONNECT_COPY: Record<
   FacebookConnectLanguage,
   { title: string; body: string; button: string; working: string; doneTitle: string; doneBody: string; taken: string; failed: string }
> = {
   en: {
      title: 'Next time, just tap Facebook',
      body: 'Connect your Facebook to log in with one tap.',
      button: 'Connect',
      working: 'Opening…',
      doneTitle: 'Facebook connected',
      doneBody: 'Next time, tap Continue with Facebook.',
      taken: 'This Facebook is already on another Moodeng account. Message us on Messenger and we’ll fix it.',
      failed: 'Facebook didn’t connect. Please try again.'
   },
   fil: {
      title: 'Sa susunod, i-tap lang ang Facebook',
      body: 'I-connect ang Facebook mo para isang tap lang ang log in.',
      button: 'I-connect',
      working: 'Binubuksan…',
      doneTitle: 'Naka-connect na ang Facebook',
      doneBody: 'Sa susunod, i-tap ang Continue with Facebook.',
      taken: 'Nakakabit na ang Facebook na ito sa ibang Moodeng account. I-message kami sa Messenger at aayusin namin.',
      failed: 'Hindi na-connect ang Facebook. Subukan ulit.'
   }
};

export function facebookConnectErrorText(language: FacebookConnectLanguage, message: string | null | undefined): string {
   const copy = FACEBOOK_CONNECT_COPY[language];
   return isFacebookTakenError(message) ? copy.taken : copy.failed;
}
