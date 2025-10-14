import { mostNeededLendingButtons } from '@/config/buttonConfig';
import type { ActionButtonConfig } from '@/types/actionButtonTypes';

export interface CardData {
   id: string;
   icon: string;
   title: string;
   titleColor: string;
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
   ctaButtonConfig?: ActionButtonConfig[]; // Reference to button config section name
}

export const mostNeededCards: CardData[] = [
   {
      id: 'indian-crypto',
      icon: 'https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/6b790ac2aaa0e8d3b5376bf28b32e3fdafad129768457ad5444c768a26b9e3c0?apiKey=e485b3dc4b924975b4554885e21242bb',
      title: 'Indian crypto enthusiasts',
      titleColor: 'text-emerald-500',
      mainNumber: '150 million',
      mainNumberColor: 'text-zinc-900',
      features: [
         {
            title: 'Top 5 out of 10 on Play Store',
            description: 'Are Cash Advance or "Small" Loan Apps'
         },
         {
            title: 'People do not want Rupee',
            description: 'loans/assets, they want dollars or gold instead'
         },
         {
            title: 'Local Indian banks charge',
            description: 'very high interest rates of 32% and higher'
         },
         {
            title: 'Their credit scores do not travel',
            description: 'though 2 out of 5 people in the world are Indian'
         },
         {
            title: '20% of Indians have 750+',
            description: 'credit score at local banks, very high credit'
         },
         {
            title: 'India processes 100+ billion UPI transactions',
            description: "annually, world's largest real-time payment system"
         }
      ],
      opportunitySection: {
         title: 'Opportunity?',
         titleColor: 'text-emerald-500',
         items: [
            {
               title: 'Kucoin estimates 150 million',
               description: 'Indians are actively in crypto'
            },
            {
               title: 'Many are highly-paid Indian ',
               description: 'workers, e.g. devs, etc.'
            },
            {
               title: 'Many want to build credit ',
               description: 'that they can take anywhere'
            }
         ]
      }
   },
   {
      id: 'swahili-mkopo',
      icon: 'https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/8863e3289df8e873f486617995f6c5cd4fc7e36e2b81e139b905be92e7536b39?apiKey=e485b3dc4b924975b4554885e21242bb',
      title: 'Swahili MKopo APPS',
      titleColor: 'text-indigo-500',
      mainNumber: '30',
      mainNumberColor: 'text-zinc-900',
      subtitle: 'million users',
      features: [
         {
            title: 'Mkopo means "Credit" in Swahili',
            description: 'are a type of loan shark app seven African nations'
         },
         {
            title: 'Mkopo offers easy, instant credit',
            description: 'But traps users in debt cycles'
         },
         {
            title: 'Mkopo apps are local cash-only',
            description: 'No USDT loans, limiting options'
         },
         {
            title: 'Mkopo apps are used for',
            description: 'buying phones, medical emergenies, etc.'
         },
         {
            title: 'Many apps enable to buy USDT',
            description: 'so popular alternatives to physical cash exist'
         },
         {
            title: 'Mkopo not built for USDT',
            description: 'Missing out on stablecoin benefits'
         }
      ],
      opportunitySection: {
         title: 'Objective',
         titleColor: 'text-indigo-500',
         items: [
            {
               title: 'Replace Mkopo with USDT loans',
               description: 'Leverage existing app popularity'
            },
            {
               title: 'Stablecoins bring transparency',
               description: 'Lower costs benefit high-quality borrowers'
            },
            {
               title: 'High-value Mkopo users exist',
               description: 'Stablecoin loans preferred over cash'
            }
         ]
      },
      ctaButtonConfig: mostNeededLendingButtons
   },
   {
      id: 'argentine-peso',
      icon: 'https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/5e5843576620302489bc3694ee17584a77169668c089040f311a2c9db566862c?apiKey=e485b3dc4b924975b4554885e21242bb',
      title: 'Argentine PESO ESCAPERS',
      titleColor: 'text-emerald-500',

      mainNumber: '13 Million',
      mainNumberColor: 'text-zinc-900',
      features: [
         {
            title: 'Cash-only economy persists',
            description: 'Credit access severely limited for many'
         },
         {
            title: 'Dollarization trend accelerates',
            description: 'Stablecoins gaining traction as solution'
         },
         {
            title: 'Crypto wallets getting adoption',
            description: 'Metamask popular among tech-savvy users'
         },
         {
            title: 'Binance, the app, 40% of the',
            description: '18-40 year old population, use it'
         },
         {
            title: 'Loansharks prey on people',
            description: 'with worthless Peso loans and 300%+ APR loans'
         },
         {
            title: 'Stablecoin unlocks a lot',
            description: 'New opportunities emerge for all Argentinians'
         }
      ],
      opportunitySection: {
         title: 'Build',
         titleColor: 'text-emerald-500',
         items: [
            {
               title: 'Enable USD loans for an',
               description: 'underserved population'
            },
            {
               title: 'Propel young Argentinians',
               description: 'to build an on-chain economy'
            }
         ]
      }
   }
];
