import type { ComponentType, ReactNode } from 'react';

import { ArrowLeft, ArrowRight, Building2, RefreshCw, UserRoundCheck, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';

import { SUPPORTED_DIDIT_COUNTRIES } from '@/components/verification/CountryFlags';
import { BaseMark, BinanceTile, CoinsPhTile, GCashTile, PdaxTile, UsdcMark } from '@/components/brand/ProviderLogos';
import { useGoBack } from '@/hooks/useGoBack';
import { usePageSeo } from '@/hooks/usePageSeo';

// A logo chip: small brand tile/mark + label. Reuses the real provider marks so the
// guide shows the same logos the funding/withdraw/repay screens do.
function LogoChip({ logo, label }: { logo: ReactNode; label: string }) {
   return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-md-neutral-400 bg-md-neutral-100 py-1 pl-1 pr-2.5">
         <span className="flex h-4 w-4 items-center justify-center">{logo}</span>
         <span className="text-md-b3 font-medium text-md-heading">{label}</span>
      </span>
   );
}

// A plain (logo-less) chip for concepts like "Base network" or "Selfie".
function TextChip({ label }: { label: string }) {
   return (
      <span className="rounded-full bg-md-primary-100 px-2.5 py-1 text-md-b3 font-medium text-md-primary-1200">{label}</span>
   );
}

type TopicCard = {
   id: string;
   Icon: ComponentType<{ className?: string }>;
   iconWrap: string;
   iconColor: string;
   title: string;
   subtitle: string;
   body: string;
   chips: ReactNode;
   topicPath: string;
};

