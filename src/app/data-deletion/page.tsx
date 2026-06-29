import { Link } from 'react-router-dom';

const sections = [
   {
      title: 'Overview',
      content: (
         <>
            <p className="text-base leading-6 tracking-[-0.02em] text-[#4D4359]">
               Moodeng Credit ("Moodeng", "we", "our", or "us") lets you request deletion of the personal
               information associated with your account, including data obtained when you sign in with a
               third-party provider such as Facebook, Google, LINE, or Telegram.
            </p>
            <p className="text-base leading-6 tracking-[-0.02em] text-[#4D4359]">
               This page explains how to submit a deletion request and what to expect after you do.
            </p>
         </>
      )
   },
   {
      title: 'How to request deletion',
      content: (
         <>
            <p className="text-base leading-6 tracking-[-0.02em] text-[#4D4359]">
               Email{' '}
               <a href="mailto:privacy@moodeng.credit" className="text-[#6010D2] hover:underline">
                  privacy@moodeng.credit
               </a>{' '}
               from the email address on your account, with the subject line{' '}
               <span className="font-semibold text-[#040033]">"Data deletion request"</span>. To help us locate
               your records, please include:
            </p>
            <ul className="flex flex-col gap-1">
               {[
                  'The email address or wallet address associated with your account',
                  'The login method you used (Facebook, Google, LINE, Telegram, or email)',
                  'Confirmation that you want your personal data deleted'
               ].map(item => (
                  <li
                     key={item}
                     className="relative pl-4 text-base leading-6 tracking-[-0.02em] text-[#4D4359] before:absolute before:left-1 before:font-bold before:text-[#914cf2] before:content-['·']"
                  >
                     {item}
                  </li>
               ))}
            </ul>
            <p className="text-base leading-6 tracking-[-0.02em] text-[#4D4359]">
               We will confirm receipt and verify your identity before processing the request.
            </p>
         </>
      )
   },
   {
      title: 'What gets deleted',
      content: (
         <p className="text-base leading-6 tracking-[-0.02em] text-[#4D4359]">
            We delete the personal information we hold about you, including your profile, contact details, and
            the identifiers received from your login provider. We aim to complete verified requests within 30
            days.
         </p>
      )
   },
   {
      title: 'What we may retain',
      highlight: true,
      content: (
         <>
            <p className="text-base leading-6 tracking-[-0.02em] text-[#250650]">
               Some information may be retained where we are legally required or permitted to keep it — for
               example, to comply with financial, anti-fraud, anti-money-laundering, tax, or recordkeeping
               obligations, or to resolve disputes and enforce agreements.
            </p>
            <p className="text-base leading-6 tracking-[-0.02em] text-[#250650]">
               In addition, certain repayment history, trust metrics, and transaction records may have been
               recorded on public blockchain networks. Blockchain records are publicly visible and generally
               cannot be modified or deleted after publication.
            </p>
         </>
      )
   },
   {
      title: 'Contact',
      content: (
         <p className="text-base leading-6 tracking-[-0.02em] text-[#4D4359]">
            Data deletion and privacy requests:{' '}
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

export default function DataDeletionPage() {
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
                  <h1 className="text-[34px] font-semibold leading-[1.2] tracking-[-0.04em]">
                     Data Deletion Instructions
                  </h1>
                  <p className="max-w-2xl text-base leading-6 tracking-[-0.02em] text-[#4D4359]">
                     The short version: email{' '}
                     <a href="mailto:privacy@moodeng.credit" className="text-[#6010D2] hover:underline">
                        privacy@moodeng.credit
                     </a>{' '}
                     and we'll delete the personal data tied to your account, subject to legal retention
                     requirements.
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
                     <h2
                        className={`text-lg font-semibold leading-tight tracking-[-0.04em] ${section.highlight ? 'text-[#250650]' : 'text-[#040033]'}`}
                     >
                        {section.title}
                     </h2>
                     {section.content}
                  </div>
               ))}
            </div>

            {/* Bottom CTA */}
            <div className="flex flex-col gap-3 rounded-[16px] border border-[#D6BCFA] bg-[#F1E9FD] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
               <p className="text-sm leading-5 tracking-[-0.02em] text-[#250650]">Looking for our Privacy Policy?</p>
               <Link
                  to="/privacy-policy"
                  className="text-sm font-semibold tracking-[-0.02em] text-[#6010D2] hover:underline"
               >
                  View Privacy Policy →
               </Link>
            </div>
         </section>
      </main>
   );
}
