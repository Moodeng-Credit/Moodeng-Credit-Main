import { useState } from 'react';

import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

export default function Calendar() {
   const [month, setMonth] = useState(new Date(2025, 1));

   const active = new Date(2025, 1, 17);
   const defaulted = new Date(2025, 1, 14);
   const pending = new Date(2025, 1, 8);

   const modifiers = { active, defaulted, pending };
   const modifiersClassNames = {
      active: 'bg-orange-500 text-white rounded-full',
      defaulted: 'bg-red-500 text-white rounded-full',
      pending: 'bg-purple-500 text-white rounded-full'
   };

   return (
      <div className="p-6 bg-white rounded-3xl shadow-lg mx-auto" style={{ maxWidth: '750px' }}>
         <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Loan Insights</h2>

            <div className="flex items-center gap-4">
               <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5">
                     <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
                     <span className="text-gray-700">Active Loans</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                     <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                     <span className="text-gray-700">Defaulted</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                     <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
                     <span className="text-gray-700">Pending</span>
                  </div>
               </div>
            </div>
         </div>

         <div className="relative">
            <DayPicker
               month={month}
               onMonthChange={setMonth}
               numberOfMonths={2}
               showOutsideDays
               modifiers={modifiers}
               modifiersClassNames={modifiersClassNames}
               classNames={{
                  root: 'rdp-root',
                  months: 'flex gap-8 px-12',
                  month: 'flex-1',
                  month_caption: 'flex justify-center items-center mb-4',
                  caption_label: 'text-lg font-semibold text-gray-900',
                  nav: 'absolute top-0 left-0 right-0 flex justify-between items-center px-0 pointer-events-none',
                  button_previous:
                     'h-8 w-8 bg-transparent hover:bg-gray-100 rounded-md flex items-center justify-center transition-colors text-indigo-600 pointer-events-auto',
                  button_next:
                     'h-8 w-8 bg-transparent hover:bg-gray-100 rounded-md flex items-center justify-center transition-colors text-indigo-600 pointer-events-auto',
                  month_grid: 'w-full border-spacing-0 border-collapse',
                  weekday: 'text-gray-500 font-medium text-xs text-center p-0 w-10 h-10',
                  day: 'text-center p-0 w-10 h-10',
                  day_button:
                     'w-full h-full rounded-full font-normal hover:bg-gray-100 transition-colors inline-flex items-center justify-center m-auto',
                  selected: 'bg-blue-500 text-white hover:bg-blue-600',
                  today: 'font-semibold',
                  outside: 'text-gray-400 opacity-50',
                  disabled: 'text-gray-300 cursor-not-allowed'
               }}
            />
         </div>
      </div>
   );
}
