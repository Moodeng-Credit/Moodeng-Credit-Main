// Event bus for opening the Mecha writing assistant from anywhere in the app —
// mirrors the openSupportContacts() idiom in
// src/components/support/supportContacts.ts. A component that wants an instant
// AI answer (today: the loan-reason wording helpers) fires openMecha() with
// context and a seeded question; the always-mounted MechaLauncher host listens
// and opens the panel pre-loaded.
//
// Note this is *not* the support path any more. Anything shaped like "I have a
// problem and I need a person" belongs in Crisp — see openSupportChat() in
// src/lib/support/crisp.ts, and <AskSupportButton /> for the inline trigger.

export const MECHA_OPEN_EVENT = 'moodeng:open-mecha';
export const MECHA_CLOSE_EVENT = 'moodeng:close-mecha';

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
