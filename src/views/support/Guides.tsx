import { useMemo, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import SearchBar from '@/views/support/components/SearchBar';
import SupportHeader from '@/views/support/components/SupportHeader';
import { GUIDES } from '@/views/support/data/guides';
import { ICON_MASK_BASE } from '@/views/support/constants';

export default function Guides() {
   const navigate = useNavigate();
   const [query, setQuery] = useState('');

   const filtered = useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return GUIDES;
      return GUIDES.filter((g) => g.title.toLowerCase().includes(q));
   }, [query]);

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28 flex flex-col">
            <SupportHeader title="Guides" />

            <div className="flex flex-col gap-md-3 p-md-4">
               <SearchBar placeholder="Search Guides" value={query} onChange={setQuery} showFilter />

               <div className="flex flex-col gap-md-2">
                  {filtered.map((guide) => (
                     <button
                        key={guide.slug}
                        type="button"
                        onClick={() => navigate(`/support/guides/${guide.slug}`)}
                        className="flex items-center justify-between gap-md-2 px-md-3 py-md-3 border border-md-neutral-400 rounded-md-input bg-transparent text-left"
                     >
                        <span className="text-md-b1 text-md-neutral-1900 flex-1">{guide.title}</span>
                        <div
                           className="w-6 h-6 bg-md-primary-900 shrink-0"
                           style={{
                              ...ICON_MASK_BASE,
                              WebkitMaskImage: "url('/icons/chevron-right.svg')",
                              maskImage: "url('/icons/chevron-right.svg')"
                           }}
                        />
                     </button>
                  ))}
                  {filtered.length === 0 ? (
                     <p className="text-md-b2 text-md-neutral-1200 text-center py-md-5">
                        No guides match your search.
                     </p>
                  ) : null}
               </div>
            </div>
         </div>
      </div>
   );
}
