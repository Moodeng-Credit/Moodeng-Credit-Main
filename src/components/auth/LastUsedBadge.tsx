import { type JSX } from 'react';

interface LastUsedBadgeProps {
   /** 'md' for full-width buttons, 'sm' for compact icon tiles. */
   size?: 'md' | 'sm';
   className?: string;
}

/** Small gold "Last used" pill (gold like the main borrower buttons, 2026-11-25), positioned absolutely by the parent (which must be `relative`). */
export default function LastUsedBadge({ size = 'md', className = '' }: LastUsedBadgeProps): JSX.Element {
   const sizing = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]';
   return (
      <span
         className={`pointer-events-none absolute z-10 whitespace-nowrap rounded-full bg-[#FFC83D] font-bold leading-none text-[#3A2A00] shadow-sm ${sizing} ${className}`}
      >
         Last used
      </span>
   );
}
