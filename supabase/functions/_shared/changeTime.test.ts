import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { changeTimeTarget } from './videoCall.ts';

const NOW = Date.parse('2026-11-15T10:00:00Z');
const LATER = '2026-11-15T12:00:00Z';
const EARLIER = '2026-11-15T09:00:00Z';

Deno.test('still booked: Cal.com reschedule for the current booking, even from an older card', () => {
   assertEquals(changeTimeTarget('oldUid', { video_call_booking_uid: 'newUid', video_call_starts_at: LATER, loan_access_status: 'pending' }, NOW), {
      kind: 'reschedule',
      uid: 'newUid'
   });
});

Deno.test('call cancelled (no booking): book again on our page', () => {
   assertEquals(changeTimeTarget('oldUid', { video_call_booking_uid: null, video_call_starts_at: null, loan_access_status: 'none' }, NOW), { kind: 'rebook' });
});

Deno.test('booking already in the past: book again', () => {
   assertEquals(changeTimeTarget('uid', { video_call_booking_uid: 'uid', video_call_starts_at: EARLIER, loan_access_status: 'pending' }, NOW), { kind: 'rebook' });
});

Deno.test('rejected: no rebooking', () => {
   assertEquals(changeTimeTarget('uid', { video_call_booking_uid: null, video_call_starts_at: null, loan_access_status: 'rejected' }, NOW), { kind: 'rejected' });
});

Deno.test('borrower not found: the booking on the card', () => {
   assertEquals(changeTimeTarget('uid', null, NOW), { kind: 'card', uid: 'uid' });
});
