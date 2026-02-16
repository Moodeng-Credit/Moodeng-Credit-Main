import { useState } from 'react';

import Button from '@/components/ui/Button';
import type { TransactionFilters } from '@v2/types/transactionTypes';

interface FilterModalProps {
   isOpen: boolean;
   onClose: () => void;
   onApply: (filters: TransactionFilters) => void;
   currentFilters: TransactionFilters;
}

export default function FilterModal({ isOpen, onClose, onApply, currentFilters }: FilterModalProps) {
   const [sortType, setSortType] = useState<string>(currentFilters.sort || '');
   const [selectedStatuses, setSelectedStatuses] = useState<string[]>(currentFilters.status || []);

   if (!isOpen) return null;

   const handleApply = () => {
      onApply({
         sort: sortType as TransactionFilters['sort'],
         status: selectedStatuses.length > 0 ? selectedStatuses : undefined
      });
      onClose();
   };

   const toggleStatus = (status: string) => {
      setSelectedStatuses((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
   };

   return (
      <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" onClick={onClose}>
         {/* Backdrop */}
         <div className="absolute inset-0 bg-black bg-opacity-50" />

         {/* Modal Content - Bottom Sheet Style */}
         <div
            className="relative bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto transition-transform duration-300"
            onClick={(e) => e.stopPropagation()}
         >
            {/* Handle bar for mobile */}
            <div className="flex justify-center pt-3 pb-2 md:hidden">
               <div className="w-12 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
               <h2 className="text-lg font-bold text-gray-900">Transaction History Filters</h2>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-6">
               {/* Transaction Type (Sorting) */}
               <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Transaction Type</h3>
                  <div className="space-y-2">
                     <label className="flex items-center gap-3 cursor-pointer">
                        <input
                           type="radio"
                           name="sort"
                           value="amount_asc"
                           checked={sortType === 'amount_asc'}
                           onChange={(e) => setSortType(e.target.value)}
                           className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Low to High</span>
                     </label>

                     <label className="flex items-center gap-3 cursor-pointer">
                        <input
                           type="radio"
                           name="sort"
                           value="amount_desc"
                           checked={sortType === 'amount_desc'}
                           onChange={(e) => setSortType(e.target.value)}
                           className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">High to Low</span>
                     </label>

                     <label className="flex items-center gap-3 cursor-pointer">
                        <input
                           type="radio"
                           name="sort"
                           value="date_desc"
                           checked={sortType === 'date_desc'}
                           onChange={(e) => setSortType(e.target.value)}
                           className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">New to Old</span>
                     </label>

                     <label className="flex items-center gap-3 cursor-pointer">
                        <input
                           type="radio"
                           name="sort"
                           value="date_asc"
                           checked={sortType === 'date_asc'}
                           onChange={(e) => setSortType(e.target.value)}
                           className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Old to New</span>
                     </label>
                  </div>
               </div>

               {/* Status */}
               <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Status</h3>
                  <div className="space-y-2">
                     {['pending', 'active', 'partial', 'paid', 'default'].map((status) => (
                        <label key={status} className="flex items-center gap-3 cursor-pointer">
                           <input
                              type="checkbox"
                              checked={selectedStatuses.includes(status)}
                              onChange={() => toggleStatus(status)}
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
                           />
                           <span className="text-sm text-gray-700 capitalize">{status}</span>
                        </label>
                     ))}
                  </div>
               </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200">
               <Button variant="primary" size="lg" fullWidth onClick={handleApply}>
                  Apply Filter
               </Button>
            </div>
         </div>
      </div>
   );
}
