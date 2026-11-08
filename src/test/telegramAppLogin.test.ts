import { describe, expect, it } from 'vitest';

import { deviceOs, telegramAppLink, telegramWebLink } from '@/lib/telegramAppLogin';

const ticket = { botUsername: 'MoodengBot', startParam: 'login_abcDEF123_-xyzabcDEF123_-xyz' };

describe('telegram app login links', () => {
   it('detects the phone', () => {
      expect(deviceOs('Mozilla/5.0 (Linux; Android 14; SM-A146P) [FB_IAB/FB4A;FBAV/480.0]')).toBe('android');
      expect(deviceOs('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) [FBAN/FBIOS]')).toBe('ios');
      expect(deviceOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('other');
   });

   it('web link carries the start code', () => {
      expect(telegramWebLink(ticket)).toBe('https://t.me/MoodengBot?start=login_abcDEF123_-xyzabcDEF123_-xyz');
   });

   it('Android opens the Telegram app by intent, falling back to t.me', () => {
      const link = telegramAppLink(ticket, 'android');
      expect(link.startsWith('intent://resolve?domain=MoodengBot&start=login_')).toBe(true);
      expect(link).toContain('scheme=tg;package=org.telegram.messenger');
      expect(link).toContain(`S.browser_fallback_url=${encodeURIComponent(telegramWebLink(ticket))}`);
      expect(link.endsWith(';end')).toBe(true);
   });

   it('iPhone uses the tg:// scheme; desktop uses t.me', () => {
      expect(telegramAppLink(ticket, 'ios')).toBe('tg://resolve?domain=MoodengBot&start=login_abcDEF123_-xyzabcDEF123_-xyz');
      expect(telegramAppLink(ticket, 'other')).toBe(telegramWebLink(ticket));
   });
});
