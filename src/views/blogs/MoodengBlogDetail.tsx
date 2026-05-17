import { type JSX, useLayoutEffect } from 'react';

import { ArrowRight, CalendarDays, Clock3 } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { blogPosts, findBlogPost } from '@/views/blogs/blogPosts';
import '@/views/blogs/MoodengBlogs.css';

export default function MoodengBlogDetail(): JSX.Element {
   const { slug } = useParams();
   const post = findBlogPost(slug);

   useLayoutEffect(() => {
      window.scrollTo({ left: 0, top: 0 });
   }, [slug]);

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

            <div className="blog-article__body">
               {post.sections.map((section) => (
                  <section key={section.heading}>
                     <h2>{section.heading}</h2>
                     <p>{section.body}</p>
                  </section>
               ))}
            </div>
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
