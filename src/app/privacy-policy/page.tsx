import { Link } from 'react-router-dom';

const sections = [
   {
      title: 'Introduction',
      content: (
         <>
            <p className="text-base leading-6 tracking-[-0.02em] text-[#4D4359]">
               Moodeng Credit ("Moodeng", "we", "our", or "us") respects your privacy and is committed to
               protecting your personal information. This Privacy Policy explains how we collect, use, store,
               share, and protect information when you use the Moodeng Credit platform — including our website,
               mobile applications, lending marketplace, identity verification services, and related products.
            </p>
            <p className="text-base leading-6 tracking-[-0.02em] text-[#4D4359]">
               By using Moodeng Credit, you consent to the collection and processing of information described
               in this Privacy Policy.
            </p>
         </>
      )
   },
   {
      title: 'Information we collect',
      content: (
         <>
            <p className="text-sm font-semibold tracking-[-0.02em] text-[#040033]">Information you provide</p>
            <ul className="flex flex-col gap-1">
               {[
                  'Full name, email address, phone number, and date of birth',
                  'Government-issued identification information',
                  'Wallet addresses and account credentials',
                  'Profile information, loan applications, and borrower context',
                  'Communications with support'
               ].map(item => (
                  <li key={item} className="pl-4 text-base leading-6 tracking-[-0.02em] text-[#4D4359] relative before:absolute before:left-1 before:content-['·'] before:text-[#914cf2] before:font-bold">{item}</li>
               ))}
            </ul>
            <p className="text-sm font-semibold tracking-[-0.02em] text-[#040033] mt-2">Identity verification</p>
            <ul className="flex flex-col gap-1">
               {[
                  'Government ID documents and selfie verification images',
                  'Biometric verification results and identity verification records',
                  'AML and sanctions screening results'
               ].map(item => (
                  <li key={item} className="pl-4 text-base leading-6 tracking-[-0.02em] text-[#4D4359] relative before:absolute before:left-1 before:content-['·'] before:text-[#914cf2] before:font-bold">{item}</li>
               ))}
            </ul>
            <p className="text-sm font-semibold tracking-[-0.02em] text-[#040033] mt-2">Financial information</p>
            <ul className="flex flex-col gap-1">
               {[
                  'Bank account information and Plaid-connected account data',
                  'Transaction history, income information, and repayment history',
                  'Loan performance data and credit-related information'
               ].map(item => (
                  <li key={item} className="pl-4 text-base leading-6 tracking-[-0.02em] text-[#4D4359] relative before:absolute before:left-1 before:content-['·'] before:text-[#914cf2] before:font-bold">{item}</li>
               ))}
            </ul>
            <p className="text-sm font-semibold tracking-[-0.02em] text-[#040033] mt-2">Technical information</p>
            <ul className="flex flex-col gap-1">
               {[
                  'IP address, device and browser information, operating system',
                  'Log files, session activity, and security monitoring data'
               ].map(item => (
                  <li key={item} className="pl-4 text-base leading-6 tracking-[-0.02em] text-[#4D4359] relative before:absolute before:left-1 before:content-['·'] before:text-[#914cf2] before:font-bold">{item}</li>
               ))}
            </ul>
         </>
      )
   },
   {
      title: 'How we use information',
      content: (
         <ul className="flex flex-col gap-1">
            {[
               'Verify identity and prevent fraud',
               'Assess borrower eligibility and calculate trust and repayment scores',
               'Facilitate peer-to-peer lending and process transactions',
               'Monitor platform security and comply with legal obligations',
               'Improve our products and provide customer support'
            ].map(item => (
               <li key={item} className="pl-4 text-base leading-6 tracking-[-0.02em] text-[#4D4359] relative before:absolute before:left-1 before:content-['·'] before:text-[#914cf2] before:font-bold">{item}</li>
            ))}
         </ul>
      )
   },
   {
      title: 'Plaid data',
      highlight: true,
      content: (
         <>
            <p className="text-base leading-6 tracking-[-0.02em] text-[#250650]">
               If you connect a financial account using Plaid, we may receive account ownership information,
               balances, transaction history, and account verification data.
            </p>
            <p className="text-base leading-6 tracking-[-0.02em] text-[#250650]">
               We use Plaid data solely for purposes disclosed to you and permitted by applicable law and our
               agreements with Plaid. You may disconnect connected accounts at any time, subject to applicable
               retention requirements.
            </p>
         </>
      )
   },
   {
      title: 'How we share information',
      content: (
         <>
            <p className="text-base leading-6 tracking-[-0.02em] text-[#4D4359]">We do not sell personal information.</p>
            <ul className="flex flex-col gap-1">
               {[
                  'Identity verification and AML screening providers',
                  'Banking and payment partners',
                  'Cloud infrastructure providers',
                  'Legal and regulatory authorities when required by law',
                  'Service providers acting on our behalf under appropriate agreements'
               ].map(item => (
                  <li key={item} className="pl-4 text-base leading-6 tracking-[-0.02em] text-[#4D4359] relative before:absolute before:left-1 before:content-['·'] before:text-[#914cf2] before:font-bold">{item}</li>
               ))}
            </ul>
         </>
      )
   },
   {
      title: 'Blockchain and public records',
      content: (
         <p className="text-base leading-6 tracking-[-0.02em] text-[#4D4359]">
            Certain repayment history, trust metrics, wallet activity, and transaction records may be recorded
            on public blockchain networks. Blockchain records may be publicly visible and cannot generally be
            modified or deleted after publication. Please understand the permanent nature of blockchain
            transactions before using the platform.
         </p>
      )
   },
   {
      title: 'Data retention',
      content: (
         <p className="text-base leading-6 tracking-[-0.02em] text-[#4D4359]">
            We retain information only as long as reasonably necessary to operate the platform, maintain
            security, prevent fraud, comply with legal obligations, resolve disputes, and enforce agreements.
            Retention periods may vary by jurisdiction.
         </p>
      )
   },
   {
      title: 'Data security',
      content: (
         <p className="text-base leading-6 tracking-[-0.02em] text-[#4D4359]">
            We implement reasonable administrative, technical, and physical safeguards including TLS encryption
            in transit, encryption at rest, access controls, role-based permissions, security monitoring, and
            incident response procedures. No method of storage or transmission is completely secure.
         </p>
      )
   },
   {
      title: 'Your rights',
      content: (
         <>
            <ul className="flex flex-col gap-1">
               {[
                  'Access, correct, or delete your information',
                  'Restrict or object to certain processing activities',
                  'Receive a portable copy of your data'
               ].map(item => (
                  <li key={item} className="pl-4 text-base leading-6 tracking-[-0.02em] text-[#4D4359] relative before:absolute before:left-1 before:content-['·'] before:text-[#914cf2] before:font-bold">{item}</li>
               ))}
            </ul>
            <p className="text-base leading-6 tracking-[-0.02em] text-[#4D4359]">
               Submit requests to{' '}
               <a href="mailto:privacy@moodeng.credit" className="text-[#6010D2] hover:underline">
                  privacy@moodeng.credit
               </a>
               .
            </p>
         </>
      )
   },
   {
      title: 'International transfers',
      content: (
         <p className="text-base leading-6 tracking-[-0.02em] text-[#4D4359]">
            Information may be processed and stored in countries different from your country of residence.
            Where required, we implement safeguards to protect personal information during cross-border
            transfers.
         </p>
      )
   },
   {
      title: "Children's privacy",
      content: (
         <p className="text-base leading-6 tracking-[-0.02em] text-[#4D4359]">
            Moodeng Credit is not intended for individuals under the age of 18. We do not knowingly collect
            information from minors.
         </p>
      )
   },
   {
      title: 'Changes to this policy',
      content: (
         <p className="text-base leading-6 tracking-[-0.02em] text-[#4D4359]">
            We may update this Privacy Policy from time to time. Material changes will be communicated through
            the platform or by other appropriate means.
         </p>
      )
   },
   {
      title: 'Contact',
      content: (
         <p className="text-base leading-6 tracking-[-0.02em] text-[#4D4359]">
            Privacy requests:{' '}
            <a href="mailto:privacy@moodeng.credit" className="text-[#6010D2] hover:underline">
               privacy@moodeng.credit
            </a>
            <br />
            General support:{' '}
            <a href="mailto:support@moodeng.credit" className="text-[#6010D2] hover:underline">
               support@moodeng.credit
            </a>
         </p>
      )
   }
];

