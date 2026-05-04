import { useNavigate } from 'react-router-dom';

import { ICON_MASK_BASE } from '@/views/support/constants';

interface SearchBarProps {
   placeholder: string;
   value: string;
   onChange: (value: string) => void;
   showFilter?: boolean;
   filterPath?: string;
   filterActive?: boolean;
   onFilterClick?: () => void;
}

export default function SearchBar({
   placeholder,
   value,
   onChange,
   showFilter,
   filterPath,
   filterActive,
   onFilterClick
}: SearchBarProps) {
   const navigate = useNavigate();
   const handleFilterClick = () => {
      if (onFilterClick) {
         onFilterClick();
         return;
      }
      if (filterPath) navigate(filterPath);
   };

   return (
      <div className="flex items-center gap-md-2 w-full">
         <div className="flex-1 flex items-center gap-md-2 bg-md-neutral-100 border border-md-neutral-400 rounded-md-input px-md-3 py-md-2 transition-colors focus-within:border-md-primary-1200 focus-within:ring-2 focus-within:ring-md-primary-900/20">
            <div
               className="w-5 h-5 bg-md-neutral-1000 shrink-0"
               style={{
                  ...ICON_MASK_BASE,
                  WebkitMaskImage: "url('/icons/search.svg')",
                  maskImage: "url('/icons/search.svg')"
               }}
            />
            <input
               type="text"
               value={value}
               onChange={(e) => onChange(e.target.value)}
               placeholder={placeholder}
               className="flex-1 min-w-0 bg-transparent text-md-b1 text-md-neutral-1900 placeholder:text-md-neutral-1000 outline-none"
            />
         </div>
         {showFilter ? (
            <button
               type="button"
               onClick={handleFilterClick}
               aria-label="Filter"
               aria-pressed={filterActive}
               className={[
                  'w-12 h-12 shrink-0 flex items-center justify-center border rounded-md-input transition-colors',
                  filterActive
                     ? 'border-md-primary-1200 bg-md-primary-100'
                     : 'border-md-primary-900 bg-md-neutral-100'
               ].join(' ')}
            >
               <div
                  className="w-6 h-6 bg-md-primary-900"
                  style={{
                     ...ICON_MASK_BASE,
                     WebkitMaskImage: "url('/icons/filter.png')",
                     maskImage: "url('/icons/filter.png')"
                  }}
               />
            </button>
         ) : null}
      </div>
   );
}
