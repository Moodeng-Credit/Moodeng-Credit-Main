// Meta pixel for the "Moodeng Credit | SEA" dataset (Events Manager, portfolio "G").
// Loaded by the React app's index.html and the static landing pages. The pixel follows
// the app's client-side route changes on its own, so each screen counts as a PageView.
!(function (f, b, e, v, n, t, s) {
   if (f.fbq) return;
   n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
   };
   if (!f._fbq) f._fbq = n;
   n.push = n;
   n.loaded = !0;
   n.version = '2.0';
   n.queue = [];
   t = b.createElement(e);
   t.async = !0;
   t.src = v;
   s = b.getElementsByTagName(e)[0];
   s.parentNode.insertBefore(t, s);
})(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1126927369695411');
fbq('track', 'PageView');
