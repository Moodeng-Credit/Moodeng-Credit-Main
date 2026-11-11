import { type ReactNode, useEffect, useRef, useState } from 'react';

import { Check, ExternalLink } from 'lucide-react';

import { readStep, writeStep } from '@/lib/stepMemory';
import { Card, GoldButton, SoftButton } from '@/views/indonesia/ui';

// One small card at a time: a picture, one short instruction, and a gold "Done" button. Done steps
// fold into green rows above it (tap one to look again), so people always see how far they got.
// After the last card, `finalStep` shows (e.g. a live "waiting for your money" check).
// Used by Repay (getting USDC into the wallet) and Cash out (sending to an exchange, then pesos).

export type GuideCard = {
   key: string;
   title: ReactNode;
   text?: ReactNode;
   /** A screenshot (public/repay-guides/<app>/, public/cashout-guides/<app>/). */
   img?: string;
   /** Tap path shown as chips, e.g. "Wallet → USDCBASE → Withdraw". */
   path?: string;
   /** Yellow tip, e.g. "Buy $105 USDC". */
   tip?: ReactNode;
   /** Red warning line. */
   danger?: ReactNode;
   /** Show an "Open <app>" button. */
   open?: boolean;
   /** Extra content inside the card (an address to copy, a paste box…). */
   content?: ReactNode;
   /** A checkbox they must tick before Done (used for the Base network). */
   confirm?: string;
   /** False keeps Done disabled (e.g. until a pasted address is valid). */
   canContinue?: boolean;
   doneLabel?: string;
};

type Props = {
   appName: string;
   appLogo?: ReactNode;
   cards: GuideCard[];
   onOpenApp?: () => void;
   /** Shown after the last card; omit to stop at the last card's Done (onFinish). */
   finalStep?: ReactNode;
   onFinish?: () => void;
   /** Remember the card they're on (a day), so a reloaded page picks up where they were. */
   memoryKey?: string;
   /** Called each time a card shows (for analytics). `key` is 'final' for finalStep. */
   onStep?: (index: number, key: string) => void;
};

