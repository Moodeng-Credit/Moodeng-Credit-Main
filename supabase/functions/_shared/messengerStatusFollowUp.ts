// What the Messenger bot adds after "✅ Your Facebook is confirmed!": where the borrower's
// verification stands. Used by sendpulse-messenger-verify; pure so it's unit-testable.
export const verificationFollowUpText = (user: {
   is_world_id?: string | null;
   is_didit?: string | null;
   didit_id_status?: string | null;
}): string | null => {
   if (user.is_world_id === 'ACTIVE' || user.is_didit === 'ACTIVE') {
      // Not "you're all set": they may be halfway through an application. And no link: tapping it would
      // open Moodeng inside Messenger's own browser, away from the tab they were using.
      return '✅ Your ID is already verified on Moodeng, too. Head back to the app to carry on.';
   }
   if ((user.didit_id_status ?? '').toLowerCase().includes('review')) {
      return "🕐 Your ID is in a quick review with our team. We'll message you right here the moment it's approved.";
   }
   return null;
};

// Signed up inside Facebook's or Messenger's own browser. On iPhone, Messenger's browser is thrown away
// when they close it to paste their code, and they had no way back (Emma, 2026-10-17). So these borrowers
// get a link to moodeng.app/continue, which sends them on to their next step. Everyone else gets no
// link, as above: it would open Moodeng inside Messenger's browser, away from the tab they were using.
const IN_APP_SIGNUP_BROWSERS = new Set(['Facebook app', 'Messenger app']);
export const CONTINUE_URL = 'https://moodeng.app/continue?via=bot';

export const continueLinkText = (signupBrowser: string | null | undefined): string | null =>
   signupBrowser && IN_APP_SIGNUP_BROWSERS.has(signupBrowser)
      ? `👉 Tap here to continue where you left off: ${CONTINUE_URL}\n(Started in the Facebook app? Just go back there, it's already updated.)`
      : null;
