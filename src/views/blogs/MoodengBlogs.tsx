import { type JSX } from 'react';

import { ArrowRight, BookOpen, CalendarDays, Clock3, Headphones } from 'lucide-react';
import { Link } from 'react-router-dom';

import { blogPosts, featuredBlogPost, podcastUrl } from '@/views/blogs/blogPosts';
import '@/views/blogs/MoodengBlogs.css';

const topicCards = [
   {
      title: 'Shadow lending systems',
      body: 'How friendly loan apps, fake brands, and contact-list pressure turn small debt into control.',
      href: `/blogs/${blogPosts[0].slug}`
   },
   {
      title: 'Borrower dignity',
      body: 'Why fair credit has to work without humiliation, doxxing, or private-life performance.',
      href: `/blogs/${blogPosts[2].slug}`
   },
   {
      title: 'Lender judgment',
      body: 'How to read work rhythm, payday fit, and repayment context without demanding too much.',
      href: `/blogs/${blogPosts[3].slug}`
   },
   {
      title: 'Credit as infrastructure',
      body: 'What oil pipelines can teach us about gatekeepers, access, and informal lending.',
      href: `/blogs/${blogPosts[5].slug}`
   }
];

export default function MoodengBlogs(): JSX.Element {
   const latestPosts = blogPosts.filter((post) => post.slug !== featuredBlogPost.slug);

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
                  <Link to={`/blogs/${featuredBlogPost.slug}`} className="blogs-button blogs-button--primary">
                     Read the lead essay
                     <ArrowRight aria-hidden="true" size={18} />
                  </Link>
                  <a href={podcastUrl} target="_blank" rel="noreferrer" className="blogs-button blogs-button--secondary">
                     Listen on Spotify
                  </a>
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

         <section className="blogs-topic-strip" aria-label="Blog topics">
            {topicCards.map((topic) => (
               <Link to={topic.href} className="blogs-topic" key={topic.title}>
                  <BookOpen aria-hidden="true" size={20} />
                  <span>
                     <strong>{topic.title}</strong>
                     {topic.body}
                  </span>
               </Link>
            ))}
         </section>

         <section className="blogs-feed" aria-labelledby="latest-blogs-heading">
            <div className="blogs-section-heading">
               <p className="blogs-kicker">Latest essays</p>
               <h2 id="latest-blogs-heading">Beyond guides and FAQs</h2>
            </div>

            <div className="blogs-grid">
               {latestPosts.map((post) => (
                  <article className={`blogs-post-card blogs-post-card--${post.accent}`} key={post.slug}>
                     <div className="blogs-post-card__image">
                        <img src={post.image} alt={post.imageAlt} />
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
