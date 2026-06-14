import { THEME_MODE_STORAGE_KEY } from '@/lib/themeMode';

/**
 * Wipes browser-persisted auth + app state back to a clean slate, preserving only
 * pure-UI preferences (currently the theme mode).
 *
 * Supabase's own auth token is removed by `supabase.auth.signOut()`, but the app
 * also caches the signed-in user in redux-persist (`persist:root`) plus assorted
 * per-user keys (cached scores, tour progress, recovery flags). Leaving those behind
 * lets a previous account's data leak into the next sign-in or hijack a fresh signup,
 * which is exactly the onboarding loop this clears. Used on sign out and before a new
 * signup attempt.
 */
export const clearClientAuthState = (): void => {
   if (typeof window === 'undefined') return;

   const preservedTheme = safeGet(window.localStorage, THEME_MODE_STORAGE_KEY);

   try {
      window.localStorage.clear();
      window.sessionStorage.clear();
   } catch {
      // Storage can be unavailable (private mode, blocked cookies) — nothing to clear.
   }

   if (preservedTheme !== null) {
      try {
         window.localStorage.setItem(THEME_MODE_STORAGE_KEY, preservedTheme);
      } catch {
         // Ignore — losing the theme preference is harmless next to a clean auth slate.
      }
   }
};

const safeGet = (storage: Storage, key: string): string | null => {
   try {
      return storage.getItem(key);
   } catch {
      return null;
   }
};
