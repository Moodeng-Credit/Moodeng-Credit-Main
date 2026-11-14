// The two Facebook steps every new borrower does ON the screening call, while the host watches:
// add Emma as a friend and join the community group. Facebook gives apps no way to check either
// (Groups API removed April 2024; friend lists were never readable), so the host sees both requests
// arrive, accepts them, and ticks "Added Emma…" on the call sheet. This file is only the content
// and the "already sent for this call?" rule — pure, so it's unit-testable. Sending lives in
// facebookStepsSend.ts.

export const FB_EMMA_URL = 'https://www.facebook.com/p/Emma-Moodeng-61587198479632/';
export const FB_GROUP_URL = 'https://www.facebook.com/groups/voicesunfairloan/';

export const FB_STEPS_TEXT = '📌 2 quick steps while we talk:\n1️⃣ Add Emma as a friend\n2️⃣ Join our group\nTap the buttons 👇';

// Messenger caps button titles at 20 characters and card titles at 80.
export const FB_STEPS_CARD = {
   title: 'Do these 2 steps now',
   subtitle: 'Your host will accept both on the call.',
   button: { title: '1. Add Emma', url: FB_EMMA_URL },
   moreButtons: [{ title: '2. Join the group', url: FB_GROUP_URL }]
};

export const FB_STEPS_TELEGRAM_KEYBOARD = [[{ text: '1. Add Emma', url: FB_EMMA_URL }], [{ text: '2. Join the group', url: FB_GROUP_URL }]];

// users.video_call_fb_steps_sent_at is never reset when a call is rebooked, so "already sent" means
// "sent for THIS call": anything older than 12h before the call's start belongs to an earlier booking.
const SAME_CALL_WINDOW_MS = 12 * 60 * 60 * 1000;
export const fbStepsStaleBefore = (callStartsAt: string | null | undefined, now = Date.now()): string => {
   const start = callStartsAt ? Date.parse(callStartsAt) : NaN;
   return new Date((Number.isNaN(start) ? now : start) - SAME_CALL_WINDOW_MS).toISOString();
};
export const fbStepsSentForCall = (sentAt: string | null | undefined, callStartsAt: string | null | undefined, now = Date.now()): boolean =>
   Boolean(sentAt) && Date.parse(String(sentAt)) >= Date.parse(fbStepsStaleBefore(callStartsAt, now));
