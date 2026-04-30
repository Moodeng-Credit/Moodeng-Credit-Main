export interface AccountFAQItem {
   id: string;
   question: string;
   answer: string;
}

// Shown to both borrowers and lenders
export const SHARED_FAQS: AccountFAQItem[] = [
   {
      id: 'why-usdc',
      question: 'Why does Moodeng use USDC?',
      answer: `USDC is a stablecoin pegged 1:1 to the US dollar. Issued by Circle, a regulated US financial company, it keeps loan values predictable — a $20 loan today is still $20 at repayment, not $15 or $30. Lenders and borrowers don't take on currency risk just by participating.

USDC is also fast to send globally and, when used on Base with a Coinbase Smart Wallet, is completely gasless. That means no network fees eat into your repayment — 100% of what you send reaches your lender.

It's also widely accepted: every major crypto exchange supports USDC deposits, and you can convert it to fiat (US dollars, pesos, naira, etc.) almost anywhere. So when you receive a loan or get repaid, you can spend it on-chain, hold it, or cash it out — your choice.`
   },
   {
      id: 'how-to-get-verified',
      question: 'How do I get verified?',
      answer: `We use World ID — it's the only method we accept. To get verified, you need to scan your eyes at a World ID Orb. Here's how:

First, download the World App on your phone (iOS or Android).

Then find a verification location near you. Open https://world.org/find-orb to see a map of every Orb in your country. Some locations let you book an appointment in advance; many you can just walk into.

Go to the Orb. Open the World App, follow the prompts, and let the Orb scan your eyes — it takes about a minute. The scan is converted into an anonymous proof; your biometrics never leave the device.

Once verified in the World App, come back to Moodeng and tap "Verify with World ID" — that links your World ID to your account in seconds, and you're done.`
   },
];

// Shown to borrowers only
export const BORROWER_FAQS: AccountFAQItem[] = [
   {
      id: 'convert-loan-to-bank',
      question: 'How do I convert my loan into my local bank account?',
      answer: `Once you receive USDC in your Base account, here's how to get it into your local bank:

1. Open your exchange (e.g. Binance) and find your USDC deposit address. Make sure the network is set to Base — this is important, as it keeps transfers completely free.
2. Withdraw from your Base account to that deposit address.
3. Once it arrives on the exchange, withdraw to your local bank account. If your exchange supports direct bank withdrawals, use that. If not, use the P2P feature to sell USDC and receive local currency directly to your bank.

The key detail: always select Base as the network when depositing to your exchange. Using the wrong network can result in lost funds.`
   },
   {
      id: 'how-to-repay',
      question: 'How do I repay my loan?',
      answer: `Repaying is the reverse of receiving your loan:

1. Deposit from your local bank account to your exchange (e.g. Binance) — use the P2P feature to buy USDC with local currency, or transfer from your bank if the exchange supports it.
2. Once you have USDC on the exchange, withdraw it to your Base account. Get the deposit address from your Base wallet and make sure the network is set to Base so the transfer is free.
3. Once the USDC is in your Base account, go to the Repay section in the app and follow the steps to send it to your lender.

Always repay before the due date — on-time repayment builds your Trust Score and unlocks higher credit levels.`
   },
   {
      id: 'borrow-below-limit',
      question: 'Can I borrow below my credit limit?',
      answer: `Yes — and we actually recommend it, especially when you're starting out. Borrowing below your limit is called a Trust-Building Loan.

These smaller loans don't count toward unlocking the next Credit Level (for that, you need to borrow your full limit and repay on time), but they do build your repayment history and earn you more Trust Points than borrowing your maximum would.

So if you want to grow your reputation quickly, Trust-Building Loans are a great way to do it.`
   },
   {
      id: 'increase-credit-limit',
      question: 'How do I increase my credit limit?',
      answer: `Your credit limit goes up when you borrow your full limit and repay it on time. These are called Credit-Building Loans.

If your limit is $20 and you only borrow $15, that doesn't count toward the next level — even if you repay it perfectly. The system needs to see you can handle the full limit before it raises the ceiling.

Progression goes $15 → $20 → $40 → $60 — and beyond. One step at a time: borrow your max, repay on time, repeat.`
   },
];

// Shown to lenders only
export const LENDER_FAQS: AccountFAQItem[] = [
   {
      id: 'what-are-iou-points',
      question: 'What are IOU Points?',
      answer: `IOU Points are reputation points earned by lenders. Each time you fund a loan and get repaid on time, you earn IOU. They track who's actively supporting the community.

Right now IOU is just points. Down the line, we'll launch a token also called IOU, and your accumulated points will convert via an airdrop. Holding IOU will unlock additional benefits tied to the platform.

IOU is for lenders only — borrowers build their Trust Score and Credit Level instead. So if you want to earn IOU, fund a loan request from the Request Board.`
   },
   {
      id: 'how-borrowers-verify',
      question: 'How do borrowers verify?',
      answer: `Borrowers verify through World ID. This is a one-time biometric verification that confirms each borrower is a unique real person, which helps prevent fake accounts and bots.

Each person can only create one verified account, so lenders know the borrower profile and repayment history belong to the same real individual. If someone is banned, they cannot simply come back with a new account — one World ID equals one person.`
   },
   {
      id: 'how-borrowers-increase-credit-limit',
      question: 'How do borrowers increase their credit limit and level?',
      answer: `Borrowers increase their credit limit by taking out a Credit-Building Loan and borrowing their full current limit. If they repay that full-limit loan on time, they level up and unlock a higher credit limit.

If they borrow below their limit, it is a Trust-Building Loan instead. That does not level them up, but it helps build a stronger repayment record and better borrower stats on the platform.`
   },
   {
      id: 'how-to-fund-loan',
      question: 'How do I fund a loan?',
      answer: `Go to the Request Board and browse open loan requests. Each request shows the borrower's stats, credit limit, requested amount, and repayment term.

When you find one you want to fund, tap Fund and confirm. The USDC leaves your Base account immediately and goes directly to the borrower's Base account — no middleman, no delay.

You can track all your active loans and repayment statuses from your Lender Dashboard.`
   },
   {
      id: 'when-do-i-get-repaid',
      question: 'When do I get repaid?',
      answer: `The due date is set by the borrower when they post their request — you'll see it clearly on the loan card before you fund, so you always know the timeline upfront.

Once the loan is due, the borrower repays directly to your Base account. You can track the status of all your active loans on your Lender Dashboard.`
   },
];
