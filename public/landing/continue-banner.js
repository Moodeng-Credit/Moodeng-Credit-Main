// Signed in in this browser (the app keeps its Supabase session in a cookie). The app also leaves an
// md_landing cookie saying where they are (src/lib/landingSessionCookie.ts):
//   signout — all set: "Sign in" becomes "Sign out", no banner.
//   continue (or not known yet) — still signing up / onboarding / applying: "Continue where you left off".
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
      var show = function () {
         if (allSet) {
            relabel('Sign out', '/sign-out');
            return;
         }
         relabel('Continue', '/continue?via=landing');
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
