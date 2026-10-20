import { Fragment } from 'react';
import { Link } from 'react-router-dom';

import { usePageSeo } from '@/hooks/usePageSeo';
import {
   LEGAL_LAST_UPDATED,
   type LegalSection,
   privacySections,
   SUPPORT_EMAIL,
   termsSections
} from '@/views/legal/legalContent';

type LegalPageProps = {
   type: 'terms' | 'privacy';
};

const textClass = 'text-base leading-6 tracking-[-0.02em] text-[#4D4359]';

// Turns the support email inside the copy into a mailto link.
function withEmailLinks(text: string) {
   const parts = text.split(SUPPORT_EMAIL);
   return parts.map((part, i) => (
      // eslint-disable-next-line react/no-array-index-key -- static split of fixed copy
      <Fragment key={i}>
         {part}
         {i < parts.length - 1 ? (
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#6010D2] hover:underline">
               {SUPPORT_EMAIL}
            </a>
         ) : null}
      </Fragment>
   ));
}

function SectionBody({ section }: { section: LegalSection }) {
   return (
      <>
         {section.paragraphs?.map(p => (
            <p key={p} className={textClass}>
               {withEmailLinks(p)}
            </p>
         ))}
         {section.bullets ? (
            <ul className="flex flex-col gap-1">
               {section.bullets.map(item => (
                  <li
                     key={item}
                     className={`${textClass} relative pl-4 before:absolute before:left-1 before:font-bold before:text-[#914cf2] before:content-['·']`}
                  >
                     {withEmailLinks(item)}
                  </li>
               ))}
            </ul>
         ) : null}
         {section.after?.map(p => (
            <p key={p} className={textClass}>
               {withEmailLinks(p)}
            </p>
         ))}
      </>
   );
}

export default function LegalPage({ type }: LegalPageProps) {
   const isTerms = type === 'terms';
   const title = isTerms ? 'Terms of Service' : 'Privacy Policy';
   const eyebrow = isTerms ? 'Terms' : 'Privacy';
   const intro = isTerms
      ? 'These Terms explain the rules for using Moodeng Credit: who can use it, how borrowing and lending work, your responsibilities, and ours.'
      : 'This Privacy Policy explains what information Moodeng Credit collects, including from sign-in providers like TikTok, how we use and share it, how long we keep it, and your rights.';
   const sections = isTerms ? termsSections : privacySections;
   const alternateHref = isTerms ? '/privacy-policy' : '/terms';
   const alternateLabel = isTerms ? 'Privacy Policy' : 'Terms of Service';

   usePageSeo({
      title: isTerms ? 'Terms of Service | Moodeng Credit' : 'Privacy Policy | Moodeng Credit',
      description: isTerms
         ? 'The Moodeng Credit Terms of Service: eligibility, accounts, borrowing, lending, wallets, acceptable use, liability, and governing law.'
         : 'The Moodeng Credit Privacy Policy: what we collect (including TikTok and other sign-ins), how we use and share it, retention, and your rights.',
      canonicalPath: isTerms ? '/terms' : '/privacy-policy'
   });

   return (
      <main className="min-h-screen bg-[#F9F8FA] px-4 py-8 text-[#040033] sm:px-6 sm:py-12">
         <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
            <div className="flex flex-col gap-4">
               <Link to="/" className="w-fit text-sm font-semibold tracking-[-0.02em] text-[#8336F0] hover:underline">
                  ← Back to Moodeng Credit
               </Link>
               <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#70617F]">{eyebrow}</p>
                  <h1 className="text-[34px] font-semibold leading-[1.2] tracking-[-0.04em]">{title}</h1>
                  <p className={`max-w-2xl ${textClass}`}>{intro}</p>
                  <p className="text-sm leading-5 tracking-[-0.02em] text-[#70617F]">
                     Last updated: {LEGAL_LAST_UPDATED}
                  </p>
               </div>
            </div>

            <nav
               aria-label="Contents"
               className="rounded-[16px] border border-[#F2F0F5] bg-[#FDFBFD] px-5 py-4 sm:px-6"
            >
               <p className="mb-2 text-sm font-semibold tracking-[-0.02em]">Contents</p>
               <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  {sections.map((section, index) => (
                     <li key={section.title}>
                        <a
                           href={`#section-${index + 1}`}
                           className="text-sm leading-5 tracking-[-0.02em] text-[#6010D2] hover:underline"
                        >
                           {index + 1}. {section.title}
                        </a>
                     </li>
                  ))}
               </ol>
            </nav>

            <div className="flex flex-col overflow-hidden rounded-[20px] border border-[#F2F0F5] bg-[#FDFBFD] shadow-[0px_2px_4px_rgba(27,28,29,0.04)]">
               {sections.map((section, index) => (
                  <section
                     key={section.title}
                     id={`section-${index + 1}`}
                     className={`flex scroll-mt-4 flex-col gap-2 px-5 py-5 sm:px-6 ${
                        index > 0 ? 'border-t border-[#F2F0F5]' : ''
                     }`}
                  >
                     <h2 className="text-lg font-semibold leading-tight tracking-[-0.04em]">
                        {index + 1}. {section.title}
                     </h2>
                     <SectionBody section={section} />
                  </section>
               ))}
            </div>

            <div className="flex flex-col gap-3 rounded-[16px] border border-[#D6BCFA] bg-[#F1E9FD] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
               <p className="text-sm leading-5 tracking-[-0.02em] text-[#250650]">Need the other document?</p>
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
