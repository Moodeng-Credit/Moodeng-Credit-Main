// Phase 4a — pure formatting for the real-time loan-funding fraud check.
// No Deno.* at module top so vitest can import it (masterplan §2.8).

export type FundingOverlap = {
   loan_id: string;
   tracking_id: string | null;
   lender_user_id: string;
   borrower_user_id: string;
   overlaps: string[];
};

// Human-readable meaning of each overlap kind emitted by
// public.check_loan_funding_overlap().
const KIND_LABEL: Record<string, string> = {
   same_account: 'the same account is on both sides',
   same_wallet: 'the same wallet funded and received the loan',
   shared_wallet_history: 'borrower & lender have used the same wallet before',
   shared_ip: 'borrower & lender share a login IP',
   shared_subnet: 'borrower & lender share a network subnet',
   same_chat_id: 'borrower & lender share a Telegram account',
   same_canonical_email: 'borrower & lender share an email (dot/plus normalized)'
};

export const describeOverlapKinds = (kinds: string[]): string =>
   kinds.map((k) => KIND_LABEL[k] ?? k).join('; ');

// Build the { title, body } handed to deliverSecurityAlert (source 'realtime').
export const buildFundingAlert = (o: FundingOverlap): { title: string; body: string } => {
   const label = o.tracking_id ? `Loan ${o.tracking_id}` : `Loan ${o.loan_id}`;
   const title = `${label} funded with linked accounts (${o.overlaps.join(', ')})`;
   const body =
      'A loan was just funded where the borrower and lender look like the same person.\n\n' +
      `Overlap: ${describeOverlapKinds(o.overlaps)}.\n` +
      `Borrower: ${o.borrower_user_id}\n` +
      `Lender: ${o.lender_user_id}\n\n` +
      'Alert-only — the loan was NOT blocked. Review in the admin Self-lending panel, then confirm or whitelist.';
   return { title, body };
};
