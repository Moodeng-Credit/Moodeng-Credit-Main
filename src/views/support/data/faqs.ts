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
      id: 'what-is-a-base-wallet',
      question: 'What is a Base wallet?',
      answer: `Base is a Layer 2 blockchain network built by Coinbase, designed for fast, cheap, secure crypto transactions. A "Base wallet" is any wallet that can hold and send funds on the Base network — most commonly the Coinbase Smart Wallet, which is tightly integrated with Base.

Moodeng uses Base wallets for one big reason: gasless USDC transactions. On Base with a Coinbase Smart Wallet, sending or receiving USDC costs nothing in network fees. When you receive a loan, the full amount lands in your wallet. When you repay, the lender gets every cent back.

Coinbase Smart Wallet is also passwordless and seedless — you sign in with email or passkey, no 12-word recovery phrase to lose. For a borrowing platform where new users may have never touched crypto, that's a meaningful improvement over older wallets like MetaMask.

Borrowers on Moodeng must use a Coinbase Smart Wallet on Base. Lenders have more flexibility but we recommend the same setup to keep transactions gasless.`
   },
   {
      id: 'what-is-usdc',
      question: 'What is USDC, and why does Moodeng use it?',
      answer: `USDC is a stablecoin pegged 1:1 to the US dollar, issued by Circle, a regulated US financial company. One USDC always equals one dollar, which means loan amounts on Moodeng don't fluctuate with crypto market swings — a $20 loan today is still worth $20 at repayment.

Moodeng uses USDC because it solves problems that both traditional currencies and other cryptocurrencies have. USD bank transfers take days, require both sides to have the right banking infrastructure, and often have fees. Volatile cryptocurrencies like Bitcoin or ETH can swing 10–20% during a loan's lifetime, exposing both sides to currency risk on top of repayment risk. USDC has neither problem.

USDC also moves anywhere in the world in seconds, is widely accepted by every major exchange (you can convert it to your local currency on Coinbase, Binance, Kraken, or local on/off-ramps), and is gasless when used on Base. It works whether you're in Manila, Lagos, or Mumbai.`
   },
   {
      id: 'does-moodeng-charge-fees',
      question: 'Does Moodeng charge fees?',
      answer: `No. Moodeng Credit is free to use. There are no platform fees on borrowing, no fees on lending, no monthly subscriptions, no setup costs. 100% of what a lender funds reaches the borrower, and 100% of a repayment reaches the lender.

Network fees (gas) are also zero when you use a Coinbase Smart Wallet on Base. So the only cost of using Moodeng is the interest rate the borrower offers — and that goes entirely to the lender, not to us.

How do we keep things free? We don't take a cut. Our future business model is the IOU token, which we'll launch via airdrop to active lenders. Until then, Moodeng is fully fee-free.`
   },
   {
      id: 'fight-loan-sharks',
      question: 'How does Moodeng help fight loan sharks?',
      answer: `Loan sharks — informal lenders who charge 20–100% weekly interest, threaten borrowers, and trap people in debt cycles — are a global problem. Hundreds of millions of unbanked and underbanked people have nowhere else to turn for emergency cash, and end up paying multiples of what they borrowed, over and over.

Moodeng Credit is built as a fairer alternative. Interest rates are set by the borrower and accepted (or passed on) by lenders in a transparent marketplace — no hidden charges, no compounding tricks. Small starter loans ($15–$60 at Credit Levels 1–4) match what borrowers actually need for short-term emergencies, paired with a credit-building system that grows your limit as you prove reliability.

There's no collateral, no government ID, and no bank account required — just a verified World ID and a Coinbase Smart Wallet. Anyone with a phone can access loans. And your reputation travels with you (linked to your wallet and World ID), so you build genuine credit history that lenders trust — instead of staying stuck in a cycle.

We don't claim to replace banks for everyone. But for the people currently using loan sharks because they have no other option, Moodeng aims to be a safer, fairer, more dignified path.`
   },
   {
      id: 'what-is-credit-building-loan',
      question: 'What is a credit-building loan?',
      answer: `A credit-building loan is a loan you take out specifically to grow your credit limit on Moodeng. To qualify as one, the loan must be at your full current Credit Level limit — not below it.

Here's how it works. You start at Credit Level 1 with a $15 borrowing limit. Borrow the full $15 and repay it on time, and your limit moves up to $20. Borrow that full $20 next time and repay, you unlock $40. Then $60. The progression keeps going at higher levels.

Smaller loans below your full limit are called Trust-Building Loans. Those still help — they grow your repayment record and reputation with lenders — but they don't raise your Credit Level. So if your goal is to build credit and unlock larger loans, you specifically want to take out and repay full-limit Credit-Building Loans.

Unlike a bank credit card or traditional credit-builder product, Moodeng's credit isn't reported to a credit bureau. It's tracked on-chain, tied to your wallet and World ID, and portable across any platform that integrates with the system.`
   },
   {
      id: 'small-loan',
      question: 'Can I get a small loan with Moodeng?',
      answer: `Yes — small loans are exactly what Moodeng is built for. New borrowers start at a $15 limit, and the platform was designed for short-term, low-amount lending: emergency cash, bridging gaps before payday, one-off expenses.

There are no minimum loan amounts, no monthly subscriptions, no setup costs, and no fees. You request what you need (up to your current Credit Level limit), set the repayment date and interest rate, and lenders decide whether to fund you.

Each successful repayment grows your limit step by step — $15 → $20 → $40 → $60, and beyond. So you can start small to test the platform with low stakes, build your reputation, and grow into larger loans only as you're ready.`
   }
];
