'use client';

import { useEffect, useRef, useState } from 'react';

import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { DayPicker } from 'react-day-picker';

interface DatePickerProps {
   value: Date | null;
   onChange: (date: Date | null) => void;
   placeholder?: string;
}

export default function DatePicker({ value, onChange, placeholder = 'Pick a date...' }: DatePickerProps) {
   const [isOpen, setIsOpen] = useState(false);
   const [month, setMonth] = useState(value || new Date());
   const containerRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
         if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
            setIsOpen(false);
         }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
   }, []);

   useEffect(() => {
      if (value) {
         setMonth(value);
      }
   }, [value]);

   const handleSelect = (date: Date | undefined) => {
      onChange(date || null);
      setIsOpen(false);
   };

   return (
      <div className="relative" ref={containerRef}>
         <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between border border-gray-300 rounded-lg px-4 py-2.5 text-sm hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-white transition-all duration-200"
         >
            <span className={value ? 'text-gray-900' : 'text-gray-400'}>
               {value ? format(value, 'MMM dd, yyyy') : placeholder}
            </span>
            <Calendar className="w-5 h-5 text-gray-400" />
         </button>

         <div
            className={`absolute z-50 mt-1 right-0 bg-white border border-gray-200 rounded-lg shadow-lg transition-all duration-200 origin-top-right ${
               isOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'
            }`}
         >
            <div className="p-3">
               {/* Header with month navigation */}
               <div className="flex items-center justify-between mb-2">
                  <button
                     type="button"
                     onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1))}
                     className="p-1 hover:bg-gray-100 rounded transition-colors duration-150"
                  >
                     <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  <h3 className="text-xs font-semibold text-gray-900">{format(month, 'MMMM yyyy')}</h3>
                  <button
                     type="button"
                     onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1))}
                     className="p-1 hover:bg-gray-100 rounded transition-colors duration-150"
                  >
                     <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
               </div>

               {/* Weekday headers */}
               <div className="grid grid-cols-7 mb-1">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                     <div key={day} className="text-center text-[10px] font-medium text-gray-500 py-1 w-7">
                        {day}
                     </div>
                  ))}
               </div>

               {/* Calendar */}
               <DayPicker
                  mode="single"
                  month={month}
                  onMonthChange={setMonth}
                  selected={value || undefined}
                  onSelect={handleSelect}
                  showOutsideDays
                  fixedWeeks
                  components={{
                     Nav: () => null
                  }}
                  classNames={{
                     root: '',
                     months: '',
                     month: '',
                     month_caption: 'hidden',
                     nav: 'hidden',
                     month_grid: 'w-full border-collapse',
                     weekdays: 'hidden',
                     week: 'flex',
                     day: 'flex-1 text-center',
                     day_button:
                        'w-7 h-7 rounded text-xs font-medium transition-all duration-150 hover:bg-blue-50 hover:text-blue-600 inline-flex items-center justify-center',
                     selected: '!bg-blue-600 !text-white hover:!bg-blue-700',
                     today: 'bg-gray-100 font-semibold',
                     outside: 'text-gray-300',
                     disabled: 'text-gray-300 cursor-not-allowed hover:bg-transparent'
                  }}
               />

               {/* Footer */}
               <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                  <button
                     type="button"
                     onClick={() => {
                        onChange(null);
                        setIsOpen(false);
                     }}
                     className="text-xs text-gray-500 hover:text-gray-700 transition-colors duration-150"
                  >
                     Clear
                  </button>
                  <button
                     type="button"
                     onClick={() => {
                        onChange(new Date());
                        setIsOpen(false);
                     }}
                     className="text-xs text-blue-600 font-medium hover:text-blue-700 transition-colors duration-150"
                  >
                     Today
                  </button>
               </div>
            </div>
         </div>
      </div>
   );
}
