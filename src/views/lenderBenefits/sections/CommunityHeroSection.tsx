import { type JSX } from 'react';

export default function CommunityHeroSection(): JSX.Element {
   return (
      <main className="lender-community-hero" role="main" aria-labelledby="community-heading">
         <section className="lender-community-hero__content" aria-label="Community information">
            <p className="lender-community-hero__kicker">Why lend</p>
            <h1 id="community-heading">Fund verified workers building credit abroad.</h1>
            <p>
               We are starting with Filipinos and Southeast Asians overseas in places where World ID verification is available. Small loans
               can cover urgent gaps and help borrowers build credit independently.
            </p>
            <span>Start with verified USDC microloans in real worker corridors.</span>
         </section>
         <img
            loading="lazy"
            src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/35247927cae2be261a7876006d6cabc93d487eba4ebf1ab20276cc697c04e962?apiKey=054474a0b7744b6389c3319e0a9290c2&"
            alt="Decorative community illustration"
            className="lender-community-hero__art"
            width={220}
            height={239}
         />
      </main>
   );
}
