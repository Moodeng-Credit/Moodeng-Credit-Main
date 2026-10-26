// Credit line reporting (admin → Finance → Credit line): what a lender's monthly report needs, computed from
// our own records. Pure functions, so the numbers are testable and the page and the CSV export agree.
//
// Interest follows the BitRepo pilot terms: simple, actual/365, on Deployed Principal only — a loan's principal
// counts from its funding date until the day it is repaid (Manila calendar dates), split by calendar month.

export interface CreditFacility {
   id: string;
   name: string;
   lender_name: string;
   commitment_usd: number;
   annual_rate: number;
   start_date: string; // YYYY-MM-DD
   period_anchor_day: number;
   max_loan_usd: number | null;
   max_term_days: number | null;
   originator_wallet: string | null;
   lending_wallet: string | null;
   notes: string | null;
}

export type LedgerKind =
   'advance' | 'transfer' | 'draw' | 'disbursement' | 'repayment' | 'interest_payment' | 'principal_return' | 'fee' | 'other';

export interface FacilityLedgerRow {
   id: number;
   occurred_at: string;
   kind: LedgerKind;
   description: string;
   from_label: string | null;
   to_label: string | null;
   amount_usd: number;
   tx_hash: string | null;
   loan_id: string | null;
}

export interface FacilityLoanInput {
   id: string;
   tracking_id: string;
   borrower_user_id: string;
   funded_at: string;
   due_date: string | null;
   loan_amount: number;
   total_repayment_amount: number;
   repaid_amount: number | null;
   repaid_at: string | null;
   repayment_status: string | null;
   hash: string[] | null;
   reason: string | null;
   rationale: string | null;
   // Borrower facts used for the exception checks (never exported to the lender).
   borrower: {
      username: string | null;
      display_name: string | null;
      facebook_name: string | null;
      kyc_passed: boolean;
      kyc_document: string | null; // e.g. "Passport/PHL"
      liveness: boolean;
      facebook_verified: boolean;
      video_call_attended: boolean;
   };
}

export type FacilityLoanStatus = 'Current' | 'Late' | 'Closed';

export interface FacilityLoan extends FacilityLoanInput {
   privateId: string;
   fundedDate: string;
   dueDate: string | null;
   repaidDate: string | null;
   termDays: number | null;
   impliedCost: number;
   principalRepaid: number;
   interestRepaid: number;
   outstanding: number;
   daysPastDue: number;
   status: FacilityLoanStatus;
   restructured: boolean;
   disbursementTxs: string[];
   repaymentTxs: string[];
}

export interface FacilityException {
   loanId: string | null;
   privateId: string | null;
   kind: 'loan_size' | 'term' | 'missing_tx' | 'missing_rationale' | 'kyc' | 'country' | 'restructure' | 'overdue' | 'interest_unpaid';
   message: string;
}

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Calendar date in Manila for an ISO timestamp (YYYY-MM-DD).
export const manilaDate = (iso: string): string => new Date(Date.parse(iso) + MANILA_OFFSET_MS).toISOString().slice(0, 10);

const dayNumber = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
export const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);
export const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

const round2 = (n: number) => Math.round(n * 100) / 100;

// B-01, B-02… in order of each borrower's first facility loan, so IDs stay stable as loans are added.
export function privateBorrowerIds(loans: Pick<FacilityLoanInput, 'borrower_user_id' | 'funded_at'>[]): Map<string, string> {
   const firstFunded = new Map<string, string>();
   for (const loan of loans) {
      const seen = firstFunded.get(loan.borrower_user_id);
      if (!seen || loan.funded_at < seen) firstFunded.set(loan.borrower_user_id, loan.funded_at);
   }
   const ordered = [...firstFunded.entries()].sort((a, b) => a[1].localeCompare(b[1]));
   return new Map(ordered.map(([userId], i) => [userId, `B-${String(i + 1).padStart(2, '0')}`]));
}

