// Pure signature-verification and payload-parsing for the Cal.com webhook, split from index.ts so
// it's unit-testable without importing the module that starts the HTTP server.
//
// Cal.com signs each delivery with `x-cal-signature-256`: a hex HMAC-SHA256 of the RAW request
// body, keyed with the webhook's signing secret. Verify against the raw bytes, never re-stringified
// JSON. The body envelope is { triggerEvent, createdAt, payload }; we carry the borrower's id and
// host through the embed's metadata (moodeng_user_id / moodeng_host), and fall back to a hidden
// booking response of the same name in case a deployment routes them there instead.

export type CalcomWebhookBody = {
   triggerEvent?: string;
   payload?: {
      uid?: string;
      startTime?: string;
      metadata?: Record<string, unknown>;
      responses?: Record<string, unknown>;
   };
};

export type CalcomBooking = {
   triggerEvent: string;
   bookingUid: string | null;
   userId: string | null;
   host: 'george' | 'emma' | null;
   startsAt: string | null;
};

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

export const verifySignature = async (rawBody: string, header: string | null, secret: string): Promise<boolean> => {
   if (!secret || !header) return false;
   const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
      'sign'
   ]);
   const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
   return toHex(signature).toLowerCase() === header.trim().toLowerCase();
};

// Read a value we injected either as booking metadata or as a hidden custom response. `responses`
// maps a field name to { label, value, isHidden } (or occasionally a bare value).
const readInjectedField = (payload: NonNullable<CalcomWebhookBody['payload']>, key: string): string | null => {
   const meta = payload.metadata?.[key];
   if (typeof meta === 'string' && meta) return meta;

   const resp = payload.responses?.[key];
   if (typeof resp === 'string' && resp) return resp;
   if (resp && typeof resp === 'object' && 'value' in resp) {
      const value = (resp as { value?: unknown }).value;
      if (typeof value === 'string' && value) return value;
   }
   return null;
};

export const extractBooking = (body: CalcomWebhookBody): CalcomBooking | null => {
   const triggerEvent = body.triggerEvent;
   if (!triggerEvent) return null;

   const payload = body.payload ?? {};
   const hostRaw = readInjectedField(payload, 'moodeng_host');

   return {
      triggerEvent,
      bookingUid: typeof payload.uid === 'string' && payload.uid ? payload.uid : null,
      userId: readInjectedField(payload, 'moodeng_user_id'),
      host: hostRaw === 'george' || hostRaw === 'emma' ? hostRaw : null,
      startsAt: typeof payload.startTime === 'string' && payload.startTime ? payload.startTime : null
   };
};
