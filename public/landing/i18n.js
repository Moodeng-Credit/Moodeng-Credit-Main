// Spanish for the static public pages. These pages are plain HTML (not the React app), so this swaps the
// English text for Spanish in place, the same idea as the app's LocalizationDomBridge. English stays the
// default; Spanish shows when the visitor picked it (?lang=es, the app's language picker, or the toggle
// below) or when their browser is set to Spanish and they never chose a language.
(function () {
   var STORAGE_KEY = 'md_locale';
   var stored = null;
   var params = new URLSearchParams(window.location.search);
   try {
      stored = window.localStorage.getItem(STORAGE_KEY);
   } catch (e) {}

   var requested = params.get('lang');
   if (requested === 'es' || requested === 'en') {
      stored = requested;
      try {
         window.localStorage.setItem(STORAGE_KEY, requested);
      } catch (e) {}
   }

   function browserPrefersSpanish() {
      var languages = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
      return /^es\b/i.test(languages[0] || '');
   }

   var isSpanish = stored ? stored === 'es' : browserPrefersSpanish();

   function choose(locale) {
      try {
         window.localStorage.setItem(STORAGE_KEY, locale);
      } catch (e) {}
      window.location.reload();
   }

   function addToggle() {
      var wrap = document.createElement('div');
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-label', isSpanish ? 'Idioma' : 'Language');
      wrap.style.cssText =
         'position:fixed;left:12px;bottom:12px;z-index:60;display:flex;gap:2px;padding:3px;border-radius:999px;background:#fff;' +
         'box-shadow:0 2px 10px rgba(44,19,82,.18);font:600 12px/1 system-ui,sans-serif;';
      [
         ['en', 'EN', 'English'],
         ['es', 'ES', 'Español']
      ].forEach(function (item) {
         var active = (item[0] === 'es') === isSpanish;
         var button = document.createElement('button');
         button.type = 'button';
         button.textContent = item[1];
         button.setAttribute('lang', item[0]);
         button.setAttribute('aria-label', item[2]);
         button.setAttribute('aria-pressed', active ? 'true' : 'false');
         button.style.cssText =
            'border:0;cursor:pointer;padding:7px 10px;border-radius:999px;font:inherit;' +
            (active ? 'background:#5b21b6;color:#fff;' : 'background:transparent;color:#4c1d95;');
         button.addEventListener('click', function () {
            if (!active) choose(item[0]);
         });
         wrap.appendChild(button);
      });
      document.body.appendChild(wrap);
   }

   function normalize(value) {
      return value.replace(/\s+/g, ' ').trim();
   }

   function translateSpanish(dictionary) {
      var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, SVG: 1, CODE: 1, PRE: 1 };
      var ATTRIBUTES = ['alt', 'title', 'aria-label', 'placeholder'];

      function translateText(node) {
         var original = node.nodeValue;
         var key = normalize(original);
         if (!key || !Object.prototype.hasOwnProperty.call(dictionary, key)) return;
         var leading = original.match(/^\s*/)[0];
         var trailing = original.match(/\s*$/)[0];
         node.nodeValue = leading + dictionary[key] + trailing;
      }

      function translateAttributes(element) {
         ATTRIBUTES.forEach(function (name) {
            var value = element.getAttribute && element.getAttribute(name);
            if (!value) return;
            var key = normalize(value);
            if (Object.prototype.hasOwnProperty.call(dictionary, key)) element.setAttribute(name, dictionary[key]);
         });
      }

      function walk(root) {
         if (root.nodeType === 3) {
            if (!root.parentNode || !SKIP[root.parentNode.nodeName.toUpperCase()]) translateText(root);
            return;
         }
         if (root.nodeType !== 1 || SKIP[root.nodeName.toUpperCase()]) return;
         translateAttributes(root);
         for (var child = root.firstChild; child; child = child.nextSibling) walk(child);
      }

      document.documentElement.lang = 'es';
      // Spanish words run longer than English ones, and the big headlines are sized for English, so let
      // them hyphenate and break instead of running off the edge.
      var style = document.createElement('style');
      style.textContent =
         'html[lang="es"] h1, html[lang="es"] h2, html[lang="es"] h3 { hyphens: auto; -webkit-hyphens: auto; overflow-wrap: anywhere; }';
      document.head.appendChild(style);
      var title = normalize(document.title);
      if (Object.prototype.hasOwnProperty.call(dictionary, title)) document.title = dictionary[title];
      document
         .querySelectorAll(
            'meta[name="description"], meta[name="twitter:title"], meta[name="twitter:description"], meta[property="og:title"], meta[property="og:description"]'
         )
         .forEach(function (meta) {
            var key = normalize(meta.getAttribute('content') || '');
            if (Object.prototype.hasOwnProperty.call(dictionary, key)) meta.setAttribute('content', dictionary[key]);
         });

      walk(document.body);

      // The interactive examples rewrite their own text, so keep translating what they add.
      new MutationObserver(function (mutations) {
         mutations.forEach(function (mutation) {
            if (mutation.type === 'characterData') translateText(mutation.target);
            mutation.addedNodes.forEach(walk);
         });
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
   }

   function start() {
      addToggle();
      if (!isSpanish) return;
      var script = document.createElement('script');
      script.src = '/landing/i18n-es.js?v=20261103';
      script.onload = function () {
         if (window.MOODENG_LANDING_ES) translateSpanish(window.MOODENG_LANDING_ES);
      };
      document.head.appendChild(script);
   }

   if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
   else start();
})();
