import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Sign in with the Telegram APP (supabase/functions/telegram-login app_start / app_poll +
 * telegram-webhook "/start login_<code>"). Works inside Facebook's / TikTok's browser, where
 * Telegram's website login gets lost between apps: the page opens our bot in the Telegram app, the
 * person taps Start, and this page — still open — collects the session.
 */

export type AppLoginTicket = {
   code: string;
   pollSecret: string;
   botUsername: string;
   startParam: string;
   expiresAt: string;
   /** Shown on the page; the person taps the same number in Telegram before anyone is signed in. */
   matchNumber: number;
};

export type AppLoginPoll =
   | { status: 'waiting' | 'expired' | 'used' | 'invalid' }
   | { status: 'session'; session: { access_token: string; refresh_token: string } }
   | { status: 'error'; message: string; code?: string };

const STORAGE_KEY = 'moodeng.telegramAppLogin';

export const startAppLogin = async (intent?: 'id'): Promise<AppLoginTicket> => {
   const { data, error } = await getSupabaseBrowserClient().functions.invoke('telegram-login', {
      body: { action: 'app_start', ...(intent ? { intent } : {}) }
   });
   if (error || !data?.code) throw new Error((data as { error?: string } | null)?.error ?? error?.message ?? 'Telegram sign-in is unavailable.');
   const ticket = data as AppLoginTicket;
   try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ticket));
   } catch {
      // Private mode: the ticket just lives in memory for this page.
   }
   return ticket;
};

/** A ticket this tab already started (survives a reload while they're in Telegram). */
export const savedAppLogin = (): AppLoginTicket | null => {
   try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const ticket = JSON.parse(raw) as AppLoginTicket;
      return new Date(ticket.expiresAt).getTime() > Date.now() ? ticket : null;
   } catch {
      return null;
   }
};

export const clearAppLogin = (): void => {
   try {
      sessionStorage.removeItem(STORAGE_KEY);
   } catch {
      // ignore
   }
};

export const pollAppLogin = async (ticket: AppLoginTicket): Promise<AppLoginPoll> => {
   const { data, error } = await getSupabaseBrowserClient().functions.invoke('telegram-login', {
      body: { action: 'app_poll', code: ticket.code, pollSecret: ticket.pollSecret }
   });
   if (error) return { status: 'error', message: error.message };
   const body = (data ?? {}) as { status?: string; session?: { access_token: string; refresh_token: string }; error?: string; code?: string };
   if (body.session?.access_token) return { status: 'session', session: body.session };
   if (body.error) return { status: 'error', message: body.error, code: body.code };
   if (body.status === 'waiting' || body.status === 'expired' || body.status === 'used' || body.status === 'invalid') {
      return { status: body.status };
   }
   return { status: 'error', message: 'Unexpected answer from Telegram sign-in.' };
};

export type DeviceOs = 'android' | 'ios' | 'other';

export const deviceOs = (ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): DeviceOs =>
   /android/i.test(ua) ? 'android' : /iphone|ipad|ipod/i.test(ua) ? 'ios' : 'other';

/** The plain web link (works everywhere; inside in-app browsers it may open a t.me page first). */
export const telegramWebLink = (ticket: Pick<AppLoginTicket, 'botUsername' | 'startParam'>): string =>
   `https://t.me/${ticket.botUsername}?start=${ticket.startParam}`;

/**
 * The link that opens the Telegram APP from where they are:
 *   Android (incl. Facebook's browser): an intent:// URL straight into the Telegram app, falling back
 *     to t.me when Telegram isn't installed.
 *   iPhone: tg://resolve — the app's own scheme (in-app browsers often ignore t.me universal links).
 *   Desktop: t.me (Telegram Desktop / Web).
 */
export const telegramAppLink = (ticket: Pick<AppLoginTicket, 'botUsername' | 'startParam'>, os: DeviceOs = deviceOs()): string => {
   const web = telegramWebLink(ticket);
   if (os === 'android') {
      return (
         `intent://resolve?domain=${ticket.botUsername}&start=${ticket.startParam}` +
         `#Intent;scheme=tg;package=org.telegram.messenger;S.browser_fallback_url=${encodeURIComponent(web)};end`
      );
   }
   if (os === 'ios') return `tg://resolve?domain=${ticket.botUsername}&start=${ticket.startParam}`;
   return web;
};
