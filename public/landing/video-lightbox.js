// Borrower videos play in a pop-up on the page instead of sending people away to YouTube
// (a new tab loses them, and inside Facebook's browser it often opens the YouTube app).
// Any link to a YouTube Short on the page gets this; without JavaScript the link still works.
// Loaded by the home page and its phone version.
(function () {
   try {
      var links = document.querySelectorAll('a[href*="youtube.com/shorts/"]');
      if (!links.length) return;
      var overlay = null;
      var lastFocus = null;

      var close = function () {
         if (!overlay) return;
         overlay.remove();
         overlay = null;
         document.documentElement.style.overflow = '';
         if (lastFocus && lastFocus.focus) lastFocus.focus();
      };

      var open = function (id, opener) {
         close();
         lastFocus = opener;
         overlay = document.createElement('div');
         overlay.setAttribute('role', 'dialog');
         overlay.setAttribute('aria-modal', 'true');
         overlay.setAttribute('aria-label', 'Borrower video');
         overlay.style.cssText =
            'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;' +
            'background:rgba(10,8,14,.92);padding:56px 16px 24px';
         var frame = document.createElement('div');
         // A Short is 9:16: as tall as fits, never wider than the screen.
         frame.style.cssText =
            'position:relative;height:min(100%,720px);aspect-ratio:9/16;max-width:100%;background:#000;border:1.5px solid #FFF9EC';
         var iframe = document.createElement('iframe');
         iframe.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&playsinline=1&rel=0&modestbranding=1';
         iframe.title = 'Borrower video';
         iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
         iframe.allowFullscreen = true;
         iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0';
         var button = document.createElement('button');
         button.type = 'button';
         button.textContent = 'Close ✕';
         button.style.cssText =
            'position:absolute;top:12px;right:12px;min-height:40px;border:0;border-radius:999px;background:#FFD43B;color:#141216;' +
            'padding:0 16px;font:inherit;font-size:15px;font-weight:800;cursor:pointer';
         button.addEventListener('click', close);
         overlay.addEventListener('click', function (event) {
            if (event.target === overlay) close();
         });
         frame.appendChild(iframe);
         overlay.appendChild(frame);
         overlay.appendChild(button);
         document.body.appendChild(overlay);
         document.documentElement.style.overflow = 'hidden';
         button.focus();
      };

      document.addEventListener('keydown', function (event) {
         if (event.key === 'Escape') close();
      });

      // One listener for the whole page: the phone photo strip clones its cards after load.
      document.addEventListener('click', function (event) {
         var link = event.target.closest ? event.target.closest('a[href*="youtube.com/shorts/"]') : null;
         if (!link) return;
         var match = /youtube\.com\/shorts\/([\w-]{11})/.exec(link.getAttribute('href') || '');
         if (!match) return;
         // Leave "open in new tab" clicks alone.
         if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
         event.preventDefault();
         open(match[1], link);
      });
   } catch (e) {
      // The plain links still work.
   }
})();
