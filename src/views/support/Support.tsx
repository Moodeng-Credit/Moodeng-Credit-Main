import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import BorrowerVerificationBadge from '@/components/BorrowerVerificationBadge';
import UserAvatar from '@/components/UserAvatar';

import { type LocaleCode, useLocalization } from '@/i18n';
import type { RootState } from '@/store/store';
import NeedMoreHelp from '@/views/support/components/NeedMoreHelp';
import { ICON_MASK_BASE, SUPPORT_FACEBOOK_URL, X_URL } from '@/views/support/constants';

interface SupportCard {
   label: string;
   description: string;
   icon: string;
   path: string;
   badge?: string;
}

const SUPPORT_COPY: Record<
   LocaleCode,
   {
      greeting: (name: string) => string;
      title: string;
      subtitle: string;
      communityTitle: string;
      communityDescription: string;
      cards: SupportCard[];
   }
> = {
   en: {
      greeting: (name) => `Hello, ${name}`,
      title: 'Help & Support Center',
      subtitle: 'Need help getting started? Browse help articles or reach out if you need support.',
      communityTitle: 'Join the community',
      communityDescription: 'Connect with other borrowers, share feedback, and stay up to date with Moodeng Credit.',
      cards: [
         {
            label: 'Getting started',
            description: 'New to Moodeng Credit? Learn the basics and request your first loan.',
            icon: 'play-outline.svg',
            path: '/support/getting-started'
         },
         {
            label: 'Guides',
            description: 'Step-by-step guides for Trust Score, Credit Level, and repayments.',
            icon: 'guide.png',
            path: '/support/guides'
         },
         {
            label: 'FAQs',
            description: 'Get clear answers on loans, trust, verification, and repayments.',
            icon: 'question_light.svg',
            path: '/support/faq'
         },
         {
            label: 'Updates',
            description: 'Product updates, changes, and important announcements.',
            icon: 'updates.png',
            path: '/support/updates',
            badge: 'NEW'
         }
      ]
   },
   fil: {
      greeting: (name) => `Kumusta, ${name}`,
      title: 'Sentro ng Tulong at Suporta',
      subtitle: 'Kailangan ng tulong sa pagsisimula? Mag-browse ng mga artikulo ng tulong o makipag-ugnayan kung kailangan mo ng suporta.',
      communityTitle: 'Sumali sa komunidad',
      communityDescription: 'Makipag-ugnayan sa ibang humihiram, magbigay ng feedback, at manatiling updated sa Moodeng Credit.',
      cards: [
         {
            label: 'Magsimula',
            description: 'Bago ka pa lang ba sa Moodeng Credit? Alamin ang mga pangunahing bagay at humiling ng una mong loan.',
            icon: 'play-outline.svg',
            path: '/support/getting-started'
         },
         {
            label: 'Mga gabay',
            description: 'Mga gabay na step-by-step tungkol sa Trust Score, antas ng kredito, at pagbabayad.',
            icon: 'guide.png',
            path: '/support/guides'
         },
         {
            label: 'FAQs',
            description: 'Malinaw na sagot tungkol sa pautang, tiwala, verification, at pagbabayad.',
            icon: 'question_light.svg',
            path: '/support/faq'
         },
         {
            label: 'Mga update',
            description: 'Mga update sa produkto, pagbabago, at mahahalagang anunsyo.',
            icon: 'updates.png',
            path: '/support/updates',
            badge: 'BAGO'
         }
      ]
   },
   id: {
      greeting: (name) => `Halo, ${name}`,
      title: 'Pusat Bantuan & Dukungan',
      subtitle: 'Butuh bantuan untuk mulai? Baca artikel bantuan atau hubungi kami jika kamu perlu dukungan.',
      communityTitle: 'Gabung komunitas',
      communityDescription: 'Terhubung dengan peminjam lain, bagikan masukan, dan ikuti update Moodeng Credit.',
      cards: [
         {
            label: 'Mulai',
            description: 'Baru di Moodeng Credit? Pelajari dasar-dasarnya dan ajukan pinjaman pertama kamu.',
            icon: 'play-outline.svg',
            path: '/support/getting-started'
         },
         {
            label: 'Panduan',
            description: 'Panduan langkah demi langkah untuk Trust Score, level kredit, dan pembayaran.',
            icon: 'guide.png',
            path: '/support/guides'
         },
         {
            label: 'FAQ',
            description: 'Jawaban jelas tentang pinjaman, kepercayaan, verifikasi, dan pembayaran.',
            icon: 'question_light.svg',
            path: '/support/faq'
         },
         {
            label: 'Update',
            description: 'Update produk, perubahan, dan pengumuman penting.',
            icon: 'updates.png',
            path: '/support/updates',
            badge: 'BARU'
         }
      ]
   },
   th: {
      greeting: (name) => `สวัสดี, ${name}`,
      title: 'ศูนย์ช่วยเหลือและสนับสนุน',
      subtitle: 'ต้องการความช่วยเหลือในการเริ่มต้นไหม? อ่านบทความช่วยเหลือหรือติดต่อเราหากต้องการการสนับสนุน',
      communityTitle: 'เข้าร่วมชุมชน',
      communityDescription: 'เชื่อมต่อกับผู้ยืมคนอื่น แชร์ความคิดเห็น และติดตามข่าว Moodeng Credit',
      cards: [
         {
            label: 'เริ่มต้น',
            description: 'เพิ่งใช้ Moodeng Credit ใช่ไหม? เรียนรู้พื้นฐานและขอเงินกู้ครั้งแรก',
            icon: 'play-outline.svg',
            path: '/support/getting-started'
         },
         {
            label: 'คู่มือ',
            description: 'คู่มือทีละขั้นตอนสำหรับ Trust Score, ระดับเครดิต และการชำระคืน',
            icon: 'guide.png',
            path: '/support/guides'
         },
         {
            label: 'FAQ',
            description: 'คำตอบชัดเจนเกี่ยวกับเงินกู้ ความน่าเชื่อถือ การยืนยัน และการชำระคืน',
            icon: 'question_light.svg',
            path: '/support/faq'
         },
         {
            label: 'อัปเดต',
            description: 'อัปเดตผลิตภัณฑ์ การเปลี่ยนแปลง และประกาศสำคัญ',
            icon: 'updates.png',
            path: '/support/updates',
            badge: 'ใหม่'
         }
      ]
   },
   vi: {
      greeting: (name) => `Xin chào, ${name}`,
      title: 'Trung tâm trợ giúp & hỗ trợ',
      subtitle: 'Cần trợ giúp để bắt đầu? Xem bài viết hỗ trợ hoặc liên hệ nếu bạn cần hỗ trợ.',
      communityTitle: 'Tham gia cộng đồng',
      communityDescription: 'Kết nối với người vay khác, chia sẻ góp ý và cập nhật tin tức Moodeng Credit.',
      cards: [
         {
            label: 'Bắt đầu',
            description: 'Mới dùng Moodeng Credit? Tìm hiểu cơ bản và yêu cầu khoản vay đầu tiên.',
            icon: 'play-outline.svg',
            path: '/support/getting-started'
         },
         {
            label: 'Hướng dẫn',
            description: 'Hướng dẫn từng bước về Trust Score, hạng tín dụng và trả nợ.',
            icon: 'guide.png',
            path: '/support/guides'
         },
         {
            label: 'FAQ',
            description: 'Câu trả lời rõ ràng về khoản vay, niềm tin, xác minh và trả nợ.',
            icon: 'question_light.svg',
            path: '/support/faq'
         },
         {
            label: 'Cập nhật',
            description: 'Cập nhật sản phẩm, thay đổi và thông báo quan trọng.',
            icon: 'updates.png',
            path: '/support/updates',
            badge: 'MỚI'
         }
      ]
   }
};

