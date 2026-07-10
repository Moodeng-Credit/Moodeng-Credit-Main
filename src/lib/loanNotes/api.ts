import { formatUnits, parseUnits } from 'viem';

import { getEffectiveCreditLimit } from '@/lib/creditLeveling';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { getLoanManagerService } from '@/lib/web3/loanManager';

import { LENDER_IOU_POINTS_PER_USDC, USDC_DECIMALS } from '@/config/loanFundingConfig';
import { getCreditLevelNumber } from '@/config/creditTiers';

import { type FundedLoan, type LoanNotePageData, type RelayLoan } from '@/lib/loanNotes/types';

const toNumber = (value: unknown): number => {
   const n = typeof value === 'number' ? value : Number(value ?? 0);
   return Number.isFinite(n) ? n : 0;
};

const shortenAddress = (address?: string | null): string | null => {
   if (!address || address.length < 10) return address ?? null;
   return `${address.slice(0, 6)}…${address.slice(-4)}`;
};

const usdcFromBaseUnits = (base: string): number => Number(formatUnits(BigInt(base || '0'), USDC_DECIMALS));

/**
 * Fetches everything the lender purchase page needs for a given loan: public loan +
 * borrower data, borrower repayment stats, resale economics, and the viewer's
 * relationship to the Loan Note (ownership). Safe to call when logged out.
 */
export async function getLoanNotePageData(loanId: string, viewer: { userId?: string | null; walletAddress?: string | null }): Promise<LoanNotePageData | null> {
   const supabase = getSupabaseBrowserClient();

   const { data: loan, error } = await supabase
      .from('loans')
      .select(
         'id, tracking_id, onchain_loan_id, borrower_user_id, borrower_wallet, reason, loan_amount, total_repayment_amount, repaid_amount, due_date, loan_status, listing_price, is_sellable, loan_note_owner_wallet'
      )
      .eq('id', loanId)
      .maybeSingle();

   if (error || !loan) return null;

   // Borrower profile via the safe cross-user view (the users table itself is locked down;
   // cs comes back NULL for other users, so the credit level is only shown when available).
   let borrowerDisplayName = 'A Moodeng borrower';
   let borrowerUsername = '';
   let borrowerCreditLevel: number | null = null;
   if (loan.borrower_user_id) {
      const { data: borrower } = await supabase
         .from('public_user_profiles')
         .select('username, display_name, cs, is_world_id')
         .eq('id', loan.borrower_user_id)
         .maybeSingle();
      if (borrower) {
         borrowerUsername = borrower.username ?? '';
         borrowerDisplayName = borrower.display_name || borrower.username || borrowerDisplayName;
         if (borrower.cs != null) {
            const verified = borrower.is_world_id === 'ACTIVE';
            const creditLimit = getEffectiveCreditLimit(borrower.cs, verified);
            borrowerCreditLevel = getCreditLevelNumber(creditLimit);
         }
      }
   }

   // Borrower repayment stats across funded loans.
   let loansFunded = 0;
   let loansRepaid = 0;
   if (loan.borrower_user_id) {
      const { data: history } = await supabase
         .from('loans')
         .select('repayment_status, loan_status')
         .eq('borrower_user_id', loan.borrower_user_id)
         .eq('loan_status', 'Lent');
      if (Array.isArray(history)) {
         loansFunded = history.length;
         loansRepaid = history.filter((row) => row.repayment_status === 'Paid').length;
      }
   }
   const repaymentRatePct = loansFunded > 0 ? Math.round((loansRepaid / loansFunded) * 100) : null;

   const principal = toNumber(loan.loan_amount);
   const totalOwed = toNumber(loan.total_repayment_amount);
   const repaid = toNumber(loan.repaid_amount);
   const listingPrice = loan.listing_price != null ? toNumber(loan.listing_price) : totalOwed;
   const expectedRepayment = totalOwed;
   const expectedProfit = Math.max(0, expectedRepayment - listingPrice);

   // On-chain enrichment (mock or real). Best-effort: failures fall back to DB values.
   let remainingOwed = Math.max(0, totalOwed - repaid);
   let ownsLoanNote = false;
   const service = getLoanManagerService();
   if (loan.onchain_loan_id) {
      try {
         const remainingBase = await service.getRemainingOwed(loan.onchain_loan_id);
         remainingOwed = usdcFromBaseUnits(remainingBase);
      } catch {
         /* keep DB fallback */
      }
      if (viewer.walletAddress) {
         try {
            const owner = await service.ownerOf(loan.onchain_loan_id);
            ownsLoanNote = !!owner && owner.toLowerCase() === viewer.walletAddress.toLowerCase();
         } catch {
            /* ignore */
         }
      }
   }

   return {
      loanId: loan.id,
      trackingId: loan.tracking_id,
      onchainLoanId: loan.onchain_loan_id ?? null,
      borrowerDisplayName,
      borrowerUsername,
      borrowerWalletShort: shortenAddress(loan.borrower_wallet),
      borrowerAvatarUrl: null,
      borrowerCreditLevel,
      loanPurpose: loan.reason ?? '',
      principal,
      totalOwed,
      remainingOwed,
      dueDate: loan.due_date,
      loanStatus: loan.loan_status ?? 'Active',
      listingPrice,
      expectedRepayment,
      expectedProfit,
      iouPointsReward: Math.trunc(listingPrice * LENDER_IOU_POINTS_PER_USDC),
      isSellable: Boolean(loan.is_sellable),
      repaymentStats: { loansFunded, loansRepaid, repaymentRatePct },
      isLoggedIn: Boolean(viewer.userId),
      ownsLoanNote
   };
}

