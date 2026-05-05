import { mostNeededLendingButtons } from '@/config/buttonConfig';
import type { ActionButtonConfig } from '@/types/actionButtonTypes';

export interface CardData {
   id: string;
   regionLabel: string;
   regionDetail: string;
   regionSymbols: string[];
   title: string;
   titleColor: string;
   accentColor: string;
   accentSoftColor: string;
   mainNumber: string;
   mainNumberColor: string;
   subtitle?: string;
   features: {
      title: string;
      description: string;
   }[];
   opportunitySection: {
      title: string;
      titleColor: string;
      items: {
         title: string;
         description?: string;
      }[];
   };
   ctaButtonConfig?: ActionButtonConfig[];
}

export const mostNeededCards: CardData[] = [
   {
      id: 'overseas-filipinos',
      regionLabel: 'PH',
      regionDetail: 'first corridor',
      regionSymbols: ['🇵🇭'],
      title: 'Overseas Filipino workers',
      titleColor: 'text-emerald-500',
      accentColor: '#10b981',
      accentSoftColor: '#ecfdf5',
      mainNumber: 'First',
      mainNumberColor: 'text-zinc-900',
      subtitle: 'market',
      features: [
         {
            title: 'Working abroad',
            description: 'Filipinos and Southeast Asians often earn away from home in Korea, Taiwan, Japan, Singapore, and beyond.'
         },
         {
            title: 'Small urgent gaps',
            description: 'A loan may be for a bill, transport, family support, or a short emergency before payday.'
         },
         {
            title: 'Credit does not follow',
            description: 'Repayment discipline abroad rarely becomes a portable credit record they can use later.'
         }
      ],
      opportunitySection: {
         title: 'What lenders fund',
         titleColor: 'text-emerald-500',
         items: [
            {
               title: 'USDC microloans',
               description: 'Small amounts with transparent borrower-proposed terms.'
            },
            {
               title: 'Real repayment history',
               description: 'Each repayment helps create a record the borrower can keep building.'
            }
         ]
      }
   },
   {
      id: 'world-id-corridors',
      regionLabel: 'ORB',
      regionDetail: 'Korea, Taiwan, Japan',
      regionSymbols: ['🇰🇷', '🇹🇼', '🇯🇵', '🇸🇬'],
      title: 'Orb-ready corridors',
      titleColor: 'text-indigo-500',
      accentColor: '#6366f1',
      accentSoftColor: '#eef2ff',
      mainNumber: 'SEA',
      mainNumberColor: 'text-zinc-900',
      subtitle: 'abroad',
      features: [
         {
            title: 'World ID access first',
            description: 'We focus where borrowers can verify with World ID through nearby Orb locations.'
         },
         {
            title: 'Korea, Taiwan, Japan',
            description: 'Early borrower communities are likely to be in East and Southeast Asian worker hubs.'
         },
         {
            title: 'Singapore and beyond',
            description: 'Orb availability helps us start with users who can prove they are unique, real borrowers.'
         }
      ],
      opportunitySection: {
         title: 'Why this matters',
         titleColor: 'text-indigo-500',
         items: [
            {
               title: 'Lower trust friction',
               description: 'Verification helps lenders evaluate people they have never met.'
            },
            {
               title: 'Better than quick-loan apps',
               description: 'Transparent loans can help borrowers avoid predatory emergency options.'
            }
         ]
      },
      ctaButtonConfig: mostNeededLendingButtons
   },
   {
      id: 'portable-credit',
      regionLabel: 'USDC',
      regionDetail: 'small emergency loans',
      regionSymbols: ['$'],
      title: 'Portable credit builders',
      titleColor: 'text-amber-500',
      accentColor: '#f59e0b',
      accentSoftColor: '#fffbeb',
      mainNumber: 'Small',
      mainNumberColor: 'text-zinc-900',
      subtitle: 'steps',
      features: [
         {
            title: 'Not huge money',
            description: 'The first loans are intentionally small, useful, and easier to repay responsibly.'
         },
         {
            title: 'Emergency plus progress',
            description: 'A borrower can solve a near-term problem while building a repayment record.'
         },
         {
            title: 'Independent credit',
            description: 'The long-term goal is credit the borrower owns, not a score trapped in one country.'
         }
      ],
      opportunitySection: {
         title: 'Lender upside',
         titleColor: 'text-amber-500',
         items: [
            {
               title: 'Fund useful moments',
               description: 'Support real needs without pretending every loan is life-changing.'
            },
            {
               title: 'Back repeat borrowers',
               description: 'Good repayment can become a signal for better future access.'
            }
         ]
      }
   }
];
