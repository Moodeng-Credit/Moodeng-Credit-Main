import type { SortOption } from '@/utils/loanFilters';

interface SortButtonsProps {
   activeSort: SortOption | '';
   onSortChange: (sortOption: SortOption | '') => void;
}

const sortOptions: Array<{ value: SortOption; label: string }> = [
   { value: 'lowest', label: 'Lowest' },
   { value: 'highest', label: 'Highest' },
   { value: 'oldest', label: 'Oldest' },
   { value: 'newest', label: 'Newest' }
];

export default function SortButtons({ activeSort, onSortChange }: SortButtonsProps) {
   //TODO: migrate to zustand
   // const sortBy = useRequestBoardFilterContext((state) => state.sortBy);
   // const setSortBy = useRequestBoardFilterContext((state) => state.setSortBy);

   return (
      <div className="flex flex-wrap justify-start md:justify-end gap-3">
         {sortOptions.map(({ value, label }) => (
            <button
               key={value}
               onClick={() => onSortChange(value)}
               className={`text-[10px] md:text-xs border rounded px-3 py-1 flex items-center space-x-1 transition ${
                  activeSort === value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 hover:bg-gray-100 text-gray-700'
               }`}
            >
               <span>{label}</span>
               <i className="fas fa-filter text-xs"></i>
            </button>
         ))}
      </div>
   );
}
