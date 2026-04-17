export interface GuideArticle {
   slug: string;
   title: string;
   lastUpdated: string;
   body: string;
}

export const GUIDES: GuideArticle[] = [
   {
      slug: 'how-to-request-your-first-loan',
      title: 'How to request your first loan',
      lastUpdated: 'Jan 18, 2024 1:00 A.M.',
      body: `Everyone starts with a $15 borrowing limit, and can make one request at a time.

To move up, you must borrow and fully repay your entire limit, not just part of it.

For example: if your limit is $15 but you only borrow $12 and repay $15, that doesn't unlock the next level. You need to borrow and repay the full $15 — including any small interest or repayment amount above what you borrowed, depending on what you offered and what a lender accepted and funded you for.

Each successful full repayment increases your limit step by step — $15 → $20 → $40 → $60, and beyond — while also building your trust record with lenders.

There are two loan types:
• Credit Growth Loans – full-limit loans that raise your limit once repaid.
• Trust Loans – smaller loans that build your repayment history but don't increase your limit.`
   },
   {
      slug: 'understanding-your-trust-score',
      title: 'Understanding your Trust Score',
      lastUpdated: 'Jan 18, 2024 1:00 A.M.',
      body: `Your Trust Score reflects how reliably you repay loans on Moodeng Credit.

It rises with every on-time repayment and drops when you miss or default. Lenders use it as a quick signal to decide whether to fund your request.

Because your Trust Score is tied to your wallet, it travels with you — it's not locked inside a single app.`
   },
   {
      slug: 'how-credit-levels-work',
      title: 'How Credit Levels work',
      lastUpdated: 'Jan 18, 2024 1:00 A.M.',
      body: `Credit Levels determine how much you can borrow at a time.

Everyone starts at Level 1 with a $15 limit. As you borrow and fully repay, your limit grows — $15 → $20 → $40 → $60 — and unlocks new levels.

You only advance by completing a Credit Growth Loan: a loan at your full current limit, repaid in full and on time.`
   },
   {
      slug: 'trust-building-vs-credit-building-loans',
      title: 'Trust-Building vs Credit-Building loans',
      lastUpdated: 'Jan 18, 2024 1:00 A.M.',
      body: `Moodeng Credit supports two kinds of loans:

Trust-Building Loans are smaller loans below your current limit. They help you demonstrate reliable repayment but don't increase your limit.

Credit-Building Loans are full-limit loans. Repaying one on time raises your limit and unlocks the next Credit Level.

Most borrowers use both — trust loans to keep activity healthy, credit loans to grow their limit over time.`
   },
   {
      slug: 'how-repayments-affect-your-trust-score',
      title: 'How repayments affect your Trust Score',
      lastUpdated: 'Jan 18, 2024 1:00 A.M.',
      body: `Every repayment you make changes your Trust Score.

On-time, in-full repayments strengthen it. Late or partial repayments weaken it. Defaults leave a permanent mark that future lenders can see.

The system is designed to reward consistent, honest behaviour — small loans repaid cleanly beat large loans repaid sloppily.`
   },
   {
      slug: 'what-happens-when-you-repay-a-loan-on-time',
      title: 'What happens when you repay a loan on time',
      lastUpdated: 'Jan 18, 2024 1:00 A.M.',
      body: `When you repay on time, three things happen:

1. Your Trust Score goes up.
2. If it was a Credit-Building loan, your limit increases and you unlock the next level.
3. Your repayment history becomes visible to lenders, making future funding easier.

Repayments are confirmed on-chain — once the USDC transfer settles, your loan is automatically marked repaid.`
   },
   {
      slug: 'using-usdc-on-moodeng-credit',
      title: 'Using USDC on Moodeng Credit',
      lastUpdated: 'Jan 18, 2024 1:00 A.M.',
      body: `All loans on Moodeng Credit are denominated in USDC — a regulated stablecoin pegged 1:1 to the US dollar.

Using USDC means loan values stay consistent. A $20 loan today is still a $20 loan when you repay it, regardless of crypto market movement.

We recommend Coinbase Wallet on Base, where USDC transfers are gasless — you pay no network fees.`
   },
   {
      slug: 'verification-and-why-its-required',
      title: 'Verification and why it\'s required',
      lastUpdated: 'Jan 18, 2024 1:00 A.M.',
      body: `Before borrowing, every user verifies their humanity using World ID.

This keeps the platform safe from bots and duplicate accounts. Verification costs a small one-time fee and doesn't require uploading personal documents.

Once verified, you're eligible to request loans and build your Trust Score.`
   },
   {
      slug: 'managing-your-account-and-security-settings',
      title: 'Managing your account and security settings',
      lastUpdated: 'Jan 18, 2024 1:00 A.M.',
      body: `Your account is tied to your wallet, so wallet security is account security.

From the Account screen, you can update your display name, manage your email, change your password, and sign out.

Always keep your wallet recovery phrase offline and never share it. Losing wallet access means losing your Trust Score and funds.`
   }
];
