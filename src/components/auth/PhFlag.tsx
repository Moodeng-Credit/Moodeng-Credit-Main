import type { JSX } from 'react';

/**
 * Small Philippine flag for the +63 phone fields. Drawn rather than the 🇵🇭 emoji, which shows as
 * the letters "PH" on Windows and some older Android builds.
 */
export function PhFlag({ className = 'h-[14px] w-5' }: { className?: string }): JSX.Element {
   return (
      <svg viewBox="0 0 30 15" className={`${className} shrink-0 overflow-hidden rounded-[2px]`} aria-hidden focusable="false">
         <rect width="30" height="7.5" fill="#0038A8" />
         <rect y="7.5" width="30" height="7.5" fill="#CE1126" />
         <path d="M0 0 L13 7.5 L0 15 Z" fill="#FFFFFF" />
         <circle cx="4.6" cy="7.5" r="1.6" fill="#FCD116" />
         <circle cx="1.4" cy="2" r="0.55" fill="#FCD116" />
         <circle cx="1.4" cy="13" r="0.55" fill="#FCD116" />
         <circle cx="10" cy="7.5" r="0.55" fill="#FCD116" />
      </svg>
   );
}
