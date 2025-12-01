import { Filter, Search } from 'lucide-react';

interface FilterButtonsProps {
   userRole: string;
}

export default function FilterButtons({ userRole }: FilterButtonsProps) {
   const isLender = userRole === 'lender';

   return (
      <div className="flex justify-between items-center mb-4">
         <button
            className="border border-[#2a56f4] text-[#2a56f4] font-semibold text-xs rounded-md px-4 py-2 flex items-center space-x-1"
            type="button"
         >
            <span>ALL {isLender ? 'FUNDINGS' : 'LOANS'}</span>
            <Filter size={12} />
         </button>
         <button className="border border-[#6b7280] text-[#6b7280] text-xs rounded-md px-4 py-2 flex items-center space-x-2" type="button">
            <Search size={12} />
            <span>SEARCH {isLender ? 'FUNDINGS' : 'LOANS'}</span>
         </button>
      </div>
   );
}
