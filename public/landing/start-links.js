// "Get your first loan" buttons (a[data-start]) open sign-up directly for people who aren't signed in.
// They used to open the request board, where a new visitor had to find "Apply For A Loan" to reach
// sign-up (Nov 2026: about half the people who tapped the button never got past the board).
// Signed-in people keep the request board link, which continue-banner.js relabels for them.
// Loaded by the home page and its phone version.
(function () {
   try {
      if (/(?:^|;\s*)sb-[a-z0-9]+-auth-token(?:\.0)?=/i.test(document.cookie)) return;
      document.querySelectorAll('a[data-start]').forEach(function (link) {
         link.setAttribute('href', '/sign-up');
      });
   } catch (e) {
      // Leave the links as they are.
   }
})();
