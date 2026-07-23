// Turns raw SDK / network / Shield errors into plain, non-technical copy for borrowers (many on
// mobile in the Philippines). The raw error is always logged for us; the user only sees a human
// message with a next step. Pure + dependency-free so it's unit-testable in isolation.

export const friendlyConnectError = (err: unknown): string => {
   const raw = (err instanceof Error ? err.message : typeof err === 'string' ? err : '').toLowerCase();
   // Order matters, most-specific first: "…session endpoint is not configured" contains "session",
   // so the config check must win over the auth check (which would otherwise grab it).
   if (/not configured|endpoint/.test(raw)) {
      return 'Instant wallet isn’t available right now. Please try again in a little while.';
   }
   if (/fetch|network|reach|timeout|timed out|offline|connection|502|503|504/.test(raw)) {
      return "We couldn't reach the wallet service. Check your internet and try again.";
   }
   if (/signed in|sign in|unauthor|authentication|not authenticated|\b401\b/.test(raw)) {
      return 'Please sign in again, then try creating your wallet.';
   }
   return "We couldn't finish creating your wallet. Please try again.";
};
