export interface AccountFAQItem {
   id: string;
   question: string;
   answer: string;
}

export const ACCOUNT_FAQS: AccountFAQItem[] = [
   {
      id: 'why-usdc',
      question: 'Why does Moodeng use USDC?',
      answer: `USDC is a stablecoin pegged 1:1 to the US dollar. Issued by Circle, a regulated US financial company, it keeps loan values predictable — a $20 loan today is still $20 at repayment, not $15 or $30. Lenders and borrowers don't take on currency risk just by participating.

USDC is also fast to send globally and, when used on Base with a Coinbase Smart Wallet, is completely gasless. That means no network fees eat into your repayment — 100% of what you send reaches your lender.

It's also widely accepted: every major crypto exchange supports USDC deposits, and you can convert it to fiat (US dollars, pesos, naira, etc.) almost anywhere — directly through exchanges like Coinbase, Binance, or Kraken, or via local on/off-ramps. So when you receive a loan or get repaid, you can spend it on-chain, hold it, or cash it out — your choice.

We picked USDC over local currencies (which need banks and take days to move) and over volatile cryptocurrencies (where the value swings while the loan is active). Predictable, fast, gasless on Base, and easy to cash out.`
   },
   {
      id: 'increase-credit-limit',
      question: 'How do I increase my credit limit?',
      answer: `Your credit limit goes up when you borrow your full limit and repay it on time. These are called Credit-Building Loans.

If your limit is $20 and you only borrow $15, that doesn't count toward the next level — even if you repay it perfectly. The system needs to see you can handle the full limit before it raises the ceiling. Smaller loans (Trust-Building Loans) still build your repayment history and reputation, but they don't unlock the next Credit Level.

Progression goes $15 → $20 → $40 → $60 — and beyond. One step at a time: borrow your max, repay on time, repeat.`
   },
   {
      id: 'what-are-iou-points',
      question: 'What are IOU Points?',
      answer: `IOU Points are reputation points earned by lenders. Each time you fund a loan and get repaid on time, you earn IOU. They track who's actively supporting the community.

Right now IOU is just points. Down the line, we'll launch a token also called IOU, and your accumulated points will convert via an airdrop. Holding IOU will unlock additional benefits tied to the platform.

IOU is for lenders only — borrowers build their Trust Score and Credit Level instead. So if you want to earn IOU, fund a loan request from the Request Board.`
   },
   {
      id: 'how-to-get-verified',
      question: 'How do I get verified?',
      answer: `We use World ID — it's the only method we accept. To get verified, you need to scan your eyes at a World ID Orb. Here's how:

First, download the World App on your phone (iOS or Android).

Then find a verification location near you. Open https://world.org/find-orb to see a map of every Orb in your country. Some locations let you book an appointment in advance; many you can just walk into.

Go to the Orb. Open the World App, follow the prompts, and let the Orb scan your eyes — it takes about a minute. The scan stays on the Orb device and is converted into an anonymous proof; your biometrics never leave it.

Once you're verified in the World App, come back to Moodeng and tap "Verify with World ID" anywhere you see it. That links your verified World ID to your Moodeng account in seconds, and you're done — borrowing and lending unlocked.

It's a one-time process. Verification stays with you and works across every app that uses World ID.`
   }
];
