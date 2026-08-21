import type { ComponentType, ReactNode } from 'react';

import { Building2, RefreshCw, Wallet } from 'lucide-react';

import { BaseMark, BinanceTile, CoinsPhTile, GCashTile, PdaxTile, UsdcMark } from '@/components/brand/ProviderLogos';

export type MoneyGuideOption = {
   logo?: ReactNode;
   name: string;
   text: string;
   href?: string;
};

export type MoneyGuideTopicConfig = {
   id: string;
   Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
   iconWrap: string;
   iconColor: string;
   title: string;
   subtitle: string;
   /** Short card blurb on the index screen. */
   summary: string;
   /** Opening paragraph on the topic page. */
   intro: string;
   /** Numbered how-to steps. */
   steps?: string[];
   /** Provider/service options with logos. */
   options?: { heading: string; items: MoneyGuideOption[] };
   video?: { label: string; href: string };
   callout: string;
};

// 'verify' is deliberately absent: it has its own page at /academy/money/verify
// (see VerifyGuide) because it needs real guide content rather than a provider list.
export const MONEY_GUIDE_TOPICS: MoneyGuideTopicConfig[] = [
   {
      id: 'add-funds',
      Icon: Wallet,
      iconWrap: 'bg-[#e6f1fb]',
      iconColor: 'text-md-blue-800',
      title: 'Add funds to your wallet',
      subtitle: 'USDC on the Base network',
      summary: 'Buy USDC on an exchange or with a card, then send it to your wallet — always on Base. Or bridge it from another chain.',
      intro: 'Your Moodeng wallet works with USDC on the Base network. Besides the in-app options — card purchase and bridging from another chain — here are common ways to get USDC into your wallet.',
      options: {
         heading: 'Ways to buy and send USDC',
         items: [
            {
               logo: <BinanceTile className="h-6 w-6" />,
               name: 'Binance P2P',
               text: 'Buy USDC with local currency directly from other users, then withdraw on the Base network.'
            },
            {
               logo: <CoinsPhTile className="h-6 w-6" />,
               name: 'Coins.ph',
               text: 'Buy USDC with PHP, then Send Crypto → External Wallet → Base network.'
            },
            {
               logo: <PdaxTile className="h-6 w-6" />,
               name: 'PDAX',
               text: 'Buy USDC with PHP and withdraw to your wallet on Base.'
            },
            {
               logo: <GCashTile className="h-6 w-6" />,
               name: 'GCrypto (GCash)',
               text: 'If crypto is enabled in your GCash app, buy USDC and withdraw via USDCBASE.'
            },
            {
               name: 'Moneybees',
               text: 'An over-the-counter service some users may use to buy crypto. Follow Moneybees’ instructions directly on their site.',
               href: 'https://www.moneybees.ph/'
            },
            {
               logo: <UsdcMark className="h-6 w-6" />,
               name: 'Another exchange or wallet',
               text: 'Buy USDC on an exchange you already use, or send USDC you hold elsewhere to your wallet address — always USDC on Base.'
            }
         ]
      },
      callout: 'The key detail: always choose Base as the network. Sending on the wrong network can result in lost funds.'
   },
   {
      id: 'withdraw',
      Icon: Building2,
      iconWrap: 'bg-md-green-100',
      iconColor: 'text-md-green-900',
      title: 'Withdraw to your bank',
      subtitle: 'Cash out to bank or e-wallet',
      summary: 'Send USDC to an exchange or local service, sell it, and withdraw your local currency to your bank or GCash.',
      intro: 'You can cash out by sending your USDC to a supported exchange or service, selling it there, and transferring the local currency to your bank account or e-wallet.',
      video: {
         label: 'Watch: sending USDC from your Base account to Binance',
         href: 'https://www.youtube.com/watch?v=Bqc2u3utbwc'
      },
      options: {
         heading: 'Common ways to cash out',
         items: [
            {
               logo: <BinanceTile className="h-6 w-6" />,
               name: 'Binance P2P',
               text: 'Send USDC to your Binance account (choose the Base network), sell it through P2P, and receive local currency straight to your bank or e-wallet.'
            },
            {
               logo: <PdaxTile className="h-6 w-6" />,
               name: 'PDAX',
               text: 'A BSP-regulated Philippine exchange. Deposit USDC, sell for PHP, and withdraw to your bank account.'
            },
            {
               logo: <CoinsPhTile className="h-6 w-6" />,
               name: 'Coins.ph',
               text: 'Deposit USDC, convert to PHP, and cash out to your bank or GCash.'
            },
            {
               logo: <GCashTile className="h-6 w-6" />,
               name: 'GCrypto (GCash)',
               text: 'If crypto is enabled in your GCash app, you can receive supported crypto and convert inside GCash.'
            },
            {
               name: 'Moneybees',
               text: 'An over-the-counter service some users may use to sell crypto. Follow Moneybees’ instructions directly on their site.',
               href: 'https://www.moneybees.ph/'
            },
            {
               logo: <UsdcMark className="h-6 w-6" />,
               name: 'Another wallet or exchange',
               text: 'Any wallet or exchange you already use works — just make sure it supports USDC on the Base network before sending.'
            }
         ]
      },
      callout: 'The key detail: always select Base as the network when depositing to an exchange. Using the wrong network can result in lost funds.'
   },
   {
      id: 'repay',
      Icon: RefreshCw,
      iconWrap: 'bg-[#fbe4d6]',
      iconColor: 'text-[#a2481f]',
      title: 'Repay your loan',
      subtitle: 'On-time repayment builds trust',
      summary: 'Send USDC to the repayment address shown on the Repay screen — from a wallet, exchange, or local service.',
      intro: 'To repay, send the required USDC amount to the repayment address shown in Moodeng — the Repay screen shows the exact amount and lets you copy the address.',
      steps: [
         'Open the Repay screen to see the amount due and copy the repayment address.',
         'Send USDC to that address from a wallet, an exchange, or a local service — always on the Base network.',
         'Don’t hold USDC yet? Buy it first, send it to your wallet, then repay from there.'
      ],
      options: {
         heading: 'Where to buy USDC first',
         items: [
            {
               logo: <BinanceTile className="h-6 w-6" />,
               name: 'Binance P2P',
               text: 'Buy USDC with local currency from other users, then withdraw on the Base network.'
            },
            {
               logo: <CoinsPhTile className="h-6 w-6" />,
               name: 'Coins.ph',
               text: 'Buy USDC with PHP, then use Send Crypto → External Wallet → Base network.'
            },
            {
               logo: <GCashTile className="h-6 w-6" />,
               name: 'GCrypto (GCash)',
               text: 'If crypto is enabled in your GCash app, buy USDC and withdraw via USDCBASE.'
            },
            {
               logo: <PdaxTile className="h-6 w-6" />,
               name: 'PDAX',
               text: 'Buy USDC with PHP and withdraw to your wallet on Base.'
            },
            {
               name: 'Moneybees',
               text: 'An over-the-counter service some users may use to buy crypto. Follow Moneybees’ instructions directly on their site.',
               href: 'https://www.moneybees.ph/'
            }
         ]
      },
      callout: 'Always repay before the due date — on-time repayment builds your Trust Score and unlocks higher credit levels. And always choose Base as the network.'
   }
];

export const getMoneyGuideTopic = (id: string | undefined) => MONEY_GUIDE_TOPICS.find((topic) => topic.id === id);

