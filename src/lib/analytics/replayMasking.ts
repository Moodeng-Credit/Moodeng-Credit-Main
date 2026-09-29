// Session replay records what borrowers type (loan reasons, bios, contacts) so the team can see
// exactly where and why a form stops people. Credentials are the exception: passwords, one-time
// codes, card fields, and anything a component marks with data-ph-mask="true" / .ph-mask stay
// masked. Rendered secrets (the Instant Wallet private key) are blocked outright with the
// `ph-no-capture` class instead, since they are text, not inputs.
export const isSensitiveReplayInput = (element?: HTMLElement | null): boolean => {
   // No element to inspect: mask rather than guess.
   if (!element) return true;
   if ((element as HTMLInputElement).type === 'password') return true;
   const autocomplete = (element.getAttribute('autocomplete') ?? '').toLowerCase();
   if (autocomplete.includes('password') || autocomplete.includes('one-time-code') || autocomplete.startsWith('cc-')) return true;
   return Boolean(element.closest('[data-ph-mask="true"], .ph-mask'));
};

export const maskReplayInput = (text: string, element?: HTMLElement | null): string =>
   isSensitiveReplayInput(element) ? '*'.repeat(text.length) : text;
