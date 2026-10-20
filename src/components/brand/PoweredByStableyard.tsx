// "Powered by Stableyard" attribution, required wherever Moodeng shows Stableyard-backed money
// features (deposit addresses, balances, transactions). Brand guidelines: https://stableyard.fi/brand
// Text-only for now — swap in Stableyard's official mark from the brand page once the asset is in
// the repo; don't hand-draw their logo.

export default function PoweredByStableyard({ className = '' }: { className?: string }) {
   return (
      <a
         href="https://stableyard.fi"
         target="_blank"
         rel="noopener noreferrer"
         className={`inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 ${className}`}
      >
         Powered by <span className="font-semibold">Stableyard</span>
      </a>
   );
}