// Reporting periods: anchor day → day before the next anchor (BitRepo: 17th → 16th), from the facility start
// up to the one containing asOf. Each report is due on the day after its period ends.
export function reportingPeriods(facility: Pick<CreditFacility, 'start_date' | 'period_anchor_day'>, asOf: string) {
   const periods: Array<{ start: string; end: string; due: string }> = [];
   const anchor = facility.period_anchor_day;
   let [y, m] = facility.start_date.split('-').map(Number);
   let start = facility.start_date;
   for (let guard = 0; guard < 120 && start <= asOf; guard++) {
      m += 1;
      if (m > 12) {
         m = 1;
         y += 1;
      }
      const nextAnchor = `${y}-${String(m).padStart(2, '0')}-${String(anchor).padStart(2, '0')}`;
      const end = addDays(nextAnchor, -1);
      periods.push({ start, end, due: nextAnchor });
      start = nextAnchor;
   }
   return periods;
}

export function buildFacilityLoans(inputs: FacilityLoanInput[], ledger: FacilityLedgerRow[], asOf: string): FacilityLoan[] {
   const ids = privateBorrowerIds(inputs);
   return [...inputs]
      .sort((a, b) => a.funded_at.localeCompare(b.funded_at))
      .map((loan) => {
         const amount = Number(loan.loan_amount);
         const repayable = Number(loan.total_repayment_amount);
         const repaid = Number(loan.repaid_amount ?? 0);
         const closed = loan.repayment_status === 'Paid' || repaid >= repayable;
         const principalRepaid = closed ? amount : Math.min(amount, repaid);
         const fundedDate = manilaDate(loan.funded_at);
         const dueDate = loan.due_date ? manilaDate(loan.due_date) : null;
         const repaidDate = closed && loan.repaid_at ? manilaDate(loan.repaid_at) : null;
         const outstanding = round2(amount - principalRepaid);
         const daysPastDue = outstanding > 0 && dueDate && asOf > dueDate ? daysBetween(dueDate, asOf) : 0;
         const hashes = (loan.hash ?? []).filter(Boolean);
         const ledgerFor = (kind: LedgerKind) =>
            ledger.filter((row) => row.loan_id === loan.id && row.kind === kind && row.tx_hash).map((row) => row.tx_hash as string);
         return {
            ...loan,
            privateId: ids.get(loan.borrower_user_id) ?? 'B-??',
            fundedDate,
            dueDate,
            repaidDate,
            termDays: dueDate ? daysBetween(fundedDate, dueDate) : null,
            impliedCost: amount > 0 ? (repayable - amount) / amount : 0,
            principalRepaid,
            interestRepaid: closed ? round2(Math.max(0, repaid - amount)) : round2(Math.max(0, repaid - principalRepaid)),
            outstanding,
            daysPastDue,
            status: closed ? 'Closed' : daysPastDue > 0 ? 'Late' : 'Current',
            restructured: repayable <= amount || /bridge|restructur/i.test(loan.reason ?? ''),
            // loans.hash: the funding tx first, repayment txs after it.
            disbursementTxs: [...hashes.slice(0, 1), ...ledgerFor('disbursement')],
            repaymentTxs: [...hashes.slice(1), ...ledgerFor('repayment')]
         } satisfies FacilityLoan;
      });
}

