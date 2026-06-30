import type { JSX } from 'react';

import { Link, Navigate, useParams } from 'react-router-dom';

import { usePageSeo } from '@/hooks/usePageSeo';
import { useLocalization } from '@/i18n';
import HowCreditLevelsWork from '@/views/support/HowCreditLevelsWork';
import NeedMoreHelp from '@/views/support/components/NeedMoreHelp';
import { type GuideArticle, getGuideForLocale, getGuidesForLocale } from '@/views/support/data/guides';

import '@/views/support/PublicGuide.css';

function metaDescription(body: string): string {
   const flat = body.replace(/\s+/g, ' ').trim();
   if (flat.length <= 155) return flat;
   return `${flat.slice(0, 152).replace(/\s+\S*$/, '')}…`;
}

function GuideArticleView({ guide, slug, locale }: { guide: GuideArticle; slug: string; locale: string }): JSX.Element {
   const description = metaDescription(guide.body);
   const related = getGuidesForLocale(locale)
      .filter((item) => item.slug !== slug)
      .slice(0, 3);

   usePageSeo({
      title: `${guide.title} | Moodeng Credit`,
      description,
      canonicalPath: `/learn/${slug}`,
      jsonLd: [
         {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: guide.title,
            description,
            datePublished: guide.lastUpdated,
            dateModified: guide.lastUpdated,
            author: { '@type': 'Organization', name: 'Moodeng Credit' },
            publisher: { '@type': 'Organization', name: 'Moodeng Credit' },
            mainEntityOfPage: `https://home.moodeng.app/learn/${slug}`
         }
      ]
   });

   return (
      <main className="public-guide">
         <nav className="public-guide__breadcrumb" aria-label="Breadcrumb">
            <Link to="/academy">Academy</Link>
            <span aria-hidden="true">/</span>
            <Link to="/learn">Guides</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{guide.title}</span>
         </nav>

         <article className="public-guide__article">
            <p className="public-guide__eyebrow">Moodeng Academy</p>
            <h1>{guide.title}</h1>
            <p className="public-guide__meta">By the Moodeng Team · Updated {guide.lastUpdated}</p>
            <div className="public-guide__body">{guide.body}</div>
         </article>

         {related.length > 0 ? (
            <section className="public-guide__related" aria-label="More guides">
               <h2>More guides</h2>
               <div className="public-guide__related-grid">
                  {related.map((item) => (
                     <Link key={item.slug} to={`/learn/${item.slug}`} className="public-guide__related-card">
                        <strong>{item.title}</strong>
                        <em aria-hidden="true">Read guide →</em>
                     </Link>
                  ))}
               </div>
            </section>
         ) : null}

         <div className="public-guide__help">
            <NeedMoreHelp />
         </div>
      </main>
   );
}

export default function PublicGuide(): JSX.Element {
   const { slug } = useParams<{ slug: string }>();
   const { locale } = useLocalization();

   // The Credit Levels guide has its own rich, illustrated public page.
   if (slug === 'how-credit-levels-work') {
      return <HowCreditLevelsWork variant="public" />;
   }

   const guide = getGuideForLocale(slug, locale);
   if (!guide || !slug) {
      return <Navigate to="/learn" replace />;
   }

   return <GuideArticleView guide={guide} slug={slug} locale={locale} />;
}
