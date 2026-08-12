import type { AdminLoanRecord } from './adminSupabase';
import PricingHealthSection from './PricingHealthSection';

// DEV-only screenshot harness for the "Loan pricing health" admin section. The admin tables
// aren't readable on the preview route, so we feed a representative set of loans via
// `initialLoans` (which skips the live fetch). Never registered in production.
let seq = 0;
function mkLoan(
   loanAmount: number,
   totalRepaymentAmount: number,
   opts: {
      username: string;
      status: 'Requested' | 'Lent';
      createdAt?: string;
      fundedAt?: string | null;
      repaymentStatus?: AdminLoanRecord['repayment_status'];
   }
): AdminLoanRecord {
   seq += 1;
   return {
      id: `preview-${seq}`,
      tracking_id: `PV-${seq}`,
      borrower_user_id: `b-${seq}`,
      lender_user_id: opts.status === 'Lent' ? `l-${seq}` : null,
      borrower_wallet: null,
      lender_wallet: null,
      loan_amount: loanAmount,
      total_repayment_amount: totalRepaymentAmount,
      repaid_amount: opts.repaymentStatus === 'Paid' ? totalRepaymentAmount : null,
      due_date: '2026-09-01T00:00:00.000Z',
      reason: 'Preview loan',
      coin: 'USDC',
      loan_status: opts.status,
      repayment_status: opts.repaymentStatus ?? (opts.status === 'Lent' ? 'Unpaid' : null),
      is_test: false,
      created_at: opts.createdAt ?? '2026-07-20T09:00:00.000Z',
      funded_at: opts.fundedAt ?? null,
      borrower: {
         id: `b-${seq}`,
         username: opts.username,
         wallet_address: null,
         user_role: 'borrower',
         account_status: 'active',
         is_world_id: 'ACTIVE',
         is_didit: 'ACTIVE'
      },
      lender: null
   };
}

// A representative spread: mostly priced-in (fund fast), some underpriced (fund slow / still open),
// a couple overpaying. Sizes span the buckets so the calibration table populates.
const PREVIEW_LOANS: AdminLoanRecord[] = [
   // Priced right — fund fast
   mkLoan(15, 18, { username: 'mimitoting28', status: 'Lent', createdAt: '2026-07-20T09:00:00Z', fundedAt: '2026-07-20T14:00:00Z', repaymentStatus: 'Paid' }),
   mkLoan(50, 57, { username: 'cabantuganprincess20', status: 'Lent', createdAt: '2026-07-19T08:00:00Z', fundedAt: '2026-07-19T16:00:00Z' }),
   mkLoan(50, 58, { username: 'jollysakura19', status: 'Lent', createdAt: '2026-07-18T10:00:00Z', fundedAt: '2026-07-18T21:00:00Z', repaymentStatus: 'Paid' }),
   mkLoan(30, 35, { username: 'reyner_dev', status: 'Lent', createdAt: '2026-07-17T09:00:00Z', fundedAt: '2026-07-17T18:00:00Z' }),
   mkLoan(90, 107, { username: 'bella_santos', status: 'Lent', createdAt: '2026-07-16T09:00:00Z', fundedAt: '2026-07-16T20:00:00Z' }),
   mkLoan(70, 82, { username: 'markg_ph', status: 'Lent', createdAt: '2026-07-15T09:00:00Z', fundedAt: '2026-07-15T15:00:00Z', repaymentStatus: 'Paid' }),
   mkLoan(20, 24, { username: 'ellie_cruz', status: 'Lent', createdAt: '2026-07-14T09:00:00Z', fundedAt: '2026-07-14T13:00:00Z' }),
   // Underpriced — fund slowly or sit unfunded
   mkLoan(50, 52, { username: 'joyce_m', status: 'Lent', createdAt: '2026-07-13T09:00:00Z', fundedAt: '2026-07-16T09:00:00Z' }),
   mkLoan(15, 16, { username: 'peter_ph', status: 'Requested', createdAt: '2026-07-22T09:00:00Z' }),
   mkLoan(90, 100, { username: 'grace_l', status: 'Requested', createdAt: '2026-07-21T09:00:00Z' }),
   mkLoan(40, 43, { username: 'nathan_r', status: 'Requested', createdAt: '2026-07-21T12:00:00Z' }),
   mkLoan(100, 108, { username: 'divine_a', status: 'Requested', createdAt: '2026-07-23T09:00:00Z' }),
   // Overpaying — fund fast (but leaving money on the table)
   mkLoan(50, 65, { username: 'carlo_v', status: 'Lent', createdAt: '2026-07-12T09:00:00Z', fundedAt: '2026-07-12T11:00:00Z' }),
   mkLoan(20, 30, { username: 'trixie_dev', status: 'Lent', createdAt: '2026-07-11T09:00:00Z', fundedAt: '2026-07-11T12:00:00Z', repaymentStatus: 'Paid' })
];

export default function PricingHealthPreview() {
   return (
      <div className="min-h-screen bg-[#100523] p-6 text-white">
         <div className="mx-auto max-w-5xl">
            <PricingHealthSection initialLoans={PREVIEW_LOANS} />
         </div>
      </div>
   );
}
