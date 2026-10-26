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
      // iPhone, the Facebook app itself (FBOP/5, newer ones also IABMV/1) vs Messenger (FBOP/80): both say
      // FBAN/FBIOS. Same rule as metaIosHost() in src/lib/inAppBrowser.ts. Only the Facebook app's guide changes.
      var fbAppIos = os === 'ios' && /\bFBAN\/FBIOS\b/.test(ua) && (/\bIABMV\//.test(ua) || /\bFBOP\/5\b/.test(ua));
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

         // Both buttons also copy the sign-up link, so they can paste it if the browser opens on its start
         // page. Same as the app's copyTextFromTap: a hidden field + execCommand from the tap, else the
         // Clipboard API. Resolves false when nothing was copied, so the guide can offer its own button.
         var copyText = function (text) {
            var ok = false;
            try {
               var field = document.createElement('textarea');
               field.value = text;
               field.setAttribute('readonly', '');
               field.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
               document.body.appendChild(field);
               field.select();
               field.setSelectionRange(0, text.length);
               ok = document.execCommand('copy');
               document.body.removeChild(field);
            } catch (e) {
               ok = false;
            }
            if (ok) return Promise.resolve(true);
            try {
               if (navigator.clipboard && navigator.clipboard.writeText) {
                  return navigator.clipboard.writeText(text).then(
                     function () {
                        return true;
                     },
                     function () {
                        return false;
                     }
                  );
               }
            } catch (e) {}
            return Promise.resolve(false);
         };
         var linkCopied = null; // null until a button has tried
         var copyLink = function (button) {
            return copyText(tagged()).then(function (ok) {
               linkCopied = ok;
               if (ok && button) {
                  var label = button.textContent;
                  button.textContent = 'Link copied ✓';
                  setTimeout(function () {
                     button.textContent = label;
                  }, 2000);
               }
               return ok;
            });
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
            var frame = 'position:relative;pointer-events:none;user-select:none;border-radius:16px;background:#2a2140;padding:10px';
            // The menu steps are pictures, tagged so nobody taps them (George, 20 Oct).
            var pictureTag = '<span style="position:absolute;top:-10px;right:12px;z-index:20;border-radius:999px;background:#120a1f;padding:0 8px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:rgba(255,255,255,.6)">Picture</span>';
            var doneNum = num.replace('background:#FFD43B;color:#1a0f2e', 'background:#7CE38B;color:#0d2a13');
            var hasCopyStep = linkCopied !== null;
            var first = hasCopyStep ? 2 : 1;
            // Step 1: the link (their tap already copied it, or couldn't). The one real button is purple
            // like the page's own buttons.
            var copyStep = function (state) {
               if (state === true) {
                  return '<p style="' + stepTitle + '"><span style="' + doneNum + '">✓</span>Link copied</p>' +
                     '<p style="margin:0;padding-left:36px;font-size:14px;line-height:20px;opacity:.7">If ' + browser + ' opens without Moodeng, paste it in the address bar.</p>';
               }
               return '<p style="' + stepTitle + '"><span style="' + num + '">1</span>Copy the link</p>' +
                  '<button data-iab-copy type="button" style="display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;width:100%;border:0;border-radius:999px;background:#6b55f7;color:#fff;font:inherit;font-size:17px;font-weight:700"><span aria-hidden="true">📋</span>Copy link</button>' +
                  (state === 'failed'
                     ? '<p style="margin:0;font-size:14px;line-height:20px;opacity:.8">Couldn’t copy. Press and hold the link, then tap Copy.</p>' +
                       '<p style="margin:0;font-size:14px;line-height:20px;text-decoration:underline;word-break:break-all;user-select:all;-webkit-user-select:all">' + tagged() + '</p>'
                     : '<p style="margin:0;text-align:center;font-size:14px;line-height:20px;opacity:.7">So you can paste it if ' + browser + ' opens without Moodeng.</p>');
            };
            // A finger that taps each spot, with a ripple (same as the app's MenuGuide).
            if (!document.getElementById('mg-tap-style')) {
               var st = document.createElement('style');
               st.id = 'mg-tap-style';
               st.textContent =
                  '@keyframes mg-tap{0%,100%{transform:translate(10px,14px)}40%,62%{transform:translate(0,0)}50%{transform:translate(0,0) scale(.86)}}' +
                  '@keyframes mg-ripple{0%,46%{transform:translate(-50%,-50%) scale(.3);opacity:0}52%{opacity:.95}100%{transform:translate(-50%,-50%) scale(1.7);opacity:0}}' +
                  '@media (prefers-reduced-motion:reduce){.mg-finger,.mg-ripple{animation:none!important}}';
               document.head.appendChild(st);
            }
            var finger = function (left, top) {
               return '<span aria-hidden="true" style="position:absolute;z-index:10;pointer-events:none;left:' + left + ';top:' + top + '">' +
                  '<span class="mg-ripple" style="position:absolute;left:0;top:0;width:40px;height:40px;box-sizing:border-box;border-radius:999px;border:3px solid #FFD43B;animation:mg-ripple 1.6s ease-out infinite"></span>' +
                  '<span class="mg-finger" style="position:absolute;left:-15px;top:-3px;display:block;font-size:34px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5));animation:mg-tap 1.6s ease-in-out infinite">\uD83D\uDC46</span></span>';
            };
            var fadedRow = function (width) {
               return '<div style="display:flex;align-items:center;gap:12px;padding:10px 8px;opacity:.3"><span style="width:20px;height:20px;border-radius:999px;background:rgba(255,255,255,.6)"></span><span style="height:10px;width:' + width + 'px;border-radius:999px;background:rgba(255,255,255,.6)"></span></div>';
            };
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
               '<img alt="" src="/hippos/hippo-point-menu.png" style="height:128px;width:auto;flex:none;margin-right:48px;pointer-events:none"></div>' +
               '<div style="margin-top:12px;display:flex;width:100%;max-width:380px;flex-direction:column;gap:16px">' +
               (hasCopyStep ? '<div data-iab-copystep role="status" style="display:flex;flex-direction:column;gap:8px">' + copyStep(linkCopied) + '</div>' : '') +
               '<div style="border:2px dashed rgba(255,255,255,.25);border-radius:16px;padding:12px 16px">' +
               '<p style="margin:0;font-size:15px;line-height:21px;font-weight:700">Then use the menu at the very top of your screen ↑</p>' +
               '<p style="margin:0;font-size:14px;line-height:20px;opacity:.7">The pictures below only show what to tap. They aren’t buttons.</p></div>' +
               '<div style="display:flex;flex-direction:column;gap:8px"><p style="' + stepTitle + '"><span style="' + num + '">' + first + '</span>Tap ' + icon + ' at the top right</p>' +
               '<div aria-hidden="true" style="' + frame + '">' + pictureTag + '<div style="position:relative;display:flex;align-items:center;justify-content:space-between;border-radius:12px;background:#fff;color:#1c1c1e;padding:8px 12px">' +
               '<span style="font-size:18px;line-height:1">✕</span>' +
               '<span style="display:flex;flex-direction:column;align-items:center;line-height:1.2"><span style="font-size:14px;font-weight:600">🔒 moodeng.app</span><span style="font-size:11px;color:#8e8e93">' + (app || 'Messenger') + '</span></span>' +
               '<span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:999px;font-size:20px;font-weight:900;line-height:1;' + ring + '">' + icon + '</span>' +
               finger('calc(100% - 28px)', '50%') +
               '</div></div></div>' +
               '<div style="display:flex;flex-direction:column;gap:8px"><p style="' + stepTitle + '"><span style="' + num + '">' + (first + 1) + '</span>Tap “' + item + '”' + '</p>' +
               '<div aria-hidden="true" style="' + frame + '">' + pictureTag +
               (isAndroid
                  ? '<div style="position:relative;border-radius:12px;background:#fff;color:#1c1c1e;padding:6px 8px"><div style="display:flex;align-items:center;gap:8px;border-radius:8px;padding:6px 8px;font-size:15px;font-weight:600;' + ring + '">🌐 ' + item + '</div>' + finger('62%', '55%') + '</div>'
                  : fbAppIos
                    ? // Drawn like the Messenger screenshot (dark, the rest faded, the one to tap ringed) until we
                      // have a picture of the Facebook app's own menu (same as the app's MenuGuide).
                      '<div style="position:relative;border-radius:12px;background:#1c1c1e;color:#fff;padding:8px;font-size:15px">' +
                      fadedRow(112) + fadedRow(112) +
                      '<div style="display:flex;align-items:center;gap:12px;border-radius:8px;padding:8px;font-weight:600;box-shadow:0 0 0 2px #1c1c1e,0 0 0 5px #FFD43B">' +
                      '<span style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:4px;background:#fff;color:#1c1c1e;font-size:13px;font-weight:900;line-height:1">↗</span>' + item + '</div>' +
                      fadedRow(96) + finger('62%', '58%') + '</div>'
                    : '<div style="position:relative"><img alt="" src="/guide/ios-menu-open-external.png" style="display:block;width:100%;border-radius:12px">' + finger('62%', '62%') + '</div>') +
               '</div></div>' +
               '<p style="margin:0;font-size:14px;line-height:20px;opacity:.7">Don’t see it? It may say <b>' + (isAndroid ? 'Open in browser' : 'Open in Safari') + '</b>. ' + browser + ' opens straight on sign-up.</p>' +
               '</div>' +
               '<button data-iab-pointer-close type="button" style="margin-top:auto;min-height:48px;width:100%;max-width:400px;border-radius:999px;border:2px solid rgba(255,255,255,.4);background:none;color:#fff;font:inherit;font-size:16px;font-weight:700">Got it</button>';
            pointer.addEventListener('click', function () {
               pointer.remove();
            });
            var step = pointer.querySelector('[data-iab-copystep]');
            if (step) {
               // Tapping here mustn't close the guide.
               step.addEventListener('click', function (event) {
                  event.stopPropagation();
                  if (!event.target.closest('[data-iab-copy]')) return;
                  copyText(tagged()).then(function (ok) {
                     if (ok) linkCopied = true;
                     step.innerHTML = copyStep(ok ? true : 'failed');
                  });
               });
            }
            wrap.appendChild(pointer);
         };
         Array.prototype.forEach.call(wrap.querySelectorAll('[data-iab-open]'), function (open) {
            open.addEventListener('click', function () {
               track('iab_prompt_open_tapped', { via: open.getAttribute('data-via') || 'button' });
               copyLink(open.hasAttribute('data-via') ? null : open);
               setTimeout(function () {
                  if (document.visibilityState === 'visible') showPointer(true);
               }, 1500);
            });
         });
         Array.prototype.forEach.call(wrap.querySelectorAll('[data-iab-safari], [data-iab-hippo]'), function (el) {
            el.addEventListener('click', function () {
               track('iab_prompt_open_tapped', { via: el.hasAttribute('data-iab-hippo') ? 'hippo' : 'safari_button' });
               copyLink(el.hasAttribute('data-iab-hippo') ? null : el).then(function () {
                  showPointer(false);
               });
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
