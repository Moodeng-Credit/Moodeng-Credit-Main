// Signed in in this browser (the app keeps its Supabase session in a cookie). The app also leaves an
// md_landing cookie saying where they are (src/lib/landingSessionCookie.ts):
//   signout — all set: "Sign in" becomes "Sign out", no banner; lenders (md_role=lender) get "Fund loans"
//     instead of "Get a loan".
//   continue (or not known yet) — still signing up / onboarding / applying: "Sign in" becomes "Continue",
//     "Get a loan" becomes "Sign out", and a "Continue where you left off" banner.
//     Reopening moodeng.app inside Facebook's / Messenger's browser lands on this static page, and people
//     took it for "my progress is gone" (Emma, 2026-10-17). /continue sends them on to their next step.
// Loaded by the home page, its phone version (old-mobile.html) and the other landing pages.
(function () {
   try {
      if (!/(?:^|;\s*)sb-[a-z0-9]+-auth-token(?:\.0)?=/i.test(document.cookie)) return;
      var allSet = /(?:^|;\s*)md_landing=signout(?:;|$)/.test(document.cookie);
      var relabel = function (label, href) {
         document.querySelectorAll('a[href="/sign-in"], a[href="https://moodeng.app/sign-in"]').forEach(function (link) {
            link.setAttribute('href', href);
            var target = link.querySelector('.btn-label') || link;
            // Keep any icon; swap only the words.
            var replaced = false;
            Array.prototype.forEach.call(target.childNodes, function (node) {
               if (node.nodeType === 3 && /sign in/i.test(node.nodeValue)) {
                  node.nodeValue = node.nodeValue.replace(/sign in/i, label);
                  replaced = true;
               }
            });
            if (!replaced) {
               link.setAttribute('aria-label', label);
               link.setAttribute('title', label);
            }
         });
      };
      // Sign out is rarely used, so it shouldn't sit beside the main button: a plain text link on wide screens,
      // and in the menu only (not the header) wherever the header has a menu button.
      var quietSignOut = function () {
         document.querySelectorAll('.site-header a[href="/sign-out"], .head-signin[href="/sign-out"]').forEach(function (link) {
            link.setAttribute('data-header-signout', '');
         });
         if (document.querySelector('style[data-header-signout-style]')) return;
         var style = document.createElement('style');
         style.setAttribute('data-header-signout-style', '');
         style.textContent =
            '.site-header a[data-header-signout]{background:none!important;border-color:transparent!important;box-shadow:none!important;padding-left:10px!important;padding-right:10px!important;font-weight:600!important;opacity:.8}' +
            '.site-header a[data-header-signout]:hover{opacity:1;text-decoration:underline}' +
            '@media (max-width:1179px){.site-header .header-actions a[data-header-signout]{display:none!important}}' +
            // Phone page: the header shows the main button instead of Sign out (Sign out is in the drawer).
            (document.querySelector('.head-signin[data-header-signout]')
               ? '.head-signin[data-header-signout]{display:none!important}.site-head .head-cta{display:inline-flex!important}'
               : '');
         document.head.appendChild(style);
      };
      var show = function () {
         if (allSet) {
            relabel('Sign out', '/sign-out');
            // Lenders fund loans, they don't take them.
            if (/(?:^|;\s*)md_role=lender(?:;|$)/.test(document.cookie)) {
               document
                  .querySelectorAll('a[href="/request-board"], a[href="https://moodeng.app/request-board"]')
                  .forEach(function (link) {
                     if (link.textContent.trim() === 'Get a loan') link.textContent = 'Fund loans';
                  });
            }
            quietSignOut();
            return;
         }
         relabel('Continue', '/continue?via=landing');
         // Mid sign-up they're already getting a loan, so "Get a loan" becomes "Sign out" — otherwise a
         // fresh account has no way out to switch to another one. Continue keeps the bold style.
         document
            .querySelectorAll('a[href="/request-board"], a[href="https://moodeng.app/request-board"]')
            .forEach(function (link) {
               if (link.textContent.trim() !== 'Get a loan') return;
               // Phone header: this one swaps in for Continue on scroll, so it stays Continue; Sign out
               // is in the menu (below).
               if (link.classList.contains('head-cta')) {
                  link.setAttribute('href', '/continue?via=landing');
                  link.textContent = 'Continue';
                  return;
               }
               link.setAttribute('href', '/sign-out');
               link.textContent = 'Sign out';
               var next = link.parentNode.querySelector('a[href="/continue?via=landing"]');
               if (next) {
                  var bold = link.className;
                  link.className = next.className;
                  next.className = bold;
               }
            });
         quietSignOut();
         // Phone menu (old-mobile.html) has no "Get a loan" to swap, only "Continue →" at the bottom.
         document.querySelectorAll('.d-foot').forEach(function (foot) {
            if (foot.querySelector('a[href="/sign-out"]')) return;
            var out = document.createElement('a');
            out.href = '/sign-out';
            out.textContent = 'Sign out';
            out.style.marginLeft = '28px';
            foot.appendChild(out);
         });
         if (document.querySelector('[data-continue-banner]')) return;
         var link = document.createElement('a');
         link.href = '/continue?via=landing';
         link.textContent = 'Continue where you left off →';
         link.setAttribute('data-continue-banner', '');
         link.style.cssText =
            'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom));z-index:2147483000;' +
            'display:block;width:calc(100% - 32px);max-width:420px;box-sizing:border-box;padding:16px 20px;border-radius:999px;' +
            'background:#6b55f7;color:#fff;font:700 17px/1.2 system-ui,-apple-system,sans-serif;text-align:center;text-decoration:none;' +
            'box-shadow:0 8px 24px rgba(76,35,159,.35);';
         document.body.appendChild(link);
      };
      if (document.readyState !== 'loading') show();
      else document.addEventListener('DOMContentLoaded', show);
   } catch (e) {
      // Cookies unreadable: the Sign in button still works.
   }
})();
