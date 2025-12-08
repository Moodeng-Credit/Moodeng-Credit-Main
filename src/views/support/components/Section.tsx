import { type ReactNode } from 'react';

import { clsx } from '@/views/support/util/clsx';

export default function Section(props: { header: ReactNode; content: ReactNode; bg?: boolean }) {
   return (
      <div
         className={clsx('flex flex-col px-6 md:px-20 py-16 min-h-[80svh] justify-center', {
            'bg-[#c9d5f9]': props.bg
         })}
      >
         <div className="flex flex-col lg:flex-row justify-between items-start md:items-center gap-4 sm:gap-8 lg:pe-16">
            <h2 className="text-5xl font-bold text-blue-600">{props.header}</h2>
            <div className="max-w-lg flex flex-col gap-8 w-full text-xl">{props.content}</div>
         </div>
      </div>
   );
}
