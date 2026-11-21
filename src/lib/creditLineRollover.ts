// moodeng.app/repaidcreditline: the original BitRepo advance (not the vault) rolled back to BitRepo's own
// address, which they redeploy into the new vault. BitRepo asked for "the original principal and interest"
// at that address, so this works out:
//   owed     = the advance (principal) + interest on the loans lent from it
//   received = USDC that actually arrived at that address on Base, from our lending wallet or from
//              borrowers repaying those loans straight to BitRepo (their loans point at the address)
//   coming   = what the open advance loans still have to repay (they pay BitRepo directly)
//   top-up   = what Moodeng sends itself so the total reaches what is owed
// Interest follows the agreed terms, the same as the monthly report: 15%/yr simple, actual/365, on each
// loan's principal from the day it was funded until the day it was repaid (Manila dates). An open loan
// is projected to its due date (or today, if it is already late).
import { daysBetween } from '@/app/admin/creditLineModel';
import { BASE_USDC_ADDRESS } from '@/config/wagmiConfig';
import type { LenderLoan, LenderReportData } from '@/lib/creditLineReport';
import { BASE_ALCHEMY_RPC_URL } from '@/lib/web3/baseAlchemy';

/** BitRepo's return address on Base (confirmed 2026-11-11). */
export const BITREPO_ROLLOVER_ADDRESS = '0xb991B5dD8e6cb2d9D517572CD736f37480bF07DD';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ChainTransfer {
   hash: string;
   from: string;
   amount: number;
   at: string; // ISO block time
}

export interface RolloverLoan {
   loan: LenderLoan;
   open: boolean;
   days: number;
   interest: number; // owed so far
   interestProjected: number; // if it repays on its due date
   stillToRepay: number; // what the borrower still pays (straight to BitRepo when it points there)
   paysBitrepo: boolean;
}

export interface RolloverReceipt {
   hash: string;
   at: string;
   amount: number;
   source: 'moodeng' | 'borrower';
   loan: LenderLoan | null;
}

export interface Rollover {
   asOf: string;
   principal: number;
   rate: number;
   loans: RolloverLoan[];
   interest: number;
   interestProjected: number;
   owed: number;
   owedProjected: number;
   receipts: RolloverReceipt[];
   received: number;
   comingFromBorrowers: number;
   openLoans: number;
   moodengToSend: number; // what Moodeng still sends itself (0 when borrowers' repayments cover it)
   overBy: number; // borrowers' repayments beyond what is owed (Moodeng's own fees reaching BitRepo)
   left: number; // owed (projected) minus received
}

export function buildRollover(data: LenderReportData, transfers: ChainTransfer[], asOf: string, address = BITREPO_ROLLOVER_ADDRESS): Rollover {
   const rate = Number(data.facility.annual_rate);
   const to = address.toLowerCase();
   const principal = round2(data.ledger.filter((row) => row.kind === 'advance').reduce((t, row) => t + Number(row.amount_usd), 0));

   // Loans lent from the advance: everything linked to the facility that was not drawn from the vault.
   const loans: RolloverLoan[] = data.loans
      .filter((loan) => !loan.vaultAddress)
      .map((loan) => {
         const open = loan.status !== 'Closed';
         const end = loan.repaidDate ?? asOf;
         const projectedEnd = open && loan.dueDate && loan.dueDate > asOf ? loan.dueDate : end;
         const days = Math.max(0, daysBetween(loan.fundedDate, end));
         const amount = Number(loan.loan_amount);
         return {
            loan,
            open,
            days,
            interest: (amount * rate * days) / 365,
            interestProjected: (amount * rate * Math.max(0, daysBetween(loan.fundedDate, projectedEnd))) / 365,
            stillToRepay: open ? round2(Math.max(0, Number(loan.total_repayment_amount) - Number(loan.repaid_amount ?? 0))) : 0,
            paysBitrepo: (loan.lenderWallet ?? '').toLowerCase() === to
         };
      });

   // Only money that arrived from us or from those loans' repayments counts; anything else at BitRepo's
   // address is their own business.
   const lending = (data.facility.lending_wallet ?? '').toLowerCase();
   const byTx = new Map<string, LenderLoan>();
   for (const { loan } of loans) for (const tx of loan.repaymentTxs) byTx.set(tx.toLowerCase(), loan);
   const start = data.facility.start_date;
   const receipts: RolloverReceipt[] = transfers
      .filter((t) => t.amount > 0 && t.at.slice(0, 10) >= start)
      .flatMap((t): RolloverReceipt[] => {
         const loan = byTx.get(t.hash.toLowerCase()) ?? null;
         if (loan) return [{ hash: t.hash, at: t.at, amount: t.amount, source: 'borrower', loan }];
         if (lending && t.from.toLowerCase() === lending) return [{ hash: t.hash, at: t.at, amount: t.amount, source: 'moodeng', loan: null }];
         return [];
      })
      .sort((a, b) => a.at.localeCompare(b.at));

   const interest = round2(loans.reduce((t, l) => t + l.interest, 0));
   const interestProjected = round2(loans.reduce((t, l) => t + l.interestProjected, 0));
   const owed = round2(principal + interest);
   const owedProjected = round2(principal + interestProjected);
   const received = round2(receipts.reduce((t, r) => t + r.amount, 0));
   const comingFromBorrowers = round2(loans.filter((l) => l.open && l.paysBitrepo).reduce((t, l) => t + l.stillToRepay, 0));
   const gap = round2(owedProjected - received - comingFromBorrowers);
   return {
      asOf,
      principal,
      rate,
      loans,
      interest,
      interestProjected,
      owed,
      owedProjected,
      receipts,
      received,
      comingFromBorrowers,
      openLoans: loans.filter((l) => l.open).length,
      moodengToSend: Math.max(0, gap),
      overBy: Math.max(0, -gap),
      left: Math.max(0, round2(owedProjected - received))
   };
}

/** USDC transfers on Base into `address`, oldest first. */
export async function listUsdcTransfersTo(address = BITREPO_ROLLOVER_ADDRESS): Promise<ChainTransfer[]> {
   const response = await fetch(BASE_ALCHEMY_RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
         jsonrpc: '2.0',
         id: 1,
         method: 'alchemy_getAssetTransfers',
         params: [
            {
               fromBlock: '0x0',
               toBlock: 'latest',
               toAddress: address,
               contractAddresses: [BASE_USDC_ADDRESS],
               category: ['erc20'],
               withMetadata: true,
               maxCount: '0x3e8'
            }
         ]
      })
   });
   const body = (await response.json()) as {
      error?: { message?: string };
      result?: { transfers?: Array<{ hash: string; from: string; value: number | null; metadata?: { blockTimestamp?: string } }> };
   };
   if (body.error) throw new Error(body.error.message || 'Could not read transfers on Base.');
   return (body.result?.transfers ?? [])
      .filter((t) => t.value && t.metadata?.blockTimestamp)
      .map((t) => ({ hash: t.hash, from: t.from, amount: Number(t.value), at: t.metadata?.blockTimestamp as string }))
      .sort((a, b) => a.at.localeCompare(b.at));
}
