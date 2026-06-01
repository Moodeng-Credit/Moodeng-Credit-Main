import { useEffect, useMemo, useState } from 'react';

import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { useLocalization } from '@/i18n';
import type { RootState } from '@/store/store';
import SearchBar from '@/views/support/components/SearchBar';
import SupportHeader from '@/views/support/components/SupportHeader';
import { ICON_MASK_BASE } from '@/views/support/constants';
import { getGuidesForLocale } from '@/views/support/data/guides';

const LENDER_HIDDEN_GUIDE_SLUGS = new Set(['understanding-your-trust-score', 'how-repayments-affect-your-trust-score']);

const GUIDE_CATEGORIES = {
   gettingStarted: 'Getting Started',
   trustScore: 'Trust Score',
   creditLevel: 'Credit Level',
   repayment: 'Repayment',
   wallet: 'Wallet',
   security: 'Security'
} as const;

type GuideCategory = (typeof GUIDE_CATEGORIES)[keyof typeof GUIDE_CATEGORIES];
type CategoryFilter = 'All' | GuideCategory;

const GUIDE_CATEGORY_LABELS = {
   en: {
      All: 'All',
      [GUIDE_CATEGORIES.gettingStarted]: 'Getting Started',
      [GUIDE_CATEGORIES.trustScore]: 'Trust Score',
      [GUIDE_CATEGORIES.creditLevel]: 'Antas ng kredito',
      [GUIDE_CATEGORIES.repayment]: 'Repayment',
      [GUIDE_CATEGORIES.wallet]: 'Wallet',
      [GUIDE_CATEGORIES.security]: 'Security'
   },
   fil: {
      All: 'Lahat',
      [GUIDE_CATEGORIES.gettingStarted]: 'Magsimula',
      [GUIDE_CATEGORIES.trustScore]: 'Trust Score',
      [GUIDE_CATEGORIES.creditLevel]: 'Level kredit',
      [GUIDE_CATEGORIES.repayment]: 'Repayment',
      [GUIDE_CATEGORIES.wallet]: 'Wallet',
      [GUIDE_CATEGORIES.security]: 'Security'
   },
   id: {
      All: 'Semua',
      [GUIDE_CATEGORIES.gettingStarted]: 'Mulai',
      [GUIDE_CATEGORIES.trustScore]: 'Trust Score',
      [GUIDE_CATEGORIES.creditLevel]: 'ระดับเครดิต',
      [GUIDE_CATEGORIES.repayment]: 'Pembayaran',
      [GUIDE_CATEGORIES.wallet]: 'Wallet',
      [GUIDE_CATEGORIES.security]: 'Keamanan'
   },
   th: {
      All: 'ทั้งหมด',
      [GUIDE_CATEGORIES.gettingStarted]: 'เริ่มต้น',
      [GUIDE_CATEGORIES.trustScore]: 'Trust Score',
      [GUIDE_CATEGORIES.creditLevel]: 'Hạng tín dụng',
      [GUIDE_CATEGORIES.repayment]: 'การชำระคืน',
      [GUIDE_CATEGORIES.wallet]: 'กระเป๋าเงิน',
      [GUIDE_CATEGORIES.security]: 'ความปลอดภัย'
   },
   vi: {
      All: 'Tất cả',
      [GUIDE_CATEGORIES.gettingStarted]: 'Bắt đầu',
      [GUIDE_CATEGORIES.trustScore]: 'Trust Score',
      [GUIDE_CATEGORIES.creditLevel]: 'Credit Level',
      [GUIDE_CATEGORIES.repayment]: 'Trả nợ',
      [GUIDE_CATEGORIES.wallet]: 'Ví',
      [GUIDE_CATEGORIES.security]: 'Bảo mật'
   }
} as const;

const GUIDE_CATEGORY_BY_SLUG: Record<string, GuideCategory> = {
   'how-to-request-your-first-loan': GUIDE_CATEGORIES.gettingStarted,
   'understanding-your-trust-score': GUIDE_CATEGORIES.trustScore,
   'how-credit-levels-work': GUIDE_CATEGORIES.creditLevel,
   'trust-building-vs-credit-building-loans': GUIDE_CATEGORIES.creditLevel,
   'how-repayments-affect-your-trust-score': GUIDE_CATEGORIES.repayment,
   'what-happens-when-you-repay-a-loan-on-time': GUIDE_CATEGORIES.repayment,
   'using-usdc-on-moodeng-credit': GUIDE_CATEGORIES.wallet,
   'verification-and-why-its-required': GUIDE_CATEGORIES.gettingStarted,
   'managing-your-account-and-security-settings': GUIDE_CATEGORIES.security
};

const getGuideCategory = (slug: string): GuideCategory => GUIDE_CATEGORY_BY_SLUG[slug] ?? GUIDE_CATEGORIES.gettingStarted;

