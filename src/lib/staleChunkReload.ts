const RELOAD_FLAG_KEY = 'moodeng_stale_chunk_reload';

export const isStaleChunkError = (message: unknown): boolean => {
   if (typeof message !== 'string') return false;
   return /dynamically imported module|is not a valid javascript mime type|importing a module script failed/i.test(message);
};

/**
 * Reloads the page at most once per tab session. A broken deploy that fails on
 * every load will only trigger this once — the second failure is left alone
 * (shown as a normal error/toast) instead of looping.
 */
export const reloadOnceForStaleChunk = () => {
   if (window.sessionStorage.getItem(RELOAD_FLAG_KEY)) return;
   window.sessionStorage.setItem(RELOAD_FLAG_KEY, '1');
   window.location.reload();
};

/**
 * After a new deploy, a browser tab open on the old build can request a JS chunk whose
 * hash no longer exists. The server falls back to index.html, the browser gets
 * `text/html` where it expected JS, and the import throws. Reload once to pick up the
 * current build instead of leaving the user on a broken page.
 */
export function setupStaleChunkReload() {
   if (typeof window === 'undefined') return;

   window.addEventListener('vite:preloadError', reloadOnceForStaleChunk as EventListener);

   window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason as { message?: unknown } | string | undefined;
      const message = typeof reason === 'string' ? reason : reason?.message;
      if (isStaleChunkError(message)) reloadOnceForStaleChunk();
   });

   window.addEventListener('error', (event) => {
      if (isStaleChunkError(event.message)) reloadOnceForStaleChunk();
   });
}
