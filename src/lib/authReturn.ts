/**
 * "Take me back to where I started" after a social login. The static money-lesson page (/stocks) sends people
 * through /auth/start/:provider?next=/stocks; the provider callback then returns them there instead of the dashboard.
 *
 * Only an allowlist of paths is ever honoured, so this can never be used as an open redirect.
 */
const STORAGE_KEY = 'moodeng:auth-return-to';
const ALLOWED_PATHS = ['/stocks'];
const MAX_AGE_MS = 15 * 60 * 1000;

export function isAllowedReturnPath(path: string | null | undefined): path is string {
   return typeof path === 'string' && ALLOWED_PATHS.includes(path);
}

export function setAuthReturnTo(path: string | null | undefined): void {
   if (!isAllowedReturnPath(path)) return;
   try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ path, at: Date.now() }));
   } catch {
      // storage disabled — the user just lands on the dashboard after login
   }
}

/** Read and clear the saved return path. Null when none, expired, or not on the allowlist. */
export function consumeAuthReturnTo(): string | null {
   try {
      const raw = localStorage.getItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { path?: unknown; at?: unknown };
      if (typeof parsed.at !== 'number' || Date.now() - parsed.at > MAX_AGE_MS) return null;
      return isAllowedReturnPath(parsed.path as string) ? (parsed.path as string) : null;
   } catch {
      return null;
   }
}
