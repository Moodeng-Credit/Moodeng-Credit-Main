import { type JSX, useLayoutEffect } from 'react';

import { ArrowRight, CalendarDays, Clock3 } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { usePageSeo } from '@/hooks/usePageSeo';
import { blogPosts, findBlogPost } from '@/views/blogs/blogPosts';
import '@/views/blogs/MoodengBlogs.css';

const SITE_ORIGIN = 'https://moodeng.app';

export default function MoodengBlogDetail(): JSX.Element {
   const { slug } = useParams();
   const post = findBlogPost(slug);

   useLayoutEffect(() => {
      window.scrollTo({ left: 0, top: 0 });
   }, [slug]);

   // Per-route SEO (title, description, canonical, Open Graph) + Article/FAQ JSON-LD.
   // Absolute URLs use the fixed production origin so the prerendered <head> is correct
   // regardless of the host the snapshot runs on. usePageSeo must run unconditionally
   // (before any early return), so it falls back to the index when the slug is unknown.
   const canonicalPath = post ? `/blogs/${post.slug}` : '/blogs';
   const description = post ? (post.metaDescription ?? post.dek) : 'Notes on fair small-loan credit from Moodeng Credit.';
   const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;
   const faqEntities = post?.faq?.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer }
   }));
   const blogJsonLd: object[] | undefined = post
      ? [
           {
              '@context': 'https://schema.org',
              '@graph': [
                 {
                    '@type': 'BlogPosting',
                    headline: post.title,
                    description,
                    datePublished: '2026-05-18',
                    dateModified: '2026-05-18',
                    image: `${SITE_ORIGIN}${post.image}`,
                    mainEntityOfPage: canonicalUrl,
                    author: { '@type': 'Organization', name: 'Moodeng Credit' },
                    publisher: { '@type': 'Organization', name: 'Moodeng Credit', url: SITE_ORIGIN },
                    keywords: post.keywords?.join(', ')
                 },
                 ...(faqEntities?.length ? [{ '@type': 'FAQPage', mainEntityOfPage: canonicalUrl, mainEntity: faqEntities }] : [])
              ]
           }
        ]
      : undefined;

   usePageSeo({
      title: post ? (post.seoTitle ?? `${post.title} | Moodeng`) : 'Moodeng blog | Moodeng Credit',
      description,
      canonicalPath,
      image: post?.image,
      jsonLd: blogJsonLd
   });

   if (!post) {
      return <Navigate to="/blogs" replace />;
   }

   const relatedPosts = blogPosts.filter((candidate) => candidate.slug !== post.slug).slice(0, 3);

   return (
      <main className="moodeng-blog-detail">
         <article className="blog-article">
            <Link to="/blogs" className="blog-back-link">
               Back to blogs
            </Link>

            <header className={`blog-article__header blog-article__header--${post.accent}`}>
               <div className="blog-article__copy">
                  <div className="blogs-post-meta">
                     <span>{post.category}</span>
                     <span>{post.audience}</span>
                  </div>
                  <h1>{post.title}</h1>
                  <p>{post.dek}</p>
                  <div className="blog-article__facts">
                     <span>
                        <CalendarDays aria-hidden="true" size={17} />
                        {post.publishedAt}
                     </span>
                     <span>
                        <Clock3 aria-hidden="true" size={17} />
                        {post.readTime}
                     </span>
                  </div>
                  {post.sourceLabel ? (
                     <div className="blog-source">
                        {post.sourceHref ? (
                           <a href={post.sourceHref} target="_blank" rel="noreferrer">
                              {post.sourceLabel}
                              <ArrowRight aria-hidden="true" size={16} />
                           </a>
                        ) : (
                           <span>{post.sourceLabel}</span>
                        )}
                     </div>
                  ) : null}
               </div>
               <div className="blog-article__image">
                  <img src={post.image} alt={post.imageAlt} />
               </div>
            </header>

            {post.summary?.length ? (
               <section className="blog-quick-answer" aria-labelledby="blog-quick-answer-heading">
                  <p className="blogs-kicker">Quick answer</p>
                  <h2 id="blog-quick-answer-heading">What this piece says</h2>
                  <ul>
                     {post.summary.map((item) => (
                        <li key={item}>{item}</li>
                     ))}
                  </ul>
               </section>
            ) : null}

            <div className="blog-article__body">
               {post.sections.map((section) => {
                  const paragraphs = Array.isArray(section.body) ? section.body : [section.body];

                  return (
                     <section key={section.heading}>
                        <h2>{section.heading}</h2>
                        {paragraphs.map((paragraph) => (
                           <p key={paragraph}>{paragraph}</p>
                        ))}
                        {section.evidenceImages?.length ? (
                           <div className="blog-evidence-grid">
                              {section.evidenceImages.map((image) => (
                                 <figure className="blog-evidence-card" key={image.src}>
                                    <img src={image.src} alt={image.alt} loading="lazy" />
                                    <figcaption>{image.caption}</figcaption>
                                 </figure>
                              ))}
                           </div>
                        ) : null}
                     </section>
                  );
               })}
            </div>

            {post.faq?.length ? (
               <section className="blog-faq" aria-labelledby="blog-faq-heading">
                  <p className="blogs-kicker">Common questions</p>
                  <h2 id="blog-faq-heading">Fast answers for readers</h2>
                  {post.faq.map((item) => (
                     <div className="blog-faq__item" key={item.question}>
                        <h3>{item.question}</h3>
                        <p>{item.answer}</p>
                     </div>
                  ))}
               </section>
            ) : null}

            {post.sources?.length ? (
               <aside className="blog-sources" aria-labelledby="blog-sources-heading">
                  <p className="blogs-kicker">Sources</p>
                  <h2 id="blog-sources-heading">References and research notes</h2>
                  <ul>
                     {post.sources.map((source) => (
                        <li key={source.label}>
                           {source.href ? (
                              <a href={source.href} target="_blank" rel="noreferrer">
                                 {source.label}
                                 <ArrowRight aria-hidden="true" size={15} />
                              </a>
                           ) : (
                              <span>{source.label}</span>
                           )}
                        </li>
                     ))}
                  </ul>
               </aside>
            ) : null}
         </article>

         <aside className="blog-related" aria-labelledby="related-blog-heading">
            <div className="blogs-section-heading">
               <p className="blogs-kicker">Keep reading</p>
               <h2 id="related-blog-heading">Related Moodeng notes</h2>
            </div>
            <div className="blog-related__grid">
               {relatedPosts.map((related) => (
                  <Link to={`/blogs/${related.slug}`} className="blog-related-card" key={related.slug}>
                     <span>{related.category}</span>
                     <strong>{related.title}</strong>
                     <ArrowRight aria-hidden="true" size={17} />
                  </Link>
               ))}
            </div>
         </aside>
      </main>
   );
}
