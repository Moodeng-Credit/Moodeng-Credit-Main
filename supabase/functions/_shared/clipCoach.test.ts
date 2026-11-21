import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { CLIP_COACH_MAX_BYTES, clipCoachSystem, clipMimeOf, toCoach } from './prescreenV2.ts';

Deno.test('clip type comes from the uploaded path; unknown types are skipped', () => {
   assertEquals(clipMimeOf('abc/intro-1.webm'), 'video/webm');
   assertEquals(clipMimeOf('abc/intro-1.MP4'), 'video/mp4');
   assertEquals(clipMimeOf('abc/intro-1.wav'), 'audio/wav');
   assertEquals(clipMimeOf('abc/intro-1.exe'), null);
});

Deno.test('clip coach: kind, in their language, never blocking or blaming; fails open', () => {
   for (const lang of ['en', 'fil', 'id']) {
      const sys = clipCoachSystem(lang);
      assert(sys.includes('When unsure, "ok": true'));
      assert(sys.includes('no blame'));
      assert(sys.includes('Never flag for accent'));
   }
   assert(clipCoachSystem('fil').includes('Taglish'));
   assertEquals(toCoach({ ok: false, hint: 'It’s a bit hard to hear you — a quieter spot would really help.' }).ok, false);
   assertEquals(toCoach(null), { ok: true, hint: '' });
   assertEquals(toCoach({ ok: false }), { ok: true, hint: '' });
   assert(CLIP_COACH_MAX_BYTES <= 14 * 1024 * 1024);
});
