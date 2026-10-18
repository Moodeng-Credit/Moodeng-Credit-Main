// "For the best experience, open Moodeng in Chrome / Safari" on the home page, inside Facebook's,
// Messenger's and Instagram's own browsers, for people not signed in. Same screen, rules and
// "Continue here" memory (localStorage md_iab_continue) as the app's OpenInBrowserPrompt
// (src/components/OpenInBrowserPrompt.tsx, src/lib/openInBrowserPrompt.ts). Switch:
// telegram_bot_settings.iab_open_prompt_enabled. Loaded by the home page and its phone version.
(function () {
   try {
      var ua = navigator.userAgent || '';
      var os = /iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Android/i.test(ua) ? 'android' : 'other';
      var app = /\bFBAN\/Messenger|MessengerForiOS|MessengerLite|\bMessenger\//i.test(ua)
         ? 'Messenger'
         : /\bFBAN|\bFBAV|FB_IAB|FB4A|FBIOS/i.test(ua)
           ? 'Facebook'
           : /Instagram/i.test(ua)
             ? 'Instagram'
             : null;
      var params = new URLSearchParams(window.location.search);
      var POSTHOG_KEY = 'phc_qjr9yzwxKTun5ofaWE5z6QWrpY9dV9TsRMMRmX2rooEV';

      var distinctId = function () {
         try {
            var m = document.cookie.match(/ph_phc_[^=]+_posthog=([^;]+)/);
            if (m) return JSON.parse(decodeURIComponent(m[1])).distinct_id;
         } catch (e) {}
         try {
            var id = localStorage.getItem('md_landing_id');
            if (!id) {
               id = 'landing-' + Math.random().toString(36).slice(2, 12);
               localStorage.setItem('md_landing_id', id);
            }
            return id;
         } catch (e) {
            return 'landing-anon';
         }
      };
      var track = function (event, props) {
         try {
            fetch('https://us.i.posthog.com/i/v0/e/', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                  api_key: POSTHOG_KEY,
                  event: event,
                  distinct_id: distinctId(),
                  properties: Object.assign({ os: os, app: app, page: window.location.pathname, $current_url: window.location.origin + window.location.pathname, $lib: 'landing' }, props || {})
               }),
               keepalive: true
            }).catch(function () {});
         } catch (e) {}
      };

      // Arrived in Chrome / Safari from this screen (?ia=1): count it, then tidy the address.
      if (params.get('ia') === '1') {
         if (!app) track('iab_prompt_arrived', {});
         params.delete('ia');
         var q = params.toString();
         window.history.replaceState(null, '', window.location.pathname + (q ? '?' + q : '') + window.location.hash);
      }

      if (!app || (os !== 'android' && os !== 'ios')) return;
      if (/(?:^|;\s*)sb-[a-z0-9]+-auth-token(?:\.0)?=/i.test(document.cookie)) return; // signed in: "Continue where you left off" instead
      try {
         if (localStorage.getItem('md_iab_continue')) return;
      } catch (e) {}

      // Chrome / Safari opens straight on sign-up (they've chosen to start; no second home page),
      // keeping the Facebook post's ?src= tag: Chrome can't see this browser's saved first visit.
      var src = params.get('src') || params.get('utm_source');
      if (!src) {
         try {
            src = (JSON.parse(localStorage.getItem('md_first_touch') || 'null') || {}).src || null;
         } catch (e) {}
      }
      var originalAddress = window.location.pathname + window.location.search + window.location.hash;
      var tagged = function () {
         var u = new URL('/sign-up', window.location.origin);
         u.searchParams.set('ia', '1');
         if (src) u.searchParams.set('src', src);
         return u.toString();
      };

      var show = function () {
         if (document.querySelector('[data-iab-prompt]')) return;
         var isAndroid = os === 'android';
         var browser = isAndroid ? 'Chrome' : 'Safari';
         // Facebook's menu opens whatever address the page shows: tag it so arrivals are counted.
         var t = new URL(tagged());
         window.history.replaceState(null, '', t.pathname + t.search + t.hash);

         var intent = function () {
            var u = new URL(tagged());
            return 'intent://' + u.host + u.pathname + u.search + u.hash + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(u.toString()) + ';end';
         };

         var wrap = document.createElement('div');
         wrap.setAttribute('data-iab-prompt', '');
         wrap.setAttribute('role', 'dialog');
         wrap.setAttribute('aria-modal', 'true');
         wrap.style.cssText =
            'position:fixed;inset:0;z-index:2147483600;overflow-y:auto;background:linear-gradient(#fbfafd,#fff);' +
            'display:flex;justify-content:center;align-items:flex-start;padding:32px 16px;box-sizing:border-box;' +
            'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#26143f;';
         wrap.innerHTML =
            '<div style="width:100%;max-width:400px;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center">' +
            // The hippo does what the main action does: people tap the picture instead of the button.
            (isAndroid
               ? '<a data-iab-open data-via="hippo" aria-label="Open in Chrome" href="' + intent() + '"><img alt="" src="/hippos/hippo-chrome.png" style="height:144px;width:auto;display:block"></a>'
               : '<button data-iab-hippo type="button" aria-label="Open in Safari" style="padding:0;border:0;background:none"><img alt="" src="/hippos/hippo-safari.png" style="height:144px;width:auto;display:block"></button>') +
            '<h1 style="margin:0;font-size:26px;line-height:32px;font-weight:800">For the best experience, open Moodeng in ' + browser + '</h1>' +
            '<p style="margin:0;font-size:16px;line-height:22px;color:#594d65">Signing up and connecting Facebook work more smoothly there. It takes two taps.</p>' +
            (isAndroid
               ? '<a data-iab-open href="' + intent() + '" style="display:flex;align-items:center;justify-content:center;min-height:56px;width:100%;box-sizing:border-box;border-radius:999px;background:#6b55f7;color:#fff;font-size:17px;font-weight:700;text-decoration:none">Open in Chrome</a>'
               : '<button data-iab-safari type="button" style="display:flex;align-items:center;justify-content:center;min-height:56px;width:100%;border:0;border-radius:999px;background:#6b55f7;color:#fff;font:inherit;font-size:17px;font-weight:700">Open in Safari</button>') +
            '<button data-iab-continue type="button" style="margin-top:4px;min-height:48px;width:100%;border-radius:999px;border:2px solid #d9d0ee;background:#fff;font:inherit;font-size:16px;font-weight:700;color:#594d65">Continue here</button>' +
            '</div>';
         document.body.appendChild(wrap);
         document.documentElement.style.overflow = 'hidden';
         track('iab_prompt_shown', {});

         var close = function () {
            wrap.remove();
            document.documentElement.style.overflow = '';
            window.history.replaceState(null, '', originalAddress);
         };
         wrap.querySelector('[data-iab-continue]').addEventListener('click', function () {
            track('iab_prompt_continue', {});
            try {
               localStorage.setItem('md_iab_continue', String(Date.now()));
            } catch (e) {}
            close();
         });
         // The arrow at the menu that can open the real browser: iPhone's "Open in Safari" shows it at
         // once (nothing can open Safari for them; Meta blocks it), Android when Chrome didn't open.
         var showPointer = function (chromeFailed) {
            if (wrap.querySelector('[data-iab-pointer]')) return;
            var icon = isAndroid ? '⋮' : '⋯';
            var item = isAndroid ? 'Open in Chrome' : 'Open in external browser';
            var ring = 'box-shadow:0 0 0 2px #fff,0 0 0 5px #FFD43B;';
            var num = 'display:flex;align-items:center;justify-content:center;width:28px;height:28px;flex:none;border-radius:999px;background:#FFD43B;color:#1a0f2e;font-weight:900;font-size:15px';
            var stepTitle = 'display:flex;align-items:center;gap:8px;margin:0;font-size:17px;line-height:22px;font-weight:700';
            var frame = 'pointer-events:none;user-select:none;border-radius:16px;background:#2a2140;padding:10px';
            var pointer = document.createElement('div');
            pointer.setAttribute('data-iab-pointer', '');
            pointer.setAttribute('role', 'dialog');
            pointer.style.cssText =
               'position:fixed;inset:0;z-index:2147483601;overflow-y:auto;background:#120a1f;color:#fff;box-sizing:border-box;' +
               'display:flex;flex-direction:column;align-items:center;padding:8px 20px 24px;font-family:inherit;text-align:left';
            pointer.innerHTML =
               '<div style="display:flex;width:100%;max-width:380px;align-items:flex-end;justify-content:space-between;gap:8px">' +
               '<p style="margin:0;padding-bottom:8px;font-size:22px;line-height:28px;font-weight:800">' +
               (chromeFailed ? 'Chrome didn’t open? ' : '') + 'Open Moodeng in ' + browser + '</p>' +
               '<img alt="" src="/hippos/hippo-point-menu.png" style="height:128px;width:auto;flex:none;margin-right:-8px;pointer-events:none"></div>' +
               '<div style="margin-top:12px;display:flex;width:100%;max-width:380px;flex-direction:column;gap:16px">' +
               '<div style="display:flex;flex-direction:column;gap:8px"><p style="' + stepTitle + '"><span style="' + num + '">1</span>Tap ' + icon + ' at the top right</p>' +
               '<div aria-hidden="true" style="' + frame + '"><div style="display:flex;align-items:center;justify-content:space-between;border-radius:12px;background:#fff;color:#1c1c1e;padding:8px 12px">' +
               '<span style="font-size:18px;line-height:1">✕</span>' +
               '<span style="display:flex;flex-direction:column;align-items:center;line-height:1.2"><span style="font-size:14px;font-weight:600">🔒 moodeng.app</span><span style="font-size:11px;color:#8e8e93">' + (app || 'Messenger') + '</span></span>' +
               '<span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:999px;font-size:20px;font-weight:900;line-height:1;' + ring + '">' + icon + '</span>' +
               '</div></div></div>' +
               '<div style="display:flex;flex-direction:column;gap:8px"><p style="' + stepTitle + '"><span style="' + num + '">2</span>Tap “' + item + '”</p>' +
               '<div aria-hidden="true" style="' + frame + '"><div style="border-radius:12px;background:#fff;color:#1c1c1e;padding:6px 8px">' +
               '<div style="display:flex;align-items:center;gap:8px;border-radius:8px;padding:6px 8px;font-size:15px;font-weight:600;' + ring + '">' + (isAndroid ? '🌐 ' : '🧭 ') + item + '</div>' +
               '</div></div></div>' +
               '<p style="margin:0;font-size:14px;line-height:20px;opacity:.7">Don’t see it? It may say <b>' + (isAndroid ? 'Open in browser' : 'Open in Safari') + '</b>. ' + browser + ' opens straight on sign-up.</p>' +
               '</div>' +
               '<button data-iab-pointer-close type="button" style="margin-top:auto;min-height:48px;width:100%;max-width:400px;border-radius:999px;border:2px solid rgba(255,255,255,.4);background:none;color:#fff;font:inherit;font-size:16px;font-weight:700">Got it</button>';
            pointer.addEventListener('click', function () {
               pointer.remove();
            });
            wrap.appendChild(pointer);
         };
         Array.prototype.forEach.call(wrap.querySelectorAll('[data-iab-open]'), function (open) {
            open.addEventListener('click', function () {
               track('iab_prompt_open_tapped', { via: open.getAttribute('data-via') || 'button' });
               setTimeout(function () {
                  if (document.visibilityState === 'visible') showPointer(true);
               }, 1500);
            });
         });
         Array.prototype.forEach.call(wrap.querySelectorAll('[data-iab-safari], [data-iab-hippo]'), function (el) {
            el.addEventListener('click', function () {
               track('iab_prompt_open_tapped', { via: el.hasAttribute('data-iab-hippo') ? 'hippo' : 'safari_button' });
               showPointer(false);
            });
         });
      };

      // The switch: shown only when it's on (fails closed if the check fails).
      fetch('https://qplmmxynzxzkfxtayoqr.supabase.co/rest/v1/rpc/get_iab_open_prompt_enabled', {
         method: 'POST',
         headers: { apikey: 'sb_publishable_iS4m6B9ej4AUhve4pkj29w_5TDEUNzh', 'Content-Type': 'application/json' },
         body: '{}'
      })
         .then(function (r) {
            return r.ok ? r.json() : false;
         })
         .then(function (enabled) {
            if (enabled !== true) return;
            if (document.body) show();
            else document.addEventListener('DOMContentLoaded', show);
         })
         .catch(function () {});
   } catch (e) {
      // Never let this block the home page.
   }
})();
