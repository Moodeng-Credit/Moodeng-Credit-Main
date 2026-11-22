import { Lock } from 'lucide-react';

import { cardProgress, stampSrc } from '@/views/referral/sharkFighter/stampMath';

const PRIMARY_GRADIENT = 'linear-gradient(77.66deg, #9584ff 0.5%, #6b55f7 98.16%)';
const GOLD_GRADIENT = 'linear-gradient(180deg, #ffe27a 0%, #ffbe1a 100%)';

// Shark Fighter Card (George, 2026-11-22; Figma "Shark Fighter Card – /refer"). Every friend who joins with
// your code and repays on time fills one stamp ($2 each); the 10th stamp is a $20 bonus, then a new card starts.
// Stamp art: public/shark-fighter/stamp-1..10.webp (Gemini, from the Moodeng sisters).

export function StampGrid({ stamps, every, bonusUsd, size = 56 }: { stamps: number; every: number; bonusUsd: number; size?: number }) {
   const { filled } = cardProgress(stamps, every);
   return (
      <ol className="grid grid-cols-5 justify-items-center gap-2" aria-label={`${filled} of ${every} stamps`}>
         {Array.from({ length: every }, (_, index) => {
            const isFilled = index < filled;
            const isBonus = index === every - 1;
            const style = { width: size, height: size };
            if (isFilled) {
               return (
                  <li key={index} style={style}>
                     <img
                        src={stampSrc(index)}
                        alt=""
                        className="h-full w-full rounded-full object-cover shadow-[0_2px_6px_rgba(76,35,159,0.25)]"
                        draggable={false}
                     />
                  </li>
               );
            }
            if (isBonus) {
               return (
                  <li
                     key={index}
                     style={{ ...style, backgroundImage: GOLD_GRADIENT }}
                     className="flex flex-col items-center justify-center rounded-full border-[3px] border-white text-[#4a2a00] shadow-[0_2px_6px_rgba(176,120,0,0.3)]"
                  >
                     <span style={{ fontSize: size * 0.34 }} aria-hidden="true">
                        🎁
                     </span>
                     <span className="font-black leading-none" style={{ fontSize: size * 0.2 }}>
                        +${bonusUsd}
                     </span>
                  </li>
               );
            }
            return (
               <li
                  key={index}
                  style={style}
                  className="flex items-center justify-center rounded-full border-2 border-dashed border-[#b9aeff] bg-[#f4f1fb] font-bold text-[#b9aeff] dark:bg-dv2-tab"
               >
                  <span style={{ fontSize: size * 0.32 }}>{index + 1}</span>
               </li>
            );
         })}
      </ol>
   );
}

/** /affiliate: the full card with progress and the bonus line. */
export function SharkFighterCard({
   stamps,
   every,
   rewardUsd,
   bonusUsd,
   bonusesEarned,
   unlocked
}: {
   stamps: number;
   every: number;
   rewardUsd: number;
   bonusUsd: number;
   bonusesEarned: number;
   unlocked: boolean;
}) {
   const { filled, cardNumber, toGo } = cardProgress(stamps, every);
   return (
      <section
         className="mt-6 overflow-hidden rounded-[20px] bg-white shadow-[0_2px_8px_rgba(28,5,61,0.08)] dark:bg-dv2-card"
         aria-label="Shark Fighter Card"
      >
         <div className="px-5 py-4" style={{ backgroundImage: 'linear-gradient(90deg, #4c239f, #7e6afa)' }}>
            <p className="text-[22px] font-black italic leading-7 text-white">
               🦛 Shark Fighter Card{cardNumber > 1 ? ` #${cardNumber}` : ''}
            </p>
            <p className="mt-0.5 text-[14px] font-semibold text-[#e4dafb]">${rewardUsd} per friend who repays on time</p>
         </div>
         <div className="px-5 pb-5 pt-4">
            <StampGrid stamps={stamps} every={every} bonusUsd={bonusUsd} />
            <p className="mt-4 text-[16px] font-bold text-[#2a1e5c] dark:text-white">
               {filled} of {every} friends · ${stamps * rewardUsd + bonusesEarned * bonusUsd} earned
            </p>
            <div className="mt-2 h-2.5 rounded-full bg-[#ece6fa] dark:bg-dv2-tab">
               <div className="h-full rounded-full" style={{ width: `${(filled / every) * 100}%`, backgroundImage: PRIMARY_GRADIENT }} />
            </div>
            <p className="mt-2 text-[14px] font-semibold text-[#b07800] dark:text-[#ffe27a]">
               {filled === every ? `Card full! +$${bonusUsd} bonus is on its way 🎁` : `${toGo} more → +$${bonusUsd} bonus 🎁`}
            </p>
            {!unlocked ? (
               <p className="mt-3 flex items-center gap-1.5 rounded-[12px] bg-[#f4f1fb] px-3 py-2 text-[13px] font-semibold text-[#6b55f7] dark:bg-dv2-tab dark:text-[#b3a6ff]">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  Repay your first loan to start collecting
               </p>
            ) : null}
         </div>
      </section>
   );
}

/** Dashboard: one line of stamps that opens /affiliate. */
export function MiniStampStrip({
   stamps,
   every,
   rewardUsd,
   bonusUsd,
   unlocked,
   onOpen
}: {
   stamps: number;
   every: number;
   rewardUsd: number;
   bonusUsd: number;
   unlocked: boolean;
   onOpen: () => void;
}) {
   const { filled } = cardProgress(stamps, every);
   return (
      <button
         type="button"
         onClick={onOpen}
         className="mx-5 flex w-[calc(100%-40px)] flex-col gap-2 rounded-[8px] bg-white px-3 py-3 text-left shadow-[0_1px_2px_rgba(28,5,61,0.06)] active:scale-[0.99] dark:bg-dv2-card"
         aria-label={`Shark Fighter Card: ${filled} of ${every} friends. $${rewardUsd} per friend who repays on time.`}
      >
         <span className="flex items-center justify-between">
            <span className="text-[15px] font-black italic text-[#4c239f] dark:text-[#c4b8ff]">🦛 Shark Fighter Card</span>
            <span className="text-[13px] font-semibold text-[#7a6fa3] dark:text-[#b3a9d9]">
               {unlocked ? `${filled} of ${every} · $${rewardUsd} each` : 'Repay first to start 🔒'}
            </span>
         </span>
         <span className="flex items-center justify-between" aria-hidden="true">
            {Array.from({ length: every }, (_, index) =>
               index < filled ? (
                  <img key={index} src={stampSrc(index)} alt="" className="h-7 w-7 rounded-full object-cover" draggable={false} />
               ) : index === every - 1 ? (
                  <span
                     key={index}
                     className="flex h-7 w-7 items-center justify-center rounded-full text-[13px]"
                     style={{ backgroundImage: GOLD_GRADIENT }}
                     title={`+$${bonusUsd}`}
                  >
                     🎁
                  </span>
               ) : (
                  <span key={index} className="h-7 w-7 rounded-full border-2 border-dashed border-[#d6ceff] dark:border-[#4a3f7a]" />
               )
            )}
         </span>
      </button>
   );
}
