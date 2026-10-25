import { useEffect, useMemo, useState } from 'react';

import { Facebook } from 'lucide-react';
import posthog from 'posthog-js';
import { useParams, useSearchParams } from 'react-router-dom';

import { clarityEvent } from '@/lib/analytics/clarity';
import { buildMessengerVerifyLink, isAndroidBrowser, MESSENGER_APP_CHAT_LINK, MESSENGER_CODE_PATTERN } from '@/config/contactVerification';
import { copyTextFromTap } from '@/lib/inAppHandoff';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// moodeng.app/fb/<code> — what the desktop Messenger QR (DesktopMessengerCard) opens on the borrower's
// phone. No sign-in: the one-time code is the key, exactly as when they send it to the Page by hand.
// Each phone gets the way into Messenger that works there:
//   * iPhone — a tapped m.me link with the code attached; Messenger confirms them by itself.
//   * Android — m.me never reaches the Messenger app from the browser, so our chat opens without the
//     code, exactly like the in-app Android button: the tap is stamped by code (no sign-in here) and the
//     bot connects them by timing when they say hi; pasting the code (already copied) is the backup.
// The computer's card turns green on its own once the bot confirms. ?from=fb is the same page opened in
// Safari from Facebook's iPhone browser (ContactsStep), where Messenger can't be opened: wording says
// Facebook instead of computer.

type Phone = 'ios' | 'android' | 'other';

const detectPhone = (): Phone => {
   if (isAndroidBrowser()) return 'android';
   if (/iphone|ipad|ipod/i.test(navigator.userAgent) || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1))
      return 'ios';
   return 'other';
};

const POLL_EVERY_MS = 3000;
const POLL_FOR_MS = 30 * 60 * 1000;

const track = (event: string, properties: Record<string, unknown>) => {
   try {
      posthog.capture(event, properties);
   } catch {
      // Analytics unavailable — the page works the same.
   }
};

