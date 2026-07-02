// Shared persistence for the /verify flow. Stored in localStorage (not
// sessionStorage) so it survives the full-page redirects Didit/World ID do, and
// an involuntary session-expiry logout (which resets redux but does NOT clear
// localStorage). It is written when verification starts and cleared on success,
// so a lingering flow means "started verifying but never finished" — which the
// request board reads to show the "we couldn't verify you" modal.

// 'worldid' = Orb (Proof of Human) credential; 'worldid-passport' = World ID
// Passport/ID (NFC document) credential. Both share the liveness pre-gate.
export type VerifyMethod = 'worldid' | 'worldid-passport' | 'didit';

export type FlowState = {
   method: VerifyMethod;
   returnTo?: string;
   livenessSessionId?: string;
   ts?: number;
};

export const VERIFY_FLOW_KEY = 'verify_flow';
// Long enough to span a Didit manual review (up to ~1 business day), so retry
// buttons on parked status screens keep the original method and returnTo instead
// of falling back to a synthesized flow that dumps the user on the dashboard.
// The /verify page refreshes ts on every visit, so an active flow only expires
// after the user has stayed away this long.
export const VERIFY_FLOW_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

export const readVerifyFlow = (): FlowState | null => {
   try {
      const raw = window.localStorage.getItem(VERIFY_FLOW_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as FlowState;
      if (parsed.ts && Date.now() - parsed.ts > VERIFY_FLOW_TTL_MS) {
         window.localStorage.removeItem(VERIFY_FLOW_KEY);
         return null;
      }
      return parsed;
   } catch {
      return null;
   }
};

export const writeVerifyFlow = (flow: FlowState): void => {
   try {
      window.localStorage.setItem(VERIFY_FLOW_KEY, JSON.stringify({ ...flow, ts: Date.now() }));
   } catch {
      // Storage can be unavailable (private mode) — the flow just won't persist.
   }
};

export const clearVerifyFlow = (): void => {
   try {
      window.localStorage.removeItem(VERIFY_FLOW_KEY);
   } catch {
      // Nothing to clear if storage is unavailable.
   }
};
