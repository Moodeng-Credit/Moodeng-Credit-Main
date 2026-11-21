import { Check, X } from 'lucide-react';

import { type DocExampleSpec, EXAMPLE_MUST_SHOW } from '@/app/documents/incomeDocKinds';

// A drawn look-alike of a good document, big enough to read on a phone, with the common wrong one
// under it — so nobody has to guess what to send. The numbers 1–3 mark what must show (name, dates,
// money coming in). Sample data only.

const Mark = ({ n }: { n: number }) => (
   <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-[#6b55f7] text-[13px] font-bold leading-none text-white">{n}</span>
);

export function DocExample({ spec, mustShow = EXAMPLE_MUST_SHOW }: { spec: DocExampleSpec; mustShow?: string[] }) {
   return (
      <div className="flex flex-col gap-2.5">
         <figure className="relative flex flex-col gap-2 rounded-[16px] border-2 border-b-4 border-[#4aa256] bg-white px-3.5 pb-3 pt-3 dark:bg-[#1b1526]">
            <figcaption className="absolute -top-3 left-3 flex items-center gap-1 rounded-full bg-[#4aa256] px-2.5 py-0.5 text-[13px] font-bold text-white">
               <Check aria-hidden="true" className="size-3.5" strokeWidth={4} />
               Like this
            </figcaption>
            <span className="mt-1 truncate text-[11px] font-bold uppercase tracking-[0.05em] text-[#a49cb5]">{spec.header}</span>
            <span className="flex items-center gap-2 rounded-[10px] bg-[#f3ecff] px-2 py-1.5 dark:bg-[#2a2140]">
               <Mark n={1} />
               <span className="truncate text-[15px] font-bold text-[#3b2f4a] dark:text-[#f5f0ff]">Juan Dela Cruz</span>
            </span>
            <ul className="flex flex-col gap-1.5">
               {spec.rows.map((row, i) => (
                  <li key={`${row.label}-${row.amount}`} className="flex items-center gap-2 text-[14px] leading-[18px] text-[#594d65] dark:text-[#d9cfe8]">
                     {i === 0 && row.date ? <Mark n={2} /> : <span className="w-[22px] shrink-0" />}
                     {row.date ? <span className="w-[72px] shrink-0 truncate text-[#7b6b8c] dark:text-[#b9abcc]">{row.date}</span> : null}
                     <span className="min-w-0 flex-1 truncate">{row.label}</span>
                     <span className="shrink-0 font-bold text-[#2f7a3a] dark:text-[#7ee2a0]">{row.amount}</span>
                     {i === 0 && row.amount ? <Mark n={3} /> : <span className="w-[22px] shrink-0" />}
                  </li>
               ))}
            </ul>
         </figure>

         <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
            {mustShow.map((text, i) => (
               <li key={text} className="flex items-center gap-1.5 text-[14px] font-semibold leading-[18px] text-[#3b2f4a] dark:text-[#f5f0ff]">
                  <Mark n={i + 1} />
                  {text}
               </li>
            ))}
         </ul>

         <div className="flex items-center gap-3 rounded-[14px] border-2 border-dashed border-[#e0a19c] bg-[#fff7f6] px-3 py-2 dark:bg-[#2a1716]">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#c0392b] text-white">
               <X aria-hidden="true" className="size-4" strokeWidth={3.5} />
            </span>
            <span className="min-w-0 flex-1 text-[14px] font-bold leading-[18px] text-[#c0392b] dark:text-[#f2a39b]">{spec.wrong.caption}</span>
            <span className="flex shrink-0 flex-col items-end leading-tight">
               <span className="text-[15px] font-extrabold text-[#8d7f9c] dark:text-[#b9abcc]">{spec.wrong.big}</span>
               <span className="text-[11px] text-[#a49cb5]">{spec.wrong.small}</span>
            </span>
         </div>
      </div>
   );
}
