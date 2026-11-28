// "Cancel and resend the booking offer": the borrower booked the wrong time (e.g. Monday when they
// meant today). The team cancels the call (Cal.com + Zoom go with it, quietly — callCancel.ts) and we
// send the booking link again on Messenger and WhatsApp so they pick a new time themselves.
// loan-access { action: 'rebook_call', user_id, by, offer? } (internal). offer: false = cancel only.
import { BOOK_CALL_URL, HOW_TO, sendBookCallWhatsApp, WA_PERSON_COLUMNS, type WaPerson } from './bookCallLink.ts';
import { cancelUpcomingCall } from './callCancel.ts';
import { sendMessengerMessage } from './sendpulse.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

/** The Messenger text (English + Filipino). Pure. */
export const rebookMessengerText = () =>
   `📅 We cancelled the call you booked so you can pick a better time. Book a new one here: ${BOOK_CALL_URL}\n${HOW_TO}\n\n` +
   `📅 Kinansela namin ang na-book mong call para makapili ka ng mas tamang oras. Mag-book ulit dito: ${BOOK_CALL_URL}`;

export const cancelAndOfferRebook = async (
   svc: SupabaseClient,
   userId: string,
   by: string,
   opts: { offer?: boolean } = {}
): Promise<{ ok: boolean; summary: string }> => {
   const { data } = await svc.from('users').select(`messenger_psid, ${WA_PERSON_COLUMNS}`).eq('id', userId).maybeSingle();
   const u = data as (WaPerson & { messenger_psid?: string | null }) | null;
   if (!u) return { ok: false, summary: 'Borrower not found.' };
   const why = await cancelUpcomingCall(svc, userId, opts.offer === false ? by : `${by} (rebook offer)`);
   if (why) return { ok: false, summary: why };
   if (opts.offer === false) return { ok: true, summary: 'Call cancelled. Nothing was sent to them.' };
   const [msg, wa] = await Promise.all([
      sendMessengerMessage(u.messenger_psid, { text: rebookMessengerText() }).catch(() => ({ ok: false })),
      sendBookCallWhatsApp(u, 'reminder')
   ]);
   const sent = [(msg as { ok?: boolean }).ok ? 'Messenger' : null, wa ? 'WhatsApp' : null].filter(Boolean);
   return {
      ok: true,
      summary: `Call cancelled. Booking link ${sent.length ? `sent on ${sent.join(' + ')}` : 'NOT delivered (no open Messenger window or WhatsApp) — send it by hand'}.`
   };
};
