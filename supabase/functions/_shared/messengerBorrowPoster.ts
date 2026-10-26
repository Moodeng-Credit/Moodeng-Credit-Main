import type { MessengerCard } from './sendpulse.ts';

// The "6 things you need to know before borrow" poster (George, 2026-10-15). Sent once per borrower,
// on the first message they write to the Page AFTER their MDNG code connected Facebook — never in
// answer to the code message itself, which the confirm flow already answers. Waiting for them to
// write keeps us inside Meta's 24h window. Stamped in users.borrow_poster_sent_at.
export const BORROW_POSTER_URL = `${(Deno.env.get('SITE_URL') ?? 'https://moodeng.app').replace(/\/$/, '')}/messenger/borrow-6-things.jpg`;

// A message this soon after the connection is still part of connecting (the code message, or one
// SendPulse stamped a little apart from our clock), not a new message from them.
export const AFTER_CONNECT_MARGIN_MS = 30 * 1000;

export const BORROW_POSTER_TEXT = 'Thanks for your message! Before you borrow, here are 6 things to know 👇';

export const BORROW_POSTER_CARD: MessengerCard = {
   title: '6 things to know before you borrow',
   subtitle: 'Borrow small. Build trust. Unlock your future.',
   imageUrl: BORROW_POSTER_URL,
   button: { title: 'Open Moodeng', url: 'https://moodeng.app' }
};

export type PosterCandidate = {
   messenger_verified_at: string | null;
   borrow_poster_sent_at: string | null;
   user_role: string | null;
};

/** True when this message is the borrower's first chance to get the poster. `hasBorrowed` = a funded loan exists. */
export const shouldSendBorrowPoster = (user: PosterCandidate | null, messageAt: number, hasBorrowed: boolean): boolean => {
   if (!user || user.borrow_poster_sent_at || user.user_role === 'lender' || hasBorrowed) return false;
   const connectedAt = user.messenger_verified_at ? Date.parse(user.messenger_verified_at) : Number.NaN;
   if (Number.isNaN(connectedAt)) return false;
   return messageAt - connectedAt >= AFTER_CONNECT_MARGIN_MS;
};
