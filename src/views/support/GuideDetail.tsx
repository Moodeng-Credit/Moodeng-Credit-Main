import { Navigate, useParams } from 'react-router-dom';

import { useLocalization } from '@/i18n';
import NeedMoreHelp from '@/views/support/components/NeedMoreHelp';
import SupportHeader from '@/views/support/components/SupportHeader';
import { getGuideForLocale } from '@/views/support/data/guides';

const GUIDE_DETAIL_COPY = {
   en: {
      title: 'Guide',
      createdBy: 'Created by',
      lastUpdated: 'Last Updated',
      team: 'Moodeng Team'
   },
   fil: {
      title: 'Gabay',
      createdBy: 'Ginawa ng',
      lastUpdated: 'Huling update',
      team: 'Moodeng Team'
   },
   id: {
      title: 'Panduan',
      createdBy: 'Dibuat oleh',
      lastUpdated: 'Terakhir diperbarui',
      team: 'Tim Moodeng'
   },
   th: {
      title: 'คู่มือ',
      createdBy: 'สร้างโดย',
      lastUpdated: 'อัปเดตล่าสุด',
      team: 'ทีม Moodeng'
   },
   vi: {
      title: 'Hướng dẫn',
      createdBy: 'Tạo bởi',
      lastUpdated: 'Cập nhật lần cuối',
      team: 'Đội ngũ Moodeng'
   }
} as const;

export default function GuideDetail() {
   const { slug } = useParams<{ slug: string }>();
   const { locale } = useLocalization();
   const copy = GUIDE_DETAIL_COPY[locale] ?? GUIDE_DETAIL_COPY.en;
   const guide = getGuideForLocale(slug, locale);

   if (!guide) {
      return <Navigate to="/support/guides" replace />;
   }

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28 flex flex-col">
            <SupportHeader title={copy.title} />

            <div className="flex flex-col gap-md-4 p-md-4">
               <div className="flex flex-col gap-md-2">
                  <h1 className="text-md-h4 font-semibold text-md-heading tracking-[-0.96px]">{guide.title}</h1>
                  <div className="flex items-start gap-md-5">
                     <div className="flex items-center gap-md-1">
                        <img src="/hippos/thinking.png" alt="" className="w-8 h-8 rounded-full object-cover" />
                        <div className="flex flex-col">
                           <span className="text-md-b3 text-md-neutral-1000">{copy.createdBy}</span>
                           <span className="text-md-b2 font-medium text-md-neutral-1900">{copy.team}</span>
                        </div>
                     </div>
                     <div className="flex flex-col">
                        <span className="text-md-b3 text-md-neutral-1000">{copy.lastUpdated}</span>
                        <span className="text-md-b2 font-medium text-md-neutral-1900">{guide.lastUpdated}</span>
                     </div>
                  </div>
               </div>

               <article className="flex flex-col gap-md-3 text-md-b1 text-md-neutral-1200 whitespace-pre-line">{guide.body}</article>

               <NeedMoreHelp />
            </div>
         </div>
      </div>
   );
}
