// Connect an Android borrower by timing when their code can't reach the bot.
//
// On Android, Messenger refuses every link that carries our code (George's tests on
// moodeng.app/messenger-test.html, 2026-10-10/11): only a bare link to the Page's chat opens it. So the
// Android screen records the moment the borrower taps "Open Messenger" (contact_verification_codes.
// chat_opened_at), and when a Facebook contact we don't know yet subscribes to or writes the Page
// shortly after, sendpulse-events asks this module whether exactly one borrower just did that:
//   * exactly one borrower tapped in the last minute → connect them (through sendpulse-messenger-verify,
//     the same path a code takes) and tell the team it was matched by timing;
//   * two or more → don't guess; they paste the code, and name matching can still suggest a match.
// Known weak spot: a stranger who opens the chat inside that minute, before the borrower, gets
// linked. The team's "Facebook connected" alert shows the Facebook name, so a mismatch is visible.

export const TIMING_WINDOW_MS = 60 * 1000;
// The chat event can be stamped a moment before our tap (clock skew between SendPulse and us).
const EARLY_SKEW_MS = 5 * 1000;

export type TimingAttempt = { code: string; user_id: string; chat_opened_at: string };

export type TimingDecision = { kind: 'auto'; attempt: TimingAttempt } | { kind: 'ambiguous'; userIds: string[] } | { kind: 'none' };

export const decideTimingMatch = (eventAt: number, attempts: TimingAttempt[]): TimingDecision => {
   const inWindow = attempts.filter((a) => {
      const openedAt = Date.parse(a.chat_opened_at);
      return Number.isFinite(openedAt) && openedAt >= eventAt - TIMING_WINDOW_MS && openedAt <= eventAt + EARLY_SKEW_MS;
   });
   const userIds = [...new Set(inWindow.map((a) => a.user_id))];
   if (userIds.length === 0) return { kind: 'none' };
   if (userIds.length > 1) return { kind: 'ambiguous', userIds };
   // One borrower (maybe several taps): use their latest code.
   const latest = [...inWindow].sort((a, b) => Date.parse(b.chat_opened_at) - Date.parse(a.chat_opened_at))[0];
   return { kind: 'auto', attempt: latest };
};
