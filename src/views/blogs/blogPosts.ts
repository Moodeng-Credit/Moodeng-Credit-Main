export interface BlogSection {
   heading: string;
   body: string | string[];
   evidenceImages?: BlogEvidenceImage[];
}

export interface BlogEvidenceImage {
   src: string;
   alt: string;
   caption: string;
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
export const loanSharksBookUrl = 'https://www.bloomsbury.com/us/loan-sharks-9780815734321/';
export const organizedCrimeCyberspaceUrl = 'https://academic.oup.com/bjc/article/61/2/303/5918755';
export const philippinesOlpAdvisoryUrl =
   'https://privacy.gov.ph/wp-content/uploads/2026/03/DICT-NPC-SEC-Public-Advisory-on-Online-Lending-Platforms.pdf';
export const reutersThaiHouseholdDebtUrl =
   'https://www.tradingview.com/news/reuters.com%2C2025%3Anewsml_L6N3VQ05C%3A0-thailand-to-start-buying-bad-household-debt-this-month-finance-minister-says/';
export const reutersScamCentersUrl =
   'https://www.investing.com/news/world-news/scam-hubs-on-thaimyanmar-border-still-have-up-to-100000-people-thai-police-says-3933574';

export const blogPosts: BlogPost[] = [
   {
      slug: 'first-credit-record-should-not-belong-to-a-loan-shark',
      category: 'Shadow systems',
      title: 'Your first credit record should not belong to a loan shark',
      dek: 'The app that says yes first gets to write your financial story. In the Philippines, that app is often unregistered, run from overseas, and designed around your contacts, not your creditworthiness.',
      seoTitle: 'Loan Shark Alternatives for First Credit Records | Moodeng',
      metaDescription:
         'Why the first credit record should belong to the borrower, not an unregistered loan app using contact-list pressure and fake-looking credibility signals.',
      summary: [
         'In the Philippines, many online lending apps look safe while operating through weak registration, offshore ownership, and private repayment ledgers.',
         'Fake-looking executive profiles, unverifiable public footprints, and strange engagement signals are red flags when paired with borrower complaints and contact-list abuse.',
         'A fair first credit record should become portable borrower evidence, not a private collection tool controlled by the lender.'
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
         { label: 'OLAs Research notes' },
         { label: 'National Privacy Commission of the Philippines complaint reports' },
         { label: 'SEC enforcement orders' },
         { label: 'Tala 2024 Philippine Digital Lending Industry Report' },
         { label: 'ResearchGate integrative review of OLAs in the Philippines' },
         { label: 'Al Jazeera Philippines loan app investigation, September 2024' },
         { label: 'Rappler investigation into Chinese-linked OLA operators' },
         { label: 'inquiro.ph financial literacy statistics 2024' }
      ],
      sourceLabel: 'From the OLA research notes',
      publishedAt: 'May 2026',
      readTime: '11 min read',
      audience: 'Borrowers',
      image: '/hippos/journal-hippo-no-eyebrows.png',
      imageAlt: 'Moodeng hippo writing in a journal',
      accent: 'violet',
      sections: [
         {
            heading: 'The app-store illusion',
            body: [
               'For millions of informal workers across Southeast Asia, formal credit has one consistent answer: no. No bank account history. No payslips from a registered employer. No credit file anywhere a normal lender can read it.',
               'The need for money does not disappear with the rejection. So borrowers go looking for whoever will say yes. In the Philippines right now, whoever says yes first is very often an app: cheap to build, fast to approve, and designed around a very different definition of collateral than the one printed in any lending contract.',
               'Open the iOS App Store and search for Philippine loan apps. You will find bright icons, friendly names, fast approvals, low barriers, and easy language about financial freedom. The design communicates safety. In many cases, the substance does not.',
               'A review of 40 online lending applications active in the Philippines found that only 25% were registered with the Securities and Exchange Commission. Of those claiming to report credit scores, most were not listed with the Credit Information Corporation of the Philippines, the official body that exists specifically to make borrower records portable and useful.',
               'This is not a niche problem. The National Privacy Commission has received hundreds of formal complaints against online lending apps, all reporting essentially the same pattern: contact lists accessed without genuine consent, personal information disclosed to third parties, and harassment aimed not only at the borrower but at family members, coworkers, and friends.'
            ]
         },
         {
            heading: 'Who is actually running these apps',
            body: [
               'The ownership structure of Philippine online lending apps is one of the most revealing parts of the story, and the least discussed. Research into the operators behind iOS-listed loan apps finds a consistent pattern: many are registered under one company name in the SEC while operating three or four different app brands at the same time.',
               'A single lending corporation may run several consumer-facing products with shared infrastructure and ownership. If one brand accumulates too many complaints or regulatory attention, the others continue operating.',
               'The nationality breakdown of identified operators skews heavily toward Chinese nationals, often in partnership with Filipino co-directors who provide the local registration requirements. This is not uniformly predatory. Legitimate Chinese-backed fintech operates across Southeast Asia. But it does create accountability gaps when abusive collection tactics have to be traced through local registrations, offshore operators, and app-store listings that can be changed or removed.',
               'HappyCash, operated by Yinshan Lending Inc., lists a CEO profile on LinkedIn. The company is SEC-registered, but it is not listed with the Credit Information Corporation. The executive profile raises credibility questions: the profile photo appears AI-generated, the account has no meaningful independent footprint, and searches did not surface a matching public professional record outside the profile itself.',
               'FT Lending similarly presents a LinkedIn executive identity with a highly polished portrait, a generic corporate-style background, and little verifiable external presence. Researchers were unable to find normal public traces one would expect from a real executive operating a consumer lending company: no press mentions, no visible industry history, no independent references, and no credible trail beyond the profile.'
            ],
            evidenceImages: [
               {
                  src: '/blog-linkedin-yige-w.png',
                  alt: 'LinkedIn profile screenshot for Yige W. associated with Yinshan Lending Inc.',
                  caption:
                     'HappyCash operator Yinshan Lending Inc. presents a LinkedIn CEO profile with a synthetic-looking portrait and no meaningful independent public footprint.'
               },
               {
                  src: '/blog-linkedin-pete-zuo.png',
                  alt: 'LinkedIn profile screenshot for Pete Shipeng Zuo associated with FT Lending Master Philippines Corp.',
                  caption:
                     'FT Lending presents a similarly polished executive profile with a generic city background and little corroborating public record.'
               }
            ]
         },
         {
            heading: 'Constructed credibility',
            body: [
               'The two profiles are especially striking side by side. They come from different companies, yet use the same credibility formula: clean studio-like profile photo, generic city cover image, executive title, university badge, and almost no discoverable life outside the page.',
               'The profile photos are not proof by themselves. But in context, they are a red flag. They look less like accidental placeholders and more like constructed credibility: the visual language of a legitimate fintech executive used to project trust to borrowers, regulators, and journalists who might only do a surface-level check.',
               'The pattern is not limited to corporate profiles. A Cashify video on Facebook reportedly showed roughly 61,000 views with not a single comment. That is not impossible, but it is suspicious for a consumer loan product targeting real borrowers. Real financial products generate questions, complaints, reactions, confusion, spam, tags, anger, and support requests.',
               'A large-view, zero-comment lending video deserves scrutiny because it suggests the visible engagement layer may be managed, suppressed, inflated, or disconnected from genuine borrower activity.',
               'The point is not that every odd profile photo or quiet Facebook video proves fraud. The point is that these apps often rely on surfaces of legitimacy that collapse under basic verification. The App Store listing looks safe. The LinkedIn identity looks professional. The video looks popular. But when the company is not CIC-listed, the executive identity cannot be independently corroborated, the profile image appears synthetic, and borrower complaints describe contact-list abuse, the surface is doing a lot of work.'
            ]
         },
         {
            heading: 'The contact list is the product',
            body: [
               'To understand what these apps are actually selling, you have to understand what they are actually collecting. When a borrower downloads a loan app and requests a small amount, maybe PHP 2,000, PHP 5,000, or an emergency float, they are typically asked for permissions that have nothing to do with assessing their ability to repay.',
               'Contacts. Location. SMS history. Camera. Sometimes social media access. The framing is underwriting: we need to assess your risk profile. The function is leverage: we need to know who to call if you are late.',
               'The National Privacy Commission documented the mechanism precisely in its complaints: contact lists are accessed without genuine consent or authority, and the information is used to send threatening, false, or humiliating messages to people who never agreed to be part of a loan transaction. The borrower thinks they borrowed money. The lender knows they purchased leverage over a social network.'
            ]
         },
         {
            heading: 'Who borrows, and why they stay',
            body: [
               'The typical Philippine online lending app borrower does not look like someone making a careless financial decision. Research from Tala paints a specific profile: young adults, 25-34, predominantly female, urban, some college education, Android smartphone users with household incomes under PHP 42,000 a month supporting 2-6 family members.',
               'They borrow primarily for emergency expenses, bill payments, and daily needs. Nearly 90% report clear awareness of interest rates and fees at the point of application. They are not confused about the terms. They are choosing the available option.',
               'The Philippine financial literacy rate sits at approximately 25% of adults, 13th among 21 developing Asian countries in a recent comparative ranking. But low financial literacy is not what drives online lending app use. High financial exclusion is. A borrower who understands exactly what an app charges and takes it anyway is telling you something about the alternatives, not about their comprehension.',
               'What keeps borrowers inside the system is not ignorance. It is the absence of a portable exit. A borrower who repays an app on time has demonstrated something real. But if the lender is not CIC-registered, that demonstration produces no transferable credit record. The next emergency starts from zero. The same gate is still the only open one.'
            ]
         },
         {
            heading: 'The first record becomes the story',
            body: [
               'There is a simple principle underneath all of this. The first lender to say yes to a new borrower gets to write the first entry in their financial story. If that entry is written by a legitimate lender into a system the borrower owns and can carry forward, it becomes a ladder. If it is written by a predatory app into a private database that serves the lender collection function rather than the borrower future access, it becomes a trap.',
               'The borrower repays. The lender learned something valuable about that borrower. The borrower behavior generated a proof of reliability. The borrower does not own that proof. It does not travel with them. The next lender cannot see it. The system resets.',
               'This is how predatory credit reproduces itself. It is not primarily about interest rates, though the rates are often abusive. It is about who owns the useful output of a completed loan. A repayment is evidence. Evidence should belong to the person who produced it.'
            ]
         },
         {
            heading: 'What a different pipe looks like',
            body: [
               'The OLA problem in the Philippines is a specific, documentable instance of a structural failure in credit infrastructure. Informal workers need access to liquidity. Formal systems exclude them. Shadow systems rush in, and the shadow systems are designed around the logic of leverage, not the logic of underwriting.',
               'A fair alternative has to be different in structure, not just in tone. Friendlier copy and brighter colors are not a product. Predatory apps already know how to look friendly: the app names, the fast-approval UX, the polished LinkedIn profiles, the synthetic-looking executive photos, the engagement numbers that do not behave like real communities, and the trust-building flow that arrives before the permissions request.',
               'The structural differences that matter are simple: no contact-list collateral, terms before funding, identity that protects the network without exposing the person, and repayment history that belongs to the borrower.',
               'The first credit record should be a ladder. Moodeng is designed around that premise: small USDC loans, World ID verification, and portable repayment history for borrowers building credit where the formal system has not reached them yet. The app that says yes first should not get to own your financial story forever.'
            ]
         }
      ]
   },
   {
      slug: 'app-store-costume-of-predatory-credit',
      category: 'Predatory credit history',
      title: "Loan sharks didn't begin with apps",
      dek: "They began where banks wouldn't lend. Smartphones changed the scale of predatory lending, but not the business model.",
      seoTitle: 'Loan Sharking History and Predatory Loan Apps | Moodeng',
      metaDescription:
         'A history of loan sharking, salary buying, payday lending, and app-based debt collection shows how predatory credit keeps finding the same pressure points.',
      summary: [
         'Loan sharking grew where formal banks would not make small loans, leaving workers and low-income borrowers dependent on private lenders.',
         'Salary buying shows the payday-lending template: quick cash before wages arrive, confusing legal framing, and collection pressure through the borrower job.',
         'Digital loan apps scale old tactics by turning phones, contacts, photos, and social ties into collection leverage.'
      ],
      keywords: ['loan sharking history', 'predatory loan apps', 'salary buying', 'contact-list lending', 'payday lending history'],
      faq: [
         {
            question: 'Did loan sharks begin with mobile apps?',
            answer:
               'No. Modern loan apps scale an older model: find people excluded from normal credit, make the debt hard to escape, and collect through pressure.'
         },
         {
            question: 'What was salary buying?',
            answer:
               'Salary buying was an early form of payday lending where a worker received cash before payday and repaid through wages, often with charges that looked small but annualized into extreme rates.'
         },
         {
            question: 'What makes app-based predatory lending dangerous?',
            answer:
               'The danger is not only interest. Some apps can use contact lists, messages, photos, location, and social ties as pressure points for debt collection.'
         }
      ],
      sources: [
         { label: 'Loan Sharks: The Birth of Predatory Lending, Charles R. Geisst', href: loanSharksBookUrl },
         { label: 'Organized crime in cyberspace, British Journal of Criminology', href: organizedCrimeCyberspaceUrl },
         { label: 'The Cost of Convenience: predatory loan applications on Android', href: predatoryLoanAppsPaperUrl },
         { label: 'Philippines public advisory on online lending platforms', href: philippinesOlpAdvisoryUrl },
         { label: 'Reuters reporting on Thai household debt', href: reutersThaiHouseholdDebtUrl },
         { label: 'Reuters reporting on Southeast Asia scam centres', href: reutersScamCentersUrl },
         { label: "Bangkok Post reporting on Thailand's traditional and app-based loan-shark cases" }
      ],
      sourceLabel: 'Loan shark history and digital lending research',
      sourceHref: loanSharksBookUrl,
      publishedAt: 'May 31, 2026',
      readTime: '18 min read',
      audience: 'Everyone',
      image: '/blog-loan-shark.png',
      imageAlt: 'Cartoon loan shark in a suit holding a phone and loan agreement',
      accent: 'blue',
      sections: [
         {
            heading: 'The old business model',
            body: [
               `A history of loan sharking shows that predatory lending has always followed the same pattern: find people who need money quickly, make the price hard to escape, and use shame or fear to collect. Smartphones changed the scale, not the business model.`,
               `Before the loan shark became an app, he was a lender with a desk, a newspaper ad, and a very good understanding of payday.`,
               `The phrase itself is older than the smartphone by more than a century. In Loan Sharks: The Birth of Predatory Lending, Charles R. Geisst traces the rise of American loan sharking to the decades after the Civil War, when banks were growing, cities were expanding, and many ordinary borrowers still had nowhere respectable to go for small loans. The book's central argument is blunt: "Today's predatory lending is yesterday's loan sharking."`,
               `The first loan sharks did not appear because people suddenly became reckless with money. They appeared because formal credit was unevenly distributed. In the late 19th century, large banks mostly served businesses, merchants, and wealthier customers. Farmers, wage workers, and small borrowers were often left outside the system. Geisst writes that by the 1890s, loan sharking had become a "large cottage industry," especially west of the Ohio River, where small banks and private finance companies filled gaps left by older institutions.`,
               `Those lenders were not always gangsters. Some were merchants. Some were businessmen. Geisst even notes that clergymen with a few thousand dollars to invest entered the high-interest lending business. The attraction was simple: small borrowers had urgent needs, few alternatives, and little ability to sue. In Geisst's telling, lenders charged "what the market would bear," and borrowers seldom complained publicly. Returns could run from ordinary-looking interest to well over 500% a year.`,
               `That is where the modern story begins: not with violence, but with exclusion. The poor needed cash. The banks did not want the loans. Private lenders stepped in.`
            ]
         },
         {
            heading: 'Exclusion created the market',
            body: [
               `The name "loan shark" replaced the older word "usurer" because "shark" already meant a predator in 19th-century American slang. The new term made the lender sound less like a medieval moral villain and more like a rough businessman providing a service at a price. Geisst notes that some later loan sharks even softened their public image as "aunties and uncles," though the rates were anything but charitable.`,
               `Usury laws were supposed to stop this. Many states had inherited interest-rate ceilings from older British and colonial traditions. Some capped real-estate loans at 6% or 8%. But the laws were patchy, outdated, and often easy to evade. Small borrowers, generally people borrowing $300 or less, had to rely on private lenders. Those lenders could hide the real cost in the details of the agreement while appearing to stay within the law.`,
               `The problem was not only that the rates were high. It was that the rules were written for one kind of credit market while borrowers were living in another.`
            ]
         },
         {
            heading: 'Salary buying',
            body: [
               `By the early 20th century, one form of loan sharking became especially important: salary buying.`,
               `Today, Geisst writes, salary buying is known as payday lending. It took off in urban areas with factories, offices, and municipal governments, places full of workers with steady paychecks and frequent cash shortages. A finance company would advance money to a worker before payday. When the worker was paid, the lender took a fee, leaving the worker with less than the full paycheck. The charge often amounted to more than 20% per pay period, or about 240% annualized. The lender's defense was that this was not a loan, but a discounted advance on future wages.`,
               `That legal distinction mattered. If it was not a loan, usury laws might not apply. But the borrower experienced it like debt.`,
               `Salary buying was attractive to loan sharks because it was simple, contractual, and profitable. One New York loan office reported a monthly return that worked out to 342% annualized. Geisst describes how successful salary lenders grew from local offices into multi-city businesses. D.H. Tolman, one of the most notorious salary buyers of the era, had more than 60 offices in the United States and Canada by World War I.`,
               `The most powerful weapon was not always a fist. It was the borrower's job.`,
               `Borrowing against salary could be grounds for dismissal. That made the worker vulnerable. If a borrower fell behind, the lender could notify the employer. Geisst calls the implied blackmail obvious. Some lenders also sent women to workplaces to publicly shame borrowers, a practice known as a "bawling out."`,
               `That detail matters because it shows that loan sharking has always been about more than interest. The debt was collected through reputation. The lender did not merely own the loan. He owned the borrower's fear of exposure.`
            ]
         },
         {
            heading: 'Reform and evasion',
            body: [
               `Reformers saw the problem. The Russell Sage Foundation became one of the central forces in the early 20th-century campaign against loan sharks. Arthur Ham, who led the foundation's Division of Remedial Loans, studied the economics of small lending and reached an uncomfortable conclusion. Very low legal interest ceilings did not make small loans affordable; they made legal small loans uneconomical, leaving the market to illegal lenders. Ham wrote that "A profitable business at 6 percent is impossible," because the revenue on a small loan could not cover the cost of administering it.`,
               `That was the reform dilemma. If the law capped rates too low, legitimate lenders stayed away and loan sharks filled the vacuum. If the law allowed higher rates, reformers worried they were legalizing exploitation.`,
               `The Uniform Small Loan Law tried to resolve that tension. Beginning in the 1910s, states adopted versions of a model law backed by the Russell Sage Foundation. These laws allowed licensed lenders to charge higher rates, often 2.5% to 3.5% per month, while requiring licenses, limits on fees, and rules around business methods. In effect, reformers tried to draw a line between legal high-cost lending and criminal loan sharking.`,
               `But the line was never clean.`,
               `Geisst shows that even when states legalized higher rates for licensed lenders, loan sharks continued to operate. In New York, officials realized in the late 1920s that loan sharking had never really been defeated in salary buying, which Geisst calls the "almost invisible weapon" of urban loan sharks. Borrowers got less money in exchange for salary advances and often had little choice but to continue. Lenders still used employers as pressure points.`,
               `Chicago showed how organized the business had become. A 1916 city report found 229 lending firms active at one time or another, with 139 active in the fall of that year. The business was estimated at nearly $12 million a year. And despite the image of small-time operators, loan sharks had systems: Geisst notes that Chicago lenders operated a joint clearinghouse, much like banks and brokers, to check whether borrowers already owed other sharks.`,
               `The clearinghouse was not consumer protection. It protected the lender. A borrower already trapped by one shark might be too risky for another.`
            ]
         },
         {
            heading: 'Depression-era scale',
            body: [
               `During the Depression, the problem hardened. Workers were poorer, credit was tighter, and desperation was easier to monetize. Geisst describes one Atlanta case in which a borrower paid $1,550 on an original $76 loan before it was finally settled. The Twentieth Century Fund estimated that loan sharks had a total business volume of about $750 million on loans averaging $50, implying roughly 15 million transactions.`,
               `By then, the older business had also begun to overlap more clearly with organized crime. Geisst notes that before the Great Depression, organized crime did not dominate urban private lending. But crime syndicates moved quickly when other loans became hard to find in the 1930s.`,
               `Thomas Dewey's campaign against New York loan sharks shows how large the problem had become. Loan sharking was so widespread among Works Progress Administration employees that, after receiving more than 14,000 complaints, Dewey launched a major investigation. His agents raided lenders around New York, targeting small unlicensed operators whose terms and tactics were hurting working people. By October 1936, Dewey had successfully prosecuted 130 people.`,
               `But even that victory was temporary. The pattern repeated: reformers cracked down, lenders adapted, and borrowers with few alternatives kept returning.`
            ]
         },
         {
            heading: 'Smartphones solved old operating problems',
            body: [
               `That is the history that matters for today's loan apps. The smartphone did not create the loan shark's business model. It solved the loan shark's old operating problems.`,
               `A salary buyer once needed access to a worker's employer. A digital lender can access a borrower's contact list.`,
               `A workplace shaming campaign once required someone to show up and yell. A digital lender can text-bomb relatives, classmates, and co-workers.`,
               `A lender once needed local knowledge. A phone already contains the borrower's social world.`
            ]
         },
         {
            heading: 'Relational repression went digital',
            body: [
               `In a 2020 article in the British Journal of Criminology, Peng Wang, Mei Su, and Jingyi Wang examined how traditional organized criminal groups in China moved into online peer-to-peer lending. Their research found loan sharks using false advertising, hidden or confusing interest terms, compromising information, and legal intimidation to trap student borrowers. The authors describe a new enforcement strategy: relational repression, or pressure applied through a borrower's social ties.`,
               `Their clearest sentence is this: "Cyberviolence drags the client's social contacts into the debt collection process." In the cases they studied, borrowers were asked for phone service codes that allowed lenders to obtain call records and numbers for family members, teachers, and friends. Social contacts became collateral. Some borrowers were also pressured to provide nude photos or videos, which lenders could threaten to expose.`,
               `This is not a break from the old loan shark. It is a continuation.`,
               `The old salary buyer threatened the worker's job. The digital loan shark threatens the borrower's social graph. The old "bawling out" happened at the workplace. The new version happens through mass messages. The old loan shark used shame locally. The new loan shark can scale shame instantly.`
            ]
         },
         {
            heading: 'The app data problem',
            body: [
               `A 2026 study of 434 loan apps in Indonesia, Kenya, Nigeria, Pakistan, and the Philippines found that some apps transmitted sensitive data, including contacts, SMS, location, and media, before users had completed sign-up. The researchers found 141 apps violating national regulatory policy and 147 violating Google policy; after disclosure, Google removed 93 flagged apps representing more than 300 million cumulative installs.`,
               `Regulators are now describing the same problem in plain language. In the Philippines, a 2026 public advisory said the government had received reports of online lending platforms engaging in "harassment, intimidation, public shaming" and unlawful use of personal data. The advisory prohibited excessive access to contact lists and said lenders may contact only named guarantors for debt collection. It ended with a line that could apply across the digital credit industry: "Digital transformation must protect -- not prey upon -- the Filipino people."`
            ]
         },
         {
            heading: 'Southeast Asia is the live test',
            body: [
               `Thailand shows why this matters in Southeast Asia. Reuters reported in October 2025 that household debt had "shackled the economy" for years, with Thailand's household debt at 86.8% of GDP by the end of June and total debt at 16.3 trillion baht.`,
               `High household debt does not automatically create illegal lending. But it creates the conditions in which fast money becomes powerful. When families are stretched and formal credit is slow or unavailable, the loan shark's pitch becomes familiar again: money now, consequences later.`,
               `According to the Bangkok Post, Thai authorities have confronted both old and new faces of loan sharking. A report headlined "Biggest loan shark surrenders, held in custody" evokes the traditional model: a powerful local lender with personal reach. Another Bangkok Post report, "Chinese loan sharks charged 3,780% a year," points to a newer form: cross-border operators, extreme rates, and lending systems that can move through digital channels and disposable identities.`,
               `Across the region, the wider infrastructure of digital crime has also become more industrialized. Reuters reported in 2025 that scam centres along the Thai-Myanmar border and elsewhere in Southeast Asia have trafficked large numbers of people into online fraud operations, with criminal networks primarily originating from China known to operate some centres. Those scam centres are not the same thing as every illegal lending app, but they show the kind of infrastructure -- call centres, scripts, messaging platforms, payment channels, and cross-border enforcement problems -- that can also support predatory digital lending.`
            ]
         },
         {
            heading: 'The pressure point',
            body: [
               `The history of loan sharks is therefore not a story of a criminal disappearing and then returning as technology. It is a story of continuity.`,
               `First, the lender used the borrower's lack of banking access. Then he used the paycheck. Then he used the employer. Then he used public shame. Now he can use the phone.`,
               `The app-store version may look cleaner than the old salary buyer's office. It may have a friendly name, a logo, and a privacy policy. But the test is the same one reformers faced a century ago: does the lender solve a real credit need, or does it turn need into dependency?`,
               `A fair loan should make the amount, cost, due date, and consequences clear before the borrower commits. It should not hide fees. It should not make repayment impossible. It should not turn a borrower's family, friends, or co-workers into collateral.`,
               `The loan shark's oldest trick was never just charging interest. It was finding the point of pressure. For the salary buyer, that point was payday. For the app-based lender, it may be the contact list.`
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
      slug: 'what-oil-pipelines-teach-us-about-credit',
      category: 'Book review',
      title: 'What oil pipelines teach us about credit',
      dek: 'A book about oil routes has a useful lesson for small loans: when the main pipes are controlled by powerful players, ordinary people end up paying more for worse access.',
      seoTitle: 'Credit Infrastructure Lessons From Oil Pipelines | Moodeng',
      metaDescription:
         'A book review connecting oil pipeline infrastructure to credit access, loan sharks, and why small loans need borrower-owned records.',
      summary: [
         'Pipelines decide access to critical resources; credit rails decide who can reach normal borrowing and who is pushed into shadow options.',
         'When formal credit routes are closed, predatory lenders become the available pipe for urgent liquidity.',
         'A fair credit pipe should move money and reputation without charging borrower dignity as the toll.'
      ],
      keywords: ['credit infrastructure', 'oil pipeline book review', 'loan shark alternatives', 'financial access rails'],
      faq: [
         {
            question: 'What do oil pipelines have to do with credit?',
            answer:
               'Both are access systems. Pipelines move energy through controlled routes, while credit rails move money through identity, underwriting, and payment networks.'
         },
         {
            question: 'Why compare loan sharks to shadow infrastructure?',
            answer:
               'Loan sharks often appear where formal routes are slow or closed. They become the available path, but that path charges borrowers through fear, privacy loss, and dependency.'
         },
         {
            question: 'What is a better credit pipe?',
            answer:
               'A better credit pipe combines clear terms, safe identity, stable settlement, borrower request context, and repayment history that continues helping the borrower.'
         }
      ],
      sources: [
         { label: 'Book review source: The Global Game of Oil Pipelines' },
         { label: 'World Bank Global Findex', href: globalFindexUrl },
         { label: 'CGAP digital credit overview', href: cgapDigitalCreditUrl }
      ],
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
