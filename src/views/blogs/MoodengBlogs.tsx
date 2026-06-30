import { type JSX, useMemo, useState } from 'react';

import { ArrowRight, CalendarDays, Clock3, Headphones } from 'lucide-react';
import { Link } from 'react-router-dom';

import { usePageSeo } from '@/hooks/usePageSeo';
import { type BlogPost, blogPosts, featuredBlogPost, leadBlogPost, podcastUrl } from '@/views/blogs/blogPosts';
import '@/views/blogs/MoodengBlogs.css';

const BLOG_INDEX_DESCRIPTION =
   'Essays and podcast companions from Moodeng Credit on loan sharks, credit invisibility, borrower dignity, and why fair small-USDC lending needs a different kind of trust.';

export default function MoodengBlogs(): JSX.Element {
   const [audienceFilter, setAudienceFilter] = useState<BlogPost['audience'] | 'All'>('All');

   usePageSeo({
      title: 'Moodeng Blog — The human side of fair credit | Moodeng Credit',
      description: BLOG_INDEX_DESCRIPTION,
      canonicalPath: '/blogs',
      jsonLd: [
         {
            '@context': 'https://schema.org',
            '@type': 'Blog',
            name: 'Moodeng Blog',
            description: BLOG_INDEX_DESCRIPTION,
            url: 'https://home.moodeng.app/blogs',
            blogPost: blogPosts.map((post) => ({
               '@type': 'BlogPosting',
               headline: post.title,
               url: `https://home.moodeng.app/blogs/${post.slug}`
            }))
         }
      ]
   });

   const latestPosts = useMemo(() => blogPosts.filter((post) => post.slug !== featuredBlogPost.slug), []);
   const audienceFilters = useMemo(
      () => ['All', ...new Set(latestPosts.map((post) => post.audience))] as Array<BlogPost['audience'] | 'All'>,
      [latestPosts]
   );
   const visiblePosts = useMemo(
      () => (audienceFilter === 'All' ? latestPosts : latestPosts.filter((post) => post.audience === audienceFilter)),
      [audienceFilter, latestPosts]
   );

   return (
      <main className="moodeng-blogs">
         <section className="blogs-hero" aria-labelledby="blogs-heading">
            <div className="blogs-hero__copy">
               <p className="blogs-kicker">Moodeng Blogs</p>
               <h1 id="blogs-heading">The human side of fair credit</h1>
               <p>
                  Essays and podcast companions on loan sharks, credit invisibility, borrower dignity, lender judgment, and why small USDC
                  loans need a different kind of trust.
               </p>
               <div className="blogs-hero__actions">
                  <Link to={`/blogs/${leadBlogPost.slug}`} className="blogs-button blogs-button--primary">
                     Read the lead essay
                     <ArrowRight aria-hidden="true" size={18} />
                  </Link>
               </div>
            </div>

            <article className="blogs-featured" aria-label="Featured blog post">
               <div className="blogs-featured__image">
                  <img src={featuredBlogPost.image} alt={featuredBlogPost.imageAlt} />
               </div>
               <div className="blogs-featured__body">
                  <div className="blogs-post-meta">
                     <span>{featuredBlogPost.category}</span>
                     <span>{featuredBlogPost.readTime}</span>
                  </div>
                  <h2>{featuredBlogPost.title}</h2>
                  <p>{featuredBlogPost.dek}</p>
                  <Link to={`/blogs/${featuredBlogPost.slug}`} className="blogs-inline-link">
                     Read featured essay
                     <ArrowRight aria-hidden="true" size={17} />
                  </Link>
               </div>
            </article>
         </section>

         <section className="blogs-podcast" aria-label="Moodeng podcast">
            <div>
               <p className="blogs-kicker">Podcast</p>
               <h2>The Shadow Systems of Credit Identity</h2>
               <p>
                  The podcast goes deeper on the uncomfortable part of financial inclusion: what happens when the first credit product a
                  person meets is built to harvest data, manufacture pressure, and disappear.
               </p>
            </div>
            <a href={podcastUrl} target="_blank" rel="noreferrer" className="blogs-button blogs-button--primary">
               <Headphones aria-hidden="true" size={18} />
               Open Spotify
            </a>
         </section>

         <section className="blogs-feed" aria-labelledby="latest-blogs-heading">
            <div className="blogs-section-heading">
               <p className="blogs-kicker">Latest essays</p>
               <h2 id="latest-blogs-heading">More essays to explore</h2>
            </div>

            <div className="blogs-filter" role="group" aria-label="Filter essays by audience">
               {audienceFilters.map((option) => (
                  <button
                     key={option}
                     type="button"
                     className={`blogs-filter__option${audienceFilter === option ? ' blogs-filter__option--active' : ''}`}
                     aria-pressed={audienceFilter === option}
                     onClick={() => setAudienceFilter(option)}
                  >
                     {option}
                  </button>
               ))}
            </div>

            <div className="blogs-grid">
               {visiblePosts.map((post) => (
                  <article className={`blogs-post-card blogs-post-card--${post.accent}`} key={post.slug}>
                     <div className="blogs-post-card__image">
                        <img src={post.image} alt={post.imageAlt} />
                        {post.slug === leadBlogPost.slug ? <span className="blogs-post-card__badge">Lead essay</span> : null}
                     </div>
                     <div className="blogs-post-card__content">
                        <div className="blogs-post-meta">
                           <span>{post.category}</span>
                           <span>{post.audience}</span>
                        </div>
                        <h3>{post.title}</h3>
                        <p>{post.dek}</p>
                        <div className="blogs-post-card__footer">
                           <span>
                              <CalendarDays aria-hidden="true" size={16} />
                              {post.publishedAt}
                           </span>
                           <span>
                              <Clock3 aria-hidden="true" size={16} />
                              {post.readTime}
                           </span>
                        </div>
                        <Link to={`/blogs/${post.slug}`} className="blogs-inline-link">
                           Read essay
                           <ArrowRight aria-hidden="true" size={17} />
                        </Link>
                     </div>
                  </article>
               ))}
            </div>
         </section>

         <section className="blogs-closing" aria-labelledby="blogs-closing-heading">
            <div>
               <p className="blogs-kicker">Build the alternative</p>
               <h2 id="blogs-closing-heading">Fair credit is not just nicer copy.</h2>
               <p>It has to change what data is collected, how repayment pressure works, and who owns the record after the loan is done.</p>
            </div>
            <Link to="/request-board" className="blogs-button blogs-button--primary">
               Explore request board
               <ArrowRight aria-hidden="true" size={18} />
            </Link>
         </section>
      </main>
   );
}
