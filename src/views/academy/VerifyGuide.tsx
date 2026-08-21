import type { ComponentType, ReactNode } from 'react';

import {
   ArrowLeft,
   ArrowRight,
   Camera,
   ChevronDown,
   ExternalLink,
   IdCard,
   Lock,
   ScanFace,
   ShieldCheck,
   Smartphone,
   TriangleAlert,
   Users
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { SUPPORTED_DIDIT_COUNTRIES } from '@/components/verification/CountryFlags';
import { useGoBack } from '@/hooks/useGoBack';
import { usePageSeo } from '@/hooks/usePageSeo';

import type { RootState } from '@/store/store';

const PAGE_TITLE = 'Verify your identity — Moodeng Academy';
const PAGE_DESCRIPTION =
   'Why Moodeng asks borrowers to verify their identity once, what the ID and selfie check involves, which countries are supported, and how long it takes.';

// Why the check exists at all. Kept to the two reasons the product actually
// enforces — fraud prevention and unlocking borrowing — plus what it buys lenders.
const REASONS: { Icon: ComponentType<{ className?: string; strokeWidth?: number }>; title: string; body: string }[] = [
   {
      Icon: ShieldCheck,
      title: 'Security',
      body: 'Verification makes sure every request comes from a real, unique person. That is what keeps fake and duplicate accounts away from lenders.'
   },
   {
      Icon: Lock,
      title: 'Access',
      body: 'Finishing verification is what unlocks loan requests, and it is the point where your Trust Score starts building.'
   },
   {
      Icon: Users,
      title: 'Trust',
      body: 'Lenders are funding real people, not anonymous accounts. That confidence is what gets requests on the board funded.'
   }
];

const STEPS: string[] = [
   'Tap "Verify Yourself" in the app and choose "Verify Your ID".',
   'Have your physical national ID ready and find good, even lighting.',
   'Complete the quick ID photo + selfie check — it takes about 3 minutes.',
   'Most checks finish in minutes. If yours needs a human review, we will notify you as soon as it is done — usually within a few hours, at most 1 business day.'
];

const NEED: { Icon: ComponentType<{ className?: string; strokeWidth?: number }>; label: string; hint: string }[] = [
   { Icon: IdCard, label: 'Your physical national ID', hint: 'The real card in hand, not a photocopy or a picture on another screen.' },
   { Icon: Camera, label: 'Good, even lighting', hint: 'Avoid glare and hard shadows across the card or your face.' },
   { Icon: Smartphone, label: 'Chrome or Safari', hint: 'Not the browser inside Facebook or Messenger — those can stall the check.' }
];

// Straight from the support guidance on why checks fail, so readers can pass first try.
const TIPS: string[] = [
   'Open Moodeng in Chrome or Safari. In-app browsers inside Facebook or Messenger are the most common reason a check gets stuck.',
   'Make sure the whole ID is in frame, in focus, and readable — no fingers over the text and no glare washing it out.',
   'If the check does get stuck, you can simply retry it with a clearer, well-lit photo.'
];

const FAQS: { q: string; a: string }[] = [
   {
      q: 'How long does verification take?',
      a: 'The check itself takes about 3 minutes. Most results come back within minutes. If yours needs a human review, we notify you as soon as it is done — usually within a few hours, and at most 1 business day.'
   },
   {
      q: 'Does Moodeng store a copy of my ID?',
      a: 'No. Your ID is checked by our secure verification partner and is never stored by Moodeng.'
   },
   {
      q: 'Do I have to verify again for every loan?',
      a: 'No. Verification is a one-time step. Once it is complete you can keep requesting loans without repeating it.'
   },
   {
      q: 'Which countries are supported?',
      a: `National ID verification is currently supported for ${SUPPORTED_DIDIT_COUNTRIES.map((country) => country.name).join(', ')}.`
   },
   {
      q: 'I already use World App — can I use that instead?',
      a: 'Yes. If you are already verified in World App, either in person at an Orb or with a biometric passport, you can choose "Verify with World ID" and confirm through the World App instead of doing the ID check.'
   }
];

const RELATED: { to: string; title: string; blurb: string }[] = [
   { to: '/academy/money/add-funds', title: 'Add funds to your wallet', blurb: 'Buy USDC and send it to your wallet on Base.' },
   { to: '/academy/money/withdraw', title: 'Withdraw to your bank', blurb: 'Cash out USDC to your bank or e-wallet.' },
   { to: '/academy/money/repay', title: 'Repay your loan', blurb: 'Repay on time to build your Trust Score.' }
];

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
   return (
      <section className="rounded-md-lg border border-md-neutral-400 bg-md-neutral-100 p-md-3 shadow-md-card md:p-md-4">
         <h2 className="mb-3 text-md-b3 font-semibold uppercase tracking-[0.06em] text-md-neutral-800">{title}</h2>
         {children}
      </section>
   );
}

