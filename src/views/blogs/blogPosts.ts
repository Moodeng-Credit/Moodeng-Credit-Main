export interface BlogSection {
   heading: string;
   body: string | string[];
   image?: string;
   imageAlt?: string;
   imageCaption?: string;
   images?: Array<{
      src: string;
      alt: string;
   }>;
}

export interface BlogFaq {
   question: string;
   answer: string;
}

export interface BlogSource {
   label: string;
   href?: string;
}

export interface BlogPost {
   slug: string;
   category: string;
   title: string;
   dek: string;
   seoTitle?: string;
   metaDescription?: string;
   summary?: string[];
   keywords?: string[];
   faq?: BlogFaq[];
   sources?: BlogSource[];
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
export const globalFindexUrl = 'https://www.worldbank.org/en/publication/globalfindex/report';
export const lookoutLoanAppsUrl =
   'https://www.lookout.com/news-release/lookout-threat-lab-discovers-predatory-loan-apps-on-google-play-and-apple-app-store';
export const cgapDigitalCreditUrl = 'https://www.cgap.org/node/3234';
export const cgapConsumerProtectionUrl = 'https://www.cgap.org/index.php/research/publication/consumer-protection-in-digital-credit';
export const predatoryLoanAppsPaperUrl = 'https://arxiv.org/abs/2601.12634';

export const blogPosts: BlogPost[] = [
   {
      slug: 'what-oil-pipelines-teach-us-about-credit',
      category: 'Credit infrastructure',
      title: 'What oil pipelines teach us about predatory credit',
      dek: 'A book about steel, states, and oil routes turns out to be a useful map for understanding how predatory lenders extract rent from excluded borrowers.',
      seoTitle: 'What Oil Pipelines Teach Us About Predatory Credit | Moodeng',
      metaDescription:
         'A book review of The Global Game of Oil Pipelines and what pipeline politics reveals about predatory credit, shadow routes, and borrower-owned repayment history.',
      summary: [
         'Pipelines show that whoever controls a critical route can extract tolls from everyone forced through it.',
         'Predatory lenders operate like transit states by sitting between excluded borrowers and emergency liquidity.',
         'A fair credit system should make terms visible, keep repayment records portable, and move liquidity without creating dependency.'
      ],
      keywords: ['predatory credit', 'credit infrastructure', 'loan sharks', 'oil pipelines', 'borrower-owned repayment history'],
      faq: [
         {
            question: 'Why compare oil pipelines to credit?',
            answer:
               'Both systems depend on routes. Whoever controls the route to a critical resource can decide who gets access, who pays a toll, and who becomes dependent on the gatekeeper.'
         },
         {
            question: 'What is the transit-state idea in lending?',
            answer:
               'A transit state extracts rent because a pipeline must pass through it. Predatory lenders do something similar when excluded borrowers have no safer route to emergency liquidity.'
         },
         {
            question: 'What would a fair credit route look like?',
            answer:
               'It would show clear terms before funding, avoid weaponizing identity or contacts, and let repayment history keep working for the borrower after the loan closes.'
         }
      ],
      sources: [
         { label: 'Gulshan Dietl, The Global Game of Oil Pipelines (Routledge, 2022)' },
         { label: 'World Bank Global Findex on financial access', href: globalFindexUrl },
         { label: 'CGAP Digital Credit Overview', href: cgapDigitalCreditUrl }
      ],
      sourceLabel: 'Book review',
      publishedAt: 'May 2026',
      readTime: '10 min read',
      audience: 'Everyone',
      image: '/blogs/oil-pipeline-anatomy.png',
      imageAlt: 'Oil pipeline anatomy showing wellhead, gathering line, transit state, refinery, and consumer',
      accent: 'gold',
      sections: [
         {
            heading: 'A book about pipes, routes, and power',
            body: [
               'Gulshan Dietl is a professor of international relations, and her subject is pipelines. Steel infrastructure. Geopolitics. The scramble for oil from Baku to the Gulf to the Dakota plains.',
               'You would not expect a book like this to illuminate the mechanics of loan sharks. But it does, precisely because Dietl is not really writing about pipes. She is writing about who controls the route that a critical resource travels through, and what that control allows them to extract from everyone else.',
               'That is a very useful frame for thinking about credit.'
            ],
            images: [
               {
                  src: '/blogs/oil-pipeline-anatomy.png',
                  alt: 'Oil pipeline anatomy showing wellhead, gathering line, transit state, refinery, and consumer'
               },
               {
                  src: '/blogs/credit-pipeline-anatomy.png',
                  alt: 'Credit pipeline anatomy showing income, informal worker, predatory gatekeeper, credit bureau, and formal system'
               }
            ],
            imageCaption:
               'The same route logic appears in oil and credit: the gatekeeper sits between the source and the destination, then charges for access.'
         },
         {
            heading: 'The route is the power',
            body: [
               'Dietl\'s central argument is that a pipeline is never just a pipe. Every decision behind it - the route it takes, the countries it passes through, who owns the pumping stations, who collects the transit fees - is a political decision made at the top of a hierarchy. She writes that these factors "are not only technological and commercial decisions; they are political decisions taken at the top of the political hierarchy in a state."',
               'The physical steel is almost incidental. What matters is the structure of access it creates: who can move a critical resource, who cannot, who must pay a toll, and who becomes dependent on a gatekeeper.',
               'Money moves through a similar structure. Banks, identity systems, credit bureaus, payment rails, underwriting rules, platform permissions - these are also routes. They are invisible compared with steel buried in the ground, but they determine access to credit just as completely.',
               'When a borrower is excluded from the formal route, they do not stop needing money. They look for whatever route still exists. And that route may be expensive, opaque, and dangerous.'
            ]
         },
         {
            heading: "Transit states: the gatekeeper's leverage",
            body: [
               "One of the most instructive concepts in Dietl's book is the transit state - the country a pipeline must cross to reach its destination. The transit state has no oil of its own to sell. But because the pipe runs through its territory, it commands rent. It can slow things down, demand a larger share, or threaten to close the valve entirely. Its leverage is purely positional. It sits between producer and consumer, and that position is worth something.",
               'Dietl describes how transit states use this leverage aggressively: they demand fees, extract side agreements, insist on preferential access to the oil flowing through their land. The exporting country already committed its capital to build the pipe. It cannot easily reroute. The transit state knows this, and prices accordingly.',
               'Predatory lenders operate in exactly this way. They are not the source of economic value - they do not produce income, employment, or wealth for the borrower. But they sit at a chokepoint. When the formal credit system excludes someone and an emergency arrives, the predatory lender is the only available route. The borrower already has the urgent need. The lender knows this, and prices accordingly.',
               "The interest rate is the transit fee. The rollover is the renegotiation. And because the borrower has few alternatives - because no other route has been built - the gatekeeper's demands keep rising."
            ]
         },
         {
            heading: 'Dependency by design',
            body: [
               'Dietl observes something uncomfortable about pipeline politics: once a line is operational, the supplier and the importing country are locked together. Enormous capital has been committed. The infrastructure runs in one direction. Switching costs are prohibitive. "Once the pipelines become operative," she writes, "the supplier country has an upper hand as the exporting company has already put in most of the capital required and has few options left to get out of the deal."',
               'This is dependency by infrastructure, not by choice. The importing country did not set out to become dependent. It simply followed the route that existed.',
               "The same mechanism runs through predatory lending. A borrower who repays a high-cost loan on time has demonstrated creditworthiness. But that demonstration is trapped inside the lender's private ledger. The next lender cannot see it. The borrower's repayment history - genuine evidence of financial reliability - does not travel with them. So they return to the same narrow set of options: back to the same gate, back to the same transit fee.",
               'The lender benefits from this directly. There is no incentive to help the borrower graduate to cheaper credit. The lock-in is the product.'
            ]
         },
         {
            heading: 'Oil flows through places that do not own it',
            body: [
               'Dietl devotes extended attention to what economists call the rentier dynamic - the way oil wealth flows through a territory while the people living near the wells and pipelines often receive little of the value passing overhead. Communities are exposed to the environmental and social disruption of extraction, while ownership of the asset and its revenues is held elsewhere.',
               'This is one of the oldest critiques of the oil economy: the resource moves through, but the benefits do not stay.',
               "Predatory credit works the same way. A borrower can repay faithfully - five loans, ten loans, twenty - and emerge from each cycle no better positioned than when they started. The lender learned something valuable: this person repays. The borrower's behavior generated that insight. But the borrower does not own the record. The reputation stays inside the lender's system, unavailable to anyone else, unusable by the person who earned it.",
               'Credit passed through. Benefit did not stay.'
            ]
         },
         {
            heading: 'The shadow route emerges where the formal route fails',
            body: [
               'Dietl draws a sharp picture of what happens when formal access to a critical resource is blocked. Sanctions, invasions, and embargoes - the tools of powerful consumers against weaker producers - do not eliminate demand. They redirect supply through shadow channels. Oil still moves; it just moves through more expensive, more opaque, more exploitative paths.',
               'The same pattern appears in credit markets. Predatory lenders do not exist because borrowers prefer them. They exist because the formal credit system leaves too many people outside - too slow, too document-heavy, too dependent on identity infrastructure that excludes informal workers and recent migrants. The emergency does not wait. So borrowers take the shadow route.',
               'What makes the shadow route distinctively dangerous is that it knows things the formal route refuses to look at. A predatory lending app cannot underwrite a borrower fairly - it does not understand their income, their obligations, their actual capacity. But it can access their contacts, their location, their message history, their social graph. It cannot assess creditworthiness, but it can construct pressure. The app becomes a surveillance instrument first, a lender second. Collection works by shame and exposure, not by contractual right.',
               'This is not an accident of poor product design. It is the monetization of exclusion.'
            ]
         },
         {
            heading: 'Protests along the route',
            body: [
               "One of the most striking chapters in Dietl's book covers the Standing Rock protests over the Dakota Access Pipeline. Indigenous communities in North Dakota mobilized for months against a pipeline route that had been modified - specifically to avoid running near a predominantly white city upstream, and redirected to run beneath the Missouri River near the Standing Rock Sioux Reservation instead.",
               "The pipeline would carry someone else's oil through land these communities depended on. The risk of contamination, the disruption of sacred sites, the absence of meaningful consultation - these were the costs the route imposed on people who had no say in where it ran.",
               'Dietl frames this as a recurring feature of pipeline politics, not an exception: the route of infrastructure systematically places costs on those with the least power to refuse. The pipe goes where resistance is weakest.',
               'Predatory credit follows routes with similar logic. It concentrates in communities excluded from the formal system - migrant workers, informal earners, people without the documentation that banks require. These communities have the same urgent financial needs as anyone else. They have less ability to refuse the terms on offer. The route goes where resistance is weakest, and the toll is highest there.'
            ]
         },
         {
            heading: 'A fair pipe is a design choice',
            body: [
               'Dietl ends The Global Game of Oil Pipelines with something close to a provocation. The oil infrastructure that exists today is not the result of neutral market forces or technological inevitability. It is the accumulated outcome of thousands of deliberate decisions - about who gets access, on what terms, at whose expense. Different decisions would have built different infrastructure.',
               'The same is true of credit. The current architecture of formal credit - the identity requirements, the documentation thresholds, the bureau systems that start a clock only when someone takes formal employment - was designed. It excludes the people it excludes on purpose, or at least without sufficient care about the consequences of that exclusion.',
               'A better credit pipe is also a design choice. It requires the same kind of intentionality Dietl is calling for in energy governance: clear terms before the valve opens, infrastructure that creates access rather than dependency, records that belong to the person who earned them and travel forward with them.',
               "For small loans specifically, the design challenge is not glamorous. But Dietl's book is a reminder that infrastructure shapes outcomes before any individual makes a choice. The route determines what is possible. Getting the route right is the work."
            ]
         },
         {
            heading: 'What this means for Moodeng',
            body: [
               'Moodeng exists in the gap Dietl describes - the space where the formal route is closed and the shadow route charges too much.',
               'The goal is not just to be cheaper than a loan shark. It is to be a different kind of pipe: one that moves liquidity without creating dependency, that uses identity without weaponizing it, that records repayment in a way the borrower actually owns. Human uniqueness without doxxing. Terms visible before funding. Repayment history that continues working for the borrower after the loan closes.',
               "Small amounts can make people underestimate the seriousness of the design problem. Dietl's book corrects that. The pipeline for a $15 emergency loan and the pipeline for Saudi crude operate on the same structural logic: route determines access, gatekeepers extract rent, and the people with the fewest alternatives pay the most.",
               'That is worth taking seriously. The pipe should not extract dignity as the toll.'
            ]
         }
      ]
   },
   {
      slug: 'first-credit-record-should-not-belong-to-a-loan-shark',
      category: 'Shadow systems',
      title: 'Your first credit record should not belong to a loan shark',
      dek: 'For millions of informal workers, the first lender to say yes is not a bank. It is an app that can take their contacts, their dignity, and their future trust before it ever earns repayment.',
      seoTitle: 'Loan Shark Alternatives for First Credit Records | Moodeng',
      metaDescription:
         'Why a first credit record should belong to the borrower, not a loan shark app, and how Moodeng uses small USDC loans to build safer trust.',
      summary: [
         'A first credit record should help a borrower graduate to safer options, not trap them inside a private loan shark ledger.',
         'Predatory loan apps often turn a small cash need into a data and reputation problem by collecting contacts, social context, and shame leverage.',
         'Moodeng is designed around borrower-owned repayment history, clear terms, human uniqueness, and no contact-list collateral.'
      ],
      keywords: ['loan shark alternatives', 'first credit record', 'borrower-owned credit history', 'microloan repayment history'],
      faq: [
         {
            question: 'What is a first credit record?',
            answer:
               'A first credit record is the earliest reliable evidence that a borrower accepted terms, received funding, and repaid as agreed. For underbanked borrowers, that record is often missing from formal credit systems.'
         },
         {
            question: 'Why are loan shark apps dangerous for credit history?',
            answer:
               'They may collect repayment signals, contacts, device permissions, and social pressure points without turning successful repayment into portable borrower-owned credibility.'
         },
         {
            question: 'How is Moodeng different from a loan shark app?',
            answer:
               'Moodeng centers clear loan terms, human uniqueness, stable repayment records, and borrower context without using contact-list access as collection pressure.'
         }
      ],
      sources: [
         { label: 'Moodeng podcast companion', href: podcastUrl },
         { label: 'Loan Sharks in the App Store research notes' },
         { label: 'World Bank Global Findex on formal and informal borrowing', href: globalFindexUrl },
         { label: 'Lookout research on predatory loan apps', href: lookoutLoanAppsUrl }
      ],
      sourceLabel: 'Podcast companion',
      sourceHref: podcastUrl,
      publishedAt: 'May 18, 2026',
      readTime: '9 min read',
      audience: 'Borrowers',
      image: '/hippos/journal-hippo-no-eyebrows.png',
      imageAlt: 'Moodeng hippo writing in a journal',
      accent: 'violet',
      sections: [
         {
            heading: 'The first record becomes the story',
            body: [
               'A borrower can work every day, sell food, drive passengers, freelance, care for family, send money home, and still be invisible to formal credit. The work is real. The income is real. The repayment intention is real. What is missing is a record that normal lenders can understand without demanding paperwork the borrower does not have.',
               'That gap is where predatory credit becomes dangerous. The first lender willing to say yes often gets to write the first financial story about the borrower. If that lender is a loan shark app, the story is not written as proof of reliability. It is written as leverage.',
               'A first credit record should be a ladder. Too often, it becomes a trap. The borrower repays, but the useful signal stays inside a private lender database or disappears entirely. The next emergency starts from zero, and the same predatory option is waiting again.'
            ]
         },
         {
            heading: 'Predators do not only lend money',
            body: [
               'The sharpest loan sharks are not only charging abusive fees. They are collecting power. A small loan can become permission to copy phone contacts, scrape social handles, learn family relationships, identify coworkers, and find the pressure points that make a borrower afraid.',
               'The borrower thinks the product is about cash. The lender understands it as a data transaction. The app may ask for permissions that have nothing to do with underwriting a small loan. Once the permissions are granted, repayment pressure can travel far beyond the borrower.',
               'This is why the harm can feel bigger than the balance. A late payment on a tiny loan can become threats, embarrassment, fake legal language, doctored images, or messages to people who never agreed to be involved. The debt is financial, but the collection tool is social fear.'
            ]
         },
         {
            heading: 'The missing product is not another nicer loan app',
            body: [
               'A fair alternative cannot just use friendlier colors and kinder copy. Predatory lending already knows how to look friendly. It uses bright icons, easy language, fast approvals, and sometimes even cute mascots. The difference has to be structural.',
               'For Moodeng, that means no contact-list collateral. It means terms shown before funding, not hidden after the borrower is already desperate. It means a human uniqueness check that helps protect the network without asking borrowers to expose their private life. It means repayment history that builds forward.',
               'The borrower should not have to choose between dignity and liquidity. If the loan is small, the product discipline has to be even stronger, because small debts are exactly where people are told that their rights, privacy, and reputation do not matter.'
            ]
         },
         {
            heading: 'The borrower should own the useful part',
            body: [
               'The useful part of a successful loan is not only that the lender got repaid. The useful part is that the borrower proved something. They chose terms, accepted funding, repaid in the agreed window, and showed that a small trust relationship can work.',
               'That signal should not vanish. A borrower-owned record lets the next lender see evidence without demanding humiliation. It turns a small repayment into a small piece of portable credibility.',
               'That is the core Moodeng bet: the first record can belong to the borrower, not the loan shark. It can be safe enough for lenders to use, simple enough for borrowers to understand, and humane enough that people do not have to turn their private lives into collateral.'
            ]
         }
      ]
   },
   {
      slug: 'app-store-costume-of-predatory-credit',
      category: 'App-store trust',
      title: 'The app-store costume of predatory credit',
      dek: 'The most dangerous lending apps rarely look dangerous. They arrive as bright icons, friendly names, fast approvals, and a wall of happy reviews.',
      seoTitle: 'How Predatory Loan Apps Look Legitimate | Moodeng',
      metaDescription:
         'Predatory loan apps can look safe in app stores. Learn the trust signals that can be faked and what a fair lending product should make visible.',
      summary: [
         'A polished lending app can hide upfront deductions, service-charge language, contact-list pressure, and abusive effective APRs.',
         'Predatory lending networks rotate names and storefronts while keeping the same fee, permission, and collection playbook.',
         'Moodeng is designed to make legitimacy visible: clear terms, no contact-list pressure, on-chain repayment, and a borrower-owned trust record.'
      ],
      keywords: ['predatory loan apps', 'fake loan apps', 'app store lending scams', 'digital credit transparency'],
      faq: [
         {
            question: 'Can a loan app look legitimate and still be predatory?',
            answer:
               'Yes. A friendly name, high rating, or polished app-store page can hide abusive fees, upfront deductions, contact-list collection, and unclear repayment terms, often all at once.'
         },
         {
            question: 'What should borrowers check before using a loan app?',
            answer:
               'Look for transparent terms shown before you commit, a clear APR instead of only service charges, what data is requested, whether contacts are required, and whether your repayment history becomes yours to use elsewhere.'
         },
         {
            question: 'What should a fair loan app show upfront?',
            answer:
               'The loan amount, repayment amount, due date, funding source, privacy boundaries, and what happens after repayment should be visible before the borrower clicks anything irreversible.'
         }
      ],
      sources: [
         { label: 'Loan Sharks in the App Store research notes' },
         {
            label: 'Moodeng debt spiral and credit ladder deck',
            href: 'https://www.canva.com/design/DAG3QaatXV4/3VHRx51XLayyQAvulF4K6g/edit'
         },
         { label: 'Lookout research on predatory loan apps', href: lookoutLoanAppsUrl },
         { label: 'CGAP digital credit risk overview', href: cgapDigitalCreditUrl },
         { label: 'Predatory loan apps Android study', href: predatoryLoanAppsPaperUrl }
      ],
      sourceLabel: 'From the loan shark research notes',
      publishedAt: 'May 18, 2026',
      readTime: '8 min read',
      audience: 'Everyone',
      image: '/blogs/predatory-service-fees.png',
      imageAlt: 'Diagram showing predatory lending app service fees',
      accent: 'blue',
      sections: [
         {
            heading: 'The offer can change after the install',
            body: [
               'The most dangerous lending apps rarely look dangerous. They arrive as bright icons, friendly names, fast approvals, and a wall of happy reviews. What they do not show you is what happened to Aeron.',
               'Aeron Cordeo saw a ₱8,000 loan promise in the app store. He downloaded the app. By the time he was inside, the offer had switched. The app now offered ₱1,790. Before he even got the money, ₱710 was silently deducted as an upfront fee. He received ₱1,080 in cash and now owed high-APR interest on ₱1,790, the full amount he never actually received. His contacts were held as silent collateral. Miss a payment, and the app would start messaging them.',
               "This is not an edge case. Around 63% of Filipinos under 35 have borrowed from a quick lending app. Aeron's story has tens of thousands of variations across the Philippines, Thailand, Vietnam, Indonesia, and Malaysia. Half a dozen subreddits exist just to document them."
            ],
            image: '/blogs/predatory-aeron-review.png',
            imageAlt: 'Aeron Cordeo review describing a loan app bait and switch from 8000 pesos to 1080 pesos received',
            imageCaption: 'Aeron’s review shows the bait-and-switch pattern: an ₱8,000 promise turned into ₱1,080 received and ₱1,790 owed.'
         },
         {
            heading: 'Trust theater is cheap to manufacture',
            body: [
               'A loan shark does not have to look like a loan shark. In the app store, the costume is easy: a rounded logo, a cheerful name, a smooth onboarding flow, a few screenshots of smiling users, and copy that promises cash in minutes.',
               'That surface creates trust faster than a borrower can investigate who actually owns the app. A desperate user rarely has time to compare licenses, company registration, controller relationships, data policies, and complaint histories. The app only needs to look safer than the alternatives in that moment.',
               'This is the first lesson: visual trust is not the same thing as real accountability. A brand can feel local while the decision-making, data storage, playbook, and profit extraction sit somewhere else entirely.'
            ],
            image: '/blogs/predatory-victim-groups.png',
            imageAlt: 'Facebook groups for victims of online lending apps in the Philippines showing thousands of members and daily posts',
            imageCaption: 'The scale is visible in victim groups: thousands of members and daily posts tracking lending-app abuse.'
         },
         {
            heading: 'The brand changes. The machine stays.',
            body: [
               'Predatory lending networks rotate names, icons, and front companies faster than borrowers can build a warning list. One app is removed. Another appears. The colors change, the screenshots change, the support email changes, but the operating logic survives intact: traffic acquisition, permission capture, contact-list pressure, collections scripts, and repeat borrowing loops.',
               'The hidden fee structure is designed to stay invisible. Processing fees of 10-40% are deducted before money arrives. Late penalties run 1-2% per day. Extension fees of 5-15% reset every time you push the repayment date. None of these are labeled as interest. They are service charges, so the app can sidestep legal APR limits while running effective annual rates north of 400%.',
               'A ₱3,000 loan over 14 days can quietly become ₱4,000 after two extensions. Borrowers keep paying just enough to avoid the worst of it, until they owe more than they ever borrowed.',
               'When the front door is disposable, reputation stops working as a normal consumer safety mechanism. Bad reviews can be outrun. A damaged brand can be abandoned. The borrower is left dealing with a system that is harder to name than the app they downloaded.'
            ],
            image: '/blogs/predatory-service-fees.png',
            imageAlt: 'A slide listing lending apps with 17% to 56% service charges',
            imageCaption: 'From the Moodeng research deck: service fees can hide the real cost before cash ever reaches the borrower.'
         },
         {
            heading: 'Fast approval is not the same as fair access',
            body: [
               'The promise of instant approval is powerful because the underlying need is real. A delayed paycheck, a medical trip, a repair, a family emergency, none of these wait for a bank queue. People are not foolish for wanting speed.',
               'The problem begins when speed replaces consent. A borrower who needs money now may click through permissions they would reject in a calmer moment. Predatory apps exploit that urgency. They make the path to cash obvious and the path to understanding almost invisible.',
               'A fair product can still be fast where speed helps the borrower. But it should slow down where speed creates harm: before contact permissions, before terms, before a borrower commits to a due date that does not match their income.'
            ]
         },
         {
            heading: 'The identity half of trust is solved. Dependability is not.',
            body: [
               'KYC, passports, face scans, and on-chain ID all exist. Identity is a solved problem. What remains unsolved is dependability: a verifiable record of doing what you said you would, on time, every time.',
               'Without that, billions of reliable people are invisible to any lender except the predatory ones. The honest worker, the food hawker, the delivery driver, they have no proof that they are trustworthy, so the only credit available to them is the kind designed to trap them.',
               'This is the actual problem. Not that borrowers are risky. That their reliability has never been recorded anywhere it can be used.'
            ]
         },
         {
            heading: 'Legitimacy should be visible in the product',
            body: [
               'Moodeng does not need to look less friendly to be more serious. The point is to make the things that matter visible: who is funding the loan, what amount is requested, when repayment is due, what data is not collected, and how each repayment builds a record the borrower actually owns.',
               'The credit ladder works like this: new borrowers start at $10-15. Repay on time and the limit grows, to $20, then $40, and beyond. Every repayment is on-chain. No one calls your contacts. No one deducts fees before you see the money. The APR is 15%, not 400%.',
               'In our Q3 2025 pilot, 100 borrowers, average loan of $28, average term of 33 days, 92% repaid on time. Some took a second loan. Borrowers were people like a food hawker restocking her cart the same day, a delivery driver getting his bike fixed before the weekend, and an English teacher bridging the gap to payday. Real income, real needs, real repayment.',
               'The mascot can be cute. But the system underneath has to be plain, inspectable, and hard to abuse. That is the opposite of app-store theater.'
            ]
         }
      ]
   },
   {
      slug: 'contact-list-collateral-and-the-shame-tax',
      category: 'Borrower dignity',
      title: 'Contact-list collateral and the shame tax',
      dek: 'Loan sharks do not need a car title when they can threaten your mother, coworkers, customers, or group chat.',
      seoTitle: 'Contact-List Collateral and Loan App Harassment | Moodeng',
      metaDescription:
         'How contact-list access turns small loans into shame pressure, and why fair digital credit should not use borrower contacts as collateral.',
      summary: [
         'Contact-list collateral is when a lender treats access to friends, family, coworkers, or customers as repayment leverage.',
         'The real cost of a predatory microloan can include public embarrassment, relationship damage, and fear that spreads beyond the balance owed.',
         'Privacy design is credit design: fair repayment should work through clear records and terms, not harassment of a borrower network.'
      ],
      keywords: ['contact-list collateral', 'loan app harassment', 'borrower privacy', 'digital credit consumer protection'],
      faq: [
         {
            question: 'What is contact-list collateral?',
            answer:
               'Contact-list collateral is the use of a borrower phone contacts as leverage for repayment, often through threats to message family, coworkers, customers, or social groups.'
         },
         {
            question: 'Why is contact-list access dangerous in lending apps?',
            answer:
               'It can let lenders pressure third parties, expose private debts, and turn a small repayment issue into public shame or reputational harm.'
         },
         {
            question: 'Does Moodeng require contact-list access?',
            answer:
               'No. Moodeng content and product direction are built around repayment records, World ID uniqueness, and borrower-safe context, not contact-list collection.'
         }
      ],
      sources: [
         { label: 'Moodeng podcast companion', href: podcastUrl },
         { label: 'CGAP digital credit risks', href: cgapDigitalCreditUrl },
         { label: 'CGAP consumer protection in digital credit', href: cgapConsumerProtectionUrl },
         { label: 'Lookout research on excessive loan app permissions', href: lookoutLoanAppsUrl }
      ],
      sourceLabel: 'Podcast companion',
      sourceHref: podcastUrl,
      publishedAt: 'May 18, 2026',
      readTime: '7 min read',
      audience: 'Everyone',
      image: '/hippos/community.png',
      imageAlt: 'Moodeng community hippo representing lender review',
      accent: 'green',
      sections: [
         {
            heading: 'Reputation became the collateral',
            body: [
               'Old loan sharks could stand outside a stall, workplace, or home. App-based loan sharks can stand inside a borrower phone. The difference is not only convenience. It is reach.',
               'Once contacts are copied, repayment pressure can move through family, employers, customers, neighbors, classmates, and group chats. The borrower is no longer only protecting their own financial standing. They are trying to prevent the loan from becoming a public event.',
               'That is contact-list collateral. The lender may not hold a physical asset, but they hold the threat of social exposure. For a worker whose reputation is tied to customers, family obligation, or employer trust, that threat can be stronger than a lien.'
            ]
         },
         {
            heading: 'The harm is bigger than the balance',
            body: [
               'A tiny debt can create a huge burden because the borrower is not only repaying money. They are repaying fear. They are trying to stop messages, rumors, screenshots, fake police language, public embarrassment, and pressure on people who never agreed to be part of the loan.',
               'This is the shame tax. It is paid in anxiety, damaged relationships, lost sleep, and the constant fear that a private liquidity problem will be turned into a public identity problem.',
               'The shame tax also changes borrower behavior. People may roll over bad debt, take a worse loan to repay the first one, or avoid asking for help because the social cost has become unbearable. A small emergency becomes a dependency loop.'
            ]
         },
         {
            heading: 'Privacy design is credit design',
            body: [
               'Privacy is not a side issue for small loans. It is part of the credit product. If a lender relies on humiliation to collect, then the underwriting model is built on social violence.',
               'Moodeng has better tools available. World ID can help confirm that a request is tied to one real human without exposing that person to a document-heavy identity process. Wallet records can help show funding and repayment. Platform history can show whether the borrower has completed prior loans.',
               'None of those require contact-list access. None require sending messages to family. None require making a borrower prove their pain to strangers. Good credit design should make those abusive shortcuts unnecessary.'
            ]
         },
         {
            heading: 'Human context should not become social leverage',
            body: [
               'There is still a place for human context. A lender can make a better decision if they know the borrower works shifts, gets paid every Friday, has a recurring transport cost, or is covering a one-time repair. The line is whether that context helps judgment or creates leverage.',
               'A safe system asks for details that explain the request without exposing the borrower. It should guide people away from employer names, exact addresses, family names, phone numbers, and private crises that should not be turned into content.',
               'The goal is not anonymous coldness. The goal is dignity. A borrower should be understood enough to be trusted, not exposed enough to be controlled.'
            ]
         }
      ]
   },
   {
      slug: 'borrower-context-without-confession',
      category: 'Lender judgment',
      title: 'Borrower context should feel like a work rhythm, not a confession',
      dek: 'Lenders need enough humanity to understand a request. Borrowers should not have to turn their private life into content to deserve a small loan.',
      seoTitle: 'Borrower Context for P2P Microloans Without Doxxing | Moodeng',
      metaDescription:
         'What lenders need to understand a small loan request, and how borrowers can share payday fit, work rhythm, and purpose without oversharing.',
      summary: [
         'Useful borrower context is practical: work rhythm, payday timing, request purpose, due-date fit, and prior repayment behavior.',
         'Borrowers should not need to disclose employer names, exact addresses, family details, documents, or video calls to request a small loan.',
         'Lender judgment improves when the product summarizes repayment fit without turning private life into collateral.'
      ],
      keywords: ['borrower context', 'p2p microloans', 'loan request profile', 'payday fit'],
      faq: [
         {
            question: 'What borrower information is useful for small-loan lenders?',
            answer:
               'Useful details include work type, pay rhythm, due-date fit, prior repayment, requested amount, and a short reason for borrowing.'
         },
         {
            question: 'What should borrowers avoid sharing in a loan request?',
            answer:
               'Borrowers should avoid exact employer names, addresses, phone numbers, family names, document screenshots, and private crisis details.'
         },
         {
            question: 'How can a lender judge a request without doxxing the borrower?',
            answer:
               'The platform can show safe context, repayment history, amount versus limit, and whether the due date comes after the borrower stated payday window.'
         }
      ],
      sources: [
         { label: 'Moodeng podcast research notes' },
         { label: 'World Bank Global Findex on borrowing behavior', href: globalFindexUrl },
         { label: 'CGAP consumer protection in digital credit', href: cgapConsumerProtectionUrl }
      ],
      publishedAt: 'May 18, 2026',
      readTime: '6 min read',
      audience: 'Lenders',
      image: '/hippos/hippo-friendly-lock.png',
      imageAlt: 'Moodeng hippo with a friendly lock',
      accent: 'gold',
      sections: [
         {
            heading: 'The useful details are ordinary',
            body: [
               'A lender does not need a borrower employer name, exact address, private family history, or video call to make a better small-loan decision. The most useful details are often ordinary: work pattern, pay rhythm, due-date fit, repayment history, and why this expense matters now.',
               'That ordinary context can be more useful than a dramatic story. A borrower who says they are paid every two weeks and chooses a due date two days after payday is giving a lender a practical signal. A borrower who explains that a transport repair lets them keep working is describing the loan function without exposing their whole life.',
               'Moodeng should make that kind of context easy to share. The form should feel like a work rhythm, not a confession.'
            ]
         },
         {
            heading: 'Context should reduce guessing',
            body: [
               'A $20 request means different things depending on timing. If the due date is before the borrower gets paid, the lender should notice. If the due date lands after payday, that is a better fit. If the borrower has already repaid a similar loan, the request carries a different meaning.',
               'The product can help by comparing the request against the borrower profile. Does the repayment date come after the stated payday? Is the amount inside the current limit? Is this a first loan, a trust-building loan, or a credit-growth loan? Has the borrower completed a similar request before?',
               'That analysis should make the lender smarter without making the borrower feel watched. It should summarize fit, not judge worth.'
            ]
         },
         {
            heading: 'The product should protect the line',
            body: [
               'Borrowers should not be rewarded for oversharing. A platform that asks for too much personal detail can accidentally create a new kind of pressure: tell a sadder story, reveal more, prove more pain, perform more need.',
               'The safer pattern is guided context. Ask for job type, not employer name. Ask for pay rhythm, not payslip photos. Ask what the money helps with, not private family details. Ask whether the due date is after income arrives, not for bank screenshots.',
               'No exact employer. No phone numbers. No family names. No document screenshots. No video performance for strangers. If the detail could dox the borrower or let a lender pressure them off-platform, it does not belong in the request.'
            ]
         },
         {
            heading: 'Good lender judgment needs boundaries',
            body: [
               'Lenders on a peer-to-peer platform need enough information to act responsibly. They should not be guessing from a cartoon avatar and a loan amount. But more information is not automatically better.',
               'The right standard is decision-useful and borrower-safe. Work rhythm is useful. A payday window is useful. Prior repayment is useful. A short reason is useful. Private names, addresses, and crisis details create risk without improving the basic credit judgment.',
               'Moodeng can make the human side visible while still protecting the human. That is the design challenge.'
            ]
         }
      ]
   },
   {
      slug: 'small-loans-are-infrastructure',
      category: 'Market view',
      title: '$15 loans are infrastructure, not a gimmick',
      dek: 'The amount is small because the missing rail is small: identity, settlement, borrower-owned history, and lender confidence at the size banks refuse to touch.',
      seoTitle: 'Why Small USDC Loans Can Build Credit Infrastructure | Moodeng',
      metaDescription:
         'Small USDC loans can matter when the missing infrastructure is identity, settlement, clear terms, and borrower-owned repayment history.',
      summary: [
         'A $15 or $20 liquidity gap can be serious even when banks cannot profitably serve it through traditional underwriting.',
         'Stable settlement, human uniqueness, clear terms, and borrower-owned repayment records can change the economics of very small loans.',
         'The goal is not to push larger debt, but to make the small loan someone already needs safer and more useful after repayment.'
      ],
      keywords: ['small USDC loans', 'microloan infrastructure', 'borrower repayment history', 'credit-building loans'],
      faq: [
         {
            question: 'Why would a $15 loan matter?',
            answer:
               'A small gap can cover transport, medicine, a repair, or the days before income arrives. The amount is small, but the timing can be important.'
         },
         {
            question: 'How can small loans build credit?',
            answer:
               'They can create a repayment record when the borrower receives funding, repays on time, and carries that evidence into the next request.'
         },
         {
            question: 'Does small credit infrastructure mean encouraging more borrowing?',
            answer:
               'No. The better goal is safer access, clearer limits, and repayment history that helps borrowers avoid predatory options.'
         }
      ],
      sources: [
         { label: 'World Bank Global Findex on borrowing and financial inclusion', href: globalFindexUrl },
         { label: 'CGAP digital credit overview', href: cgapDigitalCreditUrl },
         { label: 'Moodeng pitch and product notes' }
      ],
      sourceLabel: 'From the Moodeng pitch materials',
      publishedAt: 'May 18, 2026',
      readTime: '6 min read',
      audience: 'Everyone',
      image: '/hippos/hippo-with-id-card.png',
      imageAlt: 'Moodeng hippo holding an identity card',
      accent: 'violet',
      sections: [
         {
            heading: 'Banks do not fail because the need is fake',
            body: [
               'A $15 or $20 liquidity gap can matter a lot to the person facing it. It can mean getting to work, buying medicine, covering a school cost, replacing a broken tool, or making it through the days before income arrives.',
               'Traditional lenders do not ignore these loans because the need is fake. They ignore them because the cost structure is wrong. Verifying a borrower, moving money, underwriting risk, servicing the loan, and collecting repayment can cost more than the loan itself.',
               'That leaves a vacuum. The borrower still needs liquidity, but the formal system cannot serve them at that size. Predatory lenders enter because they have a cheaper collection model: pressure, privacy invasion, and repeat dependency.'
            ]
         },
         {
            heading: 'New rails change the math',
            body: [
               'Small loans become less absurd when the rails change. Human uniqueness can reduce duplicate-account abuse without requiring a document-heavy process. Stablecoin settlement can make tiny transfers practical. A marketplace can let many lenders evaluate requests instead of forcing one institution to own every cost.',
               'The platform does not need a branch, a paper form, or a collector with a contact list. It needs clear terms, a safe request format, a repayment record, and enough borrower context for lenders to make a reasonable judgment.',
               'That is infrastructure work. It is less glamorous than promising instant cash, but it is what makes fair small credit possible.'
            ]
         },
         {
            heading: 'The real asset is the record',
            body: [
               'The loan is temporary. The repayment signal can last. If a borrower repays a small loan on time, the most important outcome is not only that the debt is closed. It is that the borrower has evidence for the next request.',
               'That record should help lenders distinguish between a first-time borrower, a borrower building trust through smaller loans, and a borrower ready for a higher credit limit after fully using and repaying a limit-building loan.',
               'A good system turns small successes into visible progress. A bad system makes every emergency feel like the first emergency forever.'
            ]
         },
         {
            heading: 'Infrastructure is also restraint',
            body: [
               'Building credit infrastructure for small loans does not mean pushing people to borrow more. It means making the loan they already need safer, clearer, and less dependent on coercion.',
               'That requires restraint in the product. Do not hide the terms. Do not blur credit limit with trust score. Do not let borrowers request beyond available capacity. Do not use referral boosts where a borrower has already proven themselves through real repayment history.',
               'The point is to replace predatory improvisation with rules people can see.'
            ]
         }
      ]
   },
   {
      slug: 'secret-societies-and-the-need-for-safe-trust',
      category: 'Book review',
      title: 'Secret societies and the need for safe trust',
      dek: 'A history of brotherhoods, mutual aid, and rotating credit shows why people build their own institutions when official ones do not protect them.',
      seoTitle: 'Informal Trust, Mutual Aid, and Safe Microcredit | Moodeng',
      metaDescription:
         'A book review on secret societies, mutual aid, rotating credit, and what fair P2P lending can learn about safe trust.',
      summary: [
         'Informal trust systems often appear before official institutions reach workers, migrants, or non-elite communities.',
         'The same social ties that create mutual aid can become coercive when rules are hidden and exit is weak.',
         'Moodeng should preserve community trust while preventing privacy loss, off-platform pressure, and intimidation.'
      ],
      keywords: ['informal credit', 'mutual aid lending', 'safe trust systems', 'p2p lending trust'],
      faq: [
         {
            question: 'Why discuss secret societies on a credit blog?',
            answer:
               'The history shows how people create trust and protection systems when official institutions are absent, which is directly relevant to informal credit.'
         },
         {
            question: 'How can mutual aid become harmful?',
            answer: 'When rules are hidden or power is unequal, social support can turn into pressure, hierarchy, or debt control.'
         },
         {
            question: 'What should P2P lending learn from informal trust systems?',
            answer:
               'It should keep the speed and human context of community credit while adding clear rules, privacy boundaries, and borrower-owned records.'
         }
      ],
      sources: [
         { label: 'Book review source: Secret Societies Reconsidered' },
         { label: 'World Bank Global Findex on informal borrowing', href: globalFindexUrl },
         { label: 'CGAP consumer protection in digital credit', href: cgapConsumerProtectionUrl }
      ],
      sourceLabel: 'Book review: Secret Societies Reconsidered',
      publishedAt: 'May 18, 2026',
      readTime: '8 min read',
      audience: 'Everyone',
      image: '/hippos/community.png',
      imageAlt: 'Moodeng community hippo representing lender review',
      accent: 'green',
      sections: [
         {
            heading: 'People invent institutions before institutions find them',
            body: [
               'Secret Societies Reconsidered is useful because it pushes against a lazy category. The organizations in the book are not only criminal gangs, and they are not only innocent mutual-aid groups. They sit on a continuum: brotherhood, rotating credit, funeral support, work organization, protection, commerce, coercion, and sometimes racketeering.',
               'That complexity matters for credit. People build informal institutions when official institutions do not reach them. Migrants, workers, small traders, and people outside elite networks still need trust, protection, pooled resources, and a way to coordinate with people who are not family.',
               'Before the formal system notices them, people invent systems of their own.'
            ]
         },
         {
            heading: 'Mutual aid can turn into pressure',
            body: [
               'The same social ties that help someone survive can also become tools of control. Protection can become racketeering. Brotherhood can become hierarchy. A shared fund can become debt pressure when the rules are not visible and the exit path is weak.',
               'This is not a reason to dismiss informal trust. It is a reason to design carefully around it. Communities need ways to help each other, but help should not depend on humiliation, secrecy, or private threats.',
               'Peer-to-peer lending has the same tension. It can be mutual aid with better rails, or it can become a new channel for social pressure if the product does not set boundaries.'
            ]
         },
         {
            heading: 'Loan sharks are a broken trust institution',
            body: [
               'A loan shark is not only a bad lender. It is an informal institution built around fear, dependency, and social exposure. It gives fast access, but the borrower pays with privacy, dignity, and future choice.',
               'The borrower may be known by the shark, but not in a way that creates portable trust. The lender knows the borrower repaid, but the record does not become a public or borrower-owned asset. The knowledge stays with the person who benefits from the borrower returning.',
               'That is broken trust. The relationship has information, but the information is used to control rather than to expand opportunity.'
            ]
         },
         {
            heading: 'Moodeng should make trust legible',
            body: [
               'The alternative is not cold, anonymous finance. People still need social trust. Lenders need to understand work rhythm, repayment history, request purpose, and whether a due date fits real income timing.',
               'Moodeng has to make that trust legible without making it dangerous. Identity without doxxing. Context without confession. Repayment records without intimidation. Human judgment without off-platform pressure.',
               'The product should feel like a safe institution, not a private favor and not a hidden brotherhood. Clear rules are the protection.'
            ]
         },
         {
            heading: 'Community credit needs an exit from fear',
            body: [
               'The strongest informal systems solve real problems. They work because people know one another, share risk, and move faster than formal institutions. The danger is that speed and closeness can become coercion.',
               'Moodeng should keep the useful part of community credit, then remove the fear. A borrower can be real, visible enough, and accountable without being exposed. A lender can be generous and careful without becoming a collector. The system can remember repayment without turning private hardship into a permanent label.'
            ]
         }
      ]
   },
   {
      slug: 'what-credit-risk-books-miss-about-loan-sharks',
      category: 'Book review',
      title: 'What credit risk books miss about loan sharks',
      dek: 'Reading portfolio risk beside money and credit theory shows a blind spot: formal finance manages lender concentration, while excluded borrowers face concentration of options.',
      seoTitle: 'Credit Risk, Borrower Concentration, and Loan Sharks | Moodeng',
      metaDescription:
         'A book review on credit portfolio risk and money theory, with a borrower-side lens on loan sharks and concentrated credit options.',
      summary: [
         'Formal credit risk books focus on lender exposure, but excluded borrowers also face concentration risk when only one bad lender will say yes.',
         'Loan sharks replace transparent underwriting with social pressure, contact access, shame, and repeat dependency.',
         'A fair microloan marketplace has to manage lender risk and borrower dependency at the same time.'
      ],
      keywords: ['credit risk loan sharks', 'borrower concentration risk', 'credit portfolio risk', 'microloan marketplace risk'],
      faq: [
         {
            question: 'What is borrower-side concentration risk?',
            answer:
               'It is the risk a borrower faces when they have too few fair credit options and become dependent on one predatory lender or app.'
         },
         {
            question: 'How do loan sharks manage risk differently from banks?',
            answer:
               'Instead of transparent underwriting and diversification, they often rely on pressure, social exposure, contact-list access, and repeat dependency.'
         },
         {
            question: 'What should fair microloan lenders watch?',
            answer:
               'They should watch amount versus limit, due-date fit, repayment history, borrower context, and portfolio exposure without using intimidation as risk control.'
         }
      ],
      sources: [
         { label: 'Book review source: Risk Management in Credit Portfolios' },
         { label: 'Book review source: The Theory of Money and Credit' },
         { label: 'CGAP digital credit risk overview', href: cgapDigitalCreditUrl },
         { label: 'World Bank Global Findex on borrowing sources', href: globalFindexUrl }
      ],
      sourceLabel: 'Book review: Credit portfolio risk + The Theory of Money and Credit',
      publishedAt: 'May 18, 2026',
      readTime: '9 min read',
      audience: 'Lenders',
      image: '/hippos/thinking.png',
      imageAlt: 'Moodeng hippo thinking about loan types',
      accent: 'gold',
      sections: [
         {
            heading: 'Formal credit starts with the lender problem',
            body: [
               'Risk Management in Credit Portfolios is about a real and important discipline: how lenders measure default, loss severity, concentration, correlation, and the capital needed to survive stress. The book is concerned with the lender problem. Is the institution too exposed to one borrower, one sector, one region, or one hidden pattern of failure?',
               'That machinery matters. Bad lender risk management can create systemic damage. But it is also incomplete if we are trying to understand loan sharks. Formal finance is very good at describing the risk of lending. It is much worse at describing the risk of having nowhere fair to borrow.',
               'A bank worries about concentration inside its portfolio. A borrower can face concentration inside their life.'
            ]
         },
         {
            heading: 'Borrowers have concentration risk too',
            body: [
               'Loan sharks appear where borrowers do not have a diversified set of fair options. If a bank rejects a worker because the file is thin, the borrower may not face a healthy market of lenders. They may face one app, one shop lender, one contact-list lender, or one informal collector.',
               'That is borrower-side concentration risk. Too much dependency on the only person willing to say yes. The lender can set worse terms because the borrower cannot easily walk away.',
               'A fair marketplace should reduce that concentration. More lenders, clearer borrower records, and safer context can give a borrower better options without pretending every request is risk-free.'
            ]
         },
         {
            heading: 'Money and credit are promises across time',
            body: [
               'Mises describes money as a medium that makes exchange easier, especially when direct barter no longer works. Credit extends that logic across time. Someone receives value now and promises settlement later.',
               'Whatever one thinks of his broader economics, that basic idea is useful for Moodeng. A loan is not only cash today. It is an agreement that the future borrower, future lender, future due date, and future record will still make sense when repayment arrives.',
               'Loan sharks distort that promise. They make future settlement less about trust and more about fear.'
            ]
         },
         {
            heading: 'Loan sharks turn uncertainty into control',
            body: [
               'Predatory lenders do not solve uncertainty cleanly. They replace underwriting with pressure. They ask for phone contacts, shame leverage, social visibility, and repeat dependence.',
               'Instead of pricing risk transparently, they make the borrower personally exposed. The lender may feel protected, but the protection comes from fear rather than better credit information.',
               'That is bad credit technology. It works by making default socially terrifying. It does not create a better borrower record, and it does not help fair lenders identify who deserves a chance next time.'
            ]
         },
         {
            heading: 'Moodeng has to manage both portfolios',
            body: [
               'A fair microloan marketplace should care about lender risk without copying the coldest parts of bank logic. Lenders need limits, diversification, repayment evidence, and enough context to judge a request. They should not be asked to fund blindly.',
               'Borrowers need the opposite of loan-shark concentration: more fair funding options, clear terms, no contact-list collateral, and a repayment record that improves their next choice.',
               'Moodeng has to manage both portfolios at once. The lender portfolio should avoid hidden risk. The borrower portfolio should avoid hidden dependency. That is the difference between a marketplace that merely moves loans and one that builds fair credit.'
            ]
         }
      ]
   }
];

export const featuredBlogPost = blogPosts[0];

export function findBlogPost(slug: string | undefined): BlogPost | undefined {
   return blogPosts.find((post) => post.slug === slug);
}
