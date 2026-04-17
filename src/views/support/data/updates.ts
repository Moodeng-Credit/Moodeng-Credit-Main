export interface UpdateEntry {
   slug: string;
   title: string;
   subtitle: string;
   publishedAt: string;
   relativeTime?: string;
   body: string;
}

export const LATEST_UPDATE: UpdateEntry = {
   slug: 'v2-0-lower-rates-faster-approvals',
   title: 'v2.0 - Lower Rates & Faster Approvals',
   subtitle: '30% lower rates • Under 60 second approvals',
   publishedAt: 'Jan 18, 2024 1:00 A.M.',
   relativeTime: '15 min ago',
   body: `We've released version 2.0 of Moodeng Credit to make borrowing simpler, fairer, and faster.

This update focuses on two things borrowers told us matter most: lower borrowing costs and less waiting time.

Lower rates

We've adjusted our rate structure to better reflect borrower trust and repayment history.

What this means for you:
• Lower overall borrowing costs
• Fairer rates as your Trust Score improves
• Clearer repayment terms

Your behaviour still matters. On-time repayments continue to strengthen your Trust Score and unlock better borrowing conditions over time.

Faster approvals

We've improved our request and review flow to reduce delays.

You'll now see:
• Faster loan request processing
• Quicker approval decisions
• Less friction between request and funding

This helps you access USDC when you need it, without unnecessary waiting.`
};

export const PREVIOUS_UPDATES: UpdateEntry[] = [
   {
      slug: 'v2-1-enhanced-security-features',
      title: 'v2.1 - Enhanced Security Features',
      subtitle: 'Advanced encryption • Multi-factor authentication',
      publishedAt: 'Feb 10, 2024 2:00 P.M.',
      body: `We've strengthened account security across the platform with advanced encryption and optional multi-factor authentication.

Your wallet remains the source of truth for identity, but we've added layered protections for account actions.`
   },
   {
      slug: 'v2-2-user-friendly-dashboard',
      title: 'v2.2 - User-Friendly Dashboard',
      subtitle: 'Intuitive navigation • Customizable widgets',
      publishedAt: 'Mar 5, 2024 3:00 P.M.',
      body: `The Dashboard has been redesigned for clarity — faster access to your active loans, repayments due, and Trust Score progress.

You can now rearrange widgets to focus on what matters most to you.`
   },
   {
      slug: 'v2-3-integrated-analytics-tools',
      title: 'v2.3 - Integrated Analytics Tools',
      subtitle: 'Real-time data tracking • Performance insights',
      publishedAt: 'Apr 15, 2024 4:00 P.M.',
      body: `Borrowers and lenders now get richer insights into loan performance and repayment behaviour over time.

These tools help you make better decisions about when to borrow and who to lend to.`
   }
];

export function findUpdate(slug: string): UpdateEntry | undefined {
   if (LATEST_UPDATE.slug === slug) return LATEST_UPDATE;
   return PREVIOUS_UPDATES.find((u) => u.slug === slug);
}
