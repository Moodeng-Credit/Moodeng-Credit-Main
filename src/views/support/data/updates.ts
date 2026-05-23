export interface UpdateEntry {
   slug: string;
   title: string;
   subtitle: string;
   publishedAt: string;
   relativeTime?: string;
   body: string;
}

export const LATEST_UPDATE: UpdateEntry = {
   slug: 'may-2026-live-filters-cleaner-borrowing',
   title: 'Live Filters & Cleaner Borrowing Flow',
   subtitle: 'Request Board and history filters now update as you tap',
   publishedAt: 'May 24, 2026',
   relativeTime: 'Latest May 2026 update',
   body: `The Request Board and Transaction History now feel much more immediate.

Filters apply while you choose them, so you can narrow results without pressing an extra Apply button or losing sight of the list behind the panel. Search, amount, date, type, repayment, and status choices are easier to test quickly.

This release also cleans up the borrower path around loan actions:
• unverified borrowers are guided back into onboarding before requesting a loan
• verified borrowers without a Base Wallet go straight to the wallet step
• filter panels stay focused on browsing instead of blocking the board

The goal is simple: fewer dead ends, fewer confusing taps, and a request board that updates the moment you make a choice.`
};

export const PREVIOUS_UPDATES: UpdateEntry[] = [
   {
      slug: 'may-2026-base-wallet-world-id-onboarding',
      title: 'Base Wallet & World ID Onboarding',
      subtitle: 'Clearer wallet handoff • Stronger human verification flow',
      publishedAt: 'May 23, 2026',
      body: `Borrower onboarding has been tightened so each step leads naturally into the next.

The Base Wallet screen is simpler, the connected-wallet success screen now uses the final success mark, and World ID actions are easier to understand from the Request Board and onboarding flow.

This update also improves duplicate World ID handling and keeps borrowers moving through the right next step after wallet connection, verification, or a request-board action.`
   },
   {
      slug: 'may-2026-clearer-loan-repay-states',
      title: 'Clearer Loan & Repay States',
      subtitle: 'Pending funding, repayment, and navigation are easier to trust',
      publishedAt: 'May 22, 2026',
      body: `Loan screens now do a better job showing what is actually happening.

Pending requests are clearer before they are funded, repayment screens avoid misleading action states, and bottom navigation between Request Board, Repay, Dashboard, History, and Account is more reliable.

These changes are designed to make the app feel calmer when money is involved: the screen should say whether a loan is waiting, active, repaid, or unavailable without making you guess.`
   },
   {
      slug: 'may-2026-trust-admin-readiness',
      title: 'Trust System & Admin Readiness',
      subtitle: 'Cleaner IOU rules • Better account status and recovery controls',
      publishedAt: 'May 20, 2026',
      body: `The trust layer behind Moodeng has been made more consistent.

Lender IOU point rules are now easier to reason about, admin status controls are closer to the real account state, and recovery workflows have more reliable data to work from.

Most of this work sits behind the scenes, but it matters: borrower records, lender incentives, overdue loans, and account restrictions need to line up before the product can scale safely.`
   },
   {
      slug: 'may-2026-support-credit-education',
      title: 'Support Library & Credit Education',
      subtitle: 'Repayment guides • Credit leveling • Borrower safety content',
      publishedAt: 'May 16, 2026',
      body: `The support area has been refreshed around the questions borrowers and lenders actually ask.

Guides now explain repayment, Trust Score, credit leveling, World ID, Base Wallet setup, and borrower safety in clearer language.

We also added more educational content around portable repayment history and safer alternatives to predatory lending, so new users can understand what Moodeng is building before they request or fund a loan.`
   }
];

export function findUpdate(slug: string): UpdateEntry | undefined {
   if (LATEST_UPDATE.slug === slug) return LATEST_UPDATE;
   return PREVIOUS_UPDATES.find((u) => u.slug === slug);
}
