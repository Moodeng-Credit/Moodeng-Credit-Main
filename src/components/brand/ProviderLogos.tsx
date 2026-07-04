// Shared brand marks for the payment/exchange providers Moodeng surfaces (funding,
// withdrawing, repaying). Single source so the money screens and the Academy money
// guide render identical logos. Each Mark is a bare SVG; each *Tile wraps it in the
// provider's rounded brand tile at the size passed via className.

type LogoProps = { className?: string };

export function BinanceMark({ className = '' }: LogoProps) {
   return (
      <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
         <path fill="#F3BA2F" d="m16.624 13.92 2.717 2.716-7.353 7.353-7.352-7.352 2.717-2.717 4.636 4.66 4.635-4.66zm4.637-4.636L24 12l-2.715 2.716L18.568 12l2.693-2.716zm-9.272 0 2.716 2.692-2.717 2.717L9.272 12l2.716-2.715zm-9.273 0L5.41 12l-2.692 2.692L0 12l2.716-2.716zM11.99.01l7.352 7.33-2.717 2.715-4.636-4.636-4.635 4.66-2.717-2.716L11.989.011z" />
      </svg>
   );
}

export function CoinsPhMark({ className = '' }: LogoProps) {
   return (
      <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
         <circle cx="50" cy="50" r="50" fill="#F0A500" />
         <circle cx="50" cy="50" r="41" fill="#3B6CC8" />
         <path d="M62 36 A18 18 0 1 0 62 64" fill="none" stroke="#FFFFFF" strokeWidth="11" strokeLinecap="round" />
      </svg>
   );
}

export function GCashMark({ className = '' }: LogoProps) {
   return (
      <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
         <path d="M64 22 A30 30 0 1 0 64 78" fill="none" stroke="#1C84FF" strokeWidth="11" strokeLinecap="round" />
         <path d="M56 35 A18 18 0 1 0 56 65 L56 50 L43 50" fill="none" stroke="#0A2FA8" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
         <path d="M76 39 A16 16 0 0 1 76 61" fill="none" stroke="#45C7FF" strokeWidth="6.5" strokeLinecap="round" />
         <path d="M85 31 A25 25 0 0 1 85 69" fill="none" stroke="#45C7FF" strokeWidth="6.5" strokeLinecap="round" />
      </svg>
   );
}

export function PdaxMark({ className = '' }: LogoProps) {
   return (
      <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
         <circle cx="50" cy="50" r="50" fill="#0E1A2B" />
         <g fill="#19D86F">
            <path d="M34 30 H49 L37 70 H22 Z" />
            <path d="M59 30 H74 L62 70 H47 Z" />
         </g>
      </svg>
   );
}

export function UsdcMark({ className = '' }: LogoProps) {
   return (
      <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
         <circle cx="12" cy="12" r="12" fill="#2775CA" />
         <svg x="5" y="4" width="14" height="16" viewBox="0 0 14 16">
            <path fill="#FFFFFF" fillRule="evenodd" d="M5.5 13.47c0 .19-.15.29-.33.24a5.995 5.995 0 0 1 0-11.42c.18-.06.33.05.33.24v.46c0 .13-.1.27-.22.31C3.37 4 2 5.84 2 7.99s1.37 3.99 3.28 4.69c.12.04.22.19.22.31v.47Z" />
            <path fill="#FFFFFF" fillRule="evenodd" d="M7.5 11.75c0 .14-.11.25-.25.25h-.5c-.14 0-.25-.11-.25-.25v-.79c-1.09-.15-1.62-.76-1.77-1.59c-.03-.14.09-.27.23-.27h.57c.12 0 .22.08.24.2c.11.5.39.87 1.27.87c.65 0 1.1-.36 1.1-.9s-.27-.74-1.22-.9c-1.4-.19-2.06-.61-2.06-1.71c0-.85.64-1.5 1.63-1.65v-.77c0-.14.11-.25.25-.25h.5c.14 0 .25.11.25.25v.8c.81.14 1.32.6 1.48 1.36c.03.14-.08.28-.23.28h-.53c-.11 0-.21-.08-.24-.18c-.14-.48-.49-.69-1.08-.69c-.66 0-1 .32-1 .77c0 .47.19.71 1.21.86c1.37.19 2.08.58 2.08 1.75c0 .89-.66 1.61-1.69 1.77v.79Z" />
            <path fill="#FFFFFF" fillRule="evenodd" d="M8.83 13.71c-.18.06-.33-.05-.33-.24v-.46c0-.14.08-.27.22-.31C10.63 12 12 10.16 12 8.01s-1.37-3.99-3.28-4.69a.36.36 0 0 1-.22-.31v-.46c0-.19.15-.3.33-.24C11.25 3.08 13 5.35 13 8.02s-1.75 4.93-4.17 5.71Z" />
         </svg>
      </svg>
   );
}

export function BaseMark({ className = '' }: LogoProps) {
   return (
      <svg viewBox="0 0 512 512" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
         <rect width="512" height="512" rx="96" fill="#0957FF" />
         <circle cx="256" cy="256" r="180" fill="#FFFFFF" />
         <rect x="198" y="198" width="116" height="116" rx="12" fill="#0957FF" />
      </svg>
   );
}

// Provider brand tiles — rounded square in the provider's brand color with the mark
// centered. `className` sets the tile size (e.g. "w-6 h-6").
export function BinanceTile({ className = '' }: LogoProps) {
   return (
      <span className={`inline-flex items-center justify-center rounded-[6px] bg-[#181A20] ${className}`}>
         <BinanceMark className="w-[54%] h-[54%]" />
      </span>
   );
}
export function CoinsPhTile({ className = '' }: LogoProps) {
   return (
      <span className={`inline-flex items-center justify-center overflow-hidden rounded-[6px] ${className}`}>
         <CoinsPhMark className="h-full w-full" />
      </span>
   );
}
export function GCashTile({ className = '' }: LogoProps) {
   return (
      <span className={`inline-flex items-center justify-center rounded-[6px] bg-white ${className}`}>
         <GCashMark className="h-[86%] w-[86%]" />
      </span>
   );
}
export function PdaxTile({ className = '' }: LogoProps) {
   return (
      <span className={`inline-flex items-center justify-center overflow-hidden rounded-[6px] bg-[#0B1426] ${className}`}>
         <PdaxMark className="h-[82%] w-[82%]" />
      </span>
   );
}
