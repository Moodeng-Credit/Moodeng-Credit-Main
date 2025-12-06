'use client';

import { useState, useRef, useEffect } from 'react';

export type AmountSort = 'lowest' | 'highest';
export type DateSort = 'newest' | 'oldest';

interface FilterPillsProps {
   amountSort: AmountSort;
   dateSort: DateSort;
   selectedTags: string[];
   availableTags: string[];
   onAmountSortChange: (sort: AmountSort) => void;
   onDateSortChange: (sort: DateSort) => void;
   onTagsChange: (tags: string[]) => void;
}

interface DropdownProps {
   isOpen: boolean;
   onClose: () => void;
   children: React.ReactNode;
}

function Dropdown({ isOpen, onClose, children }: DropdownProps) {
   const ref = useRef<HTMLDivElement>(null);

   useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
         if (ref.current && !ref.current.contains(event.target as Node)) {
            onClose();
         }
      };

      if (isOpen) {
         document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
         document.removeEventListener('mousedown', handleClickOutside);
      };
   }, [isOpen, onClose]);

   return (
      <div
         ref={ref}
         className={`
            absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px] overflow-hidden
            transform transition-all duration-200 ease-out origin-top
            ${isOpen
               ? 'opacity-100 scale-100 translate-y-0'
               : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
            }
         `}
      >
         {children}
      </div>
   );
}

interface PillButtonProps {
   label: string;
   isActive: boolean;
   onClick: () => void;
}

function PillButton({ label, isActive, onClick }: PillButtonProps) {
   return (
      <button
         onClick={onClick}
         className={`
            flex items-center justify-between min-w-[140px] px-4 py-2.5 rounded-lg text-sm
            transition-all duration-200 ease-out cursor-pointer
            bg-white border text-gray-700
            hover:border-gray-400 hover:shadow-sm
            ${isActive
               ? 'border-blue-500 shadow-sm font-semibold text-gray-900'
               : 'border-gray-300'
            }
         `}
      >
         <span>{label}</span>
         <svg
            className={`w-4 h-4 ml-6 transition-colors duration-200 ${isActive ? 'text-blue-500' : 'text-gray-500'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
         >
            <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
         </svg>
      </button>
   );
}

interface DropdownOptionProps {
   label: string;
   isSelected: boolean;
   onClick: () => void;
}

function DropdownOption({ label, isSelected, onClick }: DropdownOptionProps) {
   return (
      <button
         onClick={onClick}
         className={`
            w-full px-4 py-2.5 text-left text-sm cursor-pointer
            transition-all duration-150 ease-out
            ${isSelected
               ? 'bg-blue-50 text-blue-600 font-medium'
               : 'text-gray-700 hover:bg-gray-50'
            }
         `}
      >
         {label}
      </button>
   );
}

export default function FilterPills({
   amountSort,
   dateSort,
   selectedTags,
   availableTags,
   onAmountSortChange,
   onDateSortChange,
   onTagsChange
}: FilterPillsProps) {
   const [openDropdown, setOpenDropdown] = useState<'amount' | 'date' | 'tags' | null>(null);

   const handleAmountClick = () => {
      setOpenDropdown(openDropdown === 'amount' ? null : 'amount');
   };

   const handleDateClick = () => {
      setOpenDropdown(openDropdown === 'date' ? null : 'date');
   };

   const handleTagsClick = () => {
      setOpenDropdown(openDropdown === 'tags' ? null : 'tags');
   };

   const closeDropdown = () => {
      setOpenDropdown(null);
   };

   const handleTagToggle = (tag: string) => {
      if (selectedTags.includes(tag)) {
         onTagsChange(selectedTags.filter(t => t !== tag));
      } else {
         onTagsChange([...selectedTags, tag]);
      }
   };

   const amountLabel = amountSort === 'lowest' ? 'Lowest' : 'Highest';
   const dateLabel = dateSort === 'newest' ? 'Latest' : 'Oldest';
   const tagsLabel = selectedTags.length > 0
      ? `Tags (${selectedTags.length})`
      : 'Tags';

   return (
      <div className="flex flex-wrap gap-3">
         {/* Amount Pill */}
         <div className="relative">
            <PillButton
               label={amountLabel}
               isActive={openDropdown === 'amount'}
               onClick={handleAmountClick}
            />
            <Dropdown isOpen={openDropdown === 'amount'} onClose={closeDropdown}>
               <DropdownOption
                  label="Lowest"
                  isSelected={amountSort === 'lowest'}
                  onClick={() => {
                     onAmountSortChange('lowest');
                     closeDropdown();
                  }}
               />
               <DropdownOption
                  label="Highest"
                  isSelected={amountSort === 'highest'}
                  onClick={() => {
                     onAmountSortChange('highest');
                     closeDropdown();
                  }}
               />
            </Dropdown>
         </div>

         {/* Date Pill */}
         <div className="relative">
            <PillButton
               label={dateLabel}
               isActive={openDropdown === 'date'}
               onClick={handleDateClick}
            />
            <Dropdown isOpen={openDropdown === 'date'} onClose={closeDropdown}>
               <DropdownOption
                  label="Latest"
                  isSelected={dateSort === 'newest'}
                  onClick={() => {
                     onDateSortChange('newest');
                     closeDropdown();
                  }}
               />
               <DropdownOption
                  label="Oldest"
                  isSelected={dateSort === 'oldest'}
                  onClick={() => {
                     onDateSortChange('oldest');
                     closeDropdown();
                  }}
               />
            </Dropdown>
         </div>

         {/* Tags Pill - Commented out for now */}
         {/* <div className="relative">
            <PillButton
               label={tagsLabel}
               isActive={openDropdown === 'tags' || selectedTags.length > 0}
               onClick={handleTagsClick}
            />
            <Dropdown isOpen={openDropdown === 'tags'} onClose={closeDropdown}>
               {availableTags.length > 0 ? (
                  availableTags.map((tag) => (
                     <button
                        key={tag}
                        onClick={() => handleTagToggle(tag)}
                        className={`
                           w-full px-4 py-2.5 text-left text-sm cursor-pointer
                           flex items-center justify-between
                           transition-all duration-150 ease-out
                           ${selectedTags.includes(tag)
                              ? 'bg-blue-50 text-blue-600 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                           }
                        `}
                     >
                        <span>{tag}</span>
                        {selectedTags.includes(tag) && (
                           <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                           </svg>
                        )}
                     </button>
                  ))
               ) : (
                  <div className="px-4 py-3 text-gray-500 text-sm">No tags available</div>
               )}
               {selectedTags.length > 0 && (
                  <button
                     onClick={() => {
                        onTagsChange([]);
                        closeDropdown();
                     }}
                     className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 border-t border-gray-200 cursor-pointer transition-all duration-150 ease-out"
                  >
                     Clear all
                  </button>
               )}
            </Dropdown>
         </div> */}
      </div>
   );
}