export default function MessengerHandoff() {
   const { code: rawCode = '' } = useParams<{ code: string }>();
   const code = rawCode.trim().toUpperCase();
   const [searchParams] = useSearchParams();
   const fromFacebook = searchParams.get('from') === 'fb';
   const where = fromFacebook ? 'in Facebook' : 'on your computer';
   const valid = MESSENGER_CODE_PATTERN.test(code);
   const phone = useMemo(detectPhone, []);
   const [copied, setCopied] = useState(false);
   const [connected, setConnected] = useState(false);

   useEffect(() => {
      // Never the code itself: it's a one-time key.
      track('messenger_handoff_opened', { phone, valid });
   }, [phone, valid]);

   // "✓ Connected" right here once the bot confirms, so they don't have to check the laptop. Asks every
   // few seconds while this page is showing (phones pause it while they're in Messenger) and the moment
   // they come back to it. Stops after half an hour, when the code would have expired anyway.
   useEffect(() => {
      if (!valid || connected) return undefined;
      let stopped = false;
      const startedAt = Date.now();
      const check = async () => {
         if (stopped || document.visibilityState !== 'visible' || Date.now() - startedAt > POLL_FOR_MS) return;
         const { data } = await getSupabaseBrowserClient().rpc('messenger_code_verified', { p_code: code });
         if (!stopped && data === true) {
            setConnected(true);
            clarityEvent('messenger_connected');
            track('messenger_handoff_connected', { phone, seconds_on_page: Math.round((Date.now() - startedAt) / 1000) });
         }
      };
      void check();
      const timer = window.setInterval(() => void check(), POLL_EVERY_MS);
      document.addEventListener('visibilitychange', check);
      window.addEventListener('focus', check);
      return () => {
         stopped = true;
         window.clearInterval(timer);
         document.removeEventListener('visibilitychange', check);
         window.removeEventListener('focus', check);
      };
   }, [valid, connected, code, phone]);

   const copy = async () => {
      // Straight from the tap; when nothing could be copied, the code is on screen to type.
      const result = await copyTextFromTap(code);
      if (result.ok) {
         setCopied(true);
         window.setTimeout(() => setCopied(false), 2000);
      }
   };

   // Android: like the in-app Android button — copy the code and stamp the tap time, so the bot can
   // connect them by timing when they only say hi (sendpulse-events). Best-effort: the code still works.
   const openAndroidChat = () => {
      track('messenger_handoff_open_tapped', { phone });
      void copy();
      void getSupabaseBrowserClient()
         .rpc('mark_messenger_chat_opened_by_code', { p_code: code })
         .then(({ error }) => {
            if (error) console.error('mark_messenger_chat_opened_by_code failed', error.message);
         });
   };

   return (
      <div className="connect-ui flex min-h-screen items-start justify-center bg-gradient-to-b from-[#fbfafd] to-white px-4 pt-10 dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f]">
         <div className="flex w-full max-w-[400px] flex-col items-center gap-4 text-center">
            <img alt="" className="h-28 w-auto" src={connected ? '/hippos/connect/approved.png' : '/hippos/connect/hello.png'} />
            {connected ? (
               <>
                  <h1 className="text-[26px] font-extrabold leading-[32px] text-[#1f7a3d]">✓ Connected!</h1>
                  <p className="text-[16px] leading-[22px] text-[#594d65]">
                     Your Messenger is linked. Go back to Moodeng {where} to continue.
                  </p>
                  {fromFacebook && phone === 'ios' ? (
                     <p className="text-[15px] leading-[21px] text-[#594d65]">
                        To go back, swipe right along the bottom edge of the screen, or tap <b>◀ Facebook</b> at the top left.
                     </p>
                  ) : null}
               </>
            ) : !valid ? (
               <>
                  <h1 className="text-[24px] font-extrabold leading-[30px] text-[#26143f]">This link doesn&apos;t look right</h1>
                  <p className="text-[16px] leading-[22px] text-[#594d65]">
                     Go back to Moodeng {where} and tap <b>Connect Messenger</b> again for a new code.
                  </p>
               </>
            ) : (
               <>
                  <h1 className="text-[24px] font-extrabold leading-[30px] text-[#26143f]">Connect on Messenger</h1>
                  {phone === 'android' ? (
                     <>
                        <p className="text-[16px] leading-[22px] text-[#594d65]">
                           Tap the button. Our chat opens in Messenger — tap <b>Get Started</b> or say hi, and you&apos;re connected.
                        </p>
                        <a
                           className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-[#0866FF] px-4 text-[17px] font-bold text-white"
                           href={MESSENGER_APP_CHAT_LINK}
                           onClick={openAndroidChat}
                        >
                           <Facebook aria-hidden="true" className="size-5" strokeWidth={2.5} />
                           Open Messenger
                        </a>
                        <p className="text-[14px] leading-[19px] text-[#877897]">
                           Not green after a minute? Paste this code in the chat (we copied it for you) and send it:
                        </p>
                        <div className="flex w-full items-center gap-2">
                           <code className="flex-1 rounded-xl bg-[#f6f2ff] px-3 py-3 text-[22px] font-bold tracking-wide text-[#26143f]">
                              {code}
                           </code>
                           <button
                              className="rounded-xl border border-[#c9bdf5] bg-white px-4 py-3 text-[14px] font-bold text-[#6b55f7]"
                              onClick={() => void copy()}
                              type="button"
                           >
                              {copied ? 'Copied' : 'Copy'}
                           </button>
                        </div>
                        <p className="text-[14px] leading-[19px] text-[#877897]">
                           No Messenger app? Open Facebook, search <b>Moodeng Credit</b>, tap Message, and send the code there.
                        </p>
                     </>
                  ) : (
                     <>
                        <p className="text-[16px] leading-[22px] text-[#594d65]">
                           Tap the button. Messenger opens and connects you — tap <b>Get Started</b> if it asks.
                        </p>
                        <a
                           className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-[#0866FF] px-4 text-[17px] font-bold text-white"
                           href={buildMessengerVerifyLink(code)}
                           onClick={() => track('messenger_handoff_open_tapped', { phone })}
                        >
                           <Facebook aria-hidden="true" className="size-5" strokeWidth={2.5} />
                           Open Messenger
                        </a>
                        <p className="text-[14px] leading-[19px] text-[#877897]">
                           Didn&apos;t work? Send this code to <b>Moodeng Credit</b> on Messenger:{' '}
                           <button
                              className="font-bold text-[#6b55f7] underline underline-offset-4"
                              onClick={() => void copy()}
                              type="button"
                           >
                              {code}
                           </button>
                           {copied ? ' (copied)' : ''}
                        </p>
                     </>
                  )}
                  <p className="mt-2 rounded-2xl bg-[#e9f8ee] px-4 py-3 dark:bg-[#12301e] text-[15px] font-semibold leading-[20px] text-[#1f7a3d]">
                     Then go back to Moodeng {where} — it turns green on its own.
                  </p>
               </>
            )}
         </div>
      </div>
   );
}
