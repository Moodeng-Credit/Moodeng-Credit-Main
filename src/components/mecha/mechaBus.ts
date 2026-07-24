// Event bus for opening Mecha from anywhere in the app — mirrors the
// openSupportContacts() idiom in src/components/support/supportContacts.ts.
// Any component (an error card, the in-app-browser notice, a verify step) can
// fire openMecha() with context and a seeded question; the always-mounted
// MechaLauncher host listens and opens the shared panel pre-loaded.

export const MECHA_OPEN_EVENT = 'moodeng:open-mecha';
export const MECHA_CLOSE_EVENT = 'moodeng:close-mecha';
export const MECHA_SIGNAL_EVENT = 'moodeng:mecha-problem';

// The launcher bubble is problem-gated: it stays hidden until something goes wrong for the
// user (an error toast, an explicit openMecha from an error card) or they're on a known
// friction step. Once signaled, it stays available for the rest of the session.
const PROBLEM_SIGNAL_KEY = 'mecha_problem_signaled';

export function signalMechaProblem(): void {
   try {
      sessionStorage.setItem(PROBLEM_SIGNAL_KEY, '1');
   } catch {
      /* storage unavailable — the in-memory event still shows the bubble this page */
   }
   window.dispatchEvent(new CustomEvent(MECHA_SIGNAL_EVENT));
}

export function hasMechaProblemSignal(): boolean {
   try {
      return sessionStorage.getItem(PROBLEM_SIGNAL_KEY) === '1';
   } catch {
      return false;
   }
}

export type MechaContext = {
   /** Human-readable screen name, e.g. "Repay" — sent to the model for grounding. */
   page?: string;
   /** Onboarding step id, e.g. "base-account" — drives step-aware pre-emption. */
   step?: string;
};

export type MechaOpenDetail = {
   context?: MechaContext;
   /** Auto-sent as the user's first message on open (inline "why did this fail?"). */
   seedUserMessage?: string;
   /** Assistant line shown immediately, before any user message. */
   greeting?: string;
};

export function openMecha(detail: MechaOpenDetail = {}): void {
   window.dispatchEvent(new CustomEvent<MechaOpenDetail>(MECHA_OPEN_EVENT, { detail }));
}

export function closeMecha(): void {
   window.dispatchEvent(new CustomEvent(MECHA_CLOSE_EVENT));
}
