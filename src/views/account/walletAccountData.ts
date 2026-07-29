// Pure normalization helpers shared by the Wallet settings UI and focused tests.
export type WalletAccountRole = 'borrower' | 'lender';

export type WalletLoanRecord = {
   id: string;
   tracking_id: string;
   borrower_user_id: string | null;
   borrower_wallet: string | null;
   lender_user_id: string | null;
   lender_wallet: string | null;
   loan_amount: number;
   total_repayment_amount: number;
   repaid_amount: number | null;
   loan_status: string | null;
   repayment_status: string | null;
   funded_at: string | null;
   repaid_at: string | null;
   updated_at: string | null;
   hash: string[] | null;
};

export type WalletTransferRecord = {
   direction: 'in' | 'out';
   amount: number;
   timestamp: string;
   hash: string;
};

export type WalletConnectionEvent = {
   id: string;
   event_type: 'connected' | 'changed' | 'disconnected' | 'historical';
   wallet_address: string;
   previous_wallet_address: string | null;
   wallet_provider: string | null;
   wallet_connector_name: string | null;
   wallet_chain_id: number | null;
   occurred_at: string;
   total_wallets?: number;
};

export type WalletActivityKind =
   | 'loan_received'
   | 'loan_funded'
   | 'loan_repaid'
   | 'repayment_sent'
   | 'repayment_received'
   | 'usdc_received'
   | 'usdc_sent';

export type WalletActivityItem = {
   id: string;
   kind: WalletActivityKind;
   direction: 'in' | 'out' | 'neutral';
   amount: number;
   occurredAt: string;
   transactionHash: string | null;
   loanId: string | null;
   trackingId: string | null;
};

export type RepaymentDestination = {
   walletAddress: string;
   activeLoanCount: number;
};

export type RepaymentRouteLoanRecord = Pick<
   WalletLoanRecord,
   'lender_user_id' | 'lender_wallet' | 'loan_status' | 'repayment_status'
>;

export const normalizeWalletAddress = (address?: string | null) => address?.trim().toLowerCase() ?? '';

function getLoanWallet(loan: WalletLoanRecord, role: WalletAccountRole) {
   return role === 'borrower' ? loan.borrower_wallet : loan.lender_wallet;
}

function getMatchedActivityKind(role: WalletAccountRole, isFundingTransfer: boolean): WalletActivityKind {
   if (isFundingTransfer) {
      return role === 'borrower' ? 'loan_received' : 'loan_funded';
   }
   return role === 'borrower' ? 'repayment_sent' : 'repayment_received';
}

function getExpectedTransferDirection(role: WalletAccountRole, isFundingTransfer: boolean): WalletTransferRecord['direction'] {
   if (isFundingTransfer) return role === 'borrower' ? 'in' : 'out';
   return role === 'borrower' ? 'out' : 'in';
}

function getGenericActivityKind(direction: 'in' | 'out'): WalletActivityKind {
   return direction === 'in' ? 'usdc_received' : 'usdc_sent';
}

function buildLoanFallbackActivity(params: {
   loans: WalletLoanRecord[];
   userId: string;
   role: WalletAccountRole;
   currentAddress: string;
}): WalletActivityItem[] {
   const { loans, userId, role, currentAddress } = params;
   const normalizedCurrentAddress = normalizeWalletAddress(currentAddress);
   const rows: WalletActivityItem[] = [];

   for (const loan of loans) {
      const belongsToUser = role === 'borrower' ? loan.borrower_user_id === userId : loan.lender_user_id === userId;
      const loanWallet = normalizeWalletAddress(getLoanWallet(loan, role));
      if (!belongsToUser || !loanWallet || loanWallet !== normalizedCurrentAddress) continue;

      const hashes = loan.hash ?? [];
      if (role === 'borrower' && loan.funded_at && loan.loan_status === 'Lent') {
         rows.push({
            id: `${loan.id}-funded`,
            kind: 'loan_received',
            direction: 'in',
            amount: loan.loan_amount,
            occurredAt: loan.funded_at,
            transactionHash: hashes[0] ?? null,
            loanId: loan.id,
            trackingId: loan.tracking_id
         });
      }

      if (role === 'borrower' && loan.repayment_status === 'Paid' && loan.repaid_at) {
         rows.push({
            id: `${loan.id}-repaid`,
            kind: 'loan_repaid',
            direction: 'neutral',
            amount: loan.total_repayment_amount,
            occurredAt: loan.repaid_at,
            transactionHash: hashes.at(-1) ?? null,
            loanId: loan.id,
            trackingId: loan.tracking_id
         });
      }
   }

   return rows;
}

