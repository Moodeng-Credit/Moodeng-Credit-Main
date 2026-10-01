// What the Messenger bot adds after "✅ Your Facebook is confirmed!": where the borrower's
// verification stands. Used by sendpulse-messenger-verify; pure so it's unit-testable.
export const verificationFollowUpText = (user: {
   is_world_id?: string | null;
   is_didit?: string | null;
   didit_id_status?: string | null;
}): string | null => {
   if (user.is_world_id === 'ACTIVE' || user.is_didit === 'ACTIVE') {
      return "🎉 And good news: you're already verified on Moodeng, so you're all set. Head back to the app to continue: https://moodeng.app/dashboard";
   }
   if ((user.didit_id_status ?? '').toLowerCase().includes('review')) {
      return "🕐 Your ID is in a quick review with our team. We'll message you right here the moment it's approved.";
   }
   return null;
};
