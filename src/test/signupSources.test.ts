import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({ getSupabaseBrowserClient: () => ({ rpc: vi.fn() }) }));

const { describeBrowser } = await import('@/lib/attribution');
const { groupSignups, sourceLabel } = await import('@/app/admin/SignupSourcesSection');

const FB_ANDROID =
   'Mozilla/5.0 (Linux; Android 13; SM-A145F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.40.82;]';
const MESSENGER_IOS =
   'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/470.0]';
const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36';
const SAFARI_IOS =
   'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const SAMSUNG =
   'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0 Mobile Safari/537.36';
const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

describe('describeBrowser (sign-up tag)', () => {
   it('names the app whose browser they are in', () => {
      expect(describeBrowser(FB_ANDROID, false)).toEqual({ browser: 'Facebook app', os: 'android' });
      expect(describeBrowser(MESSENGER_IOS, false)).toEqual({ browser: 'Messenger app', os: 'ios' });
   });
   it('names real browsers and the Home Screen app', () => {
      expect(describeBrowser(CHROME_ANDROID, false)).toEqual({ browser: 'Chrome', os: 'android' });
      expect(describeBrowser(SAFARI_IOS, false)).toEqual({ browser: 'Safari', os: 'ios' });
      expect(describeBrowser(SAMSUNG, false).browser).toBe('Samsung Internet');
      expect(describeBrowser(MAC_CHROME, false)).toEqual({ browser: 'Chrome', os: 'desktop' });
      expect(describeBrowser(SAFARI_IOS, true).browser).toBe('Home Screen app');
   });
});

describe('sign-up sources grouping', () => {
   const row = (browser: string | null, progress: Partial<Record<'facebook_connected' | 'approved' | 'id_verified' | 'borrowed', boolean>>) => ({
      id: Math.random().toString(),
      username: 'u',
      created_at: '2026-10-16T00:00:00Z',
      method: 'Google',
      browser,
      os: 'android',
      source: null,
      referrer: 'facebook.com',
      campaign: null,
      facebook_connected: false,
      approved: false,
      id_verified: false,
      borrowed: false,
      ...progress
   });

   it('counts each step per browser, biggest first', () => {
      const groups = groupSignups(
         [row('Facebook app', { facebook_connected: true }), row('Facebook app', { borrowed: true }), row('Chrome', {}), row(null, {})],
         (r) => r.browser ?? 'Not tagged'
      );
      expect(groups[0]).toMatchObject({ key: 'Facebook app', total: 2, facebook: 1, borrowed: 1 });
      expect(groups.map((g) => g.key)).toEqual(['Facebook app', 'Chrome', 'Not tagged']);
   });

   it('source: ?src tag first, then the referring site', () => {
      expect(sourceLabel({ source: 'poster-qc', referrer: 'facebook.com' })).toBe('poster-qc');
      expect(sourceLabel({ source: null, referrer: 'facebook.com' })).toBe('facebook.com');
      expect(sourceLabel({ source: null, referrer: null })).toBe('Direct / unknown');
   });
});
