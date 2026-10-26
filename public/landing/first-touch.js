// Where visitors came from (?src= post links), for the phone home page (old-mobile.html), which doesn't
// load site.js (site.js has the same block for the desktop page). Saves the first visit in the shape
// src/lib/attribution.ts uses (same site, same localStorage), so the app tags the account with it at
// sign-up, and counts a click on an Admin → Post link, once per browser.
(function () {
   try {
      var params = new URLSearchParams(window.location.search);
      var clean = function (value) {
         if (!value) return null;
         var v = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(0, 80);
         return v || null;
      };
      var src = clean(params.get('src') || params.get('utm_source'));
      var referrer = null;
      try {
         if (document.referrer) {
            var host = new URL(document.referrer).hostname.replace(/^www\./, '');
            referrer = host === window.location.hostname.replace(/^www\./, '') ? null : host;
         }
      } catch (e) {}
      var saved = window.localStorage.getItem('md_first_touch');
      var previous = saved ? JSON.parse(saved) : null;
      if (!previous || (!previous.src && src)) {
         window.localStorage.setItem(
            'md_first_touch',
            JSON.stringify({
               src: src,
               campaign: clean(params.get('utm_campaign')),
               referrer: referrer,
               landing: window.location.pathname.slice(0, 120),
               at: new Date().toISOString()
            })
         );
      }
      var linkSrc = clean(params.get('src'));
      if (linkSrc) {
         var clicked = JSON.parse(window.localStorage.getItem('md_post_link_clicked') || '[]');
         if (clicked.indexOf(linkSrc) === -1) {
            window.localStorage.setItem('md_post_link_clicked', JSON.stringify(clicked.concat([linkSrc]).slice(-50)));
            fetch('https://qplmmxynzxzkfxtayoqr.supabase.co/rest/v1/rpc/record_post_link_click', {
               method: 'POST',
               headers: { apikey: 'sb_publishable_iS4m6B9ej4AUhve4pkj29w_5TDEUNzh', 'Content-Type': 'application/json' },
               body: JSON.stringify({ p_src: linkSrc }),
               keepalive: true
            }).catch(function () {});
         }
      }
   } catch (e) {
      // Storage blocked: this visit just isn't attributed.
   }
})();
