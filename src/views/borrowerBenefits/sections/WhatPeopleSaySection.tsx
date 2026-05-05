import { type JSX } from 'react';

const testimonials = [
   {
      name: 'Yolo_Finance2010',
      role: 'Verified Borrower',
      quote: "I never thought I'd be able to get a loan, let alone build credit. Moodeng changed that for me. It's not just about the money - it's about feeling like I have a real shot at my dreams now.",
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&h=160&q=80'
   },
   {
      name: 'CryptoKween69',
      role: 'Active Lender',
      quote: "The whole process is so straightforward. No hidden fees, no confusing terms. Just simple, honest lending. It's refreshing to use this.",
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&h=160&q=80'
   },
   {
      name: 'WanderLust3000',
      role: 'Verified Borrower',
      quote: 'As someone who moves around a lot for work, having a credit score that travels with me is incredible. Moodeng has made my lifestyle so much easier.',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&h=160&q=80'
   },
   {
      name: 'StonksWizard42',
      role: 'Active Lender',
      quote: "I love being able to help people while earning a bit on the side. Even though it's all digital. It's pretty cool to see the direct impact on me.",
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=160&h=160&q=80'
   }
];

const borrowerTestimonialVideos = [
   {
      title: 'Borrower testimonial',
      label: 'Real testimonial',
      heading: 'A borrower story, in their own words',
      description: 'A real borrower shares what Moodeng support feels like when the need is immediate.',
      url: 'https://youtube.com/shorts/2ZmuK7Vq40k?feature=share',
      embedUrl: 'https://www.youtube.com/embed/2ZmuK7Vq40k'
   },
   {
      title: 'Borrower testimonial two',
      label: 'Another borrower',
      heading: 'Another voice from the borrower side',
      description: 'A second borrower perspective helps the section feel more human and less like a single example.',
      url: 'https://youtube.com/shorts/t8dnE2h4mNk?feature=share',
      embedUrl: 'https://www.youtube.com/embed/t8dnE2h4mNk'
   }
];

export default function WhatPeopleSaySection(): JSX.Element {
   return (
      <section className="borrower-proof-section flex overflow-hidden flex-col justify-center px-20 py-24 mt-20 max-w-full w-[1440px] max-md:px-5 max-md:py-14 max-md:mt-0">
         <div className="flex flex-col max-md:max-w-full">
            <div className="flex flex-col max-w-[760px] text-neutral-100">
               <div className="text-md-b2 font-semibold uppercase tracking-[0.16em] text-md-primary-300">What people are saying</div>
               <h2 className="mt-4 text-5xl font-semibold leading-tight max-md:text-4xl">Borrowers and lenders describe the difference</h2>
               <p className="mt-5 text-xl leading-8 text-violet-100 max-md:text-md-b1">
                  Hear directly from borrowers, then browse a few examples of the kind of feedback Moodeng is designed around.
               </p>
            </div>

            <div className="borrower-testimonial-video-grid mt-10">
               {borrowerTestimonialVideos.map((video) => (
                  <div className="borrower-testimonial-video" key={video.url}>
                     <div className="borrower-testimonial-video__frame">
                        <iframe
                           src={video.embedUrl}
                           title={video.title}
                           allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                           allowFullScreen
                        />
                     </div>
                     <div className="borrower-testimonial-video__copy">
                        <div className="text-md-b2 font-semibold uppercase tracking-[0.16em] text-md-primary-300">{video.label}</div>
                        <h3>{video.heading}</h3>
                        <p>{video.description}</p>
                        <a href={video.url} target="_blank" rel="noreferrer">
                           Open on YouTube
                        </a>
                     </div>
                  </div>
               ))}
            </div>

            <div className="mt-10 grid grid-cols-2 gap-5 max-md:grid-cols-1">
               {testimonials.map((testimonial) => (
                  <article key={testimonial.name} className="rounded-[24px] border border-white/10 bg-white/[0.045] p-6 shadow-md-card">
                     <div className="flex items-center gap-4">
                        <img
                           alt=""
                           loading="lazy"
                           src={testimonial.avatar}
                           className="size-16 rounded-full border-2 border-md-primary-300/40 object-cover"
                           width={64}
                           height={64}
                        />
                        <div>
                           <div className="text-md-b1 font-semibold text-neutral-100">{testimonial.name}</div>
                           <div className="mt-1 text-md-b2 text-violet-100/70">{testimonial.role}</div>
                        </div>
                     </div>
                     <blockquote className="mt-6 text-xl leading-8 text-violet-100 max-md:text-md-b1">"{testimonial.quote}"</blockquote>
                  </article>
               ))}
            </div>
         </div>
      </section>
   );
}
