import { useState } from 'react';

interface BrowseRequestsHeaderProps {
   searchValue: string;
   onSearchChange: (value: string) => void;
   onFilterClick: () => void;
}

export default function BrowseRequestsHeader({ searchValue, onSearchChange, onFilterClick }: BrowseRequestsHeaderProps) {
   return (
      <div className="mb-6">
         <h2 className="text-xl font-semibold text-gray-900 mb-4">Browse Latest Requests</h2>
         
         <div className="flex items-center gap-3">
            {/* Search Bar */}
            <div className="flex-1 relative">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fas fa-search text-gray-400"></i>
               </div>
               <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search requests"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
               />
            </div>
            
            {/* Filter Button */}
            <button
               onClick={onFilterClick}
               className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
               aria-label="Filter requests"
            >
               <i className="fas fa-filter text-purple-600 text-lg"></i>
            </button>
         </div>
      </div>
   );
}
