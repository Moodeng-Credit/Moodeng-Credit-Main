import LoanNotePurchase from '@/views/lender/loanNote/LoanNotePurchase';

// Lender Loan Note purchase page. Reached by direct link (e.g. from Telegram), not in
// the main nav. Route: /lend/loan/:loanId
export default function LendLoanPage() {
   return <LoanNotePurchase />;
}