/** Records an admin-funded loan (direct or smart-contract) via the verified edge function. */
export async function recordAdminFunding(payload: {
   loanId: string;
   fundingMethod: 'direct' | 'smart_contract';
   txHash?: string;
   borrowerWallet?: string;
   principal?: string | number;
   totalOwed?: string | number;
   dueDate?: string;
   onchainLoanId?: string;
   onchainRequestId?: string;
   listingPrice?: string | number;
   listingTxHash?: string;
}): Promise<void> {
   const supabase = getSupabaseBrowserClient();
   const { error } = await supabase.functions.invoke('admin-fund-loan', { body: payload });
   if (error) throw new Error(error.message || 'Failed to record funding');
}

/** Records a confirmed Loan Note purchase and triggers IOU point award. Returns awarded points (major units). */
export async function recordLoanNotePurchase(payload: {
   loanId: string;
   txHash?: string;
   buyerWallet: string;
   onchainLoanId?: string | null;
   price: number;
}): Promise<{ iouPointsAwarded: number; pointsTotal: number; alreadyRecorded: boolean }> {
   const supabase = getSupabaseBrowserClient();
   const { data, error } = await supabase.functions.invoke('buy-loan-note', { body: payload });
   if (error) throw new Error(error.message || 'Failed to record purchase');
   const awardedMinor = BigInt((data?.iouPointsAwarded as string) ?? '0');
   return {
      iouPointsAwarded: Number(formatUnits(awardedMinor, 6)),
      pointsTotal: Number(data?.pointsTotal ?? 0),
      alreadyRecorded: Boolean(data?.alreadyRecorded)
   };
}

/** Lists the Loan Notes the current lender owns (their funded loans). Repayments auto-route to them. */
export async function getMyFundedLoans(): Promise<FundedLoan[]> {
   const supabase = getSupabaseBrowserClient();
   const { data, error } = await supabase
      .from('loan_note_purchases')
      .select(
         'loan_id, onchain_loan_id, price, buyer_wallet, iou_points_awarded, created_at, loans!inner(tracking_id, total_repayment_amount, repaid_amount, due_date, loan_status, repayment_status, borrower_user_id)'
      )
      .order('created_at', { ascending: false });

   if (error || !Array.isArray(data)) return [];

   // Resolve borrower display names in one pass.
   const borrowerIds = Array.from(
      new Set(data.map((row) => (row.loans as { borrower_user_id?: string })?.borrower_user_id).filter(Boolean) as string[])
   );
   const nameById = new Map<string, { display: string; username: string }>();
   if (borrowerIds.length > 0) {
      const { data: borrowers } = await supabase.from('public_user_profiles').select('id, username, display_name').in('id', borrowerIds);
      for (const b of borrowers ?? []) {
         nameById.set(b.id, { display: b.display_name || b.username || 'A Moodeng borrower', username: b.username ?? '' });
      }
   }

   const service = getLoanManagerService();

   const result: FundedLoan[] = [];
   for (const row of data) {
      const loan = row.loans as {
         tracking_id: string;
         total_repayment_amount: number;
         repaid_amount: number | null;
         due_date: string;
         loan_status: string;
         repayment_status: string;
         borrower_user_id?: string;
      };
      const borrower = loan.borrower_user_id ? nameById.get(loan.borrower_user_id) : undefined;
      const borrowerOwes = toNumber(loan.total_repayment_amount);

      // Hold-and-release: total repaid is split into "released to you" (paid out on payoff /
      // due date) and "held in contract" (repaid but still escrowed).
      const totalRepaid = toNumber(loan.repaid_amount);
      let heldInContract = 0;
      let amountReleasedToYou = totalRepaid;
      let expectedRemaining = Math.max(0, borrowerOwes - totalRepaid);
      let repaymentWallet: string | null = (row.buyer_wallet as string) ?? null;
      if (row.onchain_loan_id) {
         try {
            const onchainLoan = await service.getLoan(String(row.onchain_loan_id));
            const repaid = onchainLoan ? Number(formatUnits(BigInt(onchainLoan.amountRepaid || '0'), USDC_DECIMALS)) : totalRepaid;
            const held = Number(formatUnits(BigInt((await service.getHeld(String(row.onchain_loan_id))) || '0'), USDC_DECIMALS));
            heldInContract = held;
            amountReleasedToYou = Math.max(0, repaid - held);
            const remaining = await service.getRemainingOwed(String(row.onchain_loan_id));
            expectedRemaining = Number(formatUnits(BigInt(remaining || '0'), USDC_DECIMALS));
            const recipient = await service.getRepaymentRecipient(String(row.onchain_loan_id));
            if (recipient) repaymentWallet = recipient;
         } catch {
            /* fall back to DB values */
         }
      }

      result.push({
         loanId: row.loan_id,
         trackingId: loan.tracking_id,
         onchainLoanId: row.onchain_loan_id ? String(row.onchain_loan_id) : null,
         borrowerDisplayName: borrower?.display ?? 'A Moodeng borrower',
         borrowerUsername: borrower?.username ?? '',
         status: loan.repayment_status === 'Paid' ? 'Repaid' : loan.loan_status === 'Lent' ? 'Active' : loan.loan_status,
         amountPaid: toNumber(row.price),
         borrowerOwes,
         amountReleasedToYou,
         heldInContract,
         expectedRemaining,
         iouPointsEarned: Number(formatUnits(BigInt((row.iou_points_awarded as unknown as string) ?? '0'), 6)),
         repaymentWallet
      });
   }
   return result;
}

