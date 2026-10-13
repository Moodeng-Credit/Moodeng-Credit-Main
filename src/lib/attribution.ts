// Where a new borrower came from, so the weekly social recap can say which post or poster brought them in.
//
// Every link we share carries ?src=… (e.g. moodeng.app/?src=fb-bonds-oct8, or a printed poster's QR:
// moodeng.app/?src=poster-qc-mall). The first visit's source is kept on this browser (a tagged visit
// replaces an untagged one), and when the person has just created their account it's saved on it once
// (record_signup_source; existing accounts are never re-tagged). Untagged visits fall back to the site
// they came from (facebook, tiktok, google…). Best-effort: storage or network failures never block anything.
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const KEY = 'md_first_touch';
const SENT_KEY = 'md_first_touch_sent';

type Touch = { src: string | null; campaign: string | null; referrer: string | null; landing: string; at: string };

const clean = (value: string | null, max = 80) => (value ? value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(0, max) || null : null);

const referrerHost = () => {
   try {
      if (!document.referrer) return null;
      const host = new URL(document.referrer).hostname.replace(/^www\./, '');
      return host === window.location.hostname.replace(/^www\./, '') ? null : host;
   } catch {
      return null;
   }
};

/** Call once on page load. Keeps the first visit, unless a later visit is the first with a ?src tag. */
export const captureFirstTouch = () => {
   try {
      const params = new URLSearchParams(window.location.search);
      const src = clean(params.get('src') ?? params.get('utm_source'));
      const saved = window.localStorage.getItem(KEY);
      const previous = saved ? (JSON.parse(saved) as Touch) : null;
      if (previous && (previous.src || !src)) return;
      const touch: Touch = {
         src,
         campaign: clean(params.get('utm_campaign')),
         referrer: referrerHost(),
         landing: window.location.pathname.slice(0, 120),
         at: new Date().toISOString()
      };
      window.localStorage.setItem(KEY, JSON.stringify(touch));
   } catch {
      // Storage blocked: this visit just isn't attributed.
   }
};

/** Once per signed-in account on this browser: save where they came from, if the account is new. */
export const recordSignupSource = (userId: string) => {
   try {
      const sentFor = window.localStorage.getItem(SENT_KEY);
      if (sentFor === userId) return;
      const saved = window.localStorage.getItem(KEY);
      const touch = saved ? (JSON.parse(saved) as Touch) : null;
      window.localStorage.setItem(SENT_KEY, userId);
      if (!touch) return;
      void getSupabaseBrowserClient()
         .rpc('record_signup_source', {
            p_source: touch.src,
            p_campaign: touch.campaign,
            p_referrer: touch.referrer,
            p_landing: touch.landing,
            p_touched_at: touch.at
         })
         .then(({ error }) => {
            if (error) console.warn('record_signup_source failed', error.message);
         });
   } catch {
      // Storage blocked: skip.
   }
};
