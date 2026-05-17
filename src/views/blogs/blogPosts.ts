export interface BlogSection {
   heading: string;
   body: string | string[];
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
      readTime: '9 min read',
      audience: 'Borrowers',
      image: '/hippos/journal-hippo.png',
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
      sourceLabel: 'From the loan shark research notes',
      publishedAt: 'May 18, 2026',
      readTime: '8 min read',
      audience: 'Everyone',
      image: '/hippos/thinking.png',
      imageAlt: 'Moodeng hippo thinking about loan types',
      accent: 'blue',
      sections: [
         {
            heading: 'Trust theater is cheap to manufacture',
            body: [
               'A loan shark does not have to look like a loan shark. In the app store, the costume is easy: a rounded logo, a cheerful name, a smooth onboarding flow, a few screenshots of smiling users, and copy that promises cash in minutes.',
               'That surface can create trust faster than a borrower can investigate who owns the app. A desperate user rarely has time to compare licenses, company registration, controller relationships, data policies, and complaint histories. The app only needs to look safer than the alternatives in that moment.',
               'This is the first lesson from the loan shark research notes: visual trust is not the same thing as real accountability. A brand can feel local while the decision-making, data storage, playbook, and profit extraction sit somewhere else.'
            ]
         },
         {
            heading: 'The brand changes, the machine stays',
            body: [
               'Predatory lending networks can rotate names, icons, and front companies faster than ordinary borrowers can build a warning list. One app is removed. Another appears. The colors change, the screenshots change, the support name changes, but the operating logic survives.',
               'This matters because borrowers often judge a loan app as a single product. The network may judge it as one disposable storefront in a larger machine. The machine is what matters: traffic acquisition, permission capture, contact-list pressure, collections scripts, and repeat borrowing loops.',
               'When the front door is disposable, reputation stops working as a normal consumer safety mechanism. Bad reviews can be outrun. A damaged brand can be abandoned. The borrower is left dealing with a system that is harder to name than the app they downloaded.'
            ]
         },
         {
            heading: 'Fast approval is not the same as fair access',
            body: [
               'The promise of instant approval is powerful because the underlying need is real. People are not foolish for wanting speed. A delayed paycheck, a medical trip, a repair, or a family emergency does not wait for a bank queue.',
               'The problem begins when speed replaces consent. A borrower who needs money now may click through permissions they would reject in a calmer moment. Predatory apps exploit that urgency. They make the path to cash obvious and the path to understanding almost invisible.',
               'A fair product should still be fast where speed helps the borrower. But it should slow down where speed creates harm: before permissions, before terms, before wallet actions, before a borrower commits to a due date that does not match their income.'
            ]
         },
         {
            heading: 'Legitimacy should be visible in the product',
            body: [
               'Moodeng does not need to look less friendly to be more serious. Friendly is useful. The point is to make the parts that matter visible: who is funding the loan, what amount is requested, when repayment is due, how much the borrower offered to repay, what data is not collected, and how repayment affects trust.',
               'The app should behave like it has nothing to hide. A lender should see the request and the borrower context. A borrower should see the cost, due date, and consequences before submitting. Everyone should understand that Moodeng is not using hidden contact pressure as a backstop.',
               'That is the opposite of app-store theater. The mascot can be cute, but the system underneath has to be plain, inspectable, and hard to abuse.'
            ]
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
      slug: 'what-oil-pipelines-teach-us-about-credit',
      category: 'Book review',
      title: 'What oil pipelines teach us about credit',
      dek: 'A book about oil routes has a useful lesson for small loans: when the main pipes are controlled by powerful players, ordinary people end up paying more for worse access.',
      sourceLabel: 'Book review: The Global Game of Oil Pipelines',
      publishedAt: 'May 18, 2026',
      readTime: '8 min read',
      audience: 'Everyone',
      image: '/hippos/lender-diversity-piechart.png',
      imageAlt: 'Moodeng hippo reviewing a lender diversity chart',
      accent: 'blue',
      sections: [
         {
            heading: 'Pipelines are not just pipes',
            body: [
               'Gulshan Dietl writes about oil pipelines as more than technical infrastructure. A pipeline is a route of power. It decides who can move a critical resource, who must wait, who pays extra, and who becomes dependent on a gatekeeper.',
               'That is a useful way to think about credit. Money also moves through pipes: banks, identity checks, payment networks, credit bureaus, underwriting rules, and platform permissions. These pipes look abstract compared with steel in the ground, but they decide access just as strongly.',
               'When someone cannot enter the normal credit pipe, they do not stop needing money. They look for the route that still exists. That route may be expensive, opaque, and dangerous.'
            ]
         },
         {
            heading: 'When the formal route fails, the shadow route appears',
            body: [
               'People do not choose loan sharks because the product is good. They choose them because the official path is too slow, too expensive, too document-heavy, or closed entirely. The emergency does not wait for a bank to learn how informal work actually functions.',
               'The same borrower who is invisible to a bank can be very visible to a predatory app. The app can see contacts, work chats, location, screenshots, phone behavior, and social pressure points. It cannot underwrite them fairly, but it can collect against them aggressively.',
               'This is the shadow route. It exists because the formal route leaves too many people outside, and because the people outside still have urgent, ordinary needs.'
            ]
         },
         {
            heading: 'Access without ownership creates dependency',
            body: [
               'A pipeline can move oil through a place while the people near it have little control over the value passing through. Bad credit works in a similar way. A borrower can repay again and again while the useful reputation stays trapped inside a private lender ledger.',
               'The borrower used the pipe, but did not gain ownership of the record. The lender learned that the borrower repaid. The next lender did not. The borrower may have done everything right and still return to the same narrow set of options.',
               'This is one reason loan sharks are so sticky. They do not need to help the borrower graduate. They benefit when the borrower keeps coming back.'
            ]
         },
         {
            heading: 'Moodeng is trying to build a different pipe',
            body: [
               'The point is not that a $15 loan is the same as global oil politics. The point is that infrastructure decides outcomes before the individual ever makes a choice. Routes matter. Gatekeepers matter. Ownership of the record matters.',
               'Moodeng needs to make the fair route easier than the predatory route. That means human uniqueness without doxxing, terms shown before funding, stable settlement, borrower context without confession, and repayment history that can travel forward.',
               'A good credit pipe should not extract dignity as the toll.'
            ]
         },
         {
            heading: 'A small loan can still be a serious system',
            body: [
               'Small amounts can make people underestimate the seriousness of the design problem. But the smaller the loan, the easier it is for bad actors to claim that consumer protections are too expensive or too slow.',
               'Moodeng should take the opposite position. Small loans deserve clear infrastructure precisely because borrowers have less room for error. If the system works, it can replace a shadow route with one that is visible, accountable, and useful after the first repayment.'
            ]
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
