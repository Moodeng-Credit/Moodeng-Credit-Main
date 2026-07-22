/**
 * A gold-and-diamond "Power Lender" pill for hand-picked high-trust funders.
 * Mirrors the diamond-studded gold avatar ring (see {@link UserAvatar}) so the
 * reward reads as one cohesive treatment across the app.
 *
 * Render it only for power lenders — gate the call site with
 * {@link import('@/config/powerLenders').isPowerLender}.
 */
export default function PowerLenderBadge({ className = '' }: { className?: string }) {
   return (
      <span
         className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-2 pr-3 shadow-[0_2px_8px_rgba(183,121,22,0.28)] bg-[conic-gradient(from_145deg,#f6d365,#fff3b0,#b97916,#fff0a3,#f6d365)] ${className}`}
      >
         {/* Diamond gem — same facet styling as the avatar ring studs */}
         <span
            aria-hidden="true"
            className="rounded-[2px] border-[0.5px] border-white/85"
            style={{
               width: 11,
               height: 11,
               transform: 'rotate(45deg)',
               background: 'linear-gradient(135deg,#ffffff 0%,#dff3ff 35%,#8fd4ff 60%,#5cb6ff 100%)',
               boxShadow: '0 0 4px rgba(150,220,255,0.9),0 1px 2px rgba(0,0,0,0.25)'
            }}
         />
         <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#5a3a0a] whitespace-nowrap">
            Power Lender
         </span>
      </span>
   );
}
