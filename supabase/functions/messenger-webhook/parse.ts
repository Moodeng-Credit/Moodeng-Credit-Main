// Pure payload-parsing for the Messenger webhook, split out from index.ts so it can be unit-tested
// without importing the module that starts the HTTP server. index.ts does the DB writes; this file
// only turns a raw Messenger POST body into the list of (code, psid) pairs to verify.

// Matches the code shape start_contact_verification() generates: MDNG-6 uppercase hex chars.
// Case-insensitive and tolerant of a stray separator, since it only has to match a ref WE minted
// and round-tripped through Meta untouched.
export const CODE_PATTERN = /MDNG[-\s]?([A-Z0-9]{6})/i;

export type MessagingEvent = {
   sender?: { id?: string };
   referral?: { ref?: string };
   postback?: { referral?: { ref?: string } };
   message?: { referral?: { ref?: string } };
};

export type MessengerWebhookPayload = {
   object?: string;
   entry?: Array<{
      messaging?: MessagingEvent[];
   }>;
};

// Pull the referral ref out of whichever place Messenger put it for this event shape: a bare
// `referral` (existing thread reopened via the m.me link), a `postback.referral` (new thread, via
// the Get Started button), or a `message.referral` (first message carried the referral).
export const extractRef = (event: MessagingEvent): string | null =>
   event.referral?.ref ?? event.postback?.referral?.ref ?? event.message?.referral?.ref ?? null;

// Flatten a webhook body into the (normalized code, sender PSID) pairs worth acting on. Events
// without a ref or without a sender are dropped, as are refs that don't carry our code shape.
export const extractVerifications = (payload: MessengerWebhookPayload): Array<{ code: string; psid: string }> => {
   const events = payload.entry?.flatMap((entry) => entry.messaging ?? []) ?? [];
   const out: Array<{ code: string; psid: string }> = [];
   for (const event of events) {
      const rawRef = extractRef(event);
      const psid = event.sender?.id;
      if (!rawRef || !psid) continue;
      const match = rawRef.match(CODE_PATTERN);
      if (!match) continue;
      out.push({ code: `MDNG-${match[1].toUpperCase()}`, psid });
   }
   return out;
};
