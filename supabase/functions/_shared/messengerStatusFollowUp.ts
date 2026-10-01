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
