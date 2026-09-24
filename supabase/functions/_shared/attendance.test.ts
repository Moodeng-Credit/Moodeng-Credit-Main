import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { describeAttendance, isZoomActive, meetingIdFromJoinUrl } from './attendance.ts';

const START = '2026-09-25T03:00:00.000Z'; // 10:00 AM Bangkok

Deno.test('meeting id comes out of every Zoom link shape, and nothing else', () => {
   assertEquals(meetingIdFromJoinUrl('https://us06web.zoom.us/j/81234567890?pwd=abc'), '81234567890');
   assertEquals(meetingIdFromJoinUrl('https://zoom.us/w/81234567890?tk=x'), '81234567890');
   assertEquals(meetingIdFromJoinUrl('zoommtg://zoom.us/join?confno=81234567890'), '81234567890');
   assertEquals(meetingIdFromJoinUrl('https://app.cal.com/video/abc123'), null);
   assertEquals(meetingIdFromJoinUrl(null), null);
});

Deno.test('Zoom counts as wired up only after a recent signed event', () => {
   const now = Date.parse('2026-09-25T00:00:00Z');
   assertEquals(isZoomActive('2026-09-20T00:00:00Z', now), true);
   assertEquals(isZoomActive('2026-09-01T00:00:00Z', now), false);
   assertEquals(isZoomActive(null, now), false);
});

Deno.test('evidence: joined late and stayed', () => {
   assertEquals(
      describeAttendance(
         { video_call_starts_at: START, video_call_joined_at: '2026-09-25T03:04:00Z', video_call_left_at: '2026-09-25T03:18:00Z' },
         true
      ),
      '✅ Zoom: joined 10:04 AM (4 min late), stayed 14 min.'
   );
});

Deno.test('evidence: on time and still in the call', () => {
   assertEquals(
      describeAttendance({ video_call_starts_at: START, video_call_joined_at: '2026-09-25T03:00:30Z' }, true),
      '✅ Zoom: joined 10:00 AM, still in the call.'
   );
});

Deno.test('evidence: stuck in the waiting room', () => {
   assertEquals(
      describeAttendance({ video_call_starts_at: START, video_call_arrived_at: '2026-09-25T02:59:00Z' }, true),
      '🟡 Zoom: reached the waiting room at 9:59 AM but never got into the call.'
   );
});

Deno.test('evidence: silence only means "never joined" when Zoom is wired up for a Zoom booking', () => {
   assertEquals(describeAttendance({ video_call_starts_at: START, video_call_meeting_id: '81234567890' }, true), '❌ Zoom: never joined.');
   assertEquals(describeAttendance({ video_call_starts_at: START, video_call_meeting_id: '81234567890' }, false), null);
   assertEquals(describeAttendance({ video_call_starts_at: START, video_call_meeting_id: null }, true), null);
});
