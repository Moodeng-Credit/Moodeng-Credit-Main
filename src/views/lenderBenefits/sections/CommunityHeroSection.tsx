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
      </main>
   );
}
