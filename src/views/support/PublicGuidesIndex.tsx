import type { JSX } from 'react';

import { Link } from 'react-router-dom';

import { usePageSeo } from '@/hooks/usePageSeo';
import { useLocalization } from '@/i18n';
import { getGuidesForLocale } from '@/views/support/data/guides';

import '@/views/support/PublicGuide.css';

const PAGE_TITLE = 'Moodeng Academy — Guides';
const PAGE_DESCRIPTION =
   'Plain-language guides to borrowing on Moodeng Credit: Credit Levels, Trust Scores, USDC loans, repayments, verification, and account security.';

function firstLine(body: string): string {
   const flat = body.replace(/\s+/g, ' ').trim();
   if (flat.length <= 120) return flat;
   return `${flat.slice(0, 117).replace(/\s+\S*$/, '')}…`;
}

export default function PublicGuidesIndex(): JSX.Element {
   const { locale } = useLocalization();
   const guides = getGuidesForLocale(locale);

   usePageSeo({
      title: `${PAGE_TITLE} | Moodeng Credit`,
      description: PAGE_DESCRIPTION,
      canonicalPath: '/learn',
      jsonLd: [
         {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: PAGE_TITLE,
            description: PAGE_DESCRIPTION,
            mainEntity: {
               '@type': 'ItemList',
               itemListElement: guides.map((guide, index) => ({
                  '@type': 'ListItem',
                  position: index + 1,
                  name: guide.title,
                  url: `https://home.moodeng.app/learn/${guide.slug}`
               }))
            }
         }
      ]
   });

   return (
      <main className="public-guide public-guide--index">
         <header className="public-guide__index-head">
            <p className="public-guide__eyebrow">Moodeng Academy</p>
            <h1>Guides</h1>
            <p className="public-guide__index-sub">
               Everything you need to borrow with confidence — how Credit Levels grow, what your Trust Score means, and
               how USDC loans work.
            </p>
         </header>

         <div className="public-guide__index-grid">
            {guides.map((guide) => (
               <Link key={guide.slug} to={`/learn/${guide.slug}`} className="public-guide__index-card">
                  <h2>{guide.title}</h2>
                  <p>{firstLine(guide.body)}</p>
                  <em aria-hidden="true">Read guide →</em>
               </Link>
            ))}
         </div>
      </main>
   );
}
