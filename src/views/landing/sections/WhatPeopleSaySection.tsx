import { type JSX } from 'react';

export default function WhatPeopleSaySection(): JSX.Element {
   const testimonials = [
      {
         quote: "Moodeng's microloans helped me launch my small business. The gradual credit limit increase was perfect for me. Banks here in Rwanda don't help!",
         username: 'SmaLLBizHustler',
         role: 'Verified Borrower',
         avatar: 'https://c.animaapp.com/VPWnEuWR/img/avatar-10-1@2x.png',
      },
      {
         quote: "As a lender it is cool to see it's on-chain only. I gave it a try and threw some money on some people with interesting stories. Happy to help them! Getting paid back is a plus too.",
         username: 'CryptoLendingPro18',
         role: 'Active Lender',
         avatar: 'https://c.animaapp.com/VPWnEuWR/img/avatar-4-1@2x.png',
      },
      {
         quote: "I was worried if it was a meme. But, because there's no middle-man I figured since they can't touch the money, I will give it a try. Happy it works! Now I am building credit now.",
         username: 'GlobalStudentDreams2005',
         role: 'Verified Borrower',
         avatar: 'https://c.animaapp.com/VPWnEuWR/img/avatar-26-1@2x.png',
      },
      {
         quote: "It's nice to know you're helping real people. That's what counts at the end of the day. There's no skin off my back to lend a bit here or there.",
         username: 'DeFiDiversifier',
         role: 'Active Lender',
         avatar: 'https://c.animaapp.com/VPWnEuWR/img/avatar-13-1@2x.png',
      },
   ];

   return (
      <div className="w-full px-4 md:px-8 lg:px-16 py-12 md:py-16 lg:py-20">
         <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-12 md:mb-16">
               <h2 className="[font-family:'Inter',Helvetica] font-normal text-[#f6f6f6] text-3xl md:text-4xl tracking-[0] leading-8">
                  WHAT PEOPLE ARE SAYING
               </h2>
               <img
                  className="w-8 h-6 md:w-10 md:h-8 object-cover hidden md:block"
                  alt="Decoration"
                  src="https://c.animaapp.com/VPWnEuWR/img/svg-3.svg"
                  width={50}
                  height={37}
               />
            </div>

            {/* Testimonials Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-10">
               {testimonials.map((testimonial, index) => (
                  <div key={index} className="bg-[#0c1116] rounded-[20px] md:rounded-[30px] overflow-hidden p-6 md:p-8">
                     {/* Avatar */}
                     <img
                        className="w-10 h-10 md:w-12 md:h-12 object-cover rounded-full mb-4 md:mb-6"
                        alt={testimonial.username}
                        src={testimonial.avatar}
                     />

                     {/* Quote */}
                     <p className="[font-family:'Fira_Code',Helvetica] font-normal text-[#ffe635] text-base md:text-lg tracking-[0] leading-relaxed mb-6">
                        {testimonial.quote}
                     </p>

                     {/* Username */}
                     <div className="[font-family:'Fira_Code',Helvetica] font-bold text-white text-base tracking-[0] leading-normal mb-2">
                        Username: {testimonial.username}
                     </div>

                     {/* Role */}
                     <div className="[font-family:'Fira_Code',Helvetica] font-normal text-[#cbd5e0] text-sm md:text-base tracking-[0] leading-normal">
                        {testimonial.role}
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </div>
   );
}
