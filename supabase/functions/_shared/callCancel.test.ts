import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { buildCancelCallback, cancelCallButton, confirmCancelView, parseCancelCallback } from './callCancel.ts';

const USER = '8dd3bb85-e8f8-4f21-aedc-016ba68bc35b';

Deno.test('cancel callbacks round-trip and fit in 64 bytes', () => {
   for (const step of ['open', 'yes', 'keep'] as const) {
      const data = buildCancelCallback(step, USER);
      assert(new TextEncoder().encode(data).length <= 64, data);
      assertEquals(parseCancelCallback(data), { step, userId: USER });
   }
   assertEquals(parseCancelCallback(cancelCallButton(USER).callback_data)?.step, 'open');
   assertEquals(parseCancelCallback('rs:o:' + USER), null);
   assertEquals(parseCancelCallback('cc:z:' + USER), null);
});

Deno.test('confirm prompt names the borrower and offers yes / keep', () => {
   const view = confirmCancelView({
      id: USER,
      username: 'jijitoting',
      display_name: 'Jiji',
      email: null,
      video_call_timezone: 'Asia/Manila',
      video_call_scheduled_at: null,
      video_call_starts_at: '2026-10-17T09:00:00.000Z',
      video_call_host: 'emma',
      video_call_booking_uid: 'abc',
      video_call_join_url: null,
      video_call_meeting_id: null
   });
   assert(view.text.startsWith("🗑️ Cancel Jiji's call?"));
   assertEquals(
      view.keyboard[0].map((b) => (b as { callback_data: string }).callback_data),
      [buildCancelCallback('yes', USER), buildCancelCallback('keep', USER)]
   );
});