export default function PrivacyPolicyPage() {
   return (
      <main className="min-h-screen bg-[#F9F8FA] px-4 py-8 text-[#040033] sm:px-6 sm:py-12">
         <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
            {/* Header */}
            <div className="flex flex-col gap-4">
               <Link
                  to="/"
                  className="w-fit text-sm font-semibold tracking-[-0.02em] text-[#8336F0] hover:underline"
               >
                  ← Back to Moodeng Credit
               </Link>
               <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#70617F]">Privacy</p>
                  <h1 className="text-[34px] font-semibold leading-[1.2] tracking-[-0.04em]">Privacy Policy</h1>
                  <p className="max-w-2xl text-base leading-6 tracking-[-0.02em] text-[#4D4359]">
                     The short version: Moodeng uses account, wallet, repayment, and financial information to
                     run the platform, prevent fraud, and make borrower history useful to lenders.
                  </p>
                  <p className="text-sm leading-5 tracking-[-0.02em] text-[#70617F]">Last updated: June 2026</p>
               </div>
            </div>

            {/* Sections card */}
            <div className="flex flex-col overflow-hidden rounded-[20px] border border-[#F2F0F5] bg-[#FDFBFD] shadow-[0px_2px_4px_rgba(27,28,29,0.04)]">
               {sections.map((section, index) => (
                  <div
                     key={section.title}
                     className={`flex flex-col gap-2 px-5 py-5 sm:px-6 ${index > 0 ? 'border-t border-[#F2F0F5]' : ''} ${section.highlight ? 'bg-[#F1E9FD]' : ''}`}
                  >
                     <h2 className={`text-lg font-semibold leading-tight tracking-[-0.04em] ${section.highlight ? 'text-[#250650]' : 'text-[#040033]'}`}>
                        {section.title}
                     </h2>
                     {section.content}
                  </div>
               ))}
            </div>

            {/* Bottom CTA */}
            <div className="flex flex-col gap-3 rounded-[16px] border border-[#D6BCFA] bg-[#F1E9FD] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
               <p className="text-sm leading-5 tracking-[-0.02em] text-[#250650]">
                  Need our Terms of Service?
               </p>
               <Link
                  to="/terms"
                  className="text-sm font-semibold tracking-[-0.02em] text-[#6010D2] hover:underline"
               >
                  View Terms of Service →
               </Link>
            </div>
         </section>
      </main>
   );
}