export default function Guides() {
   const navigate = useNavigate();
   const { locale } = useLocalization();
   const [query, setQuery] = useState('');
   const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('All');
   const [showCategoryFilters, setShowCategoryFilters] = useState(false);
   const user = useSelector((state: RootState) => state.auth.user);
   const isLender = user?.userRole === 'lender';
   const guides = useMemo(() => getGuidesForLocale(locale), [locale]);
   const copy = GUIDE_CATEGORY_LABELS[locale] ?? GUIDE_CATEGORY_LABELS.en;
   const pageCopy =
      locale === 'fil'
         ? {
              title: 'Mga gabay',
              placeholder: 'Maghanap ng mga gabay',
              empty: 'Walang gabay na tugma sa search mo.'
           }
         : locale === 'id'
           ? {
                title: 'Panduan',
                placeholder: 'Cari panduan',
                empty: 'Tidak ada panduan yang cocok dengan pencarian kamu.'
             }
           : locale === 'th'
             ? {
                  title: 'คู่มือ',
                  placeholder: 'ค้นหาคู่มือ',
                  empty: 'ไม่มีคู่มือที่ตรงกับการค้นหา'
               }
             : locale === 'vi'
               ? {
                    title: 'Hướng dẫn',
                    placeholder: 'Tìm kiếm hướng dẫn',
                    empty: 'Không có hướng dẫn nào khớp với tìm kiếm.'
                 }
               : {
                    title: 'Guides',
                    placeholder: 'Search Guides',
                    empty: 'No guides match your search.'
                 };

   const visibleGuides = useMemo(
      () => (isLender ? guides.filter((guide) => !LENDER_HIDDEN_GUIDE_SLUGS.has(guide.slug)) : guides),
      [guides, isLender]
   );

   const availableCategories = useMemo(() => {
      const uniqueCategories = new Set(visibleGuides.map((guide) => getGuideCategory(guide.slug)));
      return Array.from(uniqueCategories);
   }, [visibleGuides]);

   useEffect(() => {
      if (selectedCategory !== 'All' && !availableCategories.includes(selectedCategory)) {
         setSelectedCategory('All');
      }
   }, [availableCategories, selectedCategory]);

   const filtered = useMemo(() => {
      const categoryFiltered =
         selectedCategory === 'All' ? visibleGuides : visibleGuides.filter((guide) => getGuideCategory(guide.slug) === selectedCategory);
      const q = query.trim().toLowerCase();
      if (!q) return categoryFiltered;
      return categoryFiltered.filter((g) => g.title.toLowerCase().includes(q));
   }, [query, selectedCategory, visibleGuides]);

   const categoryFilters: CategoryFilter[] = ['All', ...availableCategories];
   const shouldShowCategoryFilters = availableCategories.length > 1;

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28 flex flex-col">
            <SupportHeader title={pageCopy.title} />

            <div className="flex flex-col gap-md-3 p-md-4">
               <SearchBar
                  placeholder={pageCopy.placeholder}
                  value={query}
                  onChange={setQuery}
                  showFilter={shouldShowCategoryFilters}
                  filterActive={showCategoryFilters}
                  onFilterClick={() => setShowCategoryFilters((isOpen) => !isOpen)}
               />

               {shouldShowCategoryFilters && showCategoryFilters ? (
                  <div className="-mx-md-4 px-md-4 flex gap-1.5 overflow-x-auto pb-1" aria-label="Guide categories">
                     {categoryFilters.map((category) => {
                        const isSelected = selectedCategory === category;
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
                              {copy[category]}
                           </button>
                        );
                     })}
                  </div>
               ) : null}

               <div className="flex flex-col gap-md-2">
                  {filtered.map((guide) => (
                     <button
                        key={guide.slug}
                        type="button"
                        onClick={() => navigate(`/support/guides/${guide.slug}`)}
                        className="group flex items-center justify-between gap-md-2 px-md-3 py-md-3 border border-md-neutral-400 rounded-md-input bg-transparent text-left transition-all duration-150 active:scale-[0.99] active:border-md-primary-900 active:bg-md-primary-100 hover:border-md-primary-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-1200"
                     >
                        <span className="text-md-b1 text-md-neutral-1900 flex-1">{guide.title}</span>
                        <div
                           className="w-6 h-6 bg-md-primary-900 shrink-0 transition-transform duration-150 group-active:translate-x-1 group-hover:translate-x-0.5"
                           style={{
                              ...ICON_MASK_BASE,
                              WebkitMaskImage: "url('/icons/chevron-right.svg')",
                              maskImage: "url('/icons/chevron-right.svg')"
                           }}
                        />
                     </button>
                  ))}
                  {filtered.length === 0 ? <p className="text-md-b2 text-md-neutral-1200 text-center py-md-5">{pageCopy.empty}</p> : null}
               </div>
            </div>
         </div>
      </div>
   );
}
