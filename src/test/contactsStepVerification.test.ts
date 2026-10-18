import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildMessengerVerifyLink, buildWhatsAppVerifyLink, MESSENGER_APP_CHAT_LINK } from '@/config/contactVerification';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

// Shared, mutable Supabase behaviour the test flips between assertions: the users row the
// component reads on load and on every poll, and the code start_*_verification hands back.
const supa = vi.hoisted(() => {
   const state = {
      usersRow: { whatsapp_verified_at: null as string | null, messenger_verified_at: null as string | null },
      rpcResult: { data: 'MDNG-ABC123' as unknown, error: null as unknown }
   };
   return {
      state,
      rpc: vi.fn(async () => state.rpcResult),
      maybeSingle: vi.fn(async () => ({ data: state.usersRow })),
      invoke: vi.fn(async () => ({ data: { ok: true }, error: null }))
   };
});

// Push state the tests flip: unsupported by default (not required), or supported to test the requirement.
const push = vi.hoisted(() => {
   const state = { isSupported: false, permission: 'unsupported' as string, isSubscribed: false };
   return {
      state,
      enable: vi.fn(async () => {
         state.permission = 'granted';
         state.isSubscribed = true;
         return 'subscribed';
      })
   };
});

vi.mock('@/hooks/usePushNotifications', () => ({
   usePushNotifications: () => ({ ...push.state, isBusy: false, enable: push.enable, disable: async () => undefined })
}));

vi.mock('@/lib/supabase/client', () => ({
   getSupabaseBrowserClient: () => ({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: supa.maybeSingle }) }) }),
      rpc: supa.rpc,
      functions: { invoke: supa.invoke },
      // ContactsStep's live subscription (Supabase Realtime): a no-op channel here.
      channel: () => ({
         on(this: object) {
            return this;
         },
         subscribe(this: object) {
            return this;
         }
      }),
      removeChannel: vi.fn(async () => 'ok')
   })
}));

// Records where "Or open Moodeng in Safari instead" sends them (jsdom can't follow x-safari- links).
const safari = vi.hoisted(() => ({ open: vi.fn(() => true) }));
vi.mock('@/lib/inAppBrowser', async (importOriginal) => ({
   ...(await importOriginal<Record<string, unknown>>()),
   openInSafari: safari.open
}));

// Imported after the mock is registered so the component picks up the mocked client.
const { default: ContactsStep } = await import('@/views/dashboard/components/ContactsStep');

const buttonByText = (container: HTMLElement, text: string) =>
   Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);

// The channels are big option cards now (title + badge + subtitle in one button).
const channelCard = (container: HTMLElement, channel: 'Messenger' | 'WhatsApp' | 'Get reminders on WhatsApp') =>
   Array.from(container.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim().startsWith(channel));

const continueButton = (container: HTMLElement) => {
   const btn = buttonByText(container, 'Continue');
   expect(btn).toBeTruthy();
   return btn as HTMLButtonElement;
};

