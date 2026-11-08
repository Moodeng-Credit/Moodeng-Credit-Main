import type { IncomeDocOutcome } from '@/lib/incomeDocOutcomes';

import type { AdminIncomeDocument } from './adminSupabase';
import IncomeDocsSection from './IncomeDocsSection';

// DEV-only screenshot harness for Admin → Income docs: made-up sends (no real borrowers) showing the
// two labels and the outcome scorecard. Never registered in production.
const STEP60 = { min: 60, months: 2, fresh: false, autoApprove: false, maxShare: 0.5, liveCall: true };

const section = (key: string, label: string, status: 'pass' | 'warn' | 'fail' | 'skip', notes: string[] = []) => ({
   key,
   label,
   status,
   notes
});

const base = (id: string, name: string): Omit<AdminIncomeDocument, 'checks' | 'memo'> => ({
   id,
   files: [{ path: `${id}/1.png`, name: 'history-1.png', mime: 'image/png' }],
   note: null,
   status: 'done',
   doc_type: 'gcash_history',
   risk: 'orange',
   score: 70,
   ai_note: null,
   flags: [],
   extracted: { currency: 'PHP', transactions: [] },
   error: null,
   created_at: '2026-11-06T03:15:00Z',
   decision: null,
   decision_reason: null,
   decided_at: null,
   decided_by: null,
   notified_at: null,
   requested_amount: 60,
   tier: STEP60,
   verdict: 'needs_review',
   resend_reason: null,
   authenticity: 'real',
   affordability: 'tight',
   afford_share: 0.38,
   user: { id: `u-${id}`, username: null, display_name: name, monthly_income: null }
});

const DOCS: AdminIncomeDocument[] = [
   {
      ...base('p1', 'Sample VA (Payoneer)'),
      checks: [
         section('readable', 'Readable', 'pass', ['42 rows read']),
         section('authentic', 'Not edited', 'pass'),
         section('not_ai', 'Not AI-made', 'pass'),
         section('identity', 'Name matches ID', 'pass'),
         section('unique', 'Not used by another account', 'pass'),
         section('recent', 'Recent, with enough history', 'pass'),
         section('income', 'Earned income every month', 'pass', ['14% of money in (3000) came from loan apps — not counted as income.']),
         section('afford', 'Can afford the repayment', 'pass', [
            'Pays about 1200/month to other loan apps — taken off their income in the affordability check.'
         ])
      ],
      memo: 'gcash history (GCash) for Sample VA · 2026-08-01 → 2026-10-31\n42 transactions over ~3 months: PHP 11,900/month in, PHP 10,400/month out.\nEarned income PHP 10,900/month (loans PHP 3,000, own cash-ins PHP 0 left out).\nBy month: 2026-08 PHP 13,000 · 2026-09 PHP 7,700 · 2026-10 PHP 12,000.\n🟠 Uses 2 loan apps in this period (gloan, tala).'
   },
   {
      ...base('p2', 'Sample teacher (payslip only)'),
      doc_type: 'payslip',
      requested_amount: 60,
      tier: STEP60,
      verdict: 'resend',
      resend_reason: 'need_history',
      risk: 'orange',
      affordability: 'comfortable',
      afford_share: 0.17,
      checks: [
         section('readable', 'Readable', 'pass', ['0 rows read']),
         section('authentic', 'Not edited', 'pass'),
         section('not_ai', 'Not AI-made', 'pass'),
         section('identity', 'Name matches ID', 'pass'),
         section('unique', 'Not used by another account', 'pass'),
         section('recent', 'Recent, with enough history', 'warn', [
            'Only a payslip — the $60 step needs 2+ months of GCash, Maya or bank history too.'
         ]),
         section('income', 'Earned income every month', 'pass'),
         section('afford', 'Can afford the repayment', 'pass')
      ],
      memo: 'payslip for Sample teacher · 2026-10-01 → 2026-10-15\nNet pay PHP 18,000 (gross PHP 20,000, deductions PHP 2,000).'
   },
   {
      ...base('p3', 'Sample seller'),
      risk: 'red',
      requested_amount: 80,
      authenticity: 'fake_signs',
      affordability: 'too_much',
      afford_share: 0.92,
      checks: [
         section('readable', 'Readable', 'pass', ['18 rows read']),
         section('authentic', 'Not edited', 'fail', ['Balance below zero at [T7] — a GCash or Maya wallet can’t go negative.']),
         section('not_ai', 'Not AI-made', 'pass'),
         section('identity', 'Name matches ID', 'pass'),
         section('unique', 'Not used by another account', 'pass'),
         section('recent', 'Recent, with enough history', 'pass'),
         section('income', 'Earned income every month', 'warn', ['No income in 1 of 2 whole months.']),
         section('afford', 'Can afford the repayment', 'fail', ['Repayment $90 is 92% of ~$98 a month (aim: under 50%).'])
      ],
      memo: 'gcash history (GCash) for Sample seller · 2026-09-01 → 2026-10-31\n🔴 Balance below zero at [T7] — a GCash or Maya wallet can’t go negative.'
   }
];

const outcome = (affordability: string, result: IncomeDocOutcome['outcome'], i: number): IncomeDocOutcome => ({
   doc_id: `o${i}`,
   sent_at: '2026-11-02T00:00:00Z',
   authenticity: 'real',
   affordability,
   score: null,
   verdict: 'looks_good',
   decision: 'approved',
   loan_amount: 40,
   due_date: '2026-12-05T00:00:00Z',
   outcome: result,
   days_late: 0
});

const OUTCOMES: IncomeDocOutcome[] = [
   outcome('comfortable', 'on_time', 1),
   outcome('comfortable', 'on_time', 2),
   outcome('comfortable', 'not_due', 3),
   outcome('tight', 'on_time', 4),
   outcome('tight', 'late', 5),
   outcome('too_much', 'not_due', 6)
];

export default function IncomeDocsPreview() {
   return (
      <div className="min-h-screen bg-[#100523] p-6 text-white">
         <div className="mx-auto max-w-5xl">
            <IncomeDocsSection preview={{ docs: DOCS, outcomes: OUTCOMES }} />
         </div>
      </div>
   );
}
