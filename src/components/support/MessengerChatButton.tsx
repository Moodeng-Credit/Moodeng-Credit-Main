import { type JSX, type MouseEvent } from 'react';

import posthog from 'posthog-js';

import { MESSENGER_APP_CHAT_LINK, MESSENGER_DESKTOP_CHAT_LINK, MESSENGER_PAGE_ID, isAndroidBrowser, isDesktopBrowser } from '@/config/contactVerification';
import { metaIosHost } from '@/lib/inAppBrowser';
import { openSupportChat } from '@/lib/support/liveChat';

// The floating help button on /support and /help: "Chat on Messenger", straight to the Moodeng Credit
// Page's chat. Filipino borrowers message businesses on Messenger ("PM us"); a bare green bubble read
// as SMS, not "talk to a person". The team answers in the Page inbox.
//
// Getting into Messenger differs by where the page is open (same findings as the Facebook step,
// ContactsStep / docs/IOS_INAPP_MESSENGER_PLAN.md):
//   iPhone, Facebook app's browser  → nothing can open Messenger from there (links to other apps are
//                                      dropped), so this opens our own web chat instead.
//   iPhone, anywhere else           → m.me as a real link (Messenger's own browser opens the chat in place).
//   Android                         → fb-messenger:// (m.me never opens Messenger from Chrome); if
//                                      we're still on screen 1.5s later, it didn't open → web chat.
//   Computer                        → facebook.com/messages in a new tab (messenger.com asks to sign in again).

const IOS_LINK = `https://m.me/${MESSENGER_PAGE_ID}`;
const ANDROID_FALLBACK_MS = 1500;

type Route = 'web_chat' | 'android_app' | 'desktop' | 'm_me';

const pickRoute = (): Route => {
   if (metaIosHost() === 'facebook') return 'web_chat';
   if (isAndroidBrowser()) return 'android_app';
   if (isDesktopBrowser()) return 'desktop';
   return 'm_me';
};

const hrefFor = (route: Route) =>
   route === 'android_app' ? MESSENGER_APP_CHAT_LINK : route === 'desktop' ? MESSENGER_DESKTOP_CHAT_LINK : IOS_LINK;

const MessengerGlyph = (): JSX.Element => (
   <svg viewBox="0 0 24 24" aria-hidden="true" className="block h-full w-full">
      <path
         fill="#0a7cff"
         d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.15.26.35.27.57l.05 1.78a.8.8 0 0 0 1.12.71l1.98-.87a.8.8 0 0 1 .53-.04c.91.25 1.88.38 2.91.38 5.64 0 10-4.13 10-9.7S17.64 2 12 2Z"
      />
      <path
         fill="#fff"
         d="m5.99 14.54 2.94-4.66a1.5 1.5 0 0 1 2.17-.4l2.34 1.75a.6.6 0 0 0 .72 0l3.16-2.4c.42-.32.97.18.69.63l-2.94 4.66a1.5 1.5 0 0 1-2.17.4l-2.34-1.75a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.32-.97-.18-.69-.63Z"
      />
   </svg>
);

// The Moodeng hippo (the support "face") with a small Messenger badge: a person, in Messenger.
const SupportAvatar = (): JSX.Element => (
   <span className="relative size-9 shrink-0">
      <img
         src="/icons/hippo-support-avatar.png"
         alt=""
         width={36}
         height={36}
         className="block size-9 rounded-full border-2 border-white bg-[#f3eefe]"
      />
      <span className="absolute -bottom-[3px] -right-[3px] size-[17px] rounded-full bg-white p-[1.5px]">
         <MessengerGlyph />
      </span>
   </span>
);

export default function MessengerChatButton(): JSX.Element {
   const route = pickRoute();

   const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
      posthog.capture('support_messenger_tapped', { route });
      if (route === 'web_chat') {
         event.preventDefault();
         openSupportChat();
         return;
      }
      if (route === 'android_app') {
         // The link navigates by itself; if Messenger isn't installed (or didn't take it), we're
         // still here — give them the web chat rather than a dead tap.
         window.setTimeout(() => {
            if (document.visibilityState === 'visible') {
               posthog.capture('support_messenger_fallback', { route });
               openSupportChat();
            }
         }, ANDROID_FALLBACK_MS);
      }
   };

   return (
      <a
         href={hrefFor(route)}
         onClick={onClick}
         target={route === 'desktop' ? '_blank' : undefined}
         rel={route === 'desktop' ? 'noopener noreferrer' : undefined}
         aria-label="Chat with Moodeng on Messenger"
         className="fixed bottom-5 right-4 z-[60] inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[#00b2ff] to-[#006aff] py-1.5 pl-1.5 pr-4 text-[15px] font-semibold text-white shadow-lg shadow-[#006aff]/30 transition-transform active:scale-95"
         style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
         <SupportAvatar />
         <span>Chat on Messenger</span>
      </a>
   );
}