export function buildRecentWalletActivity(params: {
   loans: WalletLoanRecord[];
   transfers?: WalletTransferRecord[] | null;
   userId: string;
   role: WalletAccountRole;
   currentAddress: string;
   limit?: number;
}): WalletActivityItem[] {
   const { loans, transfers, userId, role, currentAddress, limit = 3 } = params;
   const normalizedCurrentAddress = normalizeWalletAddress(currentAddress);
   const relevantLoans = loans.filter((loan) => {
      const belongsToUser = role === 'borrower' ? loan.borrower_user_id === userId : loan.lender_user_id === userId;
      return belongsToUser && normalizeWalletAddress(getLoanWallet(loan, role)) === normalizedCurrentAddress;
   });

   const loanByHash = new Map<string, { loan: WalletLoanRecord; hashIndex: number }>();
   for (const loan of relevantLoans) {
      (loan.hash ?? []).forEach((hash, hashIndex) => {
         const normalizedHash = hash.trim().toLowerCase();
         if (normalizedHash) loanByHash.set(normalizedHash, { loan, hashIndex });
      });
   }

   const chainRows = (transfers ?? []).map<WalletActivityItem>((transfer) => {
      const match = loanByHash.get(transfer.hash.trim().toLowerCase());
      const isFundingTransfer = match?.hashIndex === 0;
      const isExpectedDirection = match ? transfer.direction === getExpectedTransferDirection(role, isFundingTransfer) : false;
      return {
         id: `${transfer.hash}-${transfer.direction}`,
         kind: match && isExpectedDirection ? getMatchedActivityKind(role, isFundingTransfer) : getGenericActivityKind(transfer.direction),
         direction: transfer.direction,
         amount: transfer.amount,
         occurredAt: transfer.timestamp,
         transactionHash: transfer.hash,
         loanId: match && isExpectedDirection ? match.loan.id : null,
         trackingId: match && isExpectedDirection ? match.loan.tracking_id : null
      };
   });

   const fallbackRows = buildLoanFallbackActivity({ loans, userId, role, currentAddress });
   const combined = [...chainRows];
   const seen = new Set(chainRows.map((row) => row.transactionHash?.trim().toLowerCase()).filter((hash): hash is string => Boolean(hash)));

   for (const row of fallbackRows) {
      const hash = row.transactionHash?.trim().toLowerCase();
      if (hash && seen.has(hash)) continue;
      combined.push(row);
   }

   return combined
      .filter((row) => Number.isFinite(row.amount) && row.amount > 0)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, Math.max(0, limit));
}

export function buildRepaymentDestinations(params: {
   loans: RepaymentRouteLoanRecord[];
   userId: string;
   currentAddress: string;
}): RepaymentDestination[] {
   const { loans, userId, currentAddress } = params;
   const normalizedCurrentAddress = normalizeWalletAddress(currentAddress);
   const counts = new Map<string, number>();

   for (const loan of loans) {
      if (loan.lender_user_id !== userId || loan.loan_status !== 'Lent' || loan.repayment_status === 'Paid') continue;
      const lenderWallet = normalizeWalletAddress(loan.lender_wallet);
      if (!lenderWallet || lenderWallet === normalizedCurrentAddress) continue;
      counts.set(lenderWallet, (counts.get(lenderWallet) ?? 0) + 1);
   }

   return [...counts.entries()]
      .map(([walletAddress, activeLoanCount]) => ({ walletAddress, activeLoanCount }))
      .sort((a, b) => b.activeLoanCount - a.activeLoanCount || a.walletAddress.localeCompare(b.walletAddress));
}

export function getDistinctWalletCount(events: WalletConnectionEvent[], currentAddress?: string | null) {
   const addresses = new Set<string>();
   const current = normalizeWalletAddress(currentAddress);
   if (current) addresses.add(current);

   for (const event of events) {
      const address = normalizeWalletAddress(event.wallet_address);
      const previousAddress = normalizeWalletAddress(event.previous_wallet_address);
      if (address) addresses.add(address);
      if (previousAddress) addresses.add(previousAddress);
   }

   return addresses.size;
}

export function hasMeaningfulWalletHistory(events: WalletConnectionEvent[], currentAddress?: string | null) {
   return (
      getDistinctWalletCount(events, currentAddress) > 1 ||
      events.some((event) => event.event_type === 'changed' || event.event_type === 'disconnected')
   );
}
