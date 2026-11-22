import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { EXTERNAL_LINKS } from '@/config/externalLinks';
import { buildAndroidIntentUrl } from '@/lib/inAppBrowser';
import { copyTextFromTap } from '@/lib/inAppHandoff';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { GhostButton } from '@/views/dashboard/components/connectKit';

// Facebook / Messenger on Android often has no permission to the phone's photos: tapping a file input
// shows "Please allow all media to use file chooser" and nothing opens (George's borrower screenshot,
// 2026-11-21; PostHog showed the same person tapping "Add my proof" 8 times over 3 visits). The camera
// still works there. So we notice when the picker didn't open and offer a way out.

/** An in-app browser on Android (Facebook, Messenger, TikTok… — "; wv)" is Android's WebView). Pure. */
export const isMetaAndroid = (ua: string) =>
   /Android/i.test(ua) && (/(FBAN|FBAV|FB_IAB|FB4A|Messenger|MESSENGER|Orca)/i.test(ua) || /; wv\)/.test(ua));

/**
 * Opens a file input and reports if nothing opened: when a real picker opens, the page loses focus
 * (blur / hidden) within a moment; when Messenger blocks it, nothing happens.
 */
export function usePickerWatch() {
   const [blocked, setBlocked] = useState(false);
   // True for the moment we wait to see if the picker opened (the button shows a spinner).
   const [checking, setChecking] = useState(false);
   const timer = useRef<number | null>(null);
   const open = useCallback((input: HTMLInputElement | null) => {
      if (!input) return;
      let left = false;
      setChecking(true);
      const onLeave = () => {
         left = true;
         setChecking(false);
      };
      window.addEventListener('blur', onLeave, { once: true });
      document.addEventListener('visibilitychange', onLeave, { once: true });
      input.click();
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
         window.removeEventListener('blur', onLeave);
         document.removeEventListener('visibilitychange', onLeave);
         setChecking(false);
         if (!left && document.hasFocus()) setBlocked(true);
      }, 1500);
   }, []);
   return { blocked, setBlocked, open, checking };
}

/** "I'll send it in Messenger": the server then picks up their chat photos as proof for 2 days (messengerPhotoIntake.ts). */
export const expectMessengerPhotos = async () => {
   try {
      await getSupabaseBrowserClient().rpc('request_messenger_photo_intake');
   } catch {
      // not signed in yet (pre-screening link): a pre-screening sent without proof is picked up anyway
   }
};

/** What they send in our Messenger chat so the bot asks for the photo (sendpulse-events → handleProofKeyword). */
export const PROOF_WORD = 'PROOF';
// Same as /documents: Android Chrome can't open m.me links, so Android opens the chat on messenger.com.
const messengerProofHref = () =>
   typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
      ? EXTERNAL_LINKS.support.messengerLoginCodeAndroid
      : EXTERNAL_LINKS.support.messengerProof;

/** How long we ask them to take to send it on Messenger (the server keeps picking photos up for 2 days anyway). */
export const MESSENGER_SEND_MINUTES = 20;
const UNTIL_KEY = 'moodeng_messenger_proof_until';

/** Seconds left of the 20 minutes; the deadline survives a reload / coming back from Messenger. */
function useSendCountdown() {
   const until = useMemo(() => {
      try {
         const saved = Number(window.localStorage.getItem(UNTIL_KEY));
         if (saved > Date.now()) return saved;
      } catch {
         // storage blocked: the timer just starts fresh
      }
      const next = Date.now() + MESSENGER_SEND_MINUTES * 60_000;
      try {
         window.localStorage.setItem(UNTIL_KEY, String(next));
      } catch {
         // fine without it
      }
      return next;
   }, []);
   const [now, setNow] = useState(() => Date.now());
   useEffect(() => {
      const t = window.setInterval(() => setNow(Date.now()), 1000);
      return () => window.clearInterval(t);
   }, []);
   return Math.max(0, Math.round((until - now) / 1000));
}

function CountdownRing({ secondsLeft }: { secondsLeft: number }) {
   const total = MESSENGER_SEND_MINUTES * 60;
   const r = 34;
   const c = 2 * Math.PI * r;
   const mm = Math.floor(secondsLeft / 60);
   const ss = String(secondsLeft % 60).padStart(2, '0');
   return (
      <div className="relative grid size-[84px] shrink-0 place-items-center">
         <svg aria-hidden="true" className="absolute inset-0 -rotate-90" viewBox="0 0 84 84">
            <circle
               cx="42"
               cy="42"
               fill="none"
               r={r}
               stroke="currentColor"
               strokeWidth="7"
               className="text-[#efe7c9] dark:text-[#4a3d1c]"
            />
            <circle
               cx="42"
               cy="42"
               fill="none"
               r={r}
               stroke="#6b55f7"
               strokeDasharray={c}
               strokeDashoffset={c * (1 - secondsLeft / total)}
               strokeLinecap="round"
               strokeWidth="7"
               style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
         </svg>
         <span className="text-[18px] font-black tabular-nums text-[#3b2f4a] dark:text-[#f5f0ff]">{`${mm}:${ss}`}</span>
      </div>
   );
}

