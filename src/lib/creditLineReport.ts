// The facility lender's view (moodeng.app/creditline): one password-checked RPC returns the facility, its loans
// and ledger; everything below is computed with the admin page's own model (src/app/admin/creditLineModel.ts),
// so the lender page, the admin page and the Excel download always agree.
//
// Interest follows the agreed terms: simple, actual/365, on principal deployed each day (a loan counts from its
// funding date until the day it is repaid, Manila calendar dates).

import {
   addDays,
   buildFacilityLoans,
   type CreditFacility,
   type FacilityLedgerRow,
   type FacilityLoan,
   type FacilityLoanInput,
   reportingPeriods
} from '@/app/admin/creditLineModel';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export type LenderLoan = FacilityLoan & {
   borrowerWallet: string | null;
   kycProvider: string | null;
   kycDate: string | null;
};

export interface LenderReportData {
   facility: CreditFacility;
   loans: LenderLoan[];
   ledger: FacilityLedgerRow[];
}

export type LenderReportError = 'wrong_password' | 'locked' | 'failed';

type RpcLoan = Omit<FacilityLoanInput, 'borrower'> & {
   borrower_wallet: string | null;
   borrower: {
      username: string | null;
      kyc_passed: boolean;
      kyc_provider: string | null;
      kyc_date: string | null;
      liveness: boolean;
      facebook_verified: boolean;
      video_call_attended: boolean;
   };
};

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
export const manilaToday = () => new Date(Date.now() + MANILA_OFFSET_MS).toISOString().slice(0, 10);

export async function loadLenderReport(password: string): Promise<{ data: LenderReportData } | { error: LenderReportError }> {
   let data: unknown;
   try {
      const result = await getSupabaseBrowserClient().rpc('credit_line_lender_report' as never, { p_password: password } as never);
      if (result.error) return { error: 'failed' };
      data = result.data;
   } catch {
      // Network down or client misconfigured: say so instead of spinning forever.
      return { error: 'failed' };
   }
   if (!data) return { error: 'failed' };
   const raw = data as { error?: string; facility?: CreditFacility; loans?: RpcLoan[]; ledger?: FacilityLedgerRow[] };
   if (raw.error === 'wrong_password' || raw.error === 'locked') return { error: raw.error };
   if (!raw.facility) return { error: 'failed' };

   const facility = { ...raw.facility, commitment_usd: num(raw.facility.commitment_usd), annual_rate: num(raw.facility.annual_rate) };
   const ledger = (raw.ledger ?? []).map((row) => ({ ...row, amount_usd: num(row.amount_usd) }));
   const inputs = (raw.loans ?? []).map((l) => ({
      ...l,
      loan_amount: num(l.loan_amount),
      total_repayment_amount: num(l.total_repayment_amount),
      repaid_amount: num(l.repaid_amount),
      hash: l.hash ?? [],
      borrower: {
         username: l.borrower.username,
         display_name: null,
         facebook_name: null,
         kyc_passed: l.borrower.kyc_passed,
         kyc_document: null,
         liveness: l.borrower.liveness,
         facebook_verified: l.borrower.facebook_verified,
         video_call_attended: l.borrower.video_call_attended
      }
   }));
   const extra = new Map((raw.loans ?? []).map((l) => [l.id, l]));
   const loans = buildFacilityLoans(inputs, ledger, manilaToday()).map((loan) => {
      const r = extra.get(loan.id);
      return {
         ...loan,
         borrowerWallet: r?.borrower_wallet ?? null,
         kycProvider: r?.borrower.kyc_provider ?? null,
         kycDate: r?.borrower.kyc_date ? new Date(Date.parse(r.borrower.kyc_date) + MANILA_OFFSET_MS).toISOString().slice(0, 10) : null
      };
   });
   return { data: { facility, loans, ledger } };
}

export const periodsFor = (facility: CreditFacility, today = manilaToday()) => reportingPeriods(facility, today).reverse();

export interface DailyInterestRow {
   date: string;
   deployed: number;
   interest: number;
   projected: boolean;
}

