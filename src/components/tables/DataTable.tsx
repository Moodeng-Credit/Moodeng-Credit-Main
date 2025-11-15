import { type ReactNode } from 'react';

import { useStableKeys } from '@/hooks/useStableKeys';

export interface Column<T> {
   header: string;
   accessor: keyof T | ((row: T) => ReactNode);
   className?: string;
   mobileLabel?: string; // Label for mobile card view
}

interface DataTableProps<T> {
   columns: Column<T>[];
   data: T[];
   keyExtractor: (row: T) => string;
   emptyMessage?: string;
   className?: string;
}

export default function DataTable<T>({
   columns,
   data,
   keyExtractor,
   emptyMessage = 'No data available',
   className = ''
}: DataTableProps<T>) {
   const stableData = useStableKeys(data, keyExtractor);
   const getCellValue = (row: T, column: Column<T>): ReactNode => {
      if (typeof column.accessor === 'function') {
         return column.accessor(row);
      }
      return String(row[column.accessor]);
   };

   if (data.length === 0) {
      return (
         <div className="text-center py-8 text-gray-500">
            <p>{emptyMessage}</p>
         </div>
      );
   }

   return (
      <>
         {/* Desktop Table View */}
         <div className="hidden md:block overflow-x-auto">
            <table className={`w-full border-collapse ${className}`}>
               <thead>
                  <tr className="bg-gray-100 border-b">
                     {columns.map((column) => (
                        <th
                           key={column.header}
                           className={`px-4 py-3 text-left text-xs font-semibold text-gray-700 ${column.className || ''}`}
                        >
                           {column.header}
                        </th>
                     ))}
                  </tr>
               </thead>
               <tbody>
                  {stableData.map(({ id, content: row }) => (
                     <tr key={id} className="border-b hover:bg-gray-50 transition-colors">
                        {columns.map((column) => (
                           <td key={`${id}-${column.header}`} className={`px-4 py-3 text-sm ${column.className || ''}`}>
                              {getCellValue(row, column)}
                           </td>
                        ))}
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>

         {/* Mobile Card View */}
         <div className="md:hidden space-y-4">
            {stableData.map(({ id, content: row }) => (
               <div key={id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  {columns.map((column) => (
                     <div key={`${id}-${column.header}`} className="flex justify-between py-2 border-b last:border-b-0">
                        <span className="text-xs font-semibold text-gray-600">{column.mobileLabel || column.header}:</span>
                        <span className={`text-sm ${column.className || ''}`}>{getCellValue(row, column)}</span>
                     </div>
                  ))}
               </div>
            ))}
         </div>
      </>
   );
}
