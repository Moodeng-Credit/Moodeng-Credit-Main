// Remembers where someone is in a step-by-step flow (Repay, Cash out) for a day, so leaving for
// PDAX / GCash and coming back to a reloaded page (common in Facebook's in-app browser) doesn't
// start them over. Browser storage only: it can be empty or blocked, so every call is guarded.

const DAY_MS = 24 * 60 * 60 * 1000;

export function readStep<T>(key: string, maxAgeMs = DAY_MS): T | null {
   try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const saved = JSON.parse(raw) as { at?: number; value?: T };
      if (!saved || typeof saved.at !== 'number' || Date.now() - saved.at > maxAgeMs) {
         window.localStorage.removeItem(key);
         return null;
      }
      return saved.value ?? null;
   } catch {
      return null;
   }
}

export function writeStep<T>(key: string, value: T): void {
   try {
      window.localStorage.setItem(key, JSON.stringify({ at: Date.now(), value }));
   } catch {
      // Storage blocked (private mode, in-app browsers): the flow still works, it just won't resume.
   }
}

export function clearStep(key: string): void {
   try {
      window.localStorage.removeItem(key);
   } catch {
      // ignore
   }
}
