import { useMemo, useState } from 'react';

import { useLocalization } from '@/i18n';
import SearchBar from '@/views/support/components/SearchBar';
import SupportHeader from '@/views/support/components/SupportHeader';
import { ICON_MASK_BASE } from '@/views/support/constants';
import { getFaqsForLocale } from '@/views/support/data/faqs';

export default function FAQ() {
   const { locale } = useLocalization();
   const [query, setQuery] = useState('');
   const [openId, setOpenId] = useState<string | null>('what-is-moodeng-credit');
   const faqs = useMemo(() => getFaqsForLocale(locale), [locale]);
   const copy =
      locale === 'fil'
         ? {
              title: 'Mga Madalas Itanong',
              placeholder: 'Maghanap sa FAQs',
              empty: 'Walang tanong na tugma sa search mo.'
           }
         : locale === 'id'
           ? {
                title: 'Pertanyaan yang sering diajukan',
                placeholder: 'Cari FAQ',
                empty: 'Tidak ada pertanyaan yang cocok dengan pencarian kamu.'
             }
           : {
                title: 'Frequently Asked Questions',
                placeholder: 'Search FAQs',
                empty: 'No questions match your search.'
             };

   const filtered = useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return faqs;
      return faqs.filter((f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q));
   }, [faqs, query]);

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28 flex flex-col">
            <SupportHeader title={copy.title} />

            <div className="flex flex-col gap-md-3 p-md-4">
               <SearchBar placeholder={copy.placeholder} value={query} onChange={setQuery} showFilter />

               <div className="flex flex-col gap-md-2">
                  {filtered.map((item) => {
                     const isOpen = openId === item.id;
                     return (
                        <div key={item.id} className="border border-md-neutral-400 rounded-md-input overflow-hidden bg-md-neutral-100">
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
                              <div className="px-md-3 pb-md-3 text-md-b2 text-md-neutral-1200 whitespace-pre-line">{item.answer}</div>
                           ) : null}
                        </div>
                     );
                  })}
                  {filtered.length === 0 ? <p className="text-md-b2 text-md-neutral-1200 text-center py-md-5">{copy.empty}</p> : null}
               </div>
            </div>
         </div>
      </div>
   );
}
