import { type JSX } from 'react';

import { ArrowRight, BookOpen, CalendarDays, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { blogPosts, featuredBlogPost } from '@/views/blogs/blogPosts';
import '@/views/blogs/MoodengBlogs.css';

const topicCards = [
   {
      title: 'Borrower playbooks',
      body: 'How to explain a request, choose a repayment date, and build a record without oversharing.',
      href: '/academy'
   },
   {
      title: 'Lender field notes',
      body: 'What to look for in a request before funding someone you have never met.',
      href: '/whylend'
   },
   {
      title: 'Credit basics',
      body: 'Short explanations of Trust Score, Credit Level, wallets, World ID, and direct USDC repayment.',
      href: '/benefits'
   }
];

export default function MoodengBlogs(): JSX.Element {
   const latestPosts = blogPosts.filter((post) => post.slug !== featuredBlogPost.slug);

   return (
      <main className="moodeng-blogs">
         <section className="blogs-hero" aria-labelledby="blogs-heading">
            <div className="blogs-hero__copy">
               <p className="blogs-kicker">Moodeng Blogs</p>
               <h1 id="blogs-heading">Small-loan ideas for real borrowers and careful lenders</h1>
               <p>
                  Practical notes from the Moodeng team on direct USDC loans, repayment behavior, borrower context, and how trust can grow
                  from small commitments.
               </p>
               <div className="blogs-hero__actions">
                  <Link to="/academy" className="blogs-button blogs-button--primary">
                     Start with Academy
                     <ArrowRight aria-hidden="true" size={18} />
                  </Link>
                  <a
                     href="https://moodeng-credit.gitbook.io/moodeng-credit"
                     target="_blank"
                     rel="noreferrer"
                     className="blogs-button blogs-button--secondary"
                  >
                     Read docs
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
                     Read featured note
                     <ArrowRight aria-hidden="true" size={17} />
                  </Link>
               </div>
            </article>
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
               <p className="blogs-kicker">Latest notes</p>
               <h2 id="latest-blogs-heading">Read what matters before the next request</h2>
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
                           Read note
                           <ArrowRight aria-hidden="true" size={17} />
                        </Link>
                     </div>
                  </article>
               ))}
            </div>
         </section>

         <section className="blogs-closing" aria-labelledby="blogs-closing-heading">
            <div>
               <p className="blogs-kicker">Build from the basics</p>
               <h2 id="blogs-closing-heading">New to Moodeng?</h2>
               <p>Start with the borrower flow, then come back to the blog when you want deeper context behind the product decisions.</p>
            </div>
            <Link to="/request-board" className="blogs-button blogs-button--primary">
               Explore request board
               <ArrowRight aria-hidden="true" size={18} />
            </Link>
         </section>
      </main>
   );
}
