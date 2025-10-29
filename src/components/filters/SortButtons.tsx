import { type MouseEvent } from 'react';

export type SortOption = 'lowest' | 'highest' | 'oldest' | 'newest';

interface SortButtonsProps {
   activeSort: string;
   onSortChange: (sortOption: SortOption) => void;
}

const sortOptions: Array<{ value: SortOption; label: string }> = [
   { value: 'lowest', label: 'Lowest' },
   { value: 'highest', label: 'Highest' },
   { value: 'oldest', label: 'Oldest' },
   { value: 'newest', label: 'Newest' }
];

export default function SortButtons({ activeSort, onSortChange }: SortButtonsProps) {
   const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      const value = (e.target as HTMLButtonElement).value as SortOption;
      onSortChange(value);
   };

   return (
      <div className="flex flex-wrap justify-start md:justify-end gap-3">
         {sortOptions.map(({ value, label }) => (
            <button
               key={value}
               onClick={handleClick}
               value={value}
               className={`text-[10px] md:text-xs border rounded px-3 py-1 flex items-center space-x-1 transition ${
                  activeSort === value
                     ? 'border-blue-600 bg-blue-50 text-blue-700'
                     : 'border-gray-300 hover:bg-gray-100 text-gray-700'
               }`}
            >
               <span>{label}</span>
               <i className="fas fa-filter text-xs"></i>
            </button>
         ))}
      </div>
   );
}
