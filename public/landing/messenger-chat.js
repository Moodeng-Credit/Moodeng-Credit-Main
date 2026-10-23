// "Chat on Messenger" — the help button on the landing pages, in place of the green chat bubble.
// Filipino borrowers message businesses on Messenger ("PM us"); a bare green bubble read as SMS.
// Messages to the Moodeng Credit Page become Discord #web-support tickets and the team's replies go
// back on Messenger (supabase/functions/_shared/messengerSupport.ts), so this reaches the same people.
//
// The old chat widget still loads on these pages with data-launcher="hidden" (no bubble), as the
// fallback where Messenger can't be opened. Same routing as the app's MessengerChatButton:
//   iPhone, Facebook app's browser → links to other apps are dropped there → the web chat
//   Android                        → fb-messenger:// (m.me never opens Messenger from Chrome);
//                                     still on this page 1.5s later → the web chat
//   computer                       → messenger.com in a new tab
//   everything else                → m.me (iPhone Safari/Chrome, Messenger's own browser)
(function () {
   try {
      var PAGE_ID = '1148756028310286';
      var ua = navigator.userAgent || '';
      var ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
      var android = /Android/i.test(ua);
      var fbAppIos = ios && /\bFBAN\/FBIOS\b/.test(ua) && (/\bIABMV\//.test(ua) || /\bFBOP\/5\b/.test(ua));
      var desktop =
         !ios && !android && !/Mobile/i.test(ua) && !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
      var route = fbAppIos ? 'web_chat' : android ? 'android_app' : desktop ? 'desktop' : 'm_me';
      var href =
         route === 'android_app'
            ? 'fb-messenger://user-thread/' + PAGE_ID
            : route === 'desktop'
              ? 'https://www.messenger.com/t/' + PAGE_ID
              : 'https://m.me/' + PAGE_ID;

      var openWebChat = function () {
         var tries = 0;
         var attempt = function () {
            if (window.MoodengSupport && typeof window.MoodengSupport.open === 'function') return window.MoodengSupport.open();
            if (++tries < 40) setTimeout(attempt, 250);
            else window.location.href = 'mailto:support@moodeng.app';
         };
         attempt();
      };

      var track = function (event) {
         try {
            if (window.posthog && typeof window.posthog.capture === 'function') window.posthog.capture(event, { route: route, page: location.pathname });
         } catch (e) {}
      };

      var style = document.createElement('style');
      style.textContent =
         '.md-messenger-chat{position:fixed;right:16px;bottom:calc(20px + env(safe-area-inset-bottom));z-index:90;display:inline-flex;align-items:center;gap:8px;' +
         'padding:6px 18px 6px 6px;border-radius:999px;background:linear-gradient(135deg,#00b2ff,#006aff);color:#fff;font-family:inherit;font-weight:600;font-size:15px;line-height:1.2;' +
         'text-decoration:none;box-shadow:0 8px 24px rgba(0,106,255,.35);transition:transform .15s ease}' +
         '.md-messenger-chat:hover{transform:translateY(-1px)}.md-messenger-chat:active{transform:scale(.96)}' +
         '.md-mc-avatar{position:relative;width:36px;height:36px;flex:none}' +
         '.md-mc-avatar img{display:block;width:36px;height:36px;border-radius:50%;border:2px solid #fff;box-sizing:border-box;background:#f3eefe}' +
         '.md-mc-badge{position:absolute;right:-3px;bottom:-3px;width:17px;height:17px;border-radius:50%;background:#fff;box-sizing:border-box;padding:1.5px}' +
         '.md-mc-badge svg{display:block;width:100%;height:100%}' +
         '@media (max-width:420px){.md-messenger-chat{padding:5px 15px 5px 5px;font-size:14px}}';
      document.head.appendChild(style);

      var a = document.createElement('a');
      a.className = 'md-messenger-chat';
      a.href = href;
      a.setAttribute('aria-label', 'Chat with Moodeng on Messenger');
      if (route === 'desktop') {
         a.target = '_blank';
         a.rel = 'noopener noreferrer';
      }
      // The Moodeng hippo (the support "face") with a small Messenger badge: a person, in Messenger.
      a.innerHTML =
         '<span class="md-mc-avatar"><img src="/icons/hippo-support-avatar.png" alt="" width="36" height="36" />' +
         '<span class="md-mc-badge"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#0a7cff" d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.15.26.35.27.57l.05 1.78a.8.8 0 0 0 1.12.71l1.98-.87a.8.8 0 0 1 .53-.04c.91.25 1.88.38 2.91.38 5.64 0 10-4.13 10-9.7S17.64 2 12 2Z"/>' +
         '<path fill="#fff" d="m5.99 14.54 2.94-4.66a1.5 1.5 0 0 1 2.17-.4l2.34 1.75a.6.6 0 0 0 .72 0l3.16-2.4c.42-.32.97.18.69.63l-2.94 4.66a1.5 1.5 0 0 1-2.17.4l-2.34-1.75a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.32-.97-.18-.69-.63Z"/></svg></span></span>' +
         '<span>Chat on Messenger</span>';
      a.addEventListener('click', function (event) {
         track('support_messenger_tapped');
         if (route === 'web_chat') {
            event.preventDefault();
            openWebChat();
            return;
         }
         if (route === 'android_app') {
            // The link navigates by itself; if Messenger didn't take it we're still here → web chat.
            setTimeout(function () {
               if (document.visibilityState === 'visible') {
                  track('support_messenger_fallback');
                  openWebChat();
               }
            }, 1500);
         }
      });

      // The "Continue where you left off" pill (continue-banner.js) also sits at the bottom: stand above it.
      var clearBanner = function () {
         var banner = document.querySelector('[data-continue-banner]');
         a.style.bottom = banner ? 'calc(' + (banner.offsetHeight + 28) + 'px + env(safe-area-inset-bottom))' : '';
      };
      var mount = function () {
         document.body.appendChild(a);
         clearBanner();
         // The banner is added after a cookie check; look again once it has had the chance.
         setTimeout(clearBanner, 800);
         setTimeout(clearBanner, 2500);
      };
      if (document.body) mount();
      else document.addEventListener('DOMContentLoaded', mount);
   } catch (e) {}
})();
