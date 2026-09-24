// The team ping when a borrower connects Facebook (Messenger) — posted by sendpulse-messenger-verify
// to the KYC Telegram group and Discord #kyc, next to the other identity checks.

export type ConnectedBorrower = {
   username: string | null;
   display_name: string | null;
   email: string | null;
};

export type LoanRecord = { funded_at: string | null; due_date: string | null; repaid_at: string | null; is_test?: boolean | null };

export const buildFacebookConnectedAlert = (
   borrower: ConnectedBorrower,
   facebookName: string | null,
   loans: LoanRecord[],
   now = Date.now()
): string => {
   const funded = loans.filter((l) => l.funded_at && !l.is_test);
   const late = funded.filter((l) => l.due_date && l.repaid_at && Date.parse(l.repaid_at) > Date.parse(l.due_date)).length;
   const overdue = funded.filter((l) => !l.repaid_at && l.due_date && Date.parse(l.due_date) < now).length;
   const name = borrower.display_name?.trim() || borrower.username || 'A borrower';
   const who = [borrower.username ? `@${borrower.username}` : null, borrower.email].filter(Boolean).join(' · ');
   const record = funded.length
      ? [
           `Existing borrower · ${funded.length} funded loan${funded.length === 1 ? '' : 's'}`,
           late ? `repaid late ×${late}` : null,
           overdue ? `⚠️ overdue now ×${overdue}` : null
        ]
           .filter(Boolean)
           .join(' · ')
      : 'New borrower (no loans yet)';
   return [
      `✅ Facebook connected — ${name}`,
      who || null,
      facebookName ? `Facebook name: ${facebookName}` : null,
      record,
      'Message them from Admin → Borrower contacts.'
   ]
      .filter(Boolean)
      .join('\n');
};
