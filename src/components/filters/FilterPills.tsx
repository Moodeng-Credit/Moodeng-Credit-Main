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

   if (!isOpen) return null;

   return (
      <div
         ref={ref}
         className="absolute top-full left-0 mt-2 bg-[#1e1b2e] border border-[#3d3a50] rounded-lg shadow-lg z-50 min-w-[140px] overflow-hidden"
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
            flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
            transition-all duration-200 cursor-pointer
            ${isActive
               ? 'bg-[#6d57ff] text-white shadow-[0_0_12px_rgba(109,87,255,0.3)]'
               : 'bg-[#2a2739] text-gray-300 hover:bg-[#3d3a50] border border-[#3d3a50]'
            }
         `}
      >
         <span>{label}</span>
         <i className="fas fa-filter text-xs opacity-70"></i>
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
            w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer
            ${isSelected
               ? 'bg-[#6d57ff] text-white'
               : 'text-gray-300 hover:bg-[#3d3a50]'
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

         {/* Tags Pill */}
         <div className="relative">
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
                           w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer
                           flex items-center justify-between
                           ${selectedTags.includes(tag)
                              ? 'bg-[#6d57ff]/20 text-white'
                              : 'text-gray-300 hover:bg-[#3d3a50]'
                           }
                        `}
                     >
                        <span>{tag}</span>
                        {selectedTags.includes(tag) && (
                           <i className="fas fa-check text-[#6d57ff] text-xs"></i>
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
                     className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-[#3d3a50] border-t border-[#3d3a50] cursor-pointer"
                  >
                     Clear all
                  </button>
               )}
            </Dropdown>
         </div>
      </div>
   );
}