export default function VerifyGuide() {
   const goBack = useGoBack('/academy/money');
   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);
   const isSignedIn = Boolean(user?.id && username);
   const ctaHref = isSignedIn ? (user?.userRole === 'lender' ? '/lender/dashboard' : '/dashboard') : '/sign-up';
   const ctaLabel = isSignedIn ? 'Open the app to verify' : 'Create your account';

   const canonicalPath = '/academy/money/verify';
   const canonicalUrl = `${typeof window === 'undefined' ? 'https://moodeng.app' : window.location.origin}${canonicalPath}`;

   usePageSeo({
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      canonicalPath,
      jsonLd: [
         {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'Verify your identity on Moodeng Credit',
            description: PAGE_DESCRIPTION,
            author: { '@type': 'Organization', name: 'Moodeng Credit' },
            publisher: { '@type': 'Organization', name: 'Moodeng Credit' },
            mainEntityOfPage: canonicalUrl
         },
         {
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: 'How to verify your identity on Moodeng Credit',
            totalTime: 'PT3M',
            step: STEPS.map((step, index) => ({ '@type': 'HowToStep', position: index + 1, text: step }))
         },
         {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQS.map((item) => ({
               '@type': 'Question',
               name: item.q,
               acceptedAnswer: { '@type': 'Answer', text: item.a }
            }))
         },
         {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
               { '@type': 'ListItem', position: 1, name: 'Moodeng Academy', item: `${canonicalUrl.replace(canonicalPath, '')}/academy` },
               {
                  '@type': 'ListItem',
                  position: 2,
                  name: 'Money & getting started',
                  item: `${canonicalUrl.replace(canonicalPath, '')}/academy/money`
               },
               { '@type': 'ListItem', position: 3, name: 'Verify your identity', item: canonicalUrl }
            ]
         }
      ]
   });

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="mx-auto w-full max-w-modal md:max-w-3xl">
            {/* Hero */}
            <div className="bg-md-primary-100 px-md-4 pb-md-5 pt-[max(20px,env(safe-area-inset-top))] md:rounded-md-xl md:px-md-5 md:pt-md-5">
               <button
                  type="button"
                  onClick={goBack}
                  aria-label="Go back"
                  className="mb-md-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-md-primary-300 bg-md-neutral-100 text-md-heading"
               >
                  <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
               </button>

               {/* Breadcrumb doubles as the way back for readers who landed here from search. */}
               <nav aria-label="Breadcrumb" className="text-md-b3 font-semibold uppercase tracking-[0.08em] text-md-primary-1200">
                  <Link to="/academy" className="hover:underline">
                     Moodeng Academy
                  </Link>
                  <span className="mx-1.5 text-md-primary-300" aria-hidden="true">
                     /
                  </span>
                  <Link to="/academy/money" className="hover:underline">
                     Money
                  </Link>
               </nav>

               <div className="mt-md-3 flex items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md-md bg-md-neutral-100 text-md-primary-1200">
                     <ScanFace className="h-7 w-7" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                     <h1 className="text-md-h4 font-semibold leading-tight text-md-heading md:text-md-h3">Verify your identity</h1>
                     <p className="mt-1 text-md-b2 font-medium text-md-neutral-800">One-time · about 3 minutes · free</p>
                  </div>
               </div>

               <p className="mt-md-3 max-w-2xl text-md-b2 font-normal leading-[1.6] text-md-neutral-1200 md:text-md-b1">
                  To keep Moodeng safe and fair, every borrower completes one short identity check. It keeps fake and duplicate accounts
                  out of the community, and it is what lets lenders trust the requests they fund.
               </p>
            </div>

            <div className="flex flex-col gap-md-3 px-md-4 py-md-4 md:px-md-5 md:py-md-5">
               {/* Why it matters */}
               <SectionCard title="Why verification matters">
                  <div className="grid grid-cols-1 gap-md-3 md:grid-cols-3">
                     {REASONS.map(({ Icon, title, body }) => (
                        <div key={title} className="flex flex-col gap-2">
                           <span className="flex h-10 w-10 items-center justify-center rounded-md-md bg-md-primary-100 text-md-primary-1200">
                              <Icon className="h-5 w-5" strokeWidth={2} />
                           </span>
                           <p className="text-md-b1 font-semibold text-md-heading">{title}</p>
                           <p className="text-md-b2 font-normal leading-[1.5] text-md-neutral-1200">{body}</p>
                        </div>
                     ))}
                  </div>
               </SectionCard>

               {/* What you need */}
               <SectionCard title="What you'll need">
                  <ul className="grid grid-cols-1 gap-md-3 md:grid-cols-3">
                     {NEED.map(({ Icon, label, hint }) => (
                        <li key={label} className="flex gap-3 md:flex-col md:gap-2">
                           <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md-md bg-md-neutral-300 text-md-heading md:mt-0">
                              <Icon className="h-5 w-5" strokeWidth={2} />
                           </span>
                           <div className="min-w-0">
                              <p className="text-md-b2 font-semibold text-md-heading">{label}</p>
                              <p className="mt-0.5 text-md-b3 font-normal leading-[1.5] text-md-neutral-800">{hint}</p>
                           </div>
                        </li>
                     ))}
                  </ul>
               </SectionCard>

               {/* Steps */}
               <SectionCard title="How it works">
                  <p className="-mt-1 mb-3 text-md-b2 font-medium text-md-neutral-800">The recommended route: Verify Your ID.</p>
                  <ol className="flex flex-col gap-3">
                     {STEPS.map((step, index) => (
                        <li key={step} className="flex items-start gap-3">
                           <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-md-primary-100 text-md-b3 font-bold text-md-primary-1200">
                              {index + 1}
                           </span>
                           <span className="text-md-b2 font-normal leading-[1.5] text-md-neutral-1200">{step}</span>
                        </li>
                     ))}
                  </ol>
               </SectionCard>

               {/* Supported countries */}
               <SectionCard title="Supported countries">
                  <p className="-mt-1 mb-3 text-md-b2 font-normal leading-[1.5] text-md-neutral-1200">
                     National ID verification is available for these countries.
                  </p>
                  <ul className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 md:grid-cols-4">
                     {SUPPORTED_DIDIT_COUNTRIES.map(({ code, name, Flag }) => (
                        <li key={code} className="inline-flex items-center gap-2">
                           <span className="h-3.5 w-[21px] shrink-0 overflow-hidden rounded-[2px] shadow-sm shadow-black/10">
                              <Flag className="block h-full w-full" />
                           </span>
                           <span className="truncate text-md-b3 font-medium text-md-heading">{name}</span>
                        </li>
                     ))}
                  </ul>
               </SectionCard>

               {/* Tips */}
               <section className="rounded-md-lg border border-md-yellow-700/30 bg-md-yellow-100 p-md-3 md:p-md-4">
                  <h2 className="mb-3 flex items-center gap-2 text-md-b3 font-semibold uppercase tracking-[0.06em] text-md-heading">
                     <TriangleAlert className="h-4 w-4 shrink-0" strokeWidth={2.2} />
                     Pass on the first try
                  </h2>
                  <ul className="flex flex-col gap-2">
                     {TIPS.map((tip) => (
                        <li key={tip} className="flex items-start gap-2 text-md-b2 font-normal leading-[1.5] text-md-heading">
                           <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-md-heading/50" aria-hidden="true" />
                           {tip}
                        </li>
                     ))}
                  </ul>
               </section>

               {/* World ID alternative */}
               <SectionCard title="Already use World App?">
                  <p className="text-md-b2 font-normal leading-[1.5] text-md-neutral-1200">
                     If you are already verified in World App — in person at an Orb, or with a biometric passport — you can choose
                     <strong className="font-semibold text-md-heading"> Verify with World ID</strong> instead and confirm through the World
                     App, rather than doing the ID photo check.
                  </p>
               </SectionCard>

               {/* Privacy */}
               <div className="flex items-start gap-3 rounded-md-lg border border-md-primary-300 bg-md-primary-100 p-md-3 md:p-md-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-md-primary-1200" strokeWidth={2.2} />
                  <div>
                     <p className="text-md-b2 font-semibold text-md-primary-1500">Your ID is never stored by Moodeng</p>
                     <p className="mt-1 text-md-b2 font-medium leading-[1.5] text-md-primary-1500">
                        The check is run by our secure verification partner. Moodeng receives the result — whether you passed — not a copy
                        of your document.
                     </p>
                  </div>
               </div>

               {/* FAQ */}
               <SectionCard title="Common questions">
                  <div className="flex flex-col divide-y divide-md-neutral-400">
                     {FAQS.map(({ q, a }) => (
                        <details key={q} className="group py-2.5 first:pt-0 last:pb-0">
                           <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-md-b2 font-semibold text-md-heading">
                              {q}
                              <ChevronDown
                                 className="h-4 w-4 shrink-0 text-md-neutral-800 transition-transform group-open:rotate-180"
                                 strokeWidth={2.4}
                              />
                           </summary>
                           <p className="mt-2 text-md-b2 font-normal leading-[1.55] text-md-neutral-1200">{a}</p>
                        </details>
                     ))}
                  </div>
               </SectionCard>

               {/* CTA */}
               <section className="rounded-md-lg border border-md-neutral-400 bg-md-neutral-100 p-md-3 shadow-md-card md:p-md-4">
                  <h2 className="text-md-b1 font-semibold text-md-heading">Ready to verify?</h2>
                  <p className="mt-1 text-md-b2 font-normal leading-[1.5] text-md-neutral-1200">
                     Verification lives inside the app under &ldquo;Verify Yourself&rdquo;. It takes about 3 minutes and you only do it once.
                  </p>
                  <div className="mt-md-3 flex flex-col gap-md-1 sm:flex-row sm:items-center">
                     <Link
                        to={ctaHref}
                        className="inline-flex h-11 items-center justify-center rounded-md-pill bg-md-primary-1200 px-md-4 text-md-b2 font-semibold text-white"
                     >
                        {ctaLabel}
                     </Link>
                     <Link
                        to="/learn/verification-and-why-its-required"
                        className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md-pill border border-md-primary-1200 px-md-4 text-md-b2 font-semibold text-md-primary-1200"
                     >
                        Verification &amp; Security article
                        <ExternalLink className="h-4 w-4" strokeWidth={2.2} />
                     </Link>
                  </div>
               </section>

               {/* Related guides */}
               <SectionCard title="Keep going">
                  <ul className="grid grid-cols-1 gap-md-2 md:grid-cols-3">
                     {RELATED.map(({ to, title, blurb }) => (
                        <li key={to}>
                           <Link
                              to={to}
                              className="flex h-full flex-col rounded-md-md border border-md-neutral-400 p-md-2 transition-transform duration-150 active:scale-[0.99]"
                           >
                              <p className="text-md-b2 font-semibold text-md-heading">{title}</p>
                              <p className="mt-0.5 text-md-b3 font-normal leading-[1.5] text-md-neutral-800">{blurb}</p>
                              <span className="mt-auto flex items-center gap-1 pt-2 text-md-b3 font-semibold text-md-primary-1200">
                                 Read
                                 <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
                              </span>
                           </Link>
                        </li>
                     ))}
                  </ul>
               </SectionCard>
            </div>
         </div>
      </div>
   );
}
