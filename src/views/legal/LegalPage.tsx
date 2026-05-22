import { Link } from 'react-router-dom';

type LegalPageProps = {
   type: 'terms' | 'privacy';
};

const termsSections = [
   {
      title: 'Using Moodeng',
      body: 'Moodeng Credit helps borrowers request small USDC loans and helps lenders review those requests. You are responsible for the information you submit, the wallet you connect, and the loan terms you accept.'
   },
   {
      title: 'Loan requests and repayment',
      body: 'Borrowers choose the requested amount, repayment timing, and context before submitting a request. Funded loan terms should be reviewed before accepting funds. Repayment records may be used to show account history and trust signals inside Moodeng.'
   },
   {
      title: 'Wallets and transactions',
      body: 'Onchain transactions are controlled through your connected wallet. Moodeng cannot reverse blockchain transactions, recover a lost wallet, or guarantee a lender will fund a request.'
   },
   {
      title: 'Account safety',
      body: 'Do not use Moodeng to misrepresent your identity, submit false borrower context, evade restrictions, or interfere with another user. We may limit access when account activity creates risk for borrowers, lenders, or the platform.'
   },
   {
      title: 'Updates',
      body: 'These terms may change as Moodeng evolves. Continued use of the product means you accept the latest version shown here.'
   }
];

const privacySections = [
   {
      title: 'What we collect',
      body: 'Moodeng may collect account details such as your email, display name, role, wallet address, borrower context, loan requests, repayment records, support messages, and basic product analytics.'
   },
   {
      title: 'How we use information',
      body: 'We use this information to create accounts, show loan requests, support repayment, help lenders evaluate requests, prevent abuse, improve the product, and communicate important account updates.'
   },
   {
      title: 'Wallet and onchain data',
      body: 'Wallet addresses and blockchain transactions may be public by nature. Moodeng uses wallet data to connect actions to your account, but it cannot make public blockchain activity private.'
   },
   {
      title: 'What we do not do',
      body: 'Moodeng is designed around clear borrower records, not contact-list pressure. We do not need your phone contacts to make repayment history useful inside the product.'
   },
   {
      title: 'Your choices',
      body: 'You can choose what borrower context to submit, manage your account details where the product allows it, and contact support about account or privacy questions.'
   }
];

export default function LegalPage({ type }: LegalPageProps) {
   const isTerms = type === 'terms';
   const title = isTerms ? 'Terms of Service' : 'Privacy Policy';
   const eyebrow = isTerms ? 'Terms' : 'Privacy';
   const intro = isTerms
      ? 'The short version: use Moodeng honestly, review loan terms before accepting funds, and keep your wallet secure.'
      : 'The short version: Moodeng uses account, wallet, and repayment information to run the product, reduce abuse, and make borrower history useful.';
   const sections = isTerms ? termsSections : privacySections;
   const alternateHref = isTerms ? '/privacy' : '/terms';
   const alternateLabel = isTerms ? 'Privacy Policy' : 'Terms of Service';

   return (
      <main className="min-h-screen bg-[#F9F8FA] px-4 py-8 text-[#040033] sm:px-6 sm:py-12">
         <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
            <div className="flex flex-col gap-4">
               <Link
                  to="/sign-up"
                  className="w-fit text-sm font-semibold tracking-[-0.02em] text-[#8336F0] hover:underline"
               >
                  Back to sign up
               </Link>
               <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#70617F]">{eyebrow}</p>
                  <h1 className="text-[34px] font-semibold leading-[1.2] tracking-[-0.04em]">{title}</h1>
                  <p className="max-w-2xl text-base leading-6 tracking-[-0.02em] text-[#4D4359]">{intro}</p>
                  <p className="text-sm leading-5 tracking-[-0.02em] text-[#70617F]">Last updated: May 2026</p>
               </div>
            </div>

            <div className="flex flex-col overflow-hidden rounded-[20px] border border-[#F2F0F5] bg-[#FDFBFD] shadow-[0px_2px_4px_rgba(27,28,29,0.04)]">
               {sections.map((section, index) => (
                  <section
                     key={section.title}
                     className={`flex flex-col gap-2 px-5 py-5 sm:px-6 ${
                        index > 0 ? 'border-t border-[#F2F0F5]' : ''
                     }`}
                  >
                     <h2 className="text-lg font-semibold leading-tight tracking-[-0.04em]">{section.title}</h2>
                     <p className="text-base leading-6 tracking-[-0.02em] text-[#4D4359]">{section.body}</p>
                  </section>
               ))}
            </div>

            <div className="flex flex-col gap-3 rounded-[16px] border border-[#D6BCFA] bg-[#F1E9FD] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
               <p className="text-sm leading-5 tracking-[-0.02em] text-[#250650]">
                  Need the other document?
               </p>
               <Link
                  to={alternateHref}
                  className="text-sm font-semibold tracking-[-0.02em] text-[#6010D2] hover:underline"
               >
                  View {alternateLabel}
               </Link>
            </div>
         </section>
      </main>
   );
}
