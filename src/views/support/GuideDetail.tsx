import { Navigate, useParams } from 'react-router-dom';

import NeedMoreHelp from '@/views/support/components/NeedMoreHelp';
import SupportHeader from '@/views/support/components/SupportHeader';
import { DEMO_VIDEO_ID } from '@/views/support/constants';
import { GUIDES } from '@/views/support/data/guides';

export default function GuideDetail() {
   const { slug } = useParams<{ slug: string }>();
   const guide = GUIDES.find((g) => g.slug === slug);

   if (!guide) {
      return <Navigate to="/support/guides" replace />;
   }

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28 flex flex-col">
            <SupportHeader title="Guide" />

            <div className="flex flex-col gap-md-4 p-md-4">
               <div className="relative w-full aspect-video rounded-md-lg overflow-hidden bg-md-neutral-400">
                  <iframe
                     src={`https://www.youtube.com/embed/${DEMO_VIDEO_ID}`}
                     title={guide.title}
                     allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                     allowFullScreen
                     className="absolute inset-0 w-full h-full"
                  />
               </div>

               <div className="flex flex-col gap-md-2">
                  <h1 className="text-md-h4 font-semibold text-md-heading tracking-[-0.96px]">{guide.title}</h1>
                  <div className="flex items-start gap-md-5">
                     <div className="flex items-center gap-md-1">
                        <img src="/hippos/thinking.png" alt="" className="w-8 h-8 rounded-full object-cover" />
                        <div className="flex flex-col">
                           <span className="text-md-b3 text-md-neutral-1000">Created by</span>
                           <span className="text-md-b2 font-medium text-md-neutral-1900">Moodeng Team</span>
                        </div>
                     </div>
                     <div className="flex flex-col">
                        <span className="text-md-b3 text-md-neutral-1000">Last Updated</span>
                        <span className="text-md-b2 font-medium text-md-neutral-1900">{guide.lastUpdated}</span>
                     </div>
                  </div>
               </div>

               <article className="flex flex-col gap-md-3 text-md-b1 text-md-neutral-1200 whitespace-pre-line">
                  {guide.body}
               </article>

               <NeedMoreHelp />
            </div>
         </div>
      </div>
   );
}
