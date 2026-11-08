/**
 * Telegram sign-in data (the website login redirect and the bot's login_url buttons) arrives in the
 * URL of /auth/telegram/callback: ?id=…&auth_date=…&hash=… (or #tgAuthResult=…). Analytics (Clarity,
 * PostHog) record the page URL, and that signed data could sign someone in if it leaked. So main.tsx
 * calls stashTelegramCallback() before analytics start: it moves the data into sessionStorage and
 * cleans the address bar (keeping only ?next=). The callback page reads it with takeTelegramCallback().
 */

const KEY = 'moodeng.tgAuthStash';
const CALLBACK_PATH = '/auth/telegram/callback';

export const stashTelegramCallback = (): void => {
   if (typeof window === 'undefined' || window.location.pathname !== CALLBACK_PATH) return;
   const { search, hash } = window.location;
   if (!/[?&]hash=/.test(search) && !/tgAuthResult=/.test(hash)) return;
   try {
      sessionStorage.setItem(KEY, JSON.stringify({ search, hash }));
   } catch {
      // No storage (private mode): leave the URL as it is so sign-in still works.
      return;
   }
   const next = new URLSearchParams(search).get('next');
   const clean = `${CALLBACK_PATH}${next ? `?next=${encodeURIComponent(next)}` : ''}`;
   window.history.replaceState(window.history.state, '', clean);
};

/** The stashed { search, hash } (once), or the live URL's. */
export const takeTelegramCallback = (): { search: string; hash: string } => {
   try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) {
         sessionStorage.removeItem(KEY);
         const parsed = JSON.parse(raw) as { search?: string; hash?: string };
         return { search: parsed.search ?? '', hash: parsed.hash ?? '' };
      }
   } catch {
      // fall through
   }
   return { search: window.location.search, hash: window.location.hash };
};
