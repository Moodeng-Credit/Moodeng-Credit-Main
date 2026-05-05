import { type JSX } from 'react';

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
                  Hear directly from borrowers who have used Moodeng when short-term support mattered.
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
         </div>
      </section>
   );
}
