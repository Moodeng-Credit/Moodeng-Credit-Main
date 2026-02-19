import type { Milestone } from '@/views/profile/components/tabs/types';

interface MilestoneCardProps {
   milestone: Milestone;
   onView?: (id: string) => void;
}

const MilestoneCard = ({ milestone, onView }: MilestoneCardProps) => {
   const { id, title, description, status } = milestone;

   if (status === 'completed') {
      return (
         <div className="flex items-center gap-4 bg-white border border-[#e5e7eb] rounded-xl p-4 select-none">
            <div className="w-11 h-11 rounded-xl bg-[#dcfce7] flex items-center justify-center flex-shrink-0">
               <i className="fas fa-check text-[#22c55e] text-lg" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
               <p className="font-semibold text-sm text-[#111827] leading-snug">{title}</p>
               <p className="text-xs text-[#6b7280] mt-0.5">{description}</p>
            </div>
            <span className="text-xs font-semibold text-[#22c55e] bg-[#dcfce7] px-3 py-1 rounded-full flex-shrink-0">
               Done <i className="fas fa-check ml-1" aria-hidden="true" />
            </span>
         </div>
      );
   }

   if (status === 'next') {
      return (
         <div className="flex items-center gap-4 bg-white border border-[#7c3aed] rounded-xl p-4 shadow-sm select-none">
            <div className="w-11 h-11 rounded-xl bg-[#ede9fe] flex items-center justify-center flex-shrink-0">
               <i className="fas fa-star text-[#7c3aed] text-lg" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
               <p className="text-[10px] font-semibold text-[#7c3aed] uppercase tracking-wide mb-0.5">Next milestone</p>
               <p className="font-semibold text-sm text-[#111827] leading-snug">{title}</p>
               <p className="text-xs text-[#6b7280] mt-0.5">{description}</p>
            </div>
            <button
               type="button"
               onClick={() => onView?.(id)}
               className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex-shrink-0"
            >
               View Milestone
            </button>
         </div>
      );
   }

   // locked
   return (
      <div className="flex items-center gap-4 bg-white border border-[#e5e7eb] rounded-xl p-4 select-none opacity-75">
         <div className="w-11 h-11 rounded-xl bg-[#f3f4f6] flex items-center justify-center flex-shrink-0">
            <i className="fas fa-lock text-[#9ca3af] text-lg" aria-hidden="true" />
         </div>
         <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-[#111827] leading-snug">{title}</p>
            <p className="text-xs text-[#6b7280] mt-0.5">{description}</p>
         </div>
         <button
            type="button"
            disabled
            title="Complete previous milestone to unlock"
            className="bg-[#e5e7eb] text-[#6b7280] text-xs font-semibold px-4 py-2 rounded-lg flex-shrink-0 cursor-not-allowed"
         >
            Locked <i className="fas fa-lock ml-1" aria-hidden="true" />
         </button>
      </div>
   );
};

export default MilestoneCard;
