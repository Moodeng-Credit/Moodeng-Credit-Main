// Excel download for the lender page: the monthly report's tabs (Summary, Loans (Schedule B), Repayments,
// Daily interest), built from the live numbers. exceljs is loaded only when someone taps
// Download, so it never weighs on the rest of the app.

import type { LenderReportData, PeriodReport } from '@/lib/creditLineReport';

const USD = '$#,##0.00;($#,##0.00);-';
const PCT = '0.0%';
const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF4A35C9' } };

export async function downloadCreditLineExcel(data: LenderReportData, report: PeriodReport) {
   const { default: ExcelJS } = await import('exceljs');
   const wb = new ExcelJS.Workbook();
   wb.creator = 'Moodeng Credit';
   wb.created = new Date();
   const font = { name: 'Arial', size: 10 };
   const headerRow = (ws: import('exceljs').Worksheet, values: string[]) => {
      const row = ws.addRow(values);
      row.eachCell((cell) => {
         cell.font = { ...font, bold: true, color: { argb: 'FFFFFFFF' } };
         cell.fill = HEADER_FILL;
         cell.alignment = { wrapText: true, vertical: 'middle' };
      });
   };
   const title = (ws: import('exceljs').Worksheet, text: string, note?: string) => {
      ws.addRow([text]).font = { name: 'Arial', size: 14, bold: true };
      if (note) ws.addRow([note]).font = { ...font, italic: true };
      ws.addRow([]);
   };
   const f = data.facility;
   const m = report.medians;

   // ---- Summary
   const s = wb.addWorksheet('Summary');
   s.columns = [{ width: 44 }, { width: 62 }];
   title(s, `${f.name} — monthly report`);
   const line = (label: string, value: unknown, numFmt?: string) => {
      const row = s.addRow([label, value]);
      row.font = font;
      if (numFmt) row.getCell(2).numFmt = numFmt;
      row.getCell(2).alignment = { horizontal: 'left', wrapText: true };
   };
   const section = (label: string) => {
      s.addRow([]);
      s.addRow([label]).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF4A35C9' } };
   };
   line('Lender', f.lender_name);
   line('Report period', `${report.period.start} to ${report.period.end}`);
   line('As of', report.asOf);
   line('Report due', report.period.due);
   section('Terms');
   line('Commitment ($)', Number(f.commitment_usd), USD);
   line('Interest rate (simple, per year)', Number(f.annual_rate), PCT);
   line('Interest basis', 'Actual/365, only on funds deployed in loans; none on unused funds. Paid monthly.');
   section('Balances');
   line('Advanced by lender ($)', report.advanced, USD);
   line('Principal lent to borrowers ($)', report.lent, USD);
   line('Principal repaid by borrowers ($)', report.principalRepaid, USD);
   line('Principal deployed (outstanding) ($)', report.deployed, USD);
   line('Available to deploy ($)', report.available, USD);
   line('Utilisation of the commitment', report.utilization, PCT);
   section('Interest owed to the lender');
   line('Accrued this period so far ($)', report.interestAccrued, '$#,##0.00');
   line('Projected for the full period ($)', report.interestProjected, '$#,##0.00');
   section('Loan activity');
   line('Loans funded', report.counts.funded);
   line('Active', report.counts.active);
   line('Repaid', report.counts.repaid);
   line('Overdue', report.counts.overdue);
   line('Median loan ($)', m.loan, USD);
   line('Median term (days)', m.term);
   line('Median borrower fee, all loans (flat, per loan)', m.fee, PCT);
   line('Median loan, standard pricing only ($)', m.loanStandard, USD);
   line('Median term, standard pricing only (days)', m.termStandard);
   line('Typical borrower fee (flat fee per loan, standard pricing)', m.feeStandard, PCT);
   line('What the fee means', 'A one-time flat fee on each loan for its whole term (usually 30 days), e.g. $2 on a $15 loan. Not a monthly or annual rate.');
   line('Borrower fees collected ($)', report.feesCollected, USD);
   s.addRow([]);
   s.addRow(['Medians are used because a few larger loans and restructures (0% bridge) skew averages. Standard pricing excludes restructures. Amounts in USDC (1 USDC = $1). Dates are Philippine time.']).font = { ...font, italic: true, size: 9 };

   // ---- Loans (Schedule B)
   const l = wb.addWorksheet('Loans (Schedule B)');
   title(l, 'Schedule B — loans funded from the facility', 'Borrower identity: Moodeng username and private reference; full KYC records are held by Moodeng.');
   headerRow(l, [
      '#', 'Loan ID', 'Borrower ref', 'Username', 'Funded', 'Due', 'Term (days)', 'Principal ($)', 'Total due ($)', 'Flat fee (% of loan, whole term)',
      'Repaid on', 'Outstanding ($)', 'Status', 'Pricing', 'KYC', 'KYC date', 'Liveness', 'Facebook verified', 'Video call',
      'Borrower wallet', 'Disbursement tx', 'Repayment tx', 'Approval rationale'
   ]);
   report.loans.forEach((loan, i) => {
      const outstanding = loan.repaidDate && loan.repaidDate <= report.asOf ? 0 : Number(loan.loan_amount);
      const status = outstanding === 0 ? 'Repaid' : loan.dueDate && loan.dueDate < report.asOf ? 'Overdue' : 'Active';
      const row = l.addRow([
         i + 1, loan.tracking_id, loan.privateId, loan.borrower.username ?? '', loan.fundedDate, loan.dueDate ?? '', loan.termDays ?? '',
         Number(loan.loan_amount), Number(loan.total_repayment_amount), loan.impliedCost, loan.repaidDate ?? '', outstanding, status,
         loan.restructured ? 'Restructure (0%)' : 'Standard',
         loan.borrower.kyc_passed ? `Verified${loan.kycProvider ? ` (${loan.kycProvider})` : ''}` : 'Not verified',
         loan.kycDate ?? '', loan.borrower.liveness ? 'Yes' : '—', loan.borrower.facebook_verified ? 'Yes' : 'No',
         loan.borrower.video_call_attended ? 'Attended' : '—', loan.borrowerWallet ?? '', loan.disbursementTxs.join(' '),
         loan.repaymentTxs.join(' '), loan.rationale ?? ''
      ]);
      row.font = font;
      row.alignment = { vertical: 'top', wrapText: true };
      [8, 9, 12].forEach((c) => (row.getCell(c).numFmt = USD));
      row.getCell(10).numFmt = PCT;
   });
   l.columns.forEach((col, i) => (col.width = [4, 30, 10, 26, 11, 11, 8, 11, 11, 8, 11, 12, 10, 16, 18, 11, 9, 10, 10, 44, 44, 44, 70][i] ?? 12));

   // ---- Repayments
   const r = wb.addWorksheet('Repayments');
   title(r, 'Repayments received this period');
   headerRow(r, ['Repaid on', 'Loan ID', 'Borrower ref', 'Principal returned ($)', 'Fee ($)', 'Repayment tx']);
   report.repaid.forEach((loan) => {
      const row = r.addRow([loan.repaidDate, loan.tracking_id, loan.privateId, loan.principalRepaid, loan.interestRepaid, loan.repaymentTxs.join(' ')]);
      row.font = font;
      [4, 5].forEach((c) => (row.getCell(c).numFmt = USD));
   });
   r.columns.forEach((col, i) => (col.width = [12, 30, 12, 18, 10, 70][i]));

   // ---- Daily interest
   const d = wb.addWorksheet('Daily interest');
   title(d, `Interest owed — ${(Number(f.annual_rate) * 100).toFixed(0)}% simple, actual/365, on principal deployed each day`);
   headerRow(d, ['Date', 'Deployed principal ($)', 'Interest for the day ($)', 'Actual / projected']);
   report.daily.forEach((day) => {
      const row = d.addRow([day.date, day.deployed, day.interest, day.projected ? 'Projected' : 'Actual']);
      row.font = font;
      row.getCell(2).numFmt = USD;
      row.getCell(3).numFmt = '$#,##0.0000';
   });
   const total = d.addRow(['Period total', '', report.interestProjected, '']);
   total.font = { ...font, bold: true };
   total.getCell(3).numFmt = '$#,##0.00';
   d.columns.forEach((col, i) => (col.width = [13, 20, 20, 16][i]));

   const buffer = await wb.xlsx.writeBuffer();
   const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = `${f.name.replace(/\s+/g, '_')}_report_${report.period.start}_to_${report.period.end}.xlsx`;
   a.click();
   URL.revokeObjectURL(url);
}
