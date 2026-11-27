import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { combineCreatorReads, geminiVideoMime, reachLine, tiktokHandle, verdictFor } from './creatorGrade.ts';

Deno.test('tiktokHandle reads links and bare handles', () => {
   assertEquals(tiktokHandle('https://www.tiktok.com/@some.one?lang=en'), 'some.one');
   assertEquals(tiktokHandle('@cool_creator'), 'cool_creator');
   assertEquals(tiktokHandle('https://facebook.com/someone'), null);
   assertEquals(tiktokHandle(null), null);
});

Deno.test('verdict bands', () => {
   assertEquals(verdictFor(70), 'yes');
   assertEquals(verdictFor(69), 'maybe');
   assertEquals(verdictFor(45), 'maybe');
   assertEquals(verdictFor(44), 'no');
});

Deno.test('combineCreatorReads averages scores and merges flags', () => {
   const ai = combineCreatorReads(
      [
         {
            score: 80,
            summary: 'Real PH audience.',
            strengths: ['posts daily'],
            flags: ['no video'],
            video: { watched: true, on_camera: true, said: 'Wants to help' }
         },
         { score: 60, summary: 'ok', flags: ['no video', 'promotes another loan app'] },
         { score: 'x' }
      ],
      null,
      true
   );
   assertEquals(ai.score, 70);
   assertEquals(ai.verdict, 'yes');
   assertEquals(ai.summary, 'Real PH audience.');
   assertEquals(ai.flags, ['no video', 'promotes another loan app']);
   assertEquals(ai.reads, 2);
   assertEquals(ai.video?.said, 'Wants to help');
});

Deno.test('mime names for Gemini', () => {
   assertEquals(geminiVideoMime('video/quicktime'), 'video/mov');
   assertEquals(geminiVideoMime('video/webm'), 'video/webm');
   assertEquals(geminiVideoMime(''), 'video/mp4');
});

Deno.test('reachLine', () => {
   assertEquals(
      reachLine({
         handle: 'x',
         followers: 12300,
         likes: null,
         videos: 40,
         verified: false,
         private: false,
         recent_videos: 8,
         avg_views: 4100,
         last_post_days: 2
      }),
      'TikTok @x: 12.3k followers · ~4.1k views/video · last post 2d ago'
   );
   assertEquals(
      reachLine({
         handle: 'moodeng.credit',
         followers: 63,
         likes: 57,
         videos: 19,
         verified: false,
         private: false,
         recent_videos: 0,
         avg_views: null,
         last_post_days: null
      }),
      'TikTok @moodeng.credit: 63 followers · 57 likes on 19 videos'
   );
   assertEquals(reachLine(null), null);
});