export default function MoneyGuide() {
   const goBack = useGoBack('/academy');
   usePageSeo({
      title: 'Money & getting started — Moodeng Academy',
      description: 'How to verify, add USDC to your wallet, withdraw to your bank, and repay your loan on Moodeng.',
      canonicalPath: '/academy/money'
   });

   const cards: TopicCard[] = [
      {
         id: 'verify',
         Icon: UserRoundCheck,
         iconWrap: 'bg-md-primary-100',
         iconColor: 'text-md-primary-1200',
         title: 'Verify your identity',
         subtitle: 'One-time · about 3 minutes',
         body: 'A quick national ID photo and selfie check confirms you’re a real, unique person. Most checks finish within minutes.',
         chips: (
            <>
               <TextChip label="ID photo" />
               <TextChip label="Selfie" />
               <span className="inline-flex items-center gap-1 rounded-full border border-md-neutral-400 bg-md-neutral-100 py-1 pl-1.5 pr-2.5">
                  {SUPPORTED_DIDIT_COUNTRIES.slice(0, 4).map(({ code, Flag }) => (
                     <span key={code} className="h-3.5 w-[21px] overflow-hidden rounded-[2px] shadow-sm shadow-black/10">
                        <Flag className="block h-full w-full" />
                     </span>
                  ))}
                  <span className="text-md-b3 font-medium text-md-heading">+{SUPPORTED_DIDIT_COUNTRIES.length - 4} more</span>
               </span>
            </>
         ),
         topicPath: '/academy/money/verify'
      },
      {
         id: 'add-funds',
         Icon: Wallet,
         iconWrap: 'bg-[#e6f1fb]',
         iconColor: 'text-md-blue-800',
         title: 'Add funds to your wallet',
         subtitle: 'USDC on the Base network',
         body: 'Buy USDC on an exchange or with a card, then send it to your wallet — always on Base. Or bridge it from another chain.',
         chips: (
            <>
               <LogoChip logo={<BinanceTile className="h-4 w-4" />} label="Binance P2P" />
               <LogoChip logo={<CoinsPhTile className="h-4 w-4" />} label="Coins.ph" />
               <LogoChip logo={<UsdcMark className="h-4 w-4" />} label="USDC" />
               <LogoChip logo={<BaseMark className="h-4 w-4" />} label="Base" />
            </>
         ),
         topicPath: '/academy/money/add-funds'
      },
      {
         id: 'withdraw',
         Icon: Building2,
         iconWrap: 'bg-md-green-100',
         iconColor: 'text-md-green-900',
         title: 'Withdraw to your bank',
         subtitle: 'Cash out to bank or e-wallet',
         body: 'Send USDC to an exchange or local service, sell it, and withdraw your local currency to your bank or GCash. The full guide has a video walkthrough.',
         chips: (
            <>
               <LogoChip logo={<BinanceTile className="h-4 w-4" />} label="Binance P2P" />
               <LogoChip logo={<PdaxTile className="h-4 w-4" />} label="PDAX" />
               <LogoChip logo={<CoinsPhTile className="h-4 w-4" />} label="Coins.ph" />
               <LogoChip logo={<GCashTile className="h-4 w-4" />} label="GCrypto" />
            </>
         ),
         topicPath: '/academy/money/withdraw'
      },
      {
         id: 'repay',
         Icon: RefreshCw,
         iconWrap: 'bg-[#fbe4d6]',
         iconColor: 'text-[#a2481f]',
         title: 'Repay your loan',
         subtitle: 'On-time repayment builds trust',
         body: 'Send USDC to the repayment address shown on the Repay screen — from a wallet, exchange, or local service. Repaying on time raises your Trust Score and credit limit.',
         chips: (
            <>
               <LogoChip logo={<UsdcMark className="h-4 w-4" />} label="From a wallet" />
               <LogoChip logo={<BinanceTile className="h-4 w-4" />} label="From an exchange" />
               <LogoChip logo={<BaseMark className="h-4 w-4" />} label="Base network" />
            </>
         ),
         topicPath: '/academy/money/repay'
      }
   ];

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="mx-auto w-full max-w-modal md:max-w-4xl">
            {/* Hero */}
            <div className="relative overflow-hidden bg-md-primary-100 px-md-4 pb-md-5 pt-[max(20px,env(safe-area-inset-top))] md:rounded-md-xl md:px-md-5 md:pb-md-5 md:pt-md-5">
               <button
                  type="button"
                  onClick={goBack}
                  aria-label="Go back"
                  className="mb-md-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-md-primary-300 bg-md-neutral-100 text-md-heading"
               >
                  <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
               </button>
               <div className="flex items-center gap-2">
                  <span className="text-md-b3 font-semibold uppercase tracking-[0.08em] text-md-primary-1200">Moodeng Academy</span>
               </div>
               <h1 className="mt-1 text-md-h3 font-semibold text-md-heading md:text-md-display">Money &amp; getting started</h1>
               <p className="mt-1 max-w-lg text-md-b2 font-medium text-md-neutral-800">
                  Getting verified, funding your wallet, cashing out, and repaying — in one friendly place.
               </p>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 gap-md-3 px-md-4 py-md-4 md:grid-cols-2 md:px-md-5 md:py-md-5">
               {cards.map(({ id, Icon, iconWrap, iconColor, title, subtitle, body, chips, topicPath }) => (
                  // A real <Link>, not a button+navigate(): crawlers only follow anchors,
                  // and these topic pages had no inbound link anywhere on the site.
                  <Link
                     key={id}
                     to={topicPath}
                     className="flex w-full flex-col rounded-md-lg border border-md-neutral-400 bg-md-neutral-100 p-md-3 text-left shadow-md-card transition-transform duration-150 active:scale-[0.99]"
                  >
                     <div className="mb-2 flex items-center gap-3">
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md-md ${iconWrap} ${iconColor}`}>
                           <Icon className="h-6 w-6" strokeWidth={2} />
                        </span>
                        <div className="min-w-0">
                           <p className="text-md-b1 font-semibold text-md-heading">{title}</p>
                           <p className="mt-0.5 text-md-b3 font-medium text-md-neutral-800">{subtitle}</p>
                        </div>
                     </div>
                     <p className="mb-3 text-md-b2 font-normal leading-[1.5] text-md-neutral-1200">{body}</p>
                     <div className="mb-3 flex flex-wrap gap-1.5">{chips}</div>
                     <div className="mt-auto flex items-center justify-between border-t border-md-neutral-400 pt-2.5">
                        <span className="text-md-b2 font-semibold text-md-primary-1200">Read more</span>
                        <ArrowRight className="h-4 w-4 text-md-primary-1200" strokeWidth={2.4} />
                     </div>
                  </Link>
               ))}
            </div>
         </div>
      </div>
   );
}
