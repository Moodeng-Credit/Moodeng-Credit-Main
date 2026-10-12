import { useEffect, useState } from 'react';

import type { WalletSetupPhase } from '@/lib/web3/openfort';
import { playSuccess } from '@/lib/uiSounds';
import { ConfettiRain } from '@/views/dashboard/components/connectKit';

// The Instant Wallet being created, told as the hippo growing up: a baby with a coin (securing), a
// kid with a stack of coins (creating), a teen with a piggy bank (saving), then all grown up holding
// its new purple wallet (done) — so the few seconds of setup feel like progress, not a spinner.
//
// The real phases can jump (creating → done in a blink), so the picture steps up ONE stage at a
// time, at least STAGE_MS apart, until it catches up — every stage gets seen.

const STAGES = [
   { src: '/hippos/wallet-grow/wallet-1-baby.webp', scale: 0.68, alt: 'Baby hippo holding a coin' },
   { src: '/hippos/wallet-grow/wallet-2-kid.webp', scale: 0.8, alt: 'Young hippo holding a stack of coins' },
   { src: '/hippos/wallet-grow/wallet-3-teen.webp', scale: 0.9, alt: 'Hippo saving a coin in a piggy bank' },
   { src: '/hippos/wallet-grow/wallet-4-grown.webp', scale: 1, alt: 'Grown-up hippo holding its new wallet' }
] as const;

const PHASE_STAGE: Record<WalletSetupPhase, number> = { securing: 0, creating: 1, saving: 2, done: 3 };
const STAGE_MS = 520;

export default function GrowingWalletHippo({ phase, idleSrc }: { phase: WalletSetupPhase | null; idleSrc: string }) {
   const target = phase ? PHASE_STAGE[phase] : -1;
   const [shown, setShown] = useState(-1);

   // Back to idle (setup cancelled or failed): reset straight away.
   if (target === -1 && shown !== -1) setShown(-1);

   useEffect(() => {
      if (target <= shown) return undefined;
      const timer = window.setTimeout(() => setShown((current) => Math.min(target, current + 1)), shown === -1 ? 0 : STAGE_MS);
      return () => window.clearTimeout(timer);
   }, [target, shown]);

   const isGrown = shown === STAGES.length - 1;
   useEffect(() => {
      if (isGrown) playSuccess();
   }, [isGrown]);

   const stage = shown >= 0 ? STAGES[shown] : null;
   return (
      <div className="relative mb-md-3 flex h-36 w-full items-end justify-center">
         {isGrown ? <ConfettiRain /> : null}
         {stage ? (
            <img
               alt={stage.alt}
               className="wallet-grow-pop h-full w-auto max-w-[220px] origin-bottom object-contain drop-shadow-[0_18px_40px_rgba(96,16,210,0.22)] transition-transform duration-500 ease-out"
               // A fresh element per stage replays the pop; the scale makes it visibly grow.
               key={stage.src}
               src={stage.src}
               style={{ transform: `scale(${stage.scale})` }}
            />
         ) : (
            <img
               alt="Moodeng wallet"
               className="h-28 w-auto max-w-[200px] object-contain drop-shadow-[0_18px_40px_rgba(96,16,210,0.22)]"
               src={idleSrc}
            />
         )}
      </div>
   );
}
