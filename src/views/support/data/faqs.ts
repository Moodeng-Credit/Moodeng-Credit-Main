export interface FAQItem {
   id: string;
   question: string;
   answer: string;
}

export const FAQS: FAQItem[] = [
   {
      id: 'what-is-moodeng-credit',
      question: 'What is Moodeng Credit?',
      answer: `Moodeng Credit is a borrowing platform that lets you request short-term loans in USDC while building a Trust Score linked to your wallet.

Instead of focusing on traditional credit scores, Moodeng helps you build trust through responsible borrowing and on-time repayments. Over time, this trust allows you to unlock higher Credit Levels and request larger loan amounts.

Your Trust Score isn't locked inside one app. It's designed to reflect your reliability and help you build a reputation you can carry forward.`
   },
   {
      id: 'how-does-borrowing-work',
      question: 'How does borrowing on Moodeng work?',
      answer: `You post a loan request from the Request Board with your desired amount (up to your current limit), repayment date, interest rate, and reason.

Lenders browse open requests and choose which to fund. Once a lender funds you, USDC is transferred directly to your wallet. You repay them on or before the agreed date from any wallet that holds USDC.`
   },
   {
      id: 'what-is-a-trust-score',
      question: 'What is a Trust Score and how is it calculated?',
      answer: `Your Trust Score is a reputation signal that reflects how reliably you repay loans.

It goes up with on-time, in-full repayments and drops with late payments or defaults. Lenders use it to gauge risk when deciding whether to fund your requests.`
   },
   {
      id: 'what-is-a-credit-level',
      question: 'What is a Credit Level?',
      answer: `Credit Levels control how much you can borrow at a time.

You start at Level 1 with a $15 limit. Each full repayment of a Credit-Building loan raises your limit and unlocks the next level — $15 → $20 → $40 → $60 — and beyond.`
   },
   {
      id: 'trust-vs-credit-loans',
      question: "What's the difference between Trust-building and Credit-building loans?",
      answer: `Trust-Building Loans are smaller loans below your current limit. They strengthen your repayment history but don't raise your limit.

Credit-Building Loans are full-limit loans. Repaying one on time raises your limit and unlocks the next Credit Level.`
   }
];
