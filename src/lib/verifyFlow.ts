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
export const VERIFY_FLOW_TTL_MS = 60 * 60 * 1000; // 1 hour

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
