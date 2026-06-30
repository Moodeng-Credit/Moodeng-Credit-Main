import { useMemo, useState } from 'react';

import { usePageSeo } from '@/hooks/usePageSeo';
import { useLocalization } from '@/i18n';
import SearchBar from '@/views/support/components/SearchBar';
import SupportHeader from '@/views/support/components/SupportHeader';
import { ICON_MASK_BASE } from '@/views/support/constants';
import { getFaqsForLocale } from '@/views/support/data/faqs';

const FAQ_SEO_DESCRIPTION =
   'Answers about how Moodeng Credit works — borrowing in USDC, Trust Scores, Credit Levels, Base wallets, fees, and staying safe from loan sharks.';

const FAQ_CATEGORIES = {
   general: 'General',
   borrowing: 'Borrowing',
   trustScore: 'Trust Score',
   creditLevel: 'Credit Level',
   wallet: 'Wallet'
} as const;

type FaqCategory = (typeof FAQ_CATEGORIES)[keyof typeof FAQ_CATEGORIES];
type CategoryFilter = 'All' | FaqCategory;

const FAQ_CATEGORY_BY_ID: Record<string, FaqCategory> = {
   'what-is-moodeng-credit': FAQ_CATEGORIES.general,
   'does-moodeng-charge-fees': FAQ_CATEGORIES.general,
   'fight-loan-sharks': FAQ_CATEGORIES.general,
   'how-does-borrowing-work': FAQ_CATEGORIES.borrowing,
   'what-is-credit-building-loan': FAQ_CATEGORIES.borrowing,
   'small-loan': FAQ_CATEGORIES.borrowing,
   'what-is-a-trust-score': FAQ_CATEGORIES.trustScore,
   'what-is-a-credit-level': FAQ_CATEGORIES.creditLevel,
   'what-is-a-base-wallet': FAQ_CATEGORIES.wallet,
   'what-is-usdc': FAQ_CATEGORIES.wallet
};

const getFaqCategory = (id: string): FaqCategory => FAQ_CATEGORY_BY_ID[id] ?? FAQ_CATEGORIES.general;

export default function FAQ() {
   const { locale } = useLocalization();
   const [query, setQuery] = useState('');
   const [openId, setOpenId] = useState<string | null>('what-is-moodeng-credit');
   const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('All');
   const [showCategoryFilters, setShowCategoryFilters] = useState(false);
   const faqs = useMemo(() => getFaqsForLocale(locale), [locale]);

   usePageSeo({
      title: 'Frequently Asked Questions | Moodeng Credit',
      description: FAQ_SEO_DESCRIPTION,
      canonicalPath: '/support/faq',
      jsonLd: [
         {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map((item) => ({
               '@type': 'Question',
               name: item.question,
               acceptedAnswer: { '@type': 'Answer', text: item.answer }
            }))
         }
      ]
   });

   const copy =
      locale === 'fil'
         ? {
              title: 'Mga Madalas Itanong',
              placeholder: 'Maghanap sa FAQs',
              empty: 'Walang tanong na tugma sa search mo.',
              all: 'Lahat',
              [FAQ_CATEGORIES.general]: 'Pangkalahatan',
              [FAQ_CATEGORIES.borrowing]: 'Paghiram',
              [FAQ_CATEGORIES.trustScore]: 'Trust Score',
              [FAQ_CATEGORIES.creditLevel]: 'Antas ng kredito',
              [FAQ_CATEGORIES.wallet]: 'Wallet'
           }
         : locale === 'id'
           ? {
                title: 'Pertanyaan yang sering diajukan',
                placeholder: 'Cari FAQ',
                empty: 'Tidak ada pertanyaan yang cocok dengan pencarian kamu.',
                all: 'Semua',
                [FAQ_CATEGORIES.general]: 'Umum',
                [FAQ_CATEGORIES.borrowing]: 'Pinjaman',
                [FAQ_CATEGORIES.trustScore]: 'Trust Score',
                [FAQ_CATEGORIES.creditLevel]: 'Level Kredit',
                [FAQ_CATEGORIES.wallet]: 'Wallet'
             }
           : {
                title: 'Frequently Asked Questions',
                placeholder: 'Search FAQs',
                empty: 'No questions match your search.',
                all: 'All',
                [FAQ_CATEGORIES.general]: 'General',
                [FAQ_CATEGORIES.borrowing]: 'Borrowing',
                [FAQ_CATEGORIES.trustScore]: 'Trust Score',
                [FAQ_CATEGORIES.creditLevel]: 'Credit Level',
                [FAQ_CATEGORIES.wallet]: 'Wallet'
             };

   const filtered = useMemo(() => {
      const categoryFiltered =
         selectedCategory === 'All' ? faqs : faqs.filter((f) => getFaqCategory(f.id) === selectedCategory);
      const q = query.trim().toLowerCase();
      if (!q) return categoryFiltered;
      return categoryFiltered.filter((f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q));
   }, [faqs, query, selectedCategory]);

   const categoryFilters: CategoryFilter[] = ['All', ...Object.values(FAQ_CATEGORIES)];

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28 flex flex-col">
            <SupportHeader title={copy.title} />

            <div className="flex flex-col gap-md-3 p-md-4">
               <SearchBar
                  placeholder={copy.placeholder}
                  value={query}
                  onChange={setQuery}
                  showFilter
                  filterActive={showCategoryFilters}
                  onFilterClick={() => setShowCategoryFilters((v) => !v)}
               />

               {showCategoryFilters ? (
                  <div className="-mx-md-4 px-md-4 flex gap-1.5 overflow-x-auto pb-1" aria-label="FAQ categories">
                     {categoryFilters.map((category) => {
                        const isSelected = selectedCategory === category;
                        const label = category === 'All' ? copy.all : copy[category as FaqCategory];
                        return (
                           <button
                              key={category}
                              type="button"
                              onClick={() => setSelectedCategory(category)}
                              className={[
                                 'shrink-0 rounded-[10px] px-3.5 py-2 text-md-b3 font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-1200',
                                 isSelected
                                    ? 'bg-gradient-to-br from-[#7028e4] to-md-primary-1200 text-white shadow-[0_2px_8px_rgba(96,16,210,0.25),inset_0_1px_0_rgba(255,255,255,0.25)]'
                                    : 'bg-white text-md-neutral-1100 shadow-[0_1px_3px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.92)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.92)]'
                              ].join(' ')}
                              aria-pressed={isSelected}
                           >
                              {label}
                           </button>
                        );
                     })}
                  </div>
               ) : null}

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
