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
   },
   {
      slug: 'what-oil-pipelines-teach-us-about-credit',
      category: 'Book review',
      title: 'What oil pipelines teach us about credit',
      dek: 'A book about oil routes has a useful lesson for small loans: when the main pipes are controlled by powerful players, ordinary people end up paying more for worse access.',
      sourceLabel: 'Book review: The Global Game of Oil Pipelines',
      publishedAt: 'May 18, 2026',
      readTime: '6 min read',
      audience: 'Everyone',
      image: '/hippos/lender-diversity-piechart.png',
      imageAlt: 'Moodeng hippo reviewing a lender diversity chart',
      accent: 'blue',
      sections: [
         {
            heading: 'Pipelines are not just pipes',
            body: 'Gulshan Dietl writes about oil pipelines as routes of power: physical lines that decide who can move a critical resource, who must wait, who pays extra, and who becomes dependent on a gatekeeper. That is a useful way to think about credit too. Money also moves through pipes. Identity checks, banks, credit bureaus, payment networks, and underwriting rules decide who can reach normal loans and who gets left outside.'
         },
         {
            heading: 'When the formal route fails, the shadow route appears',
            body: 'People do not choose loan sharks because the product is good. They choose them because the official path is too slow, too expensive, too document-heavy, or closed entirely. The same person who is invisible to a bank may be very visible to a predatory app: visible through contacts, work chats, location, screenshots, shame pressure, and repeat borrowing behavior.'
         },
         {
            heading: 'Access without ownership creates dependency',
            body: 'A pipeline can move oil while still leaving the community around it with little control over the value passing through. Bad credit works the same way. A borrower may repay again and again, but if the record stays inside a private lender ledger, every future emergency starts from zero. The debt moved. The reputation did not.'
         },
         {
            heading: 'Moodeng is trying to build a different pipe',
            body: 'The point is not that a $15 loan is the same as global oil politics. The point is that infrastructure decides outcomes before the individual ever makes a choice. Moodeng needs to make the fair route easier than the predatory one: human uniqueness without doxxing, terms shown before funding, stable settlement, lender context, and repayment history that the borrower can keep building on.'
         }
      ]
   },
   {
      slug: 'secret-societies-and-the-need-for-safe-trust',
      category: 'Book review',
      title: 'Secret societies and the need for safe trust',
      dek: 'A history of brotherhoods, mutual aid, and rotating credit shows why people build their own institutions when official ones do not protect them.',
      sourceLabel: 'Book review: Secret Societies Reconsidered',
      publishedAt: 'May 18, 2026',
      readTime: '6 min read',
      audience: 'Everyone',
      image: '/hippos/community.png',
      imageAlt: 'Moodeng community hippo representing lender review',
      accent: 'green',
      sections: [
         {
            heading: 'People invent institutions before institutions find them',
            body: 'David Ownby and Mary Somers Heidhues frame many Chinese brotherhoods and kongsis less as exotic criminal groups and more as non-elite organizations for people moving through risky commercial worlds. Migrants, workers, and marginal young men needed protection, pooled money, funeral support, work organization, and trust among people who were not family.'
         },
         {
            heading: 'Mutual aid can turn into pressure',
            body: 'That is the important lesson for credit. Informal systems often begin because the official system is absent or hostile. But the same social ties that help someone survive can also become tools of control. Protection can become racketeering. Brotherhood can become hierarchy. A shared fund can become debt pressure if the rules are not visible.'
         },
         {
            heading: 'Loan sharks are a broken trust institution',
            body: 'A loan shark is not only a bad lender. It is an informal institution built around fear, social exposure, and dependency. It gives fast access, but the borrower pays with privacy, dignity, and repeat vulnerability. The borrower may be known by the shark, but not in a way that creates portable trust.'
         },
         {
            heading: 'Moodeng should make trust legible',
            body: 'The alternative is not cold, anonymous finance. People still need social trust. They need lenders to understand work rhythm, repayment history, and why a small gap matters. Moodeng has to make that trust safe: identity without doxxing, context without confession, repayment records without intimidation, and clear rules that cannot quietly become social punishment.'
         }
      ]
   },
   {
      slug: 'what-credit-risk-books-miss-about-loan-sharks',
      category: 'Book review',
      title: 'What credit risk books miss about loan sharks',
      dek: 'Reading portfolio risk beside money and credit theory shows a blind spot: formal finance manages lender concentration, while excluded borrowers face concentration of options.',
      sourceLabel: 'Book review: Credit portfolio risk + The Theory of Money and Credit',
      publishedAt: 'May 18, 2026',
      readTime: '7 min read',
      audience: 'Lenders',
      image: '/hippos/thinking.png',
      imageAlt: 'Moodeng hippo thinking about loan types',
      accent: 'gold',
      sections: [
         {
            heading: 'Formal credit starts with the lender problem',
            body: 'Risk Management in Credit Portfolios is about a real and important discipline: how banks measure defaults, loss severity, portfolio concentration, correlations, and the capital needed to survive stress. That machinery protects the institution. It asks whether a lender is too exposed to one borrower, one sector, or one hidden pattern of failure.'
         },
         {
            heading: 'Borrowers have concentration risk too',
            body: 'Loan sharks appear where borrowers have no diversified set of fair options. If a bank rejects a worker because the file is thin, the borrower may not face a market of lenders at all. They may face one app, one shop lender, one contact-list lender, or one informal collector. That is concentration risk from the borrower side: too much dependency on the only person willing to say yes.'
         },
         {
            heading: 'Money and credit are promises across time',
            body: 'Mises treats money as a medium that makes exchange easier and credit as part of a system of future settlement. Whatever one thinks of his broader politics, this point matters for Moodeng: credit is not just cash today. It is a promise that the future borrower, future lender, and future record will still make sense when repayment comes due.'
         },
         {
            heading: 'Loan sharks turn uncertainty into control',
            body: 'Predatory lenders do not solve uncertainty cleanly. They replace underwriting with pressure. They ask for phone contacts, shame leverage, social visibility, and repeat dependence. Instead of pricing risk transparently, they make the borrower personally exposed. The lender may feel protected, but the protection comes from fear rather than better credit information.'
         },
         {
            heading: 'Moodeng has to manage both portfolios',
            body: 'A fair microloan marketplace should care about lender risk without copying the cold parts of bank logic. Lenders need limits, diversification, repayment evidence, and enough context to judge a request. Borrowers need the opposite of loan-shark concentration: more fair funding options, clear terms, no contact-list collateral, and a repayment record that improves their next choice.'
         }
      ]
   }
];

export const featuredBlogPost = blogPosts[0];

export function findBlogPost(slug: string | undefined): BlogPost | undefined {
   return blogPosts.find((post) => post.slug === slug);
}