export default function GuideCards({ appName, appLogo, cards, onOpenApp, finalStep, onFinish, memoryKey, onStep }: Props) {
   const [index, setIndex] = useState(() => {
      const saved = memoryKey ? readStep<number>(memoryKey) : null;
      return typeof saved === 'number' && saved >= 0 && saved <= cards.length ? saved : 0;
   });
   const [confirmed, setConfirmed] = useState(false);
   // More than 2 steps done: fold them into one "✓ N steps done" line (tap to see them).
   const [showDone, setShowDone] = useState(false);
   const topRef = useRef<HTMLDivElement>(null);
   const allDone = index >= cards.length;
   const card = cards[Math.min(index, cards.length - 1)];
   const total = cards.length + (finalStep ? 1 : 0);

   useEffect(() => {
      if (memoryKey) writeStep(memoryKey, index);
      onStep?.(index, index >= cards.length ? 'final' : cards[index].key);
      // Only when the card changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [index, memoryKey]);

   const done = () => {
      setConfirmed(false);
      setShowDone(false);
      if (index + 1 >= cards.length) onFinish?.();
      setIndex((i) => i + 1);
      topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
   };

   return (
      <div ref={topRef} className="flex scroll-mt-24 flex-col gap-3">
         {index > 2 && !showDone ? (
            <button
               type="button"
               onClick={() => setShowDone(true)}
               className="flex w-full items-center gap-3 rounded-[14px] bg-[#eafbef] px-3 py-2.5 text-left text-[15px] font-bold text-[#1f7a3d] dark:bg-[#12301e] dark:text-[#8fe3a8]"
            >
               <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#2f9e44] text-white">
                  <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
               </span>
               <span className="min-w-0 flex-1">{index} steps done</span>
               <span className="text-[13px] font-semibold opacity-75">Show</span>
            </button>
         ) : index > 0 ? (
            <ol className="flex flex-col gap-1.5">
               {cards.slice(0, index).map((c, i) => (
                  <li key={c.key}>
                     <button
                        type="button"
                        onClick={() => {
                           setShowDone(false);
                           setIndex(i);
                        }}
                        className="flex w-full items-center gap-3 rounded-[14px] bg-[#eafbef] px-3 py-2.5 text-left text-[15px] font-bold text-[#1f7a3d] dark:bg-[#12301e] dark:text-[#8fe3a8]"
                     >
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#2f9e44] text-white">
                           <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{c.title}</span>
                     </button>
                  </li>
               ))}
            </ol>
         ) : null}

         {allDone ? (
            (finalStep ?? null)
         ) : (
            <Card>
               <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex min-w-0 items-center gap-2 text-[14px] font-bold text-[#7a6a4f] dark:text-[#bfb29a]">
                     {appLogo}
                     {appName} · step {index + 1} of {total}
                  </span>
                  <span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-[#efe6cc] dark:bg-[#2a2335]" aria-hidden="true">
                     <span
                        className="block h-full rounded-full bg-[#2f9e44] transition-[width] duration-300"
                        style={{ width: `${Math.round(((index + 1) / total) * 100)}%` }}
                     />
                  </span>
               </div>

               <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#ffd75a] text-[17px] font-extrabold text-[#4a2a00]">
                     {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                     <h3 className="text-[20px] font-extrabold leading-[24px] tracking-[-0.01em]">{card.title}</h3>
                     {card.text ? <p className="mt-1 text-[16px] leading-[21px] text-[#5c4d36] dark:text-[#d8ccb4]">{card.text}</p> : null}
                  </div>
               </div>

               {card.img ? (
                  <img
                     src={card.img}
                     alt=""
                     className="block w-full rounded-[14px] border border-[#f0e6c8] dark:border-[#2e2638]"
                     draggable={false}
                  />
               ) : null}

               {card.path ? (
                  <div className="flex flex-wrap items-center gap-1.5 rounded-[14px] bg-[#fff6dc] p-3 dark:bg-[#2a220f]">
                     {card.path.split('→').map((part, i, all) => (
                        <span key={all.slice(0, i + 1).join('→')} className="inline-flex items-center gap-1.5">
                           <span className="rounded-[8px] bg-white px-2 py-1 text-[14px] font-bold text-[#4a2a00] shadow-[0_1px_0_#ecdfb8] dark:bg-[#1a1524] dark:text-[#ffd36b]">
                              {part.trim()}
                           </span>
                           {i < all.length - 1 ? <span className="text-[14px] font-bold text-[#b08a2e]">→</span> : null}
                        </span>
                     ))}
                  </div>
               ) : null}

               {card.tip ? (
                  <p className="rounded-[14px] bg-[#fff6dc] px-3 py-2.5 text-center text-[18px] font-extrabold text-[#6b4a00] dark:bg-[#2a220f] dark:text-[#ffd36b]">
                     {card.tip}
                  </p>
               ) : null}

               {card.danger ? (
                  <p className="text-center text-[15px] font-extrabold text-[#b91c1c] dark:text-[#fca5a5]">⚠️ {card.danger}</p>
               ) : null}

               {card.open && onOpenApp ? (
                  <SoftButton onClick={onOpenApp}>
                     Open {appName} <ExternalLink className="size-4" aria-hidden="true" />
                  </SoftButton>
               ) : null}

               {card.content ?? null}

               {card.confirm ? (
                  <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[14px] bg-[#fffaf0] px-3 py-2 text-[16px] font-bold leading-[21px] dark:bg-[#100d17]">
                     <input
                        checked={confirmed}
                        className="size-6 shrink-0 accent-[#ffbe1a]"
                        onChange={(e) => setConfirmed(e.target.checked)}
                        type="checkbox"
                     />
                     {card.confirm}
                  </label>
               ) : null}

               <GoldButton disabled={(card.confirm ? !confirmed : false) || card.canContinue === false} onClick={done}>
                  <Check aria-hidden="true" className="size-5" strokeWidth={3} />
                  {card.doneLabel ?? 'Done'}
               </GoldButton>
            </Card>
         )}
      </div>
   );
}
