import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { profileFromCache, videoFromItem } from './tiktokApify.ts';

// Shape of Apify's AUTHOR_PROFILE_CACHE record (Nov 2026), trimmed.
const CACHE = {
   'moodeng.credit': {
      id: '1',
      name: 'moodeng.credit',
      nickName: 'Moodeng Credit',
      verified: false,
      privateAccount: false,
      fans: 63,
      heart: 57,
      video: 19
   }
};

Deno.test('profileFromCache reads followers / likes / videos, any case', () => {
   assertEquals(profileFromCache(CACHE, 'Moodeng.Credit'), {
      handle: 'moodeng.credit',
      nickname: 'Moodeng Credit',
      followers: 63,
      likes: 57,
      videos: 19,
      verified: false,
      private: false
   });
   assertEquals(profileFromCache(null, 'x'), null);
   assertEquals(profileFromCache({}, 'x'), null);
});

Deno.test('videoFromItem maps the old dataset rows', () => {
   const v = videoFromItem({
      createTimeISO: '2026-11-20T00:00:00.000Z',
      text: ' hi \n there ',
      playCount: 120,
      diggCount: 9,
      webVideoUrl: 'https://t/1'
   });
   assertEquals(v.views, 120);
   assertEquals(v.likes, 9);
   assertEquals(v.text, 'hi there');
   assertEquals(v.comments, 0);
});