/**
 * Admin "Liquidity Relay" panel: every smart-contract-funded loan, with the data needed to
 * share a lender funding link. Public-select RLS on `loans` covers the read.
 */
export async function getRelayLoans(): Promise<RelayLoan[]> {
   const supabase = getSupabaseBrowserClient();
   const { data, error } = await supabase
      .from('loans')
      .select(
         'id, tracking_id, onchain_loan_id, loan_amount, total_repayment_amount, listing_price, is_sellable, loan_status, repayment_status, due_date, borrower_user_id, created_at'
      )
      .eq('funding_method', 'smart_contract')
      .order('created_at', { ascending: false });

   if (error || !Array.isArray(data)) return [];

   const borrowerIds = Array.from(new Set(data.map((row) => row.borrower_user_id).filter(Boolean) as string[]));
   const nameById = new Map<string, { display: string; username: string }>();
   if (borrowerIds.length > 0) {
      const { data: borrowers } = await supabase.from('public_user_profiles').select('id, username, display_name').in('id', borrowerIds);
      for (const b of borrowers ?? []) {
         nameById.set(b.id, { display: b.display_name || b.username || 'A Moodeng borrower', username: b.username ?? '' });
      }
   }

   const service = getLoanManagerService();
   const result: RelayLoan[] = [];
   for (const row of data) {
      const principal = toNumber(row.loan_amount);
      const totalOwed = toNumber(row.total_repayment_amount);
      const salePrice = row.listing_price != null ? toNumber(row.listing_price) : principal;
      const borrower = row.borrower_user_id ? nameById.get(row.borrower_user_id) : undefined;
      const status: RelayLoan['status'] =
         row.repayment_status === 'Paid' ? 'Repaid' : row.is_sellable ? 'Listed' : 'Sold';

      let heldInContract = 0;
      if (row.onchain_loan_id) {
         try {
            heldInContract = Number(formatUnits(BigInt((await service.getHeld(String(row.onchain_loan_id))) || '0'), USDC_DECIMALS));
         } catch {
            /* ignore */
         }
      }
      const pastDue = row.due_date ? new Date(row.due_date).getTime() <= Date.now() : false;

      result.push({
         loanId: row.id,
         trackingId: row.tracking_id,
         onchainLoanId: row.onchain_loan_id ? String(row.onchain_loan_id) : null,
         borrowerDisplayName: borrower?.display ?? 'A Moodeng borrower',
         borrowerUsername: borrower?.username ?? '',
         principal,
         totalOwed,
         salePrice,
         lenderUpside: Math.max(0, totalOwed - salePrice),
         status,
         heldInContract,
         dueDate: row.due_date,
         canRelease: pastDue && heldInContract > 0
      });
   }
   return result;
}

/** Reads the current user's total IOU points (major units). */
export async function getMyIouPoints(): Promise<number> {
   const supabase = getSupabaseBrowserClient();
   const {
      data: { user }
   } = await supabase.auth.getUser();
   if (!user) return 0;
   const { data } = await supabase.from('user_points').select('points_total').eq('user_id', user.id).maybeSingle();
   const minor = BigInt((data?.points_total as unknown as string) ?? '0');
   return Number(formatUnits(minor, 6));
}

/** Converts a USDC major-unit amount to base units (for contract calls). */
export const usdcToBaseUnits = (amount: string | number): bigint => parseUnits(String(amount), USDC_DECIMALS);
