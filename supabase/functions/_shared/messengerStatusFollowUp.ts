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

// The bot heard from someone but couldn't confirm them yet. The flow used to answer only "that link
// didn't work, go back and get a fresh one", even when they had just tapped Continue before pasting a
// perfectly good code (George, Android, 2026-10-18), and gave no way back to Moodeng. Every one of
// these replies now says what to do and links back to moodeng.app.
export type NotYetReason = 'no_code' | 'no_match' | 'expired';

export const notYetReplyText = (reason: NotYetReason): string => {
   const back = `👉 Back to Moodeng: ${CONTINUE_URL}`;
   if (reason === 'no_code') {
      return `Almost done! 📋 Paste your Moodeng code here and send it. It's already copied: tap the message box, hold, and choose Paste.\n\n${back}`;
   }
   if (reason === 'expired') {
      return `That code has expired (codes last 30 minutes). Go back to Moodeng and tap Connect Messenger for a new one.\n\n${back}`;
   }
   return `That code didn't match. Check it and send it again, or go back to Moodeng to see your code.\n\n${back}`;
};

// Connected without a code: they came in through our button within the minute (timing match).
export const CONNECTED_BY_TIMING_TEXT = `✅ You're connected! Go back to Moodeng to continue, it's already updated.\n\n👉 Back to Moodeng: ${CONTINUE_URL}`;
