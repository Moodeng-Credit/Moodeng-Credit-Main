/**
 * Tracks which auth method the user last signed in with, so the login/sign-up
 * screens can surface a "Last used" hint on that provider (à la Polymarket).
 * Stored in localStorage; best-effort and non-critical.
 */
export type AuthMethod = 'google' | 'facebook' | 'telegram' | 'line' | 'email';

const STORAGE_KEY = 'moodeng:last-auth-method';

export function setLastUsedAuth(method: AuthMethod): void {
   try {
      localStorage.setItem(STORAGE_KEY, method);
   } catch {
      // ignore (private mode / storage disabled)
   }
}

export function getLastUsedAuth(): AuthMethod | null {
   try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === 'google' || v === 'facebook' || v === 'telegram' || v === 'line' || v === 'email' ? v : null;
   } catch {
      return null;
   }
}
