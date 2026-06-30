import { useEffect } from 'react';

interface PageSeoOptions {
   /** Full <title> text, e.g. "How Credit Levels Work | Moodeng Credit". */
   title: string;
   description: string;
   /** Path only, e.g. "/learn/foo". Combined with the runtime origin for canonical + og:url. */
   canonicalPath: string;
   /** Optional structured-data objects rendered into a single application/ld+json script. */
   jsonLd?: object[];
   /** Absolute or root-relative og:image. Defaults to the Moodeng brand logo. */
   image?: string;
}

/**
 * Injects SEO tags (title, description, Open Graph, canonical, JSON-LD) while a
 * page is mounted and restores the previous values on unmount. Client-side only —
 * good enough for JS-rendering crawlers like Googlebot; pair with sitemap.xml and
 * a public route so the page is actually discoverable.
 */
export function usePageSeo({ title, description, canonicalPath, jsonLd, image }: PageSeoOptions): void {
   const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : '';

   useEffect(() => {
      const previousTitle = document.title;
      document.title = title;

      const created: HTMLElement[] = [];
      const touched: Array<{ el: HTMLMetaElement; previous: string | null }> = [];

      const setMeta = (selector: string, attr: 'name' | 'property', key: string, content: string) => {
         let el = document.head.querySelector<HTMLMetaElement>(selector);
         if (el) {
            touched.push({ el, previous: el.getAttribute('content') });
         } else {
            el = document.createElement('meta');
            el.setAttribute(attr, key);
            document.head.appendChild(el);
            created.push(el);
         }
         el.setAttribute('content', content);
      };

      const origin = window.location.origin;
      const canonicalUrl = `${origin}${canonicalPath}`;
      const imageUrl = image ? (image.startsWith('http') ? image : `${origin}${image}`) : `${origin}/brand/moodeng-logo.png`;

      setMeta('meta[name="description"]', 'name', 'description', description);
      setMeta('meta[property="og:title"]', 'property', 'og:title', title);
      setMeta('meta[property="og:description"]', 'property', 'og:description', description);
      setMeta('meta[property="og:type"]', 'property', 'og:type', 'article');
      setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
      setMeta('meta[property="og:image"]', 'property', 'og:image', imageUrl);
      setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');

      let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      const previousCanonical = canonical?.getAttribute('href') ?? null;
      const canonicalCreated = !canonical;
      if (!canonical) {
         canonical = document.createElement('link');
         canonical.setAttribute('rel', 'canonical');
         document.head.appendChild(canonical);
      }
      canonical.setAttribute('href', canonicalUrl);

      let jsonLdScript: HTMLScriptElement | null = null;
      if (jsonLd && jsonLd.length > 0) {
         jsonLdScript = document.createElement('script');
         jsonLdScript.type = 'application/ld+json';
         jsonLdScript.textContent = JSON.stringify(jsonLd.length === 1 ? jsonLd[0] : jsonLd);
         document.head.appendChild(jsonLdScript);
      }

      return () => {
         document.title = previousTitle;
         for (const { el, previous } of touched) {
            if (previous === null) el.removeAttribute('content');
            else el.setAttribute('content', previous);
         }
         for (const el of created) el.remove();
         if (jsonLdScript) jsonLdScript.remove();
         if (canonical) {
            if (canonicalCreated) canonical.remove();
            else if (previousCanonical !== null) canonical.setAttribute('href', previousCanonical);
         }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [title, description, canonicalPath, image, jsonLdKey]);
}