// Interest owed to the facility lender per calendar month, actual/365 on deployed principal.
export function interestByMonth(loans: FacilityLoan[], annualRate: number, asOf: string) {
   const months = new Map<string, { month: string; principalDays: number; interest: number }>();
   for (const loan of loans) {
      const start = loan.fundedDate;
      const end = loan.repaidDate && loan.repaidDate < asOf ? loan.repaidDate : asOf;
      let cursor = start;
      while (cursor < end) {
         const month = cursor.slice(0, 7);
         const [y, m] = month.split('-').map(Number);
         const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
         const segmentEnd = end < nextMonth ? end : nextMonth;
         const days = daysBetween(cursor, segmentEnd);
         const row = months.get(month) ?? { month, principalDays: 0, interest: 0 };
         row.principalDays += Number(loan.loan_amount) * days;
         row.interest = (row.principalDays * annualRate) / 365;
         months.set(month, row);
         cursor = segmentEnd;
      }
   }
   return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export function facilitySummary(facility: CreditFacility, loans: FacilityLoan[], ledger: FacilityLedgerRow[], asOf: string) {
   const sum = (kind: LedgerKind) => ledger.filter((row) => row.kind === kind).reduce((total, row) => total + Number(row.amount_usd), 0);
   const advanced = sum('advance');
   const principalReturned = Math.abs(sum('principal_return'));
   const interestPaid = Math.abs(sum('interest_payment'));
   const deployed = round2(loans.reduce((total, loan) => total + loan.outstanding, 0));
   const interest = interestByMonth(loans, Number(facility.annual_rate), asOf);
   const interestAccrued = interest.reduce((total, row) => total + row.interest, 0);
   return {
      advanced,
      disbursed: round2(loans.reduce((total, loan) => total + Number(loan.loan_amount), 0)),
      principalRepaid: round2(loans.reduce((total, loan) => total + loan.principalRepaid, 0)),
      interestCollected: round2(loans.reduce((total, loan) => total + loan.interestRepaid, 0)),
      deployed,
      unallocated: round2(advanced - principalReturned - deployed),
      utilization: facility.commitment_usd > 0 ? deployed / Number(facility.commitment_usd) : 0,
      principalOwed: round2(advanced - principalReturned),
      interest,
      interestAccrued,
      interestPaid,
      interestOwed: Math.max(0, interestAccrued - interestPaid),
      overdue: loans.filter((loan) => loan.status === 'Late').length,
      openLoans: loans.filter((loan) => loan.status !== 'Closed').length
   };
}

// Things the lender's agreement asks for that a loan doesn't meet, or that the report must disclose.
export function facilityExceptions(
   facility: CreditFacility,
   loans: FacilityLoan[],
   interestOwedForPastMonths: number
): FacilityException[] {
   const out: FacilityException[] = [];
   const openByBorrower = new Map<string, number>();
   for (const loan of loans)
      if (loan.status !== 'Closed')
         openByBorrower.set(loan.borrower_user_id, (openByBorrower.get(loan.borrower_user_id) ?? 0) + loan.outstanding);
   for (const loan of loans) {
      const base = { loanId: loan.id, privateId: loan.privateId };
      if (facility.max_loan_usd && Number(loan.loan_amount) > Number(facility.max_loan_usd))
         out.push({ ...base, kind: 'loan_size', message: `$${loan.loan_amount} is over the $${facility.max_loan_usd} per-loan cap.` });
      if (facility.max_term_days && loan.termDays && loan.termDays > facility.max_term_days)
         out.push({ ...base, kind: 'term', message: `Term ${loan.termDays} days is over the ${facility.max_term_days}-day maximum.` });
      if (!loan.disbursementTxs.length) out.push({ ...base, kind: 'missing_tx', message: 'No disbursement transaction on record.' });
      if (loan.status === 'Closed' && !loan.repaymentTxs.length)
         out.push({ ...base, kind: 'missing_tx', message: 'Repaid, but no repayment transaction on record.' });
      if (!loan.rationale?.trim()) out.push({ ...base, kind: 'missing_rationale', message: 'Underwriting rationale is empty.' });
      if (!loan.borrower.kyc_passed) out.push({ ...base, kind: 'kyc', message: 'Borrower has not passed ID verification.' });
      else if (!loan.borrower.kyc_document)
         out.push({
            ...base,
            kind: 'kyc',
            message: 'ID passed, but the document details are missing from our records; pull them from Didit.'
         });
      const country = loan.borrower.kyc_document?.split('/')[1];
      if (country && country !== 'PHL') out.push({ ...base, kind: 'country', message: `ID issued by ${country}, not the Philippines.` });
      if (loan.restructured)
         out.push({ ...base, kind: 'restructure', message: 'Restructured / 0% bridge loan; report it as restructured.' });
      if (loan.status === 'Late') out.push({ ...base, kind: 'overdue', message: `${loan.daysPastDue} days past due.` });
   }
   for (const [borrowerId, open] of openByBorrower) {
      if (facility.max_loan_usd && open > Number(facility.max_loan_usd)) {
         const loan = loans.find((l) => l.borrower_user_id === borrowerId);
         out.push({
            loanId: null,
            privateId: loan?.privateId ?? null,
            kind: 'loan_size',
            message: `$${open} open across several loans is over the $${facility.max_loan_usd} cap.`
         });
      }
   }
   if (interestOwedForPastMonths > 0.005)
      out.push({
         loanId: null,
         privateId: null,
         kind: 'interest_unpaid',
         message: `$${interestOwedForPastMonths.toFixed(2)} interest for finished months not yet paid (due on each month's last day).`
      });
   return out;
}

// One-line underwriting rationale drafted from the loan's facts (the admin edits it before reporting).
export function draftRationale(
   loan: FacilityLoan,
   priorLoans: number,
   priorRepaid: number,
   priorLate: number,
   creditLimit: number | null
): string {
   const parts: string[] = [];
   parts.push(
      `${creditLimit ? `Limit $${creditLimit}. ` : ''}${priorLoans === 0 ? '1st loan' : `Loan #${priorLoans + 1}; ${priorRepaid} prior repaid${priorLate ? ` (${priorLate} late)` : ''}`}.`
   );
   const checks = [
      loan.borrower.kyc_passed
         ? `Didit ID passed${loan.borrower.kyc_document ? ` (${loan.borrower.kyc_document})` : ''}`
         : 'ID not verified',
      loan.borrower.liveness ? 'liveness passed' : null,
      loan.borrower.facebook_verified ? 'Facebook verified' : null,
      loan.borrower.video_call_attended ? 'video call attended' : null
   ].filter(Boolean);
   parts.push(`${checks.join('; ')}.`);
   parts.push('Income check not performed (below threshold).');
   return parts.join(' ');
}

const csvCell = (value: unknown) => {
   const text = value === null || value === undefined ? '' : String(value);
   return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
export const toCsv = (rows: unknown[][]) => rows.map((row) => row.map(csvCell).join(',')).join('\n');

// Loan-level rows for the lender (Schedule B). Private IDs only — no names, usernames or wallets.
export function lenderLoanRows(loans: FacilityLoan[], asOf: string): unknown[][] {
   return [
      ['As of', asOf],
      [],
      [
         'Loan ID',
         'Private borrower ID',
         'Loan type',
         'Purpose',
         'Disbursed',
         'Disbursement tx',
         'Principal',
         'Total repayable',
         'Implied cost',
         'Term (days)',
         'Due date',
         'Repaid on',
         'Repayment tx',
         'Principal repaid',
         'Interest repaid',
         'Outstanding principal',
         'Days past due',
         'Status',
         'Underwriting rationale'
      ],
      ...loans.map((loan) => [
         loan.tracking_id,
         loan.privateId,
         loan.restructured ? 'Restructure' : 'New loan',
         loan.reason ?? '',
         loan.fundedDate,
         loan.disbursementTxs.join(' '),
         Number(loan.loan_amount).toFixed(2),
         Number(loan.total_repayment_amount).toFixed(2),
         `${(loan.impliedCost * 100).toFixed(1)}%`,
         loan.termDays ?? '',
         loan.dueDate ?? '',
         loan.repaidDate ?? '',
         loan.repaymentTxs.join(' '),
         loan.principalRepaid.toFixed(2),
         loan.interestRepaid.toFixed(2),
         loan.outstanding.toFixed(2),
         loan.daysPastDue,
         loan.restructured && loan.status !== 'Closed' ? 'Restructured' : loan.status,
         loan.rationale ?? ''
      ])
   ];
}
