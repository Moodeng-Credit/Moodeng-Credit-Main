export interface BlogSection {
   heading: string;
   body: string;
}

export interface BlogPost {
   slug: string;
   category: string;
   title: string;
   dek: string;
   sourceLabel?: string;
   sourceHref?: string;
   publishedAt: string;
   readTime: string;
   audience: 'Borrowers' | 'Lenders' | 'Everyone';
   image: string;
   imageAlt: string;
   accent: 'violet' | 'green' | 'blue' | 'gold';
   sections: BlogSection[];
}

export const podcastUrl = 'https://open.spotify.com/show/5L9DswvEsqHBPvG7rG0qYj';

export const blogPosts: BlogPost[] = [
   {
      slug: 'first-credit-record-should-not-belong-to-a-loan-shark',
      category: 'Shadow systems',
      title: 'Your first credit record should not belong to a loan shark',
      dek: 'For millions of informal workers, the first lender to say yes is not a bank. It is an app that can take their contacts, their dignity, and their future trust before it ever earns repayment.',
      sourceLabel: 'Podcast companion',
      sourceHref: podcastUrl,
      publishedAt: 'May 18, 2026',
      readTime: '6 min read',
      audience: 'Borrowers',
      image: '/hippos/borrower-insights-trophy.png',
      imageAlt: 'Moodeng hippo holding a borrower insights trophy',
      accent: 'violet',
      sections: [
         {
            heading: 'The first record becomes the story',
            body: 'A borrower who sells food, drives, freelances, sends money home, or works day to day can still be invisible to formal credit. The danger is that the first system willing to write them into finance may be the worst one: an instant-loan app that treats desperation as an onboarding funnel.'
         },
         {
            heading: 'Predators do not only lend money',
            body: 'The sharpest loan sharks are not just charging bad rates. They are building files on people: phone contacts, social handles, references, location patterns, repayment pressure points, and the fear of public shame. A tiny loan becomes a way to map a borrower and everyone around them.'
         },
         {
            heading: 'A fair first record has to work differently',
            body: 'Moodeng cannot sound like another finance app with softer branding. The product has to prove the difference in its structure: no contact-list collateral, clear terms before funding, a human uniqueness check, and repayment history that belongs to the borrower instead of disappearing inside a private shark ledger.'
         }
      ]
   },
   {
      slug: 'app-store-costume-of-predatory-credit',
      category: 'App-store trust',
      title: 'The app-store costume of predatory credit',
      dek: 'The most dangerous lending apps rarely look dangerous. They arrive as bright icons, friendly names, fast approvals, and a wall of happy reviews.',
      sourceLabel: 'From the loan shark research notes',
      publishedAt: 'May 18, 2026',
      readTime: '5 min read',
      audience: 'Everyone',
      image: '/hippos/thinking.png',
      imageAlt: 'Moodeng hippo thinking about loan types',
      accent: 'blue',
      sections: [
         {
            heading: 'Trust theater is cheap to manufacture',
            body: 'A polished landing page, a near-perfect rating, and a mascot can make a lender look safer than it is. Some networks can spin up new brands faster than borrowers or regulators can understand who is really behind them.'
         },
         {
            heading: 'The brand changes, the machine stays',
            body: 'Many predatory apps are not independent businesses with real local accountability. They can be reskinned versions of the same underlying machine: new name, new color, new icon, same data extraction and same repayment pressure.'
         },
         {
            heading: 'Moodeng should make legitimacy visible',
            body: 'The answer is not to look less friendly. Friendly is good. The answer is to make the parts that matter inspectable: who funds the loan, what the terms are, what data is not collected, how repayment is recorded, and what happens if the borrower needs help.'
         }
      ]
   },
   {
      slug: 'contact-list-collateral-and-the-shame-tax',
      category: 'Borrower dignity',
      title: 'Contact-list collateral and the shame tax',
      dek: 'Loan sharks do not need a car title when they can threaten your mother, coworkers, customers, or group chat.',
      sourceLabel: 'Podcast companion',
      sourceHref: podcastUrl,
      publishedAt: 'May 18, 2026',
      readTime: '5 min read',
      audience: 'Everyone',
      image: '/hippos/community.png',
      imageAlt: 'Moodeng community hippo representing lender review',
      accent: 'green',
      sections: [
         {
            heading: 'Reputation became the collateral',
            body: 'Old loan sharks could stand outside a stall. App-based loan sharks can stand inside a borrower phone. Once contacts are copied, repayment pressure can move through family, employers, neighbors, and social feeds.'
         },
         {
            heading: 'The harm is bigger than the balance',
            body: 'A tiny debt can become an enormous social threat because the borrower is not only trying to repay money. They are trying to stop embarrassment, rumors, doctored images, fake police language, and pressure on people who never agreed to be involved.'
         },
         {
            heading: 'Privacy design is credit design',
            body: 'If Moodeng is serious about fair credit, it has to prove that repayment can happen without humiliation. World ID can help prove one real person. Wallet records can help prove repayment. Neither requires turning a borrower contact list into a weapon.'
         }
      ]
   },
   {
      slug: 'borrower-context-without-confession',
      category: 'Lender judgment',
      title: 'Borrower context should feel like a work rhythm, not a confession',
      dek: 'Lenders need enough humanity to understand a request. Borrowers should not have to turn their private life into content to deserve a small loan.',
      publishedAt: 'May 18, 2026',
      readTime: '4 min read',
      audience: 'Lenders',
      image: '/hippos/hippo-friendly-lock.png',
      imageAlt: 'Moodeng hippo with a friendly lock',
      accent: 'gold',
      sections: [
         {
            heading: 'The useful details are ordinary',
            body: 'A lender does not need a borrower employer name, exact address, private family history, or a video call. Often the useful details are simpler: work pattern, payday timing, why the expense matters now, and whether the due date fits real cash flow.'
         },
         {
            heading: 'Context should reduce guessing',
            body: 'A request for $20 before payday says more when the lender can see the borrower is paid weekly, has repaid before, and chose a due date after income arrives. That is not a confession. It is underwriting context, written in a humane way.'
         },
         {
            heading: 'The product should protect the line',
            body: 'Moodeng can invite borrowers to explain themselves without rewarding oversharing. The form should steer people toward safe context and away from doxxing: no exact employer, no phone numbers, no family names, no document screenshots, no emotional performance for strangers.'
         }
      ]
   },
   {
      slug: 'small-loans-are-infrastructure',
      category: 'Market view',
      title: '$15 loans are infrastructure, not a gimmick',
      dek: 'The amount is small because the missing rail is small: identity, settlement, borrower-owned history, and lender confidence at the size banks refuse to touch.',
      sourceLabel: 'From the Moodeng pitch materials',
      publishedAt: 'May 18, 2026',
      readTime: '4 min read',
      audience: 'Everyone',
      image: '/hippos/hippo-with-id-card.png',
      imageAlt: 'Moodeng hippo holding an identity card',
      accent: 'violet',
      sections: [
         {
            heading: 'Banks do not fail because the need is fake',
            body: 'A $15 or $20 liquidity gap can matter a lot to the person facing it. Traditional lenders ignore it because the cost to verify, move money, underwrite, and collect can exceed the loan itself.'
         },
         {
            heading: 'New rails change the math',
            body: 'Human uniqueness, stablecoin settlement, and a marketplace model make small loans less absurd. The platform does not need a branch, a paper form, or a collector with a contact list. It needs clear terms and a record that lenders can understand.'
         },
         {
            heading: 'The real asset is the record',
            body: 'The loan is temporary. The repayment signal can last. If Moodeng works, a borrower does not just solve one emergency. They leave with a small piece of portable credibility they can build on.'
         }
      ]
   }
];

export const featuredBlogPost = blogPosts[0];

export function findBlogPost(slug: string | undefined): BlogPost | undefined {
   return blogPosts.find((post) => post.slug === slug);
}
