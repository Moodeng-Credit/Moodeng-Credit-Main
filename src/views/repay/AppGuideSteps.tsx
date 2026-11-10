import type { ReactNode } from 'react';

import GuideCards, { type GuideCard } from '@/components/guide/GuideCards';

// Repay: how to get USDC from <app> into the Moodeng wallet, one card at a time (GuideCards). The
// last card is the live "waiting for your money" check that Repay passes in (`finalStep`).
//
// Pictures: real screenshots live in /public/repay-guides/<app>/ (wallet addresses redacted). Only
// GCrypto and PDAX have them so far; the other apps show their tap path until screenshots are added.

export type GuideAppId = 'gcrypto' | 'pdax' | 'coinsph' | 'moneybees' | 'binance' | 'reku' | 'tokocrypto' | 'indodax' | 'pintu';

const GCRYPTO_IMG = '/repay-guides/gcrypto';
const PDAX_IMG = '/repay-guides/pdax';

const buildCards = ({
   appId,
   appName,
   path,
   buyTip,
   money,
   addressCard
}: {
   appId: GuideAppId;
   appName: string;
   path: string;
   buyTip: string | null;
   money: string;
   addressCard: ReactNode;
}): GuideCard[] => {
   const copy: GuideCard = {
      key: 'copy',
      title: 'Copy your wallet address',
      content: addressCard,
      confirm: appId === 'moneybees' ? 'I’ll ask Moneybees to send USDC on Base' : `I’ll pick the Base network in ${appName}`,
      doneLabel: 'Copied, next'
   };

   if (appId === 'gcrypto') {
      return [
         {
            key: 'open',
            title: 'Open GCrypto, top up pesos',
            text: 'GCash → GCrypto → Top Up.',
            img: `${GCRYPTO_IMG}/step1-topup.webp`,
            open: true
         },
         { key: 'buy', title: 'Buy USDC (Base)', text: 'Trade → Buy → USDC (Base).', img: `${GCRYPTO_IMG}/step2-trade.webp`, tip: buyTip },
         copy,
         { key: 'send', title: 'Paste it, tap MAX', text: 'Send → paste → MAX.', img: `${GCRYPTO_IMG}/step3-send.webp` },
         { key: 'confirm', title: 'Check it says Base, then Send', img: `${GCRYPTO_IMG}/step4-confirm.webp` },
         {
            key: 'processing',
            title: 'You’ll see “processing”',
            text: 'GCrypto emails you when it’s sent. Come back here.',
            img: `${GCRYPTO_IMG}/step5-processing.webp`,
            doneLabel: 'I sent it'
         }
      ];
   }

   // PDAX: cash in pesos → buy USDCBASE → Send it out on Base (the team's PDAX repay guide).
   // Pictures: frames from Moodeng's own PDAX Short (youtube.com/shorts/IyObBHW3Sbg) and PDAX's
   // "Cash in via the UnionBank app" reel (facebook.com/reel/1479406229395251), "How to send crypto from
   // your PDAX wallet" (youtube.com/watch?v=Q89OLTa9pd8) and a borrower's own screenshots.
   if (appId === 'pdax') {
      return [
         {
            key: 'cashin',
            title: 'Open PDAX → Cash in',
            text: 'Copy your PDAX account number.',
            img: `${PDAX_IMG}/step0a-cashin.webp`,
            tip: 'New to PDAX? Approval takes up to 24 hours.',
            open: true
         },
         {
            key: 'instapay',
            title: 'Send pesos to PDAX',
            text: 'Your bank or GCash → InstaPay → PDAX.',
            img: `${PDAX_IMG}/step0b-instapay.webp`
         },
         { key: 'instapay-confirm', title: 'Type the pesos, confirm', img: `${PDAX_IMG}/step0c-confirm.webp` },
         { key: 'markets', title: 'Tap Markets', text: 'At the bottom of PDAX.', img: `${PDAX_IMG}/step3-markets.webp` },
         {
            key: 'find',
            title: 'Search “usdc”, tap USDCBASE/PHP',
            text: 'The one that says Base.',
            img: `${PDAX_IMG}/step4-usdcbase.webp`
         },
         { key: 'buy', title: 'Tap Buy', img: `${PDAX_IMG}/step5-buy.webp` },
         {
            key: 'amount',
            title: 'Type the pesos, tap Buy USDC',
            text: 'Type it in pesos (₱), not USDC.',
            img: `${PDAX_IMG}/step6-amount.webp`,
            tip: buyTip,
            danger: 'Says “Insufficient PHP Balance”? Cash in more pesos first.'
         },
         copy,
         // Sending it out of PDAX, one tap per card.
         { key: 'send', title: 'Portfolio → Send', text: 'Bottom right, then Send.', img: `${PDAX_IMG}/step7-send.webp`, open: true },
         { key: 'send-coin', title: 'Pick USDCBASE', text: 'Search “usdc”, tap USDCBASE.', img: `${PDAX_IMG}/step8-coin.webp` },
         {
            key: 'send-paste',
            title: 'Paste your address',
            text: 'Network must say Base.',
            img: `${PDAX_IMG}/step9-paste.webp`,
            danger: 'Base network only'
         },
         {
            key: 'send-max',
            title: 'Tap Max, then Send',
            text: 'PDAX may send a code to your email.',
            img: `${PDAX_IMG}/step10-max-send.webp`,
            tip: 'You’ll see “Your USDCBASE is on its way!”',
            doneLabel: 'I sent it'
         }
      ];
   }

   if (appId === 'moneybees') {
      return [
         { key: 'open', title: 'Open Moneybees', text: 'Follow their steps.', open: true, tip: buyTip },
         copy,
         { key: 'send', title: 'Pay Moneybees', text: 'Only after they confirm.', doneLabel: 'I paid them' }
      ];
   }

   return [
      { key: 'open', title: `Open ${appName}, buy USDC`, text: `Buy USDC with ${money}.`, open: true, tip: buyTip },
      copy,
      { key: 'send', title: 'Send it to your address', text: 'Paste your address. Pick Base.', path, doneLabel: 'I sent it' }
   ];
};

type Props = {
   appId: GuideAppId;
   appName: string;
   appLogo: ReactNode;
   /** Full tap path from Repay (FUND_SOURCE_PATHS). */
   path: string;
   /** "Buy $X USDC", or null when nothing is needed. */
   buyTip: string | null;
   /** 'pesos' | 'rupiah' | … for "Buy USDC with …". */
   money: string;
   openApp: () => void;
   /** The tap-to-copy address card + Base warning. */
   addressCard: ReactNode;
   /** The live "waiting for your money" card shown after the last step. */
   finalStep: ReactNode;
   memoryKey?: string;
   onStep?: (index: number, key: string) => void;
};

export default function AppGuideSteps({
   appId,
   appName,
   appLogo,
   path,
   buyTip,
   money,
   openApp,
   addressCard,
   finalStep,
   memoryKey,
   onStep
}: Props) {
   return (
      <GuideCards
         appName={appName}
         appLogo={appLogo}
         cards={buildCards({ appId, appName, path, buyTip, money, addressCard })}
         onOpenApp={openApp}
         finalStep={finalStep}
         memoryKey={memoryKey}
         onStep={onStep}
      />
   );
}
