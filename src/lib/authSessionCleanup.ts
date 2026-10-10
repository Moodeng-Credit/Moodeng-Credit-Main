import { THEME_MODE_STORAGE_KEY } from '@/lib/themeMode';

// Device preferences, not account data: survive sign-out so the next visitor on this device
// keeps the language they picked and a "Turn off" on push stays off.
const PRESERVED_LOCAL_KEYS = [THEME_MODE_STORAGE_KEY, 'md_locale', 'md_locale_chosen', 'moodeng-push-opted-out', 'moodeng-push-prompted'];

/**
 * Wipes browser-persisted auth + app state back to a clean slate, preserving only
 * device-level preferences (theme mode, chosen language, push opt-out / prompt-seen flags).
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

   const preserved = PRESERVED_LOCAL_KEYS.map((key) => [key, safeGet(window.localStorage, key)] as const);

   try {
      window.localStorage.clear();
      window.sessionStorage.clear();
   } catch {
      // Storage can be unavailable (private mode, blocked cookies) — nothing to clear.
   }

   for (const [key, value] of preserved) {
      if (value === null) continue;
      try {
         window.localStorage.setItem(key, value);
      } catch {
         // Ignore — losing a UI preference is harmless next to a clean auth slate.
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
