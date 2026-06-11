import SupportedLoans from '@/views/lender/supported/SupportedLoans';

// "My Supported Loans" — logged-in lenders view the Loan Notes they own. Not in the
// main nav yet; reachable from the purchase success screen and direct link.
export default function LenderSupportedPage() {
   return <SupportedLoans />;
}
