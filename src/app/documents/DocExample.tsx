import { Check, X } from 'lucide-react';

import type { DocExampleSpec } from '@/app/documents/incomeDocKinds';

// A drawn look-alike of a good document next to the common wrong one, so nobody has to guess what
// to send. The numbers 1–3 mark what must show: name, dates, money coming in. Sample data only.

const Mark = ({ n }: { n: number }) => (
   <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-[#6b55f7] text-[11px] font-bold leading-none text-white">{n}</span>
);

export const EXAMPLE_MUST_SHOW = ['Your name', 'The dates', 'The money coming in'];

export function DocExample({ spec, mustShow = EXAMPLE_MUST_SHOW }: { spec: DocExampleSpec; mustShow?: string[] }) {
   return (
      <div className="flex flex-col gap-3">
         <div className="grid grid-cols-[1.55fr_1fr] gap-3">
            <figure className="flex flex-col gap-1.5">
               <div className="relative flex min-h-[148px] flex-col gap-1.5 rounded-[14px] border-2 border-[#4aa256] bg-white px-2.5 py-2.5 dark:bg-[#1b1526]">
                  <span className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-[#4aa256] text-white">
                     <Check aria-hidden="true" className="size-4" strokeWidth={3.5} />
                  </span>
                  <span className="truncate text-[10px] font-bold uppercase tracking-[0.04em] text-[#a49cb5]">{spec.header}</span>
                  <span className="flex items-center gap-1.5 rounded-[8px] bg-[#f3ecff] px-1.5 py-1 dark:bg-[#2a2140]">
                     <Mark n={1} />
                     <span className="truncate text-[12px] font-bold text-[#3b2f4a] dark:text-[#f5f0ff]">Juan Dela Cruz</span>
                  </span>
                  <ul className="flex flex-col gap-1">
                     {spec.rows.map((row, i) => (
                        <li key={`${row.label}-${i}`} className="flex items-center gap-1 text-[11px] leading-[14px] text-[#594d65] dark:text-[#d9cfe8]">
                           {i === 0 && row.date ? <Mark n={2} /> : <span className="w-[18px] shrink-0" />}
                           {row.date ? <span className="w-[52px] shrink-0 truncate text-[#7b6b8c] dark:text-[#b9abcc]">{row.date}</span> : null}
                           <span className="min-w-0 flex-1 truncate">{row.label}</span>
                           <span className="shrink-0 font-bold text-[#2f7a3a] dark:text-[#7ee2a0]">{row.amount}</span>
                           {i === 0 && row.amount ? <Mark n={3} /> : <span className="w-[18px] shrink-0" />}
                        </li>
                     ))}
                  </ul>
               </div>
               <figcaption className="text-center text-[13px] font-bold text-[#2f7a3a] dark:text-[#7ee2a0]">Like this</figcaption>
            </figure>
            <figure className="flex flex-col gap-1.5">
               <div className="relative flex min-h-[148px] flex-col items-center justify-center gap-0.5 rounded-[14px] border-2 border-dashed border-[#e0a19c] bg-[#fff7f6] px-2 py-2.5 dark:bg-[#2a1716]">
                  <span className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-[#c0392b] text-white">
                     <X aria-hidden="true" className="size-4" strokeWidth={3.5} />
                  </span>
                  <span className="text-[18px] font-extrabold text-[#8d7f9c] dark:text-[#b9abcc]">{spec.wrong.big}</span>
                  <span className="text-[11px] text-[#a49cb5]">{spec.wrong.small}</span>
               </div>
               <figcaption className="text-center text-[13px] font-bold text-[#c0392b] dark:text-[#f2a39b]">{spec.wrong.caption}</figcaption>
            </figure>
         </div>
         <ul className="flex flex-col gap-1.5">
            {mustShow.map((text, i) => (
               <li key={text} className="flex items-center gap-2 text-[15px] leading-[20px] text-[#3b2f4a] dark:text-[#f5f0ff]">
                  <Mark n={i + 1} />
                  {text}
               </li>
            ))}
         </ul>
      </div>
   );
}