describe('ContactsStep — WhatsApp OR Messenger verified line', () => {
   let container: HTMLDivElement;
   let root: Root;
   let onContinue: ReturnType<typeof vi.fn>;
   let openSpy: ReturnType<typeof vi.fn>;
   const originalUserAgent = navigator.userAgent;

   beforeEach(() => {
      vi.useFakeTimers();
      window.sessionStorage.clear();
      supa.state.usersRow = { whatsapp_verified_at: null, messenger_verified_at: null };
      supa.state.rpcResult = { data: 'MDNG-ABC123', error: null };
      supa.rpc.mockClear();
      supa.invoke.mockClear();
      push.state.isSupported = false;
      push.state.permission = 'unsupported';
      push.state.isSubscribed = false;
      push.enable.mockClear();
      onContinue = vi.fn();
      openSpy = vi.fn();
      vi.stubGlobal('open', openSpy);
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
      vi.useRealTimers();
      Object.defineProperty(navigator, 'userAgent', { value: originalUserAgent, configurable: true });
   });

   const render = async (userId = 'user-1', whatsappEnabled?: boolean, requireReminders?: boolean) => {
      await act(async () => {
         root.render(createElement(ContactsStep, { userId, onBack: vi.fn(), onContinue, whatsappEnabled, requireReminders }));
      });
      // Flush the initial "already verified?" load.
      await act(async () => {
         await Promise.resolve();
      });
   };

   it('keeps Continue disabled until a channel verifies, then enables it after Messenger confirms', async () => {
      await render();
      expect(continueButton(container).disabled).toBe(true);

      const verifyBtn = channelCard(container, 'Messenger');
      expect(verifyBtn).toBeTruthy();
      await act(async () => {
         verifyBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
         await Promise.resolve();
      });

      // Uses the generic starter with the messenger channel, and opens the m.me code link.
      expect(supa.rpc).toHaveBeenCalledWith('start_contact_verification', { p_channel: 'messenger' });
      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(openSpy.mock.calls[0][0]).toContain('m.me');
      expect(openSpy.mock.calls[0][0]).toContain('__mdng_code=MDNG-ABC123');

      // Still disabled until the webhook stamps the column the poll reads.
      expect(continueButton(container).disabled).toBe(true);

      supa.state.usersRow.messenger_verified_at = '2026-09-22T00:00:00Z';
      await act(async () => {
         await vi.advanceTimersByTimeAsync(3100);
      });

      expect(continueButton(container).disabled).toBe(false);
      expect(container.textContent).toContain('Verified');
   });

   it('shows the code to send by hand after a minute, and still requires Facebook to confirm it', async () => {
      await render();
      await act(async () => {
         channelCard(container, 'Messenger')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
         await Promise.resolve();
      });

      // Give the link a fair chance first.
      expect(container.textContent).not.toContain('Not confirmed yet?');

      await act(async () => {
         await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(container.textContent).toContain('Not confirmed yet?');
      expect(container.textContent).toContain('MDNG-ABC123');
      // No way around it: Continue waits for the Page to confirm the typed code.
      expect(continueButton(container).disabled).toBe(true);

      supa.state.usersRow.messenger_verified_at = '2026-09-26T00:00:00Z';
      await act(async () => {
         await vi.advanceTimersByTimeAsync(3100);
      });
      expect(continueButton(container).disabled).toBe(false);
   });

   it('offers the backups a few seconds after they come back from Messenger unconfirmed (no minute-long wait)', async () => {
      const setVisibility = async (state: 'hidden' | 'visible') => {
         Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
         await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'));
            await Promise.resolve();
         });
      };
      await render();
      await act(async () => {
         channelCard(container, 'Messenger')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
         await Promise.resolve();
      });

      // A focus/visibility blip while Messenger is opening doesn't count as a trip.
      await setVisibility('visible');
      await act(async () => {
         await vi.advanceTimersByTimeAsync(1_000);
      });
      expect(container.textContent).not.toContain('Not confirmed yet?');

      // Off to Messenger for a real visit and back, still unconfirmed → backups after the short grace.
      await setVisibility('hidden');
      await act(async () => {
         await vi.advanceTimersByTimeAsync(5_000);
      });
      await setVisibility('visible');
      expect(container.textContent).not.toContain('Not confirmed yet?');
      await act(async () => {
         await vi.advanceTimersByTimeAsync(4_100);
      });
      expect(container.textContent).toContain('Not confirmed yet?');
      expect(container.textContent).toContain('MDNG-ABC123');
      expect(container.textContent).toContain('second try usually works');

      // Tapping "Open Messenger again" in the backups reopens the same coded link.
      const again = Array.from(container.querySelectorAll('button')).filter((b) => b.textContent?.trim() === 'Open Messenger again');
      expect(again.length).toBe(2);
      openSpy.mockClear();
      await act(async () => {
         again[1].click();
      });
      expect(openSpy.mock.calls[0][0]).toContain('__mdng_code=MDNG-ABC123');
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
   });

   const setVisibilityState = async (state: 'hidden' | 'visible') => {
      Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
      await act(async () => {
         document.dispatchEvent(new Event('visibilitychange'));
         await Promise.resolve();
      });
   };
   const tapMessengerCard = async () => {
      await act(async () => {
         channelCard(container, 'Messenger')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
         await Promise.resolve();
      });
   };

   it('shows the backups right away when Messenger never opens (the page never leaves)', async () => {
      await render();
      await tapMessengerCard();
      expect(container.textContent).not.toContain('Not confirmed yet?');
      await act(async () => {
         await vi.advanceTimersByTimeAsync(3_100);
      });
      expect(container.textContent).toContain('Not confirmed yet?');
      expect(container.textContent).toContain('MDNG-ABC123');
   });

   it('shows the backups right away when Messenger flashes open and shut (the Android failure)', async () => {
      await render();
      await tapMessengerCard();
      await setVisibilityState('hidden');
      await act(async () => {
         await vi.advanceTimersByTimeAsync(300);
      });
      await setVisibilityState('visible');
      expect(container.textContent).toContain('Not confirmed yet?');
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
   });

   it('on Android, shows the code and a direct link to our chat instead of opening m.me', async () => {
      Object.defineProperty(navigator, 'userAgent', {
         value: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36',
         configurable: true
      });
      const writeText = vi.fn(async () => undefined);
      vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { clipboard: { writeText } }));
      // jsdom can't navigate; the real link opens Messenger by itself.
      const blockNavigation = (e: Event) => e.preventDefault();
      document.addEventListener('click', blockNavigation, true);
      try {
         await render();
         await tapMessengerCard();
         // Nothing opens on the first tap: m.me never reaches Messenger from Android Chrome.
         expect(openSpy).not.toHaveBeenCalled();
         expect(container.textContent).toContain('MDNG-ABC123');
         const chatLink = Array.from(container.querySelectorAll('a')).find((a) => a.textContent?.includes('Copy code & open Messenger'));
         expect(chatLink?.getAttribute('href')).toBe(MESSENGER_APP_CHAT_LINK);
         expect(chatLink?.getAttribute('target')).toBeNull();
         expect(container.textContent).not.toContain('Open Messenger again');

         await act(async () => {
            chatLink?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            await Promise.resolve();
         });
         expect(writeText).toHaveBeenCalledWith('MDNG-ABC123');
         // The tap time is recorded so the bot can connect them by timing.
         expect(supa.rpc).toHaveBeenCalledWith('mark_messenger_chat_opened');
         expect(JSON.parse(window.sessionStorage.getItem('moodeng.messengerVerifyPending') ?? '{}')).toMatchObject({
            code: 'MDNG-ABC123',
            link: MESSENGER_APP_CHAT_LINK
         });

         // The bot confirms the pasted code → the card flips to Verified.
         supa.state.usersRow.messenger_verified_at = '2026-10-11T03:00:00Z';
         await act(async () => {
            await vi.advanceTimersByTimeAsync(3_100);
         });
         expect(container.textContent).not.toContain('Copy code & open Messenger');
         expect(continueButton(container).disabled).toBe(false);
      } finally {
         document.removeEventListener('click', blockNavigation, true);
      }
   });

   it('iPhone in Facebook: the tap copies the code and shows how to paste it; Safari via ⋯ carries the code', async () => {
      Object.defineProperty(navigator, 'userAgent', {
         value:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 26_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23G83 [FBAN/FBIOS;FBAV/582.0.0.26.106;FBSN/iOS]',
         configurable: true
      });
      // Facebook's iPhone browser refuses the modern copy call; the old command still copies.
      vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { clipboard: { writeText: vi.fn(async () => Promise.reject(new Error('NotAllowedError'))) } }));
      const exec = document.execCommand;
      document.execCommand = vi.fn(() => true);
      safari.open.mockClear();
      await render();
      await tapMessengerCard();

      // No x-safari link (dropped there). Paste is the main step.
      const safariLinks = Array.from(container.querySelectorAll('a')).filter((a) => /^x-safari/.test(a.getAttribute('href') ?? ''));
      expect(safariLinks).toHaveLength(0);
      expect(container.textContent).toContain('MDNG-ABC123');
      expect(container.textContent).toContain('Paste the code in the chat and send it');

      await act(async () => {
         buttonByText(container, 'Copy code & open Messenger')?.click();
         await Promise.resolve();
      });
      expect(document.execCommand).toHaveBeenCalledWith('copy');
      // The paste card: what to do once Messenger opens, then it opens our chat.
      expect(container.textContent).toContain('📋 Code copied: MDNG-ABC123');
      const openLink = Array.from(container.querySelectorAll('a')).find((a) => a.textContent?.includes('Open Messenger'));
      expect(openLink?.getAttribute('href')).toBe(MESSENGER_APP_CHAT_LINK);

      // "Open in Safari" shows the ⋯ steps and puts the code in the address Facebook's menu will open.
      await act(async () => {
         buttonByText(container, 'Or open in Safari instead')?.click();
      });
      expect(safari.open).not.toHaveBeenCalled();
      expect(container.textContent).toContain('Open in external browser');
      expect(new URL(window.location.href).searchParams.get('fbcode')).toBe('MDNG-ABC123');
      document.execCommand = exec;
   });

   it('iPhone in Facebook: says so when the code could not be copied', async () => {
      Object.defineProperty(navigator, 'userAgent', {
         value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23G83 [FBAN/FBIOS;FBSN/iOS]',
         configurable: true
      });
      vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { clipboard: { writeText: vi.fn(async () => Promise.reject(new Error('NotAllowedError'))) } }));
      const exec = document.execCommand;
      document.execCommand = vi.fn(() => false);
      await render();
      await tapMessengerCard();
      await act(async () => {
         buttonByText(container, 'Copy code & open Messenger')?.click();
         await Promise.resolve();
         await Promise.resolve();
      });
      expect(container.textContent).toContain("Copy didn't work here");
      document.execCommand = exec;
   });

   it('Android in Facebook\'s browser: the tap copies the code, shows how to paste it, then opens Messenger', async () => {
      Object.defineProperty(navigator, 'userAgent', {
         value:
            'Mozilla/5.0 (Linux; Android 15; Pixel 7 Build/AP4A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/155.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/540.0.0.0;]',
         configurable: true
      });
      const writeText = vi.fn(async () => undefined);
      vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { clipboard: { writeText } }));
      await render();
      await tapMessengerCard();
      // Paste is the main step here (a returning chatter sends us nothing when the chat opens).
      expect(container.textContent).toContain('Paste the code in the chat and send it');

      {
         await act(async () => {
            buttonByText(container, 'Copy code & open Messenger')?.click();
            await Promise.resolve();
         });
         expect(writeText).toHaveBeenCalledWith('MDNG-ABC123');
         expect(container.textContent).toContain('📋 Code copied: MDNG-ABC123');
         expect(container.textContent).toContain('Open Messenger (3)');
         expect(supa.rpc).not.toHaveBeenCalledWith('mark_messenger_chat_opened');

         // The countdown ends → Messenger opens by itself, and the tap time is recorded for the bot.
         for (let i = 0; i < 3; i += 1) {
            await act(async () => {
               vi.advanceTimersByTime(1000);
            });
         }
         expect(supa.rpc).toHaveBeenCalledWith('mark_messenger_chat_opened');
         const openLink = Array.from(container.querySelectorAll('a')).find((a) => a.textContent?.includes('Open Messenger'));
         expect(openLink?.getAttribute('href')).toBe(MESSENGER_APP_CHAT_LINK);

         // Still on the page 2s later: Facebook ignored it, so ask for a tap.
         await act(async () => {
            vi.advanceTimersByTime(2100);
            await Promise.resolve();
         });
         expect(container.textContent).toContain('Tap to open Messenger');
      }
   });

   it('picks the attempt back up, with the code showing, after an Android fallback left the page', async () => {
      window.sessionStorage.setItem(
         'moodeng.messengerVerifyPending',
         JSON.stringify({ userId: 'user-1', code: 'MDNG-ABC123', link: buildMessengerVerifyLink('MDNG-ABC123'), at: Date.now() })
      );
      await render();
      expect(container.textContent).toContain('Not confirmed yet?');
      expect(container.textContent).toContain('MDNG-ABC123');
   });

   it('does not show the backups when the bot confirms them while they were away', async () => {
      await render();
      await act(async () => {
         channelCard(container, 'Messenger')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
         await Promise.resolve();
      });
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      await act(async () => {
         document.dispatchEvent(new Event('visibilitychange'));
      });
      supa.state.usersRow.messenger_verified_at = '2026-09-29T07:23:00Z';
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      await act(async () => {
         document.dispatchEvent(new Event('visibilitychange'));
         await Promise.resolve();
      });
      await act(async () => {
         await vi.advanceTimersByTimeAsync(4_100);
      });
      expect(container.textContent).not.toContain('Not confirmed yet?');
      expect(continueButton(container).disabled).toBe(false);
   });

   it('does not let a verified WhatsApp stand in for Facebook (Facebook is required)', async () => {
      supa.state.usersRow.whatsapp_verified_at = '2026-09-01T00:00:00Z';
      await render();
      expect(continueButton(container).disabled).toBe(true);
   });

   it('calls onContinue when Continue is clicked after a channel is verified', async () => {
      supa.state.usersRow.messenger_verified_at = '2026-09-01T00:00:00Z';
      await render();
      await act(async () => {
         continueButton(container).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(onContinue).toHaveBeenCalledTimes(1);
   });

   it('lets them continue when notifications are blocked in the browser, and says how to unblock', async () => {
      // Chrome won't ask again once someone tapped Block, so requiring reminders was a dead end.
      push.state.isSupported = true;
      push.state.permission = 'denied';
      supa.state.usersRow = { whatsapp_verified_at: null, messenger_verified_at: '2026-10-13T00:00:00Z' };
      await render();
      expect(continueButton(container).disabled).toBe(false);
      expect(container.textContent).not.toContain('Turn on reminders to continue.');
      expect(container.textContent).toContain('Blocked in your browser');
      expect(container.textContent).toContain('Optional');

      // Tapping the card opens the picture guide instead of a tap that can only fail.
      const remindersCard = Array.from(container.querySelectorAll('button')).find((b) =>
         (b.textContent ?? '').includes('Turn on reminders')
      );
      await act(async () => {
         remindersCard?.click();
      });
      expect(container.querySelector('[aria-labelledby="unblock-guide-title"]')).not.toBeNull();
      expect(container.textContent).toContain('Switch it to Allow');
      expect(push.enable).not.toHaveBeenCalled();
      expect(supa.invoke).toHaveBeenCalledWith('messenger-stuck-alerts', { body: expect.objectContaining({ reminders: true, reason: 'blocked' }) });
   });

   it('requires reminders on a push-capable device: Continue stays off until they are turned on', async () => {
      push.state.isSupported = true;
      push.state.permission = 'default';
      supa.state.usersRow = { whatsapp_verified_at: null, messenger_verified_at: '2026-09-25T00:00:00Z' };
      await render();
      expect(continueButton(container).disabled).toBe(true);
      expect(container.textContent).toContain('Turn on reminders to continue.');

      const remindersCard = Array.from(container.querySelectorAll('button')).find((b) =>
         (b.textContent ?? '').includes('Turn on reminders')
      );
      await act(async () => {
         remindersCard?.click();
      });
      expect(push.enable).toHaveBeenCalledTimes(1);
      await render();
      expect(continueButton(container).disabled).toBe(false);
   });

   it('stops requiring reminders after they fail twice on a phone that cannot subscribe', async () => {
      push.state.isSupported = true;
      push.state.permission = 'granted';
      push.enable.mockImplementationOnce(async () => 'failed').mockImplementationOnce(async () => 'failed');
      supa.state.usersRow = { whatsapp_verified_at: null, messenger_verified_at: '2026-09-25T00:00:00Z' };
      await render();
      const remindersCard = () =>
         Array.from(container.querySelectorAll('button')).find((b) => (b.textContent ?? '').includes('Turn on reminders'));

      await act(async () => {
         remindersCard()?.click();
      });
      expect(continueButton(container).disabled).toBe(true);
      expect(container.textContent).toContain("Couldn't turn on reminders");

      await act(async () => {
         remindersCard()?.click();
      });
      expect(push.enable).toHaveBeenCalledTimes(2);
      expect(continueButton(container).disabled).toBe(false);
      expect(container.textContent).toContain('Not working on this phone');
      expect(container.textContent).not.toContain('Turn on reminders to continue.');
      // The bot tells them how to fix it in Chrome/Safari, and the team hears about it.
      expect(supa.invoke).toHaveBeenCalledWith('messenger-stuck-alerts', { body: expect.objectContaining({ reminders: true, reason: 'failed', failures: 2 }) });
   });

   it('does not block an iPhone-Safari borrower, and shows no Home Screen instructions', async () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
      supa.state.usersRow = { whatsapp_verified_at: null, messenger_verified_at: '2026-09-25T00:00:00Z' };
      await render();
      expect(continueButton(container).disabled).toBe(false);
      // The old "In Safari, tap Share → Add to Home Screen" box read like a scam and made people stop.
      expect(container.textContent).not.toContain('Add to Home Screen');
      expect(container.textContent).not.toContain('Safari');
   });

   it('does not block a Facebook in-app-browser borrower, and shows no browser instructions', async () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/450.0]';
      Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
      supa.state.usersRow = { whatsapp_verified_at: null, messenger_verified_at: '2026-09-25T00:00:00Z' };
      await render();
      expect(continueButton(container).disabled).toBe(false);
      expect(container.textContent).not.toContain('Open in Safari');
      expect(container.textContent).not.toContain('Add to Home Screen');
   });

   it('hides WhatsApp by default (Facebook first) and offers only Messenger', async () => {
      await render();
      expect(channelCard(container, 'WhatsApp')).toBeUndefined();
      expect(channelCard(container, 'Messenger')).toBeTruthy();
      expect(container.textContent).not.toContain('(one option)');
   });

   it('does not show the old WhatsApp contact card to a borrower who verified WhatsApp before', async () => {
      supa.state.usersRow.whatsapp_verified_at = '2026-09-01T00:00:00Z';
      await render();
      expect(channelCard(container, 'WhatsApp')).toBeUndefined();
   });

   it('locks "Turn on reminders" as step 2 until Facebook is connected, then unlocks it', async () => {
      push.state.isSupported = true;
      push.state.permission = 'default';
      await render();
      expect(container.textContent).toContain('Step 2 · Payment reminders');
      expect(container.textContent).toContain('Unlocks after step 1');
      expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent?.includes('Turn on reminders'))).toBe(false);
   });

   it('shows the reminders button itself once Facebook is connected', async () => {
      push.state.isSupported = true;
      push.state.permission = 'default';
      supa.state.usersRow.messenger_verified_at = '2026-09-25T00:00:00Z';
      await render();
      expect(container.textContent).toContain('Step 1 ✓ · Connect Facebook');
      expect(container.textContent).not.toContain('Unlocks after step 1');
      expect(container.textContent).toContain('Turn on reminders');
   });

   it('shows no step numbers when there is no reminders step', async () => {
      await render();
      expect(container.textContent).not.toContain('Step 1');
   });

   describe('WhatsApp reminders (where notifications can\'t work)', () => {
      const remindersOn = () =>
         supa.rpc.mockImplementation(async (name: string) =>
            name === 'get_whatsapp_reminders_enabled' ? { data: true, error: null } : supa.state.rpcResult
         );
      afterEach(() => supa.rpc.mockImplementation(async () => supa.state.rpcResult));

      it('offers WhatsApp reminders when the switch is on and push is unsupported', async () => {
         remindersOn();
         supa.state.usersRow.messenger_verified_at = '2026-09-25T00:00:00Z';
         await render();
         expect(container.textContent).toContain('Get reminders on WhatsApp');
         // Recommended, not required: Facebook alone still lets them through.
         expect(continueButton(container).disabled).toBe(false);
      });

      it('shows Step 1 / Step 2 with WhatsApp locked until Facebook is connected', async () => {
         remindersOn();
         await render();
         expect(container.textContent).toContain('Step 1 · Connect Facebook');
         expect(container.textContent).toContain('Step 2 · Payment reminders');
         expect(container.textContent).toContain('Unlocks after step 1');
         expect(channelCard(container, 'Get reminders on WhatsApp')).toBeUndefined();
         expect(container.textContent).toContain('Connect Facebook to continue.');
      });

      it('shows nothing about WhatsApp reminders while the switch is off', async () => {
         supa.state.usersRow.messenger_verified_at = '2026-09-25T00:00:00Z';
         await render();
         expect(container.textContent).not.toContain('Get reminders on WhatsApp');
      });

      it('does not offer WhatsApp when push works', async () => {
         remindersOn();
         push.state.isSupported = true;
         push.state.permission = 'granted';
         push.state.isSubscribed = true;
         supa.state.usersRow.messenger_verified_at = '2026-09-25T00:00:00Z';
         await render();
         expect(container.textContent).not.toContain('Get reminders on WhatsApp');
      });

      it('tapping it starts a WhatsApp code and shows it with an Open WhatsApp link (nothing opens by itself)', async () => {
         remindersOn();
         supa.state.usersRow.messenger_verified_at = '2026-09-25T00:00:00Z';
         await render();
         const card = channelCard(container, 'Get reminders on WhatsApp');
         await act(async () => {
            card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await Promise.resolve();
            await Promise.resolve();
         });
         expect(supa.rpc).toHaveBeenCalledWith('start_whatsapp_verification');
         // Nothing opens by itself (Facebook's browser shows the wa.me web page instead of the app):
         // the panel's button is a real link they tap.
         expect(openSpy.mock.calls.some((call) => String(call[0]).includes('wa.me'))).toBe(false);
         const waLink = Array.from(container.querySelectorAll('a')).find((a) => a.textContent?.includes('Open WhatsApp and hit send'));
         expect(waLink?.getAttribute('href')).toContain('wa.me/66951659077');
         expect(container.textContent).toContain('MDNG-ABC123');
         expect(container.textContent).toContain('+66 95 165 9077');
      });

      describe('required (only email reaches them)', () => {
         it('push can’t work: Continue stays locked until WhatsApp is on, and the card says Required', async () => {
            remindersOn();
            supa.state.usersRow.messenger_verified_at = '2026-09-25T00:00:00Z';
            await render('user-1', undefined, true);
            expect(continueButton(container).disabled).toBe(true);
            expect(channelCard(container, 'Get reminders on WhatsApp')?.textContent).toContain('Required');
            expect(container.textContent).toContain('Turn on WhatsApp reminders to continue.');
         });

         it('"I don’t have WhatsApp" lets them through', async () => {
            remindersOn();
            supa.state.usersRow.messenger_verified_at = '2026-09-25T00:00:00Z';
            await render('user-1', undefined, true);
            await act(async () => {
               buttonByText(container, "I don't have WhatsApp")?.click();
            });
            expect(continueButton(container).disabled).toBe(false);
            expect(container.textContent).not.toContain('Turn on WhatsApp reminders to continue.');
         });

         it('an old WhatsApp confirmation (sent STOP, or never linked) doesn’t count', async () => {
            remindersOn();
            supa.state.usersRow.messenger_verified_at = '2026-09-25T00:00:00Z';
            supa.state.usersRow.whatsapp_verified_at = '2026-09-21T00:00:00Z';
            await render('user-1', undefined, true);
            expect(continueButton(container).disabled).toBe(true);
            expect(container.textContent).toContain('Get reminders on WhatsApp');
         });

         it('push works on this phone: push is required as before, no WhatsApp', async () => {
            remindersOn();
            push.state.isSupported = true;
            push.state.permission = 'default';
            supa.state.usersRow.messenger_verified_at = '2026-09-25T00:00:00Z';
            await render('user-1', undefined, true);
            expect(continueButton(container).disabled).toBe(true);
            expect(container.textContent).toContain('Turn on reminders to continue.');
            expect(container.textContent).not.toContain('Get reminders on WhatsApp');
         });

         it('WhatsApp card switched off: nothing to require, Facebook is enough', async () => {
            supa.state.usersRow.messenger_verified_at = '2026-09-25T00:00:00Z';
            await render('user-1', undefined, true);
            expect(continueButton(container).disabled).toBe(false);
         });
      });

      it('shows WhatsApp reminders as on once verified', async () => {
         remindersOn();
         supa.state.usersRow.messenger_verified_at = '2026-09-25T00:00:00Z';
         supa.state.usersRow.whatsapp_verified_at = '2026-10-16T00:00:00Z';
         await render();
         expect(container.textContent).toContain('WhatsApp reminders');
         expect(container.textContent).not.toContain('Get reminders on WhatsApp');
      });
   });

   it('WhatsApp button keeps the original RPC entry point and opens a wa.me link', async () => {
      await render('user-1', true);
      const verifyBtn = channelCard(container, 'WhatsApp');
      await act(async () => {
         verifyBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
         await Promise.resolve();
      });
      expect(supa.rpc).toHaveBeenCalledWith('start_whatsapp_verification');
      expect(openSpy.mock.calls[0][0]).toContain('wa.me');
   });
   it('shows a custom intro (the existing-borrower ask) in place of the default line', async () => {
      await act(async () => {
         root.render(
            createElement(ContactsStep, {
               userId: 'user-1',
               onBack: vi.fn(),
               onContinue,
               intro: createElement('p', null, 'So we can help you more — $10 referral program')
            })
         );
      });
      expect(container.textContent).toContain('$10 referral program');
      expect(container.textContent).not.toContain('like withdrawing, or extending a loan');
   });

   it('shows a live "Confirming on Messenger" state after the borrower taps Messenger', async () => {
      await render();
      await act(async () => {
         channelCard(container, 'Messenger')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
         await Promise.resolve();
      });
      // The wait now reads as active work (with a reopen affordance), not a frozen "Waiting…".
      expect(container.textContent).toContain('Confirming on Messenger');
      expect(container.textContent).toContain('Open Messenger again');
   });

   it('disables Continue and shows "Submitting…" while the request is posting', async () => {
      supa.state.usersRow = { whatsapp_verified_at: null, messenger_verified_at: '2026-09-25T00:00:00Z' };
      await act(async () => {
         root.render(createElement(ContactsStep, { userId: 'user-1', onBack: vi.fn(), onContinue, isSubmitting: true }));
      });
      await act(async () => {
         await Promise.resolve();
      });
      const btn = buttonByText(container, 'Submitting…');
      expect(btn).toBeTruthy();
      expect((btn as HTMLButtonElement).disabled).toBe(true);
   });
});

describe('contact verification link builders', () => {
   it('builds a wa.me link with the code in the prefilled text', () => {
      const link = buildWhatsAppVerifyLink('MDNG-ABC123');
      expect(link.startsWith('https://wa.me/')).toBe(true);
      expect(decodeURIComponent(link)).toContain('MDNG-ABC123');
   });

   it('builds an m.me link that launches the SendPulse flow with the code as mdng_code', () => {
      const link = buildMessengerVerifyLink('MDNG-ABC123');
      // SendPulse's format: ref={flow_id}__{variable}={value}, unencoded.
      expect(link).toMatch(/^https:\/\/m\.me\/\d+\?ref=[0-9a-f-]{36}__mdng_code=MDNG-ABC123$/);
   });
});
