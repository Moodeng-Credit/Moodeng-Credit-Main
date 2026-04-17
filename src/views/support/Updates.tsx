import { useNavigate } from 'react-router-dom';

import SupportHeader from '@/views/support/components/SupportHeader';
import { LATEST_UPDATE, PREVIOUS_UPDATES } from '@/views/support/data/updates';
import { ICON_MASK_BASE } from '@/views/support/constants';

function BookmarkIcon({ color = 'bg-md-primary-900' }: { color?: string }) {
   return (
      <div
         className={`w-4 h-4 ${color}`}
         style={{
            ...ICON_MASK_BASE,
            WebkitMaskImage: "url('/icons/bookmark.svg')",
            maskImage: "url('/icons/bookmark.svg')"
         }}
      />
   );
}

export default function Updates() {
   const navigate = useNavigate();

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28 flex flex-col">
            <SupportHeader title="Updates" />

            <div className="flex flex-col gap-md-4 p-md-4">
               {/* What's New */}
               <div className="flex flex-col gap-md-3">
                  <h2 className="text-md-h5 font-semibold text-md-heading">What's New</h2>
                  <button
                     type="button"
                     onClick={() => navigate(`/support/updates/${LATEST_UPDATE.slug}`)}
                     className="flex items-start gap-md-2 p-md-3 rounded-md-sm-md w-full text-left"
                     style={{
                        backgroundImage: 'linear-gradient(165.83deg, #9810fa 0%, #4f39f6 100%)'
                     }}
                  >
                     <div className="bg-white/20 rounded-md-md w-8 h-8 shrink-0 flex items-center justify-center">
                        <BookmarkIcon color="bg-white" />
                     </div>
                     <div className="flex flex-col gap-md-1 flex-1 min-w-0">
                        <div className="flex flex-col gap-1">
                           <p className="text-md-b2 font-semibold text-white">{LATEST_UPDATE.title}</p>
                           <p className="text-md-b3 text-md-primary-100">{LATEST_UPDATE.subtitle}</p>
                        </div>
                        <p className="text-md-b3 text-md-primary-400">{LATEST_UPDATE.relativeTime}</p>
                     </div>
                  </button>
               </div>

               {/* Previous Updates */}
               <div className="flex flex-col gap-md-3">
                  <h2 className="text-md-h5 font-semibold text-md-heading">Previous Updates</h2>
                  <div className="flex flex-col gap-md-3">
                     {[LATEST_UPDATE, ...PREVIOUS_UPDATES].map((update) => (
                        <button
                           key={update.slug}
                           type="button"
                           onClick={() => navigate(`/support/updates/${update.slug}`)}
                           className="flex items-start gap-md-2 p-md-3 border border-md-primary-100 rounded-md-sm-md bg-md-neutral-200 text-left"
                        >
                           <div className="bg-md-primary-100 rounded-md-md w-8 h-8 shrink-0 flex items-center justify-center">
                              <BookmarkIcon />
                           </div>
                           <div className="flex flex-col gap-1 flex-1 min-w-0">
                              <p className="text-md-b2 font-semibold text-md-primary-2000">{update.title}</p>
                              <p className="text-md-b3 text-md-neutral-1700">{update.subtitle}</p>
                              <p className="text-md-b3 text-md-neutral-1000">{update.publishedAt}</p>
                           </div>
                        </button>
                     ))}
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}