function CategoryIcon({ icon }: { icon: string }) {
   return (
      <div
         className="w-9 h-9 bg-md-primary-900"
         style={{
            ...ICON_MASK_BASE,
            WebkitMaskImage: `url('/icons/${icon}')`,
            maskImage: `url('/icons/${icon}')`
         }}
      />
   );
}

export default function Support() {
   const navigate = useNavigate();
   const { locale } = useLocalization();
   const copy = SUPPORT_COPY[locale] ?? SUPPORT_COPY.en;
   const user = useSelector((state: RootState) => state.auth.user);
   const firstName = (user?.displayName || user?.username || 'there').split(' ')[0];

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28 flex flex-col">
            {/* User header */}
            <div className="flex items-center justify-between px-md-5 py-md-3">
               <div className="flex items-center gap-md-2">
                  <UserAvatar size={48} />
                  <div className="flex flex-col gap-1">
                     <p className="text-md-h5 font-semibold text-md-primary-2000">{copy.greeting(firstName)}</p>
                     <BorrowerVerificationBadge />
                  </div>
               </div>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-md-4 p-md-4">
               <div className="flex flex-col gap-md-3">
                  <h1 className="text-md-h3 font-semibold text-md-heading tracking-[-0.56px]">{copy.title}</h1>
                  <p className="text-md-b1 text-md-neutral-1200">{copy.subtitle}</p>
               </div>

               {/* 4 category cards, 2x2 grid */}
               <div className="grid grid-cols-2 gap-md-4">
                  {copy.cards.map((card) => (
                     <button
                        key={card.label}
                        type="button"
                        onClick={() => navigate(card.path)}
                        className="group flex flex-col items-start gap-md-3 border border-md-neutral-600 rounded-md-input p-md-3 text-left bg-transparent transition-all duration-150 hover:border-md-primary-900 hover:bg-md-primary-100/45 active:scale-[0.985] active:border-md-primary-900 active:bg-md-primary-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-1200"
                     >
                        <div className="transition-transform duration-150 group-active:scale-95">
                           <CategoryIcon icon={card.icon} />
                        </div>
                        <div className="flex flex-col gap-md-0 w-full">
                           <div className="flex items-start gap-1">
                              <span className="text-md-h5 font-semibold text-md-heading">{card.label}</span>
                              {card.badge ? (
                                 <span className="bg-md-primary-300 rounded-md-sm px-md-1 py-md-0 text-md-b3 font-semibold text-md-primary-1200">
                                    {card.badge}
                                 </span>
                              ) : null}
                           </div>
                           <p className="text-md-b2 text-md-neutral-1200">{card.description}</p>
                        </div>
                     </button>
                  ))}
               </div>

               <NeedMoreHelp />

               {/* Join community */}
               <div className="bg-md-neutral-300 border border-md-primary-900 rounded-md-input flex flex-col items-center gap-md-1 p-md-3">
                  <img src="/hippos/community.png" alt="" className="h-[185px] w-full max-w-[326px] object-contain" />
                  <p className="text-md-h5 font-semibold text-md-heading text-center">{copy.communityTitle}</p>
                  <p className="text-md-b2 text-md-neutral-1200 text-center">{copy.communityDescription}</p>
                  <div className="flex w-full gap-md-1 pt-md-1">
                     <a
                        href={SUPPORT_FACEBOOK_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-0 rounded-md-input flex items-center justify-center gap-md-1 px-md-3 py-md-2 shadow-md-card transition-all duration-150 hover:brightness-105 active:scale-[0.97] active:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-1200"
                        style={{ backgroundColor: '#1877F2' }}
                     >
                        <div
                           className="w-5 h-5 bg-md-neutral-100"
                           style={{
                              ...ICON_MASK_BASE,
                              WebkitMaskImage: "url('/icons/facebook.svg')",
                              maskImage: "url('/icons/facebook.svg')"
                           }}
                        />
                        <span className="text-md-b1 font-medium text-md-neutral-100 whitespace-nowrap">Facebook</span>
                     </a>
                     <a
                        href={X_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-0 bg-md-neutral-1700 rounded-md-input flex items-center justify-center gap-md-1 px-md-3 py-md-2 shadow-md-card transition-all duration-150 hover:brightness-110 active:scale-[0.97] active:brightness-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-1200"
                     >
                        <div
                           className="w-[22px] h-5 bg-md-neutral-100"
                           style={{
                              ...ICON_MASK_BASE,
                              WebkitMaskImage: "url('/icons/x-logo.svg')",
                              maskImage: "url('/icons/x-logo.svg')"
                           }}
                        />
                        <span className="text-md-b1 font-medium text-md-neutral-100 whitespace-nowrap">Twitter</span>
                     </a>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}
