export const stampSrc = (index: number) => `/shark-fighter/stamp-${(index % 10) + 1}.webp`;

/** Where the borrower is on their current card. */
export function cardProgress(stamps: number, every: number) {
   const safeEvery = Math.max(1, every);
   const full = Math.floor(stamps / safeEvery);
   // A card that was just completed shows full until the next friend starts a new one.
   const justCompleted = stamps > 0 && stamps % safeEvery === 0;
   const filled = justCompleted ? safeEvery : stamps % safeEvery;
   return { filled, cardNumber: justCompleted ? full : full + 1, toGo: safeEvery - filled };
}
