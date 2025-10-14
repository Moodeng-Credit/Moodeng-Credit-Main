'use client';

import React from 'react';

export default function MoodengCreditSection() {
   return (
      <section
         id="web3"
         className="flex flex-col justify-center items-center px-20 py-28 w-full rounded-[0px] max-md:px-5 max-md:py-24 max-md:max-w-full"
         style={{
            background: 'rgb(6, 0, 102)',
            backgroundImage: 'linear-gradient(180deg, rgba(6, 0, 102, 1) 0%, rgba(2, 0, 34, 1) 35%)'
         }}
      >
         <div className="flex flex-col items-center mb-0 w-full max-w-[1015px] max-md:mb-2.5 max-md:max-w-full">
            <h2 className="self-stretch text-5xl text-white font-semibold leading-none max-md:max-w-full max-md:text-4xl">
               Want to learn more about Moodeng Credit?
            </h2>
            <p className="mt-6 text-xl leading-7 text-center text-white text-opacity-80 w-[709px] max-md:max-w-full">
               Contact us today to learn more about joining our community and unlocking the benefits awaiting you.
            </p>
            <div className="flex gap-8 justify-center items-center mt-8 text-xl leading-relaxed">
               <svg width="80px" height="80px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff">
                  <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                     {' '}
                     <path
                        d="M4 7.00005L10.2 11.65C11.2667 12.45 12.7333 12.45 13.8 11.65L20 7"
                        stroke="#ffffff"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                     ></path>{' '}
                     <rect x="3" y="5" width="18" height="14" rx="2" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"></rect>{' '}
                  </g>
               </svg>
               <button
                  className="gap-2.5 self-stretch px-5 py-3.5 my-auto bg-blue-600 rounded-xl min-h-[60px] min-w-[240px] w-[246px]"
                  aria-label="Contact Us Via dm3"
               >
                  Contact Us via Email
               </button>
            </div>
         </div>
      </section>
   );
}
