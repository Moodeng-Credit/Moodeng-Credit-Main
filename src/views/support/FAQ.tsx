import { useMemo, useState } from 'react';

import SearchBar from '@/views/support/components/SearchBar';
import SupportHeader from '@/views/support/components/SupportHeader';
import { FAQS } from '@/views/support/data/faqs';
import { ICON_MASK_BASE } from '@/views/support/constants';

export default function FAQ() {
   const [query, setQuery] = useState('');
   const [openId, setOpenId] = useState<string | null>(FAQS[0]?.id ?? null);

   const filtered = useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return FAQS;
      return FAQS.filter(
         (f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
      );
   }, [query]);

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28 flex flex-col">
            <SupportHeader title="Frequently Asked Questions" />

            <div className="flex flex-col gap-md-3 p-md-4">
               <SearchBar placeholder="Search FAQs" value={query} onChange={setQuery} showFilter />

               <div className="flex flex-col gap-md-2">
                  {filtered.map((item) => {
                     const isOpen = openId === item.id;
                     return (
                        <div
                           key={item.id}
                           className="border border-md-neutral-400 rounded-md-input overflow-hidden bg-md-neutral-100"
                        >
                           <button
                              type="button"
                              onClick={() => setOpenId(isOpen ? null : item.id)}
                              aria-expanded={isOpen}
                              className="w-full flex items-center justify-between gap-md-2 px-md-3 py-md-3 text-left bg-transparent"
                           >
                              <span className="text-md-b1 text-md-neutral-1900 flex-1">{item.question}</span>
                              <div
                                 className={`w-6 h-6 bg-md-primary-900 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                 style={{
                                    ...ICON_MASK_BASE,
                                    WebkitMaskImage: "url('/icons/chevron-down.svg')",
                                    maskImage: "url('/icons/chevron-down.svg')"
                                 }}
                              />
                           </button>
                           {isOpen ? (
                              <div className="px-md-3 pb-md-3 text-md-b2 text-md-neutral-1200 whitespace-pre-line">
                                 {item.answer}
                              </div>
                           ) : null}
                        </div>
                     );
                  })}
                  {filtered.length === 0 ? (
                     <p className="text-md-b2 text-md-neutral-1200 text-center py-md-5">
                        No questions match your search.
                     </p>
                  ) : null}
               </div>
            </div>
         </div>
      </div>
   );
}
