export interface GuideArticle {
   slug: string;
   title: string;
   lastUpdated: string;
   body: string;
}

export const GUIDES: GuideArticle[] = [
   {
      slug: 'how-to-request-your-first-loan',
      title: 'How to Request Your First Loan',
      lastUpdated: 'Jan 18, 2024 1:00 A.M.',
      body: `Follow these streamlined steps to initiate your first loan request on Moodeng Credit. You can also view a video walkthrough of this process here: https://youtube.com/shorts/fKpBC9zD6Hk?si=KoU6NRuIguzLw-Hh.

Step 1: Create Your Account
Register on the Moodeng platform by entering your preferred username, email, and password. Click "Create Account" to proceed.

Step 2: Initialize BASE Application
Once logged in, tap the "Apply for a Loan" button to start the process.

Step 3: Set Up Your BASE Wallet
Secure transactions on Moodeng require a BASE Wallet. Visit https://account.base.app and follow the registration instructions.
Refer to How to Create Base Acc 1.jpg and How to Create Base Acc 2.jpg for a visual guide on account setup.

Step 4: Connect Your Wallet
Return to the Moodeng platform and tap "Connect Wallet" to securely link your new BASE Wallet to your Moodeng account.

Step 5: Verify Your Identity
To ensure community safety, download the World App and complete your human identity verification at a physical World Orb location.

Step 6: Link World ID
After verifying at an Orb, return to Moodeng and tap "Verify with World ID." Scan the provided QR code to finalize the link between your World ID and your Moodeng account.

Step 7: Submit Your Request
Tap "Explore the Request Board" to set your specific loan terms. You will need to define:
- The desired loan amount.
- The repayment amount and date.
- A clear reason for your borrowing request to help build trust with potential lenders.

Important Notes on Your Credit Limit
- Starting Limit: Every new borrower begins with an initial borrowing limit of $15.
- Credit-Building Loans: This is a full-limit loan that maxes out your current credit limit (e.g., requesting the full $15). Successfully repaying this type of loan is the only way to increase your limit to the next level (e.g., moving from $15 --> $20 --> $40 --> $60 and beyond). You may only have one credit-building loan request active at a time.
- Trust-Building Loans: These are smaller loans requested for amounts under your current credit limit. While these build your Trust Score with lenders, they do not increase your overall credit limit. You are permitted to have multiple trust-building loan requests active simultaneously, provided the total stays under your current limit.
- Unlocking the Next Level: To move up, you must borrow and fully repay your entire limit. For example, if your limit is $15 and you only request a trust-building loan of $12 and repay $15, your limit will not increase. You must borrow the full $15 and repay the total agreed amount, including any small interest or additional repayment amount you offered that a lender accepted, to unlock the next level.`
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
      title: 'How Repayments Affect Your Trust Score',
      lastUpdated: 'Jan 18, 2024 1:00 A.M.',
      body: `Every repayment for either Credit-Building or Trust-Building loans directly impacts your Trust Score (TS), which serves as your reputation on the platform. Our system is designed to reward consistent, reliable, and honest behavior; small loans repaid cleanly are more valuable for your reputation than large loans repaid sloppily.

Scoring Breakdown

- On-Time, Full Repayments: Completing a 100% repayment on or before the due date maximizes your score (10 TS).

- Partial Repayments: Failing to repay the full amount reduces your score proportionally:

75% Repayment = 7 TS.

50% Repayment = 5 TS.

25% Repayment = 3 TS.

- Late Repayments: Any payment received after the agreed-upon deadline results in a 0 TS for that transaction.

- Defaults: Unpaid loans leave a permanent mark on your profile that is visible to all future lenders.`
   },
   {
      slug: 'what-happens-when-you-repay-a-loan-on-time',
      title: 'The Benefits of On-Time Repayments',
      lastUpdated: 'Jan 18, 2024 1:00 A.M.',
      body: `Submitting your repayment on or before the scheduled deadline is the most effective way to strengthen your standing within the Moodeng Credit ecosystem. All repayments are confirmed on-chain; once the USDC transfer settles, your loan status is automatically updated to "Successfully Repaid."

When you repay on time, the following benefits are applied to your profile:

- Trust Score Enhancement: Your Trust Score increases for either Credit-Building or Trust-Building loans, reflecting your reliability to the community.
- Credit Limit Progression: For Credit-Building loans, your current borrowing limit increases, successfully unlocking the next credit level (e.g., advancing from $15 --> $20).
- Verified Lending History: Your successful repayment history becomes visible to potential lenders, significantly streamlining the funding process for your future requests.

Repayment Scoring Breakdown

Your Trust Score (TS) reflects your reliability and determines your future funding success:

- On-Time, Full Repayment: Awards the maximum 10 TS.
- Partial Repayment: Your score is reduced proportionally based on the amount paid (e.g., 75% = 7 TS; 50% = 5 TS).
- Late Repayment: Any payment made after the deadline results in 0 TS, regardless of the amount.
- Default: Unpaid loans result in a permanent mark on your public on-chain profile.`
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

From the Account screen, you can update your display name, manage your email, change your password, and sign out.`
   }
];
