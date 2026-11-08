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
      title: 'Copy your Moodeng address',
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
         { key: 'confirm', title: 'Check it says Base, then Send', img: `${GCRYPTO_IMG}/step4-confirm.webp`, doneLabel: 'I sent it' }
      ];
   }

   // PDAX: cash in pesos → buy USDCBASE → Send it out on Base (the team's PDAX repay guide).
   // Pictures are frames from Moodeng's own PDAX Short (youtube.com/shorts/IyObBHW3Sbg).
   if (appId === 'pdax') {
      return [
         {
            key: 'cashin',
            title: 'Open PDAX, cash in pesos',
            text: 'Portfolio → Cash in.',
            tip: 'New to PDAX? Approval takes up to 24 hours.',
            open: true
         },
         { key: 'find', title: 'Find USDCBASE', text: 'Markets → type “usdc” → USDCBASE/PHP.', img: `${PDAX_IMG}/step1-find.webp` },
         { key: 'buy', title: 'Buy USDC', text: 'Buy → type pesos → Buy USDC.', img: `${PDAX_IMG}/step2-buy.webp`, tip: buyTip },
         copy,
         {
            key: 'send',
            title: 'Send it to your address',
            text: 'Pick Base. Paste your address.',
            path: 'Portfolio → Send → USDC → Base → paste',
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
};

export default function AppGuideSteps({ appId, appName, appLogo, path, buyTip, money, openApp, addressCard, finalStep }: Props) {
   return (
      <GuideCards
         appName={appName}
         appLogo={appLogo}
         cards={buildCards({ appId, appName, path, buyTip, money, addressCard })}
         onOpenApp={openApp}
         finalStep={finalStep}
      />
   );
}
