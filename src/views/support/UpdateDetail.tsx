import { Navigate, useParams } from 'react-router-dom';

import NeedMoreHelp from '@/views/support/components/NeedMoreHelp';
import SupportHeader from '@/views/support/components/SupportHeader';
import { findUpdate } from '@/views/support/data/updates';

export default function UpdateDetail() {
   const { slug } = useParams<{ slug: string }>();
   const update = slug ? findUpdate(slug) : undefined;

   if (!update) {
      return <Navigate to="/support/updates" replace />;
   }

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28 flex flex-col">
            <SupportHeader title={update.title} />

            <div className="flex flex-col gap-md-4 p-md-4">
               <img src="/banner_temp.png" alt="" className="w-full aspect-video rounded-md-lg object-cover" />

               <div className="flex items-start justify-between gap-md-3">
                  <h2 className="text-md-h5 font-semibold text-md-heading">What's New</h2>
                  <div className="flex flex-col items-end">
                     <span className="text-md-b3 text-md-neutral-1000">Published on</span>
                     <span className="text-md-b2 font-medium text-md-neutral-1900">{update.publishedAt}</span>
                  </div>
               </div>

               <article className="flex flex-col gap-md-2 text-md-b1 text-md-neutral-1200 whitespace-pre-line">
                  {update.body}
               </article>

               <NeedMoreHelp />
            </div>
         </div>
      </div>
   );
}