// Each day of the period: principal deployed that day × rate ÷ 365. Days after asOf assume no change.
export function dailyInterest(loans: FacilityLoan[], rate: number, start: string, end: string, asOf: string): DailyInterestRow[] {
   const rows: DailyInterestRow[] = [];
   for (let date = start; date <= end; date = addDays(date, 1)) {
      const deployed = loans
         .filter((l) => l.fundedDate <= date && (!l.repaidDate || l.repaidDate > date))
         .reduce((total, l) => total + Number(l.loan_amount), 0);
      rows.push({ date, deployed, interest: (deployed * rate) / 365, projected: date > asOf });
   }
   return rows;
}

export const median = (values: number[]) => {
   const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
   if (!sorted.length) return 0;
   const mid = Math.floor(sorted.length / 2);
   return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export interface PeriodReport {
   period: { start: string; end: string; due: string };
   asOf: string;
   loans: LenderLoan[]; // funded on or before the period end
   repaid: LenderLoan[]; // repaid within the period
   daily: DailyInterestRow[];
   advanced: number;
   drawn: number;
   atBinance: number;
   lent: number;
   principalRepaid: number;
   deployed: number;
   available: number;
   utilization: number;
   interestAccrued: number;
   interestProjected: number;
   feesCollected: number;
   counts: { funded: number; active: number; repaid: number; overdue: number };
   medians: { loan: number; term: number; fee: number; loanStandard: number; termStandard: number; feeStandard: number };
}

export function buildPeriodReport(data: LenderReportData, period: { start: string; end: string; due: string }, today = manilaToday()): PeriodReport {
   const asOf = today < period.end ? today : period.end;
   const loans = data.loans.filter((l) => l.fundedDate <= period.end);
   const daily = dailyInterest(loans, Number(data.facility.annual_rate), period.start, period.end, asOf);
   const ledgerTo = data.ledger.filter((row) => row.occurred_at.slice(0, 10) <= period.end);
   const sumKind = (kind: string) => ledgerTo.filter((row) => row.kind === kind).reduce((t, row) => t + Number(row.amount_usd), 0);
   const advanced = sumKind('advance');
   const drawn = sumKind('draw');
   const outstandingAt = (l: LenderLoan) => (l.repaidDate && l.repaidDate <= asOf ? 0 : Number(l.loan_amount));
   const deployed = loans.reduce((t, l) => t + outstandingAt(l), 0);
   const lent = loans.reduce((t, l) => t + Number(l.loan_amount), 0);
   const standard = loans.filter((l) => !l.restructured);
   const commitment = Number(data.facility.commitment_usd);
   return {
      period,
      asOf,
      loans,
      repaid: loans.filter((l) => l.repaidDate && l.repaidDate >= period.start && l.repaidDate <= asOf),
      daily,
      advanced,
      drawn,
      atBinance: advanced - drawn,
      lent,
      principalRepaid: lent - deployed,
      deployed,
      available: commitment - deployed,
      utilization: commitment > 0 ? deployed / commitment : 0,
      interestAccrued: daily.filter((d) => !d.projected).reduce((t, d) => t + d.interest, 0),
      interestProjected: daily.reduce((t, d) => t + d.interest, 0),
      feesCollected: loans.filter((l) => l.repaidDate && l.repaidDate <= asOf).reduce((t, l) => t + l.interestRepaid, 0),
      counts: {
         funded: loans.length,
         active: loans.filter((l) => outstandingAt(l) > 0 && !(l.dueDate && l.dueDate < asOf)).length,
         repaid: loans.filter((l) => outstandingAt(l) === 0).length,
         overdue: loans.filter((l) => outstandingAt(l) > 0 && l.dueDate !== null && l.dueDate < asOf).length
      },
      medians: {
         loan: median(loans.map((l) => Number(l.loan_amount))),
         term: median(loans.map((l) => l.termDays ?? NaN)),
         fee: median(loans.map((l) => l.impliedCost)),
         loanStandard: median(standard.map((l) => Number(l.loan_amount))),
         termStandard: median(standard.map((l) => l.termDays ?? NaN)),
         feeStandard: median(standard.map((l) => l.impliedCost))
      }
   };
}
