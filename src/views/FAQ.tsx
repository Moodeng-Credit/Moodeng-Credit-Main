import { useMemo, useState } from 'react';

import { useLocalization } from '@/i18n';
import { getFaqsForLocale } from '@/views/support/data/faqs';

export default function FAQsComponent() {
   const { locale } = useLocalization();
   const [openIndex, setOpenIndex] = useState(0);
   const faqs = useMemo(() => getFaqsForLocale(locale), [locale]);
   const copy =
      locale === 'fil'
         ? {
              title: 'Mga FAQ',
              subtitle: 'Mga sagot tungkol sa credit growth, secure loans, at transparent financial management'
           }
         : locale === 'id'
           ? {
                title: 'FAQ',
                subtitle: 'Jawaban tentang pertumbuhan kredit, pinjaman aman, dan pengelolaan keuangan yang transparan'
             }
           : {
                title: 'FAQs',
                subtitle: 'The Comprehensive FAQ Guide to Credit Growth, Secure Loans, and Transparent Financial Management'
             };

   return (
      <div className="bg-[#c9d5f9] flex flex-col px-6 md:px-20 py-12">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12">
            <h2 className="text-4xl font-bold text-blue-600">{copy.title}</h2>
            <div className="text-gray-700 max-w-2xl mt-6 md:mt-0">
               <p className="font-medium">{copy.subtitle}</p>
            </div>
         </div>

         <div className="space-y-4 w-full self-center">
            {faqs.map((faq, idx) => (
               <div key={faq.id} className="bg-white rounded-xl shadow-sm">
                  <button
                     type="button"
                     onClick={() => setOpenIndex(openIndex === idx ? -1 : idx)}
                     className="w-full flex justify-between items-center text-left px-6 py-6 rounded-xl transition"
                  >
                     <div className="flex items-center gap-4">
                        <span className="text-2xl font-bold text-blue-600">{String(idx + 1).padStart(2, '0')}</span>
                        <span className="text-lg font-semibold text-gray-900">{faq.question}</span>
                     </div>
                     <span className="text-2xl font-bold text-blue-600">{openIndex === idx ? 'x' : '+'}</span>
                  </button>

                  {openIndex === idx ? (
                     <div className="px-8 pb-6 md:px-20">
                        {faq.answer.split('\n\n').map((paragraph) => (
                           <p key={paragraph} className="mb-4 text-gray-700 whitespace-pre-line">
                              {paragraph}
                           </p>
                        ))}
                     </div>
                  ) : null}
               </div>
            ))}
         </div>
      </div>
   );
}
