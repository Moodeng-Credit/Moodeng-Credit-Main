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
         var steps = isAndroid
            ? 'Tap <b>⋮</b> at the top right, then <b>Open in Chrome</b> (or <b>Open in browser</b>).'
            : 'Tap <b>⋯</b> at the top right, then <b>Open in external browser</b> (or <b>Open in Safari</b>).';

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
               : '<button data-iab-hippo type="button" aria-label="How to open it in Safari" style="padding:0;border:0;background:none"><img alt="" src="/hippos/hippo-safari.png" style="height:144px;width:auto;display:block"></button>') +
            '<h1 style="margin:0;font-size:26px;line-height:32px;font-weight:800">For the best experience, open Moodeng in ' + browser + '</h1>' +
            '<p style="margin:0;font-size:16px;line-height:22px;color:#594d65">Signing up and connecting Facebook work more smoothly there. It takes two taps.</p>' +
            (isAndroid
               ? '<a data-iab-open href="' + intent() + '" style="display:flex;align-items:center;justify-content:center;min-height:56px;width:100%;box-sizing:border-box;border-radius:999px;background:#6b55f7;color:#fff;font-size:17px;font-weight:700;text-decoration:none">Open in Chrome</a>'
               : '<button data-iab-safari type="button" style="display:flex;align-items:center;justify-content:center;min-height:56px;width:100%;border:0;border-radius:999px;background:#6b55f7;color:#fff;font:inherit;font-size:17px;font-weight:700">Open in Safari</button>') +
            '<div data-iab-steps style="width:100%;box-sizing:border-box;border-radius:16px;padding:12px 16px;text-align:left;font-size:15px;line-height:21px;' +
            'background:rgba(255,255,255,.7);color:#6b5b86' +
            '">' +
            '<p data-iab-steps-title style="margin:0;font-weight:600">' + (isAndroid ? 'Or do it yourself:' : 'Two taps:') + '</p>' +
            '<p style="margin:4px 0 0">' + steps + '</p>' +
            '<button data-iab-copy type="button" style="margin-top:8px;padding:0;border:0;background:none;font:inherit;font-weight:700;color:#6b55f7;text-decoration:underline;text-underline-offset:4px">No menu? Copy the link for ' + browser + '</button>' +
            '</div>' +
            '<button data-iab-continue type="button" style="margin-top:4px;min-height:48px;width:100%;border-radius:999px;border:2px solid #d9d0ee;background:#fff;font:inherit;font-size:16px;font-weight:700;color:#594d65">Continue here instead</button>' +
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
         Array.prototype.forEach.call(wrap.querySelectorAll('[data-iab-open]'), function (open) {
            open.addEventListener('click', function () {
               track('iab_prompt_open_tapped', { via: open.getAttribute('data-via') || 'button' });
               setTimeout(function () {
                  if (document.visibilityState !== 'visible') return;
                  var box = wrap.querySelector('[data-iab-steps]');
                  box.style.border = '2px solid #6b55f7';
                  box.style.background = '#fff';
                  box.style.color = '#26143f';
                  wrap.querySelector('[data-iab-steps-title]').textContent = 'Chrome didn’t open? Two taps:';
               }, 1500);
            });
         });
         var safariButton = wrap.querySelector('[data-iab-safari]');
         if (safariButton) {
            // iPhone: nothing can open Safari for them (Meta blocks it), so point at the ⋯ menu that can.
            safariButton.addEventListener('click', function () {
               track('iab_prompt_open_tapped', { via: 'safari_button' });
               var pointer = document.createElement('button');
               pointer.type = 'button';
               pointer.setAttribute('aria-label', 'Close');
               pointer.style.cssText =
                  'position:fixed;inset:0;z-index:2147483601;border:0;background:rgba(0,0,0,.9);color:#fff;' +
                  'display:flex;flex-direction:column;align-items:flex-end;text-align:right;padding:12px 20px;font:inherit';
               pointer.innerHTML =
                  '<span aria-hidden="true" style="font-size:56px;line-height:1;margin-right:4px">\u2191</span>' +
                  '<span style="margin-top:8px;font-size:24px;line-height:30px;font-weight:800">Tap <b>\u22EF</b> up here</span>' +
                  '<span style="margin-top:4px;font-size:18px;line-height:25px">then <b>Open in external browser</b><br>(or <b>Open in Safari</b>)</span>' +
                  '<span style="margin-top:24px;font-size:15px;line-height:21px;opacity:.8">Safari opens straight on sign-up.</span>';
               pointer.addEventListener('click', function () {
                  pointer.remove();
               });
               wrap.appendChild(pointer);
            });
         }
         var copyButton = wrap.querySelector('[data-iab-copy]');
         var hippo = wrap.querySelector('[data-iab-hippo]');
         if (hippo) {
            // iPhone: no button can open Safari, so the hippo points at the ⋯ steps and copies the link.
            hippo.addEventListener('click', function () {
               track('iab_prompt_hippo_tapped', {});
               var box = wrap.querySelector('[data-iab-steps]');
               box.style.transition = 'transform .2s';
               box.style.transform = 'scale(1.04)';
               setTimeout(function () {
                  box.style.transform = '';
               }, 1200);
               copyButton.click();
            });
         }
         copyButton.addEventListener('click', function () {
            var btn = copyButton;
            var link = tagged();
            var ok = false;
            try {
               var field = document.createElement('textarea');
               field.value = link;
               field.setAttribute('readonly', '');
               field.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;font-size:16px';
               document.body.appendChild(field);
               field.select();
               field.setSelectionRange(0, link.length);
               ok = document.execCommand('copy');
               document.body.removeChild(field);
            } catch (err) {}
            var done = function (copied) {
               track('iab_prompt_link_copied', { ok: copied });
               if (copied) btn.textContent = 'Link copied ✓ Paste it into ' + browser;
            };
            if (ok) done(true);
            else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(function () { done(true); }, function () { done(false); });
            else done(false);
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
