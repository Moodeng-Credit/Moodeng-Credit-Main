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
      <div className="p-4 bg-white rounded-2xl shadow-md mx-auto">
         <h2 className="text-lg font-bold text-indigo-900">Loan Insights</h2>

         <DayPicker
            month={month}
            onMonthChange={setMonth}
            numberOfMonths={1}
            navLayout="around"
            mode="range"
            modifiers={modifiers}
            modifiersClassNames={modifiersClassNames}
            disabled
         />

         <div className="flex gap-4 justify-center text-sm">
            <div className="flex items-center gap-1">
               <span className="w-3 h-3 bg-orange-500 rounded-full"></span> Active Loans
            </div>
            <div className="flex items-center gap-1">
               <span className="w-3 h-3 bg-red-500 rounded-full"></span> Defaulted
            </div>
            <div className="flex items-center gap-1">
               <span className="w-3 h-3 bg-purple-500 rounded-full"></span> Pending
            </div>
         </div>
      </div>
   );
}
