// Where to go after signing in: the page someone was on when a protected page sent them to
// /sign-in (ProtectedRoute state.from, or ?next=). Kept in localStorage for 30 minutes so it
// survives the code screen, the email link (/auth/confirm) and a Facebook page that gets killed.

const NEXT_KEY = 'moodeng:auth-next';
const NEXT_TTL_MS = 30 * 60 * 1000;

// Never bounce back into the sign-in flow itself.
const AUTH_PAGES = /^\/(sign-in|sign-up|login|signup|auth|forgot-password|reset-password|mfa-challenge)(\/|\?|$)/;

/** An internal path only (no other sites, no protocol-relative //evil.com), never an auth page. */
export function safeNextPath(path: unknown): string | null {
   if (typeof path !== 'string') return null;
   const trimmed = path.trim();
   if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) return null;
   if (AUTH_PAGES.test(trimmed)) return null;
   return trimmed;
}

export function rememberNextPath(path: unknown, now = Date.now()): void {
   const safe = safeNextPath(path);
   if (!safe || safe === '/' || safe === '/dashboard') return;
   try {
      localStorage.setItem(NEXT_KEY, JSON.stringify({ path: safe, at: now }));
   } catch {
      // ignore (private mode / storage disabled)
   }
}

/** The remembered path (once): reading it clears it. */
export function takeNextPath(now = Date.now()): string | null {
   try {
      const raw = localStorage.getItem(NEXT_KEY);
      localStorage.removeItem(NEXT_KEY);
      const saved = raw ? (JSON.parse(raw) as { path?: unknown; at?: unknown }) : null;
      if (!saved || typeof saved.at !== 'number' || now - saved.at > NEXT_TTL_MS) return null;
      return safeNextPath(saved.path);
   } catch {
      return null;
   }
}

export const AUTH_NEXT_STORAGE_KEY = NEXT_KEY;
