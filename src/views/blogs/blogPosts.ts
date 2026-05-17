export interface BlogSection {
   heading: string;
   body: string;
}

export interface BlogPost {
   slug: string;
   category: string;
   title: string;
   dek: string;
   publishedAt: string;
   readTime: string;
   audience: 'Borrowers' | 'Lenders' | 'Everyone';
   image: string;
   imageAlt: string;
   accent: 'violet' | 'green' | 'blue' | 'gold';
   sections: BlogSection[];
}

export const blogPosts: BlogPost[] = [
   {
      slug: 'why-small-usdc-loans-can-build-credit-signals',
      category: 'Borrower credit',
      title: 'Why small USDC loans can build real credit signals',
      dek: 'Moodeng starts with small loans on purpose. The point is not the size of the first request, it is the repayment pattern that follows.',
      publishedAt: 'May 18, 2026',
      readTime: '4 min read',
      audience: 'Borrowers',
      image: '/hippos/borrower-insights-trophy.png',
      imageAlt: 'Moodeng hippo holding a borrower insights trophy',
      accent: 'violet',
      sections: [
         {
            heading: 'Small is the feature',
            body: 'A $15 or $20 request is easier for a new lender to understand than a large unsecured loan. The first goal is to create a clean repayment event that future lenders can review.'
         },
         {
            heading: 'The signal comes from behavior',
            body: 'Loan size alone does not prove reliability. Moodeng looks at whether the borrower asked for clear terms, received funding, and repaid the agreed amount on time.'
         },
         {
            heading: 'Progress should feel earned',
            body: 'Borrowers can grow by repeating the same simple pattern: request what they can repay, communicate clearly, and keep the repayment record clean.'
         }
      ]
   },
   {
      slug: 'credit-building-vs-trust-building-loans',
      category: 'Loan basics',
      title: 'Credit-building vs trust-building loans',
      dek: 'Two loan types can look similar on the board, but they do different jobs for a borrower profile.',
      publishedAt: 'May 18, 2026',
      readTime: '3 min read',
      audience: 'Everyone',
      image: '/hippos/thinking.png',
      imageAlt: 'Moodeng hippo thinking about loan types',
      accent: 'blue',
      sections: [
         {
            heading: 'Credit-building raises the ceiling',
            body: 'A credit-building loan is a full-limit loan. When it is repaid successfully, it can unlock the next borrowing level and give lenders a stronger signal.'
         },
         {
            heading: 'Trust-building fills in the record',
            body: 'A smaller loan below the current limit does not raise the limit by itself. It still matters because it shows the borrower can handle real repayment commitments.'
         },
         {
            heading: 'Both can be useful',
            body: 'A healthy profile can include both. Full-limit loans show readiness for the next level, while smaller loans show consistent behavior between level-up moments.'
         }
      ]
   },
   {
      slug: 'what-lenders-look-for-before-funding',
      category: 'Lender notes',
      title: 'What lenders look for before funding a stranger',
      dek: 'A good request is not just a number. It gives a lender enough context to understand the borrower, the reason, and the repayment path.',
      publishedAt: 'May 18, 2026',
      readTime: '5 min read',
      audience: 'Lenders',
      image: '/hippos/community.png',
      imageAlt: 'Moodeng community hippo representing lender review',
      accent: 'green',
      sections: [
         {
            heading: 'Clear terms reduce guessing',
            body: 'The amount, repayment amount, due date, and reason should be visible before funding. Lenders should not have to infer the plan from a vague sentence.'
         },
         {
            heading: 'Human context matters',
            body: 'Borrowers do not need to reveal private details. A simple note about work rhythm, payday timing, or why the loan helps can make a request easier to evaluate.'
         },
         {
            heading: 'History is still the anchor',
            body: 'Context helps explain the request, but repayment history remains the strongest signal. Moodeng is designed so lenders can see that record clearly over time.'
         }
      ]
   },
   {
      slug: 'why-base-account-matters-for-repayment',
      category: 'Wallets',
      title: 'Why Base Account matters for repayment',
      dek: 'A locked Base Account keeps borrowing and repayment tied to one wallet, which makes the record easier for both sides to trust.',
      publishedAt: 'May 18, 2026',
      readTime: '3 min read',
      audience: 'Borrowers',
      image: '/hippos/hippo-friendly-lock.png',
      imageAlt: 'Moodeng hippo with a friendly lock',
      accent: 'gold',
      sections: [
         {
            heading: 'One wallet, cleaner records',
            body: 'When funding and repayment happen through the same connected wallet, it is easier to understand what happened without chasing screenshots or outside messages.'
         },
         {
            heading: 'USDC keeps the amount predictable',
            body: 'Moodeng uses USDC so a $20 loan stays understandable at repayment. Borrowers and lenders should not be forced to guess the value of the loan.'
         },
         {
            heading: 'The wallet supports the trust layer',
            body: 'The wallet is not the whole identity. World ID, request terms, and repayment behavior all work together to make the borrower profile more useful.'
         }
      ]
   },
   {
      slug: 'world-id-without-oversharing',
      category: 'Verification',
      title: 'World ID helps prove uniqueness without oversharing',
      dek: 'Moodeng needs one real person behind each borrower account, but borrowers should not have to publish private documents to make a small request.',
      publishedAt: 'May 18, 2026',
      readTime: '4 min read',
      audience: 'Everyone',
      image: '/hippos/hippo-with-id-card.png',
      imageAlt: 'Moodeng hippo holding an identity card',
      accent: 'violet',
      sections: [
         {
            heading: 'The goal is uniqueness',
            body: 'World ID helps reduce duplicate borrower accounts. That gives lenders more confidence that a repayment history belongs to one real person.'
         },
         {
            heading: 'Privacy still matters',
            body: 'Borrowers should not dox themselves to get a small loan. Moodeng can ask for useful context while still keeping sensitive personal details out of public view.'
         },
         {
            heading: 'Verification is only the first step',
            body: 'Being verified does not make every request fundable. It gives the profile a stronger starting point, then repayment behavior does the long-term work.'
         }
      ]
   }
];

export const featuredBlogPost = blogPosts[0];

export function findBlogPost(slug: string | undefined): BlogPost | undefined {
   return blogPosts.find((post) => post.slug === slug);
}