/** Messenger-first help: one button to the chat, a 20-minute countdown, the rest tucked away. */
function MessengerFirstHelp({ onCamera, onSkip, skipLabel }: { onCamera: () => void; onSkip?: () => void; skipLabel?: string }) {
   const meta = typeof navigator !== 'undefined' && isMetaAndroid(navigator.userAgent);
   const [messengerChosen, setMessengerChosen] = useState(false);
   const secondsLeft = useSendCountdown();
   return (
      <div className="flex flex-col gap-3 rounded-[16px] border-2 border-[#f5c46b] bg-[#fff8e8] px-4 py-4 dark:border-[#6b5420] dark:bg-[#2e2512]">
         <div className="flex items-center gap-3">
            <CountdownRing secondsLeft={secondsLeft} />
            <div className="flex flex-col gap-1">
               <p className="text-[17px] font-black leading-[22px] text-[#5a4300] dark:text-[#f3dfa8]">Photos are blocked here 🙈</p>
               <p className="text-[14px] leading-[19px] text-[#5a4300] dark:text-[#f3dfa8]">
                  {secondsLeft > 0 ? (
                     <>
                        Send it on <b>Messenger</b> in the next {MESSENGER_SEND_MINUTES} minutes.
                     </>
                  ) : (
                     <>Still send it on Messenger. We’ll check it when it comes.</>
                  )}
               </p>
            </div>
         </div>
         {/* A real link (iOS opens Messenger in place only from a tap on <a>). PROOF is copied on tap: sending it
             is a message from them, so the bot may answer right away (a link tap alone isn't). */}
         <a
            className="flex items-center justify-center gap-2 rounded-[14px] bg-[#6b55f7] px-4 py-3.5 text-[17px] font-bold text-white"
            href={messengerProofHref()}
            onClick={() => {
               void copyTextFromTap(PROOF_WORD);
               void expectMessengerPhotos();
               setMessengerChosen(true);
            }}
            rel="noreferrer"
            target="_blank"
         >
            💬 Send it on Messenger
         </a>
         <p className="text-center text-[14px] leading-[20px] text-[#5a4300] dark:text-[#f3dfa8]">
            Send <b className="rounded bg-white px-1.5 py-0.5 font-black tracking-wide dark:bg-black/30">{PROOF_WORD}</b>, then your photo
            📎
         </p>
         {messengerChosen ? (
            <p className="rounded-[12px] bg-white/70 px-3 py-2 text-[13px] leading-[19px] text-[#5a4300] dark:bg-black/20 dark:text-[#f3dfa8]">
               <b>Chat didn’t open?</b> Open the <b>Messenger</b> app, search <b>Moodeng Credit</b>, send <b>{PROOF_WORD}</b>, then your
               photo.
            </p>
         ) : null}
         <button
            className="text-center text-[14px] font-semibold text-[#6b55f7] underline dark:text-[#b4a6ff]"
            onClick={onCamera}
            type="button"
         >
            📷 Or take a photo of it instead
         </button>
         {meta ? (
            <details className="rounded-[12px] bg-white/70 px-3 py-2 text-[14px] leading-[20px] text-[#5a4300] dark:bg-black/20 dark:text-[#f3dfa8]">
               <summary className="cursor-pointer font-semibold">Or let Messenger use your photos</summary>
               <p className="mt-1">
                  Phone <b>Settings</b> → <b>Apps</b> → <b>Messenger</b> → <b>Permissions</b> → <b>Photos and videos</b> → <b>Allow all</b>.
                  Then come back and tap again.
               </p>
               <a
                  className="mt-1 block font-semibold text-[#7661f9] underline"
                  href={typeof window !== 'undefined' ? buildAndroidIntentUrl(window.location.href) : '#'}
               >
                  Or open this page in Chrome (you may need to sign in again)
               </a>
            </details>
         ) : null}
         {onSkip ? <GhostButton onClick={onSkip}>{skipLabel ?? 'Skip for now'}</GhostButton> : null}
      </div>
   );
}

/** What to do when the file picker won't open. */
export function PickerHelp({
   onCamera,
   onSkip,
   skipLabel,
   messenger
}: {
   onCamera: () => void;
   onSkip?: () => void;
   skipLabel?: string;
   /** Messenger first: "Send it on Messenger" + a 20-minute countdown (the server picks the photos up automatically). */
   messenger?: boolean;
}) {
   const meta = typeof navigator !== 'undefined' && isMetaAndroid(navigator.userAgent);
   if (messenger) return <MessengerFirstHelp onCamera={onCamera} onSkip={onSkip} skipLabel={skipLabel} />;
   return (
      <div className="flex flex-col gap-3 rounded-[16px] border-2 border-[#f5c46b] bg-[#fff8e8] px-4 py-4 dark:border-[#6b5420] dark:bg-[#2e2512]">
         <p className="text-[16px] font-bold text-[#5a4300] dark:text-[#f3dfa8]">Can’t open your photos? No problem 🙂</p>
         <button className="rounded-[14px] bg-[#6b55f7] px-4 py-3 text-[16px] font-bold text-white" onClick={onCamera} type="button">
            📷 Take a photo of it instead
         </button>
         <p className="-mt-1 text-[13px] text-[#7a6420] dark:text-[#d9c58a]">
            Like your payslip on paper, or your GCash screen on another phone.
         </p>
         {meta ? (
            <div className="rounded-[12px] bg-white/70 px-3 py-2 text-[14px] leading-[20px] text-[#5a4300] dark:bg-black/20 dark:text-[#f3dfa8]">
               <b>Or let Messenger use your photos:</b>
               <br />
               Phone <b>Settings</b> → <b>Apps</b> → <b>Messenger</b> → <b>Permissions</b> → <b>Photos and videos</b> → <b>Allow all</b>.
               Then come back and tap again.
            </div>
         ) : null}
         {meta ? (
            <a
               className="text-center text-[14px] font-semibold text-[#7661f9] underline"
               href={typeof window !== 'undefined' ? buildAndroidIntentUrl(window.location.href) : '#'}
            >
               Or open this page in Chrome (you may need to sign in again)
            </a>
         ) : null}
         {onSkip ? <GhostButton onClick={onSkip}>{skipLabel ?? 'Skip for now'}</GhostButton> : null}
      </div>
   );
}
