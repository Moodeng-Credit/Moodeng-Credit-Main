/**
 * The 🇮🇩 mark for Indonesia-track requests and borrowers (loans.market / users.market = 'ID').
 * One look everywhere — request board, borrower cards, admin — so the team and lenders can tell an
 * Indonesian $5/$10 request apart at a glance. Red-and-white, readable in light and dark mode.
 */
type IndonesiaBadgeProps = {
   /** Just the flag (tight spaces like table rows). */
   compact?: boolean;
   /** Overrides the "Indonesia" text. */
   label?: string;
   className?: string;
};

export default function IndonesiaBadge({ compact = false, label = 'Indonesia', className = '' }: IndonesiaBadgeProps) {
   if (compact) {
      return (
         <span
            aria-label={label}
            className={`inline-flex shrink-0 items-center justify-center rounded-full border border-[#ce1126]/30 bg-white px-1 text-[12px] leading-[18px] dark:border-[#ff6b7a]/40 dark:bg-[#2a1216] ${className}`}
            role="img"
            title={label}
         >
            🇮🇩
         </span>
      );
   }
   return (
      <span
         className={`inline-flex shrink-0 items-center gap-1 overflow-hidden rounded-full border border-[#ce1126]/35 bg-[linear-gradient(180deg,#fff1f2_0%,#fff1f2_50%,#ffffff_50%,#ffffff_100%)] px-2 py-[1px] text-[12px] font-semibold leading-[18px] text-[#b00e20] dark:border-[#ff6b7a]/45 dark:bg-none dark:bg-[#2a1216] dark:text-[#ffb3bc] ${className}`}
         title={label}
      >
         <span aria-hidden="true">🇮🇩</span>
         {label}
      </span>
   );
}

/** Thin red top edge for an Indonesia-track card (pair with the card's own border). */
export const INDONESIA_CARD_ACCENT = 'border-t-[3px] border-t-[#ce1126] dark:border-t-[#ff4d5e]';
