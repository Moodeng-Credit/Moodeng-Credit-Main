import { type JSX } from 'react';

export default function CommunityHeroSection(): JSX.Element {
   return (
      <main
         className="relative flex overflow-hidden flex-col px-16 mt-2 max-w-full bg-violet-400 bg-blend-normal rounded-[60px] text-zinc-900 w-[1425px] max-md:px-5 max-md:mt-10"
         role="main"
         aria-labelledby="community-heading"
      >
         <section
            className="flex flex-col self-center pb-12 pt-4 mt-0 max-w-full w-[1221px] max-md:mt-0"
            aria-label="Community information"
         >
            <header className="flex overflow-hidden flex-col items-start pr-60 pb-2 text-6xl leading-tight bg-blend-normal max-md:pr-5 max-md:max-w-full max-md:text-4xl">
               <h1 id="community-heading" className="bg-blend-normal w-[110%] max-md:max-w-full max-md:text-4xl">
                  Community for Global Credit Freedom
               </h1>
            </header>
            <article className="z-10 self-start mt-0 text-3xl leading-8 max-md:max-w-full">
               <p className="leading-normal">
                  Millions are trapped in restrictive financial systems, unable to access credit beyond their borders.
                  <span className="bg-orange-200 text-black px-2 py-1 rounded-xl">You hold the key to their freedom.</span>
               </p>
            </article>
         </section>
         <img
            loading="lazy"
            src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/35247927cae2be261a7876006d6cabc93d487eba4ebf1ab20276cc697c04e962?apiKey=054474a0b7744b6389c3319e0a9290c2&"
            alt="Decorative community illustration"
            className="absolute top-0 right-0 object-contain z-10 max-w-full aspect-[0.92] w-[220px]"
            width={220}
            height={239}
         />
      </main>
   );
}
