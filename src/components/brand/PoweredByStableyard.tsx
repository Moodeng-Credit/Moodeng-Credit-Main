// "Powered by Stableyard" attribution, required wherever Moodeng shows Stableyard-backed money
// features (deposit addresses, balances, transactions). Brand guidelines: https://stableyard.fi/brand
// The wordmark is Stableyard's official file (public/brand/stableyard/, from the brand page), used
// whole and never recolored. It's dark ink, so it always sits on a white chip — in dark mode too —
// with the ≥12px clear space the guidelines ask for.

export default function PoweredByStableyard({ className = '' }: { className?: string }) {
   return (
      <a
         href="https://stableyard.fi"
         target="_blank"
         rel="noopener noreferrer"
         aria-label="Powered by Stableyard"
         className={`inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 ring-1 ring-black/5 transition-opacity hover:opacity-80 ${className}`}
      >
         <span className="text-[11px] font-medium text-[#6b7280]">Powered by</span>
         <img src="/brand/stableyard/stableyard-wordmark.svg" alt="Stableyard" width={72} height={16} className="h-4 w-auto" />
      </a>
   );
}
