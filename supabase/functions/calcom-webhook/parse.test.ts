import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { extractBooking, verifySignature } from './parse.ts';

// Compute the hex HMAC-SHA256 the same way Cal.com signs a delivery, so we can prove verify accepts
// a good signature and rejects a tampered body.
const sign = async (raw: string, secret: string): Promise<string> => {
   const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
   const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
   return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
};

Deno.test('valid signature over the raw body passes, tampering fails', async () => {
   const secret = 'whsec_test';
   const raw = JSON.stringify({ triggerEvent: 'BOOKING_CREATED', payload: { uid: 'bk_1' } });
   const good = await sign(raw, secret);
   assertEquals(await verifySignature(raw, good, secret), true);
   assertEquals(await verifySignature(raw, good.toUpperCase(), secret), true); // case-insensitive hex
   assertEquals(await verifySignature(raw + ' ', good, secret), false); // body changed
   assertEquals(await verifySignature(raw, good, 'wrong_secret'), false);
   assertEquals(await verifySignature(raw, null, secret), false);
   assertEquals(await verifySignature(raw, good, ''), false);
});

Deno.test('BOOKING_CREATED: user id + host come from embed metadata', () => {
   const body = {
      triggerEvent: 'BOOKING_CREATED',
      payload: {
         uid: 'bk_abc',
         startTime: '2026-10-01T09:00:00Z',
         metadata: { moodeng_user_id: 'user-123', moodeng_host: 'george', videoCallUrl: 'https://cal.example/x' }
      }
   };
   assertEquals(extractBooking(body), {
      triggerEvent: 'BOOKING_CREATED',
      bookingUid: 'bk_abc',
      userId: 'user-123',
      host: 'george',
      startsAt: '2026-10-01T09:00:00Z',
      joinUrl: 'https://cal.example/x'
   });
});

Deno.test('falls back to a hidden response field when metadata is absent', () => {
   const body = {
      triggerEvent: 'BOOKING_CREATED',
      payload: {
         uid: 'bk_def',
         startTime: '2026-10-02T10:30:00Z',
         responses: {
            moodeng_user_id: { label: 'ref', value: 'user-777', isHidden: true },
            moodeng_host: { label: 'host', value: 'emma', isHidden: true }
         }
      }
   };
   assertEquals(extractBooking(body), {
      triggerEvent: 'BOOKING_CREATED',
      bookingUid: 'bk_def',
      userId: 'user-777',
      host: 'emma',
      startsAt: '2026-10-02T10:30:00Z',
      joinUrl: null
   });
});

Deno.test('an unknown host is normalized to null rather than trusted', () => {
   const body = { triggerEvent: 'BOOKING_CREATED', payload: { uid: 'bk_1', metadata: { moodeng_user_id: 'u1', moodeng_host: 'mallory' } } };
   assertEquals(extractBooking(body)?.host, null);
});

Deno.test('cancellation keeps the uid so the right booking can be reopened', () => {
   const body = { triggerEvent: 'BOOKING_CANCELLED', payload: { uid: 'bk_abc', metadata: { moodeng_user_id: 'user-123' } } };
   const parsed = extractBooking(body);
   assertEquals(parsed?.triggerEvent, 'BOOKING_CANCELLED');
   assertEquals(parsed?.bookingUid, 'bk_abc');
   assertEquals(parsed?.userId, 'user-123');
});

Deno.test('a body with no triggerEvent is ignored', () => {
   assertEquals(extractBooking({}), null);
   assertEquals(extractBooking({ payload: { uid: 'x' } }), null);
});

Deno.test('extractBooking picks up the meeting join link (Zoom / Cal Video)', () => {
   const booking = extractBooking({
      triggerEvent: 'BOOKING_RESCHEDULED',
      payload: {
         uid: 'b2',
         startTime: '2026-10-03T03:00:00Z',
         location: 'integrations:zoom',
         metadata: { moodeng_user_id: 'u1', moodeng_host: 'emma', videoCallUrl: 'https://us06web.zoom.us/j/999' }
      }
   });
   assertEquals(booking?.joinUrl, 'https://us06web.zoom.us/j/999');
   const plain = extractBooking({ triggerEvent: 'BOOKING_CREATED', payload: { uid: 'b3', location: 'https://cal.com/video/abc' } });
   assertEquals(plain?.joinUrl, 'https://cal.com/video/abc');
});
