import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { classifyParticipant, classifyZoomEvent, hmacSha256Hex, pickBooking, verifyZoomSignature } from './lib.ts';

const SECRET = 'test-secret-token';

Deno.test('a correctly signed, fresh request is accepted', async () => {
   const body = '{"event":"meeting.participant_joined"}';
   const ts = '1790000000';
   const sig = `v0=${await hmacSha256Hex(SECRET, `v0:${ts}:${body}`)}`;
   assertEquals(await verifyZoomSignature(SECRET, ts, body, sig, 1790000000 * 1000 + 30_000), true);
});

Deno.test('tampered, stale, unsigned or wrong-secret requests are refused', async () => {
   const body = '{"event":"meeting.participant_joined"}';
   const ts = '1790000000';
   const now = 1790000000 * 1000;
   const sig = `v0=${await hmacSha256Hex(SECRET, `v0:${ts}:${body}`)}`;
   assertEquals(await verifyZoomSignature(SECRET, ts, body + ' ', sig, now), false);
   assertEquals(await verifyZoomSignature(SECRET, ts, body, sig, now + 10 * 60_000), false);
   assertEquals(await verifyZoomSignature(SECRET, null, body, sig, now), false);
   assertEquals(await verifyZoomSignature('other-secret', ts, body, sig, now), false);
});

Deno.test('Zoom URL validation is recognised', () => {
   assertEquals(classifyZoomEvent({ event: 'endpoint.url_validation', payload: { plainToken: 'abc' } }), { kind: 'validation', plainToken: 'abc' });
});

const participantEvent = (event: string, participant: Record<string, string>) => ({
   event,
   event_ts: 1790000000000,
   payload: { object: { id: 81234567890, host_id: 'HOST123', participant } }
});

Deno.test('borrower in the waiting room = arrived; in the meeting = joined; leaving = left', () => {
   const guest = { user_name: 'Maria', date_time: '2026-09-25T02:59:00Z' };
   assertEquals(classifyZoomEvent(participantEvent('meeting.participant_joined_waiting_room', guest)), {
      kind: 'arrived',
      meetingId: '81234567890',
      isHost: false,
      at: '2026-09-25T02:59:00.000Z',
      name: 'Maria',
      email: ''
   });
   assertEquals(classifyZoomEvent(participantEvent('meeting.participant_joined', { user_name: 'Maria', join_time: '2026-09-25T03:01:00Z' })).kind, 'joined');
   assertEquals(classifyZoomEvent(participantEvent('meeting.participant_jbh_waiting', guest)).kind, 'arrived');
   assertEquals(classifyZoomEvent(participantEvent('meeting.participant_left', { user_name: 'Maria', leave_time: '2026-09-25T03:15:00Z' })).kind, 'left');
});

Deno.test('the host joining is recognised as the host, not the borrower', () => {
   const e = classifyZoomEvent(participantEvent('meeting.participant_joined', { id: 'HOST123', user_name: 'Emma', join_time: '2026-09-25T03:02:00Z' }));
   assertEquals(e.kind === 'joined' && e.isHost, true);
});

Deno.test('unrelated events are ignored', () => {
   assertEquals(classifyZoomEvent({ event: 'meeting.started', payload: { object: { id: 1 } } }), { kind: 'ignore' });
   assertEquals(classifyZoomEvent({}), { kind: 'ignore' });
});

Deno.test('a shared personal-room id matches the booking closest to the event', () => {
   const at = Date.parse('2026-09-25T03:01:00Z');
   const rows = [
      { id: 'a', video_call_starts_at: '2026-09-25T01:00:00Z' },
      { id: 'b', video_call_starts_at: '2026-09-25T03:00:00Z' },
      { id: 'c', video_call_starts_at: '2026-09-26T03:00:00Z' }
   ];
   assertEquals(pickBooking(rows, at)?.id, 'b');
   assertEquals(pickBooking([{ id: 'far', video_call_starts_at: '2026-09-25T10:00:00Z' }], at), null);
});

const kryshia = { display_name: 'kryshia gonzales', username: 'sleeptonight00-57e835', email: 'sleeptonight00@gmail.com' };

Deno.test('note-taker bots are never the borrower', () => {
   for (const name of ["George's Notetaker (Otter.ai)", 'Fireflies.ai Notetaker', 'Read.ai meeting notes', 'Fathom', 'tl;dv recorder', 'Emma AI Notetaker']) {
      assertEquals(classifyParticipant({ name, email: '' }, kryshia), 'bot', name);
   }
});

Deno.test('teammates are never the borrower', () => {
   assertEquals(classifyParticipant({ name: 'George Lerner', email: '' }, kryshia), 'team');
   assertEquals(classifyParticipant({ name: 'Emma', email: '' }, kryshia), 'team');
   assertEquals(classifyParticipant({ name: 'Moodeng Credit', email: '' }, kryshia), 'team');
   assertEquals(classifyParticipant({ name: 'Anyone', email: 'ops@moodeng.app' }, kryshia), 'team');
});

Deno.test('the borrower is matched by any shared name word, or by email', () => {
   assertEquals(classifyParticipant({ name: 'Kryshia Joyce', email: '' }, kryshia), 'borrower');
   assertEquals(classifyParticipant({ name: 'sleeptonight00', email: '' }, kryshia), 'borrower');
   assertEquals(classifyParticipant({ name: 'K', email: 'sleeptonight00@gmail.com' }, kryshia), 'borrower');
});

Deno.test('a borrower who shares a host first name is still the borrower', () => {
   assertEquals(classifyParticipant({ name: 'Emma Santos', email: '' }, { display_name: 'Emma Santos', username: 'emmas', email: null }), 'borrower');
});

Deno.test('an unrecognised name is a maybe, not ignored', () => {
   assertEquals(classifyParticipant({ name: 'iPhone', email: '' }, kryshia), 'unknown');
   assertEquals(classifyParticipant({ name: '', email: '' }, kryshia), 'unknown');
});
