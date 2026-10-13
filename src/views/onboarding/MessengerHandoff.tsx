import { useEffect, useMemo, useState } from 'react';

import { Facebook } from 'lucide-react';
import posthog from 'posthog-js';
import { useParams } from 'react-router-dom';

import { buildMessengerVerifyLink, isAndroidBrowser, MESSENGER_APP_CHAT_LINK, MESSENGER_CODE_PATTERN } from '@/config/contactVerification';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// moodeng.app/fb/<code> — what the desktop Messenger QR (DesktopMessengerCard) opens on the borrower's
// phone. No sign-in: the one-time code is the key, exactly as when they send it to the Page by hand.
// Each phone gets the way into Messenger that works there:
//   * iPhone — a tapped m.me link with the code attached; Messenger confirms them by itself.
//   * Android — m.me never reaches the Messenger app from the browser, so our chat opens without the
//     code, exactly like the in-app Android button: the tap is stamped by code (no sign-in here) and the
//     bot connects them by timing when they say hi; pasting the code (already copied) is the backup.
// The computer's card turns green on its own once the bot confirms.

type Phone = 'ios' | 'android' | 'other';

const detectPhone = (): Phone => {
   if (isAndroidBrowser()) return 'android';
   if (/iphone|ipad|ipod/i.test(navigator.userAgent) || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1))
      return 'ios';
   return 'other';
};

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
   const valid = MESSENGER_CODE_PATTERN.test(code);
   const phone = useMemo(detectPhone, []);
   const [copied, setCopied] = useState(false);

   useEffect(() => {
      // Never the code itself: it's a one-time key.
      track('messenger_handoff_opened', { phone, valid });
   }, [phone, valid]);

   const copy = async () => {
      try {
         await navigator.clipboard.writeText(code);
         setCopied(true);
         window.setTimeout(() => setCopied(false), 2000);
      } catch {
         // Clipboard blocked: the code is on screen to type.
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
            <img alt="" className="h-28 w-auto" src="/hippos/connect/hello.png" />
            {!valid ? (
               <>
                  <h1 className="text-[24px] font-extrabold leading-[30px] text-[#26143f]">This link doesn&apos;t look right</h1>
                  <p className="text-[16px] leading-[22px] text-[#594d65]">
                     Go back to Moodeng on your computer and tap <b>Connect Messenger</b> again for a new code.
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
                     Then look at your computer — Moodeng turns green on its own.
                  </p>
               </>
            )}
         </div>
      </div>
   );
}
