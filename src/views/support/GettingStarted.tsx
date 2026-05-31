import { useMemo } from 'react';

import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { useLocalization } from '@/i18n';
import type { RootState } from '@/store/store';
import NeedMoreHelp from '@/views/support/components/NeedMoreHelp';
import SupportHeader from '@/views/support/components/SupportHeader';
import { DEMO_VIDEO_ID, ICON_MASK_BASE } from '@/views/support/constants';

interface BasicsItem {
   title: string;
   description: string;
   icon: string;
   bg: string;
   path: string;
}

const BASICS: BasicsItem[] = [
   {
      title: 'Browse Guides',
      description: 'Quick Start for New Users',
      icon: 'trend-up.svg',
      bg: 'bg-[#155dfc]',
      path: '/support/guides'
   },
   {
      title: 'Browse Benefits',
      description: "See Why It's Worth It",
      icon: 'lightning.svg',
      bg: 'bg-[#00a63e]',
      path: '/benefits'
   },
   {
      title: 'Why Moodeng uses USDC',
      description: 'Learn how USDC works',
      icon: 'usdc.svg',
      bg: 'bg-[#2775ca]',
      path: '/support/guides/using-usdc-on-moodeng-credit'
   },
   {
      title: 'Learn Credit Leveling System',
      description: 'Grow Limits, Build Trust',
      icon: 'book-open.svg',
      bg: 'bg-[#9810fa]',
      path: '/support/guides/how-credit-levels-work'
   },
   {
      title: 'Learn more at the Academy',
      description: 'Borrowing, Base wallet, Trust Score, and Credit Level',
      icon: 'book-open.svg',
      bg: 'bg-md-primary-1200',
      path: '/academy'
   },
   {
      title: 'Read Moodeng Blogs',
      description: 'Stories on fair credit, loan sharks, and trust',
      icon: 'book-open.svg',
      bg: 'bg-[#d75a00]',
      path: '/blogs'
   }
];

const GETTING_STARTED_COPY = {
   en: {
      title: 'Getting started',
      heading: 'Learn the Moodeng Basics',
      latestVideo: 'Latest Video Guide',
      latestVideoTitle: 'Latest Video Guide',
      lenderBenefitsTitle: 'Lender Benefits',
      lenderBenefitsDescription: 'See why lending matters',
      basics: [
         { title: 'Browse Guides', description: 'Quick Start for New Users' },
         { title: 'Browse Benefits', description: "See Why It's Worth It" },
         { title: 'Why Moodeng uses USDC', description: 'Learn how USDC works' },
         { title: 'Learn Credit Leveling System', description: 'Grow Limits, Build Trust' },
         { title: 'Learn more at the Academy', description: 'Borrowing, Base wallet, Trust Score, and Credit Level' },
         { title: 'Read Moodeng Blogs', description: 'Stories on fair credit, loan sharks, and trust' }
      ]
   },
   fil: {
      title: 'Magsimula',
      heading: 'Alamin ang basics ng Moodeng',
      latestVideo: 'Pinakabagong video guide',
      latestVideoTitle: 'Pinakabagong video guide',
      lenderBenefitsTitle: 'Benepisyo para sa nagpapahiram',
      lenderBenefitsDescription: 'Alamin kung bakit mahalaga ang pagpapahiram',
      basics: [
         { title: 'Tingnan ang mga gabay', description: 'Quick start para sa bagong users' },
         { title: 'Tingnan ang benefits', description: 'Alamin kung bakit sulit ito' },
         { title: 'Bakit USDC ang gamit ng Moodeng', description: 'Alamin kung paano gumagana ang USDC' },
         { title: 'Alamin ang Credit Leveling System', description: 'Palakihin ang limits, bumuo ng trust' },
         { title: 'Matuto pa sa Academy', description: 'Borrowing, Base wallet, Trust Score, at Credit Level' },
         { title: 'Basahin ang Moodeng Blogs', description: 'Mga kwento tungkol sa patas na credit, loan sharks, at trust' }
      ]
   },
   id: {
      title: 'Mulai',
      heading: 'Pelajari dasar-dasar Moodeng',
      latestVideo: 'Panduan video terbaru',
      latestVideoTitle: 'Panduan video terbaru',
      lenderBenefitsTitle: 'Manfaat pemberi pinjaman',
      lenderBenefitsDescription: 'Lihat mengapa memberi pinjaman penting',
      basics: [
         { title: 'Lihat panduan', description: 'Mulai cepat untuk pengguna baru' },
         { title: 'Lihat manfaat', description: 'Lihat mengapa ini berguna' },
         { title: 'Mengapa Moodeng memakai USDC', description: 'Pelajari cara kerja USDC' },
         { title: 'Pelajari sistem Credit Leveling', description: 'Naikkan limit, bangun kepercayaan' },
         { title: 'Pelajari lebih lanjut di Academy', description: 'Pinjaman, Base wallet, Trust Score, dan Credit Level' },
         { title: 'Baca Blog Moodeng', description: 'Cerita tentang kredit adil, rentenir, dan kepercayaan' }
      ]
   },
   th: {
      title: 'เริ่มต้น',
      heading: 'เรียนรู้พื้นฐานของ Moodeng',
      latestVideo: 'วิดีโอคู่มือล่าสุด',
      latestVideoTitle: 'วิดีโอคู่มือล่าสุด',
      lenderBenefitsTitle: 'ประโยชน์สำหรับผู้ให้กู้',
      lenderBenefitsDescription: 'ดูว่าทำไมการให้กู้จึงสำคัญ',
      basics: [
         { title: 'ดูคู่มือ', description: 'เริ่มต้นอย่างรวดเร็วสำหรับผู้ใช้ใหม่' },
         { title: 'ดูประโยชน์', description: 'ดูว่าทำไมจึงคุ้มค่า' },
         { title: 'ทำไม Moodeng ใช้ USDC', description: 'เรียนรู้ว่า USDC ทำงานอย่างไร' },
         { title: 'เรียนรู้ระบบ Credit Level', description: 'เพิ่มวงเงิน สร้างความน่าเชื่อถือ' },
         { title: 'เรียนรู้เพิ่มเติมที่ Academy', description: 'การยืม, Base wallet, Trust Score และ Credit Level' },
         { title: 'อ่านบล็อก Moodeng', description: 'เรื่องราวเกี่ยวกับเครดิตที่เป็นธรรม เงินกู้นอกระบบ และความน่าเชื่อถือ' }
      ]
   },
   vi: {
      title: 'Bắt đầu',
      heading: 'Tìm hiểu cơ bản về Moodeng',
      latestVideo: 'Video hướng dẫn mới nhất',
      latestVideoTitle: 'Video hướng dẫn mới nhất',
      lenderBenefitsTitle: 'Lợi ích cho người cho vay',
      lenderBenefitsDescription: 'Xem vì sao cho vay quan trọng',
      basics: [
         { title: 'Xem hướng dẫn', description: 'Bắt đầu nhanh cho người dùng mới' },
         { title: 'Xem lợi ích', description: 'Xem vì sao đáng dùng' },
         { title: 'Vì sao Moodeng dùng USDC', description: 'Tìm hiểu USDC hoạt động ra sao' },
         { title: 'Tìm hiểu hệ thống Credit Level', description: 'Tăng hạn mức, xây dựng niềm tin' },
         { title: 'Học thêm tại Academy', description: 'Vay, Base wallet, Trust Score và Credit Level' },
         { title: 'Đọc Blog Moodeng', description: 'Câu chuyện về tín dụng công bằng, cho vay nặng lãi và niềm tin' }
      ]
   }
} as const;

function ChevronRight() {
   return (
      <div
         className="w-6 h-6 bg-md-primary-900 shrink-0"
         style={{
            ...ICON_MASK_BASE,
            WebkitMaskImage: "url('/icons/chevron-right.svg')",
            maskImage: "url('/icons/chevron-right.svg')"
         }}
      />
   );
}

export default function GettingStarted() {
   const navigate = useNavigate();
   const { locale } = useLocalization();
   const copy = GETTING_STARTED_COPY[locale] ?? GETTING_STARTED_COPY.en;
   const user = useSelector((state: RootState) => state.auth.user);
   const isLender = user?.userRole === 'lender';
   const basics = useMemo(
      () =>
         BASICS.map((item) =>
            item.title === 'Browse Benefits' && isLender
               ? {
                    ...item,
                    title: copy.lenderBenefitsTitle,
                    description: copy.lenderBenefitsDescription,
                    path: '/whylend'
                 }
               : {
                    ...item,
                    title: copy.basics[BASICS.indexOf(item)].title,
                    description: copy.basics[BASICS.indexOf(item)].description
                 }
         ),
      [copy, isLender]
   );

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28 flex flex-col">
            <SupportHeader title={copy.title} />

            <div className="flex flex-col gap-md-4 p-md-4">
               <div className="flex flex-col">
                  <h2 className="text-md-h4 font-semibold text-md-heading tracking-[-0.96px] pb-md-2">{copy.heading}</h2>
                  {basics.map((item, idx) => (
                     <button
                        key={item.title}
                        type="button"
                        onClick={() => navigate(item.path)}
                        className={`flex items-center gap-md-2 py-md-2 text-left bg-transparent ${
                           idx < basics.length - 1 ? 'border-b border-md-neutral-600' : ''
                        }`}
                     >
                        <div className={`${item.bg} rounded-[10px] w-8 h-8 shrink-0 flex items-center justify-center`}>
                           <div
                              className="w-5 h-5 bg-white"
                              style={{
                                 ...ICON_MASK_BASE,
                                 WebkitMaskImage: `url('/icons/${item.icon}')`,
                                 maskImage: `url('/icons/${item.icon}')`
                              }}
                           />
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                           <span className="text-md-b1 font-medium text-md-neutral-1900">{item.title}</span>
                           <span className="text-md-b3 text-md-neutral-1200">{item.description}</span>
                        </div>
                        <ChevronRight />
                     </button>
                  ))}
               </div>

               <div className="flex flex-col gap-md-3">
                  <h2 className="text-md-h4 font-semibold text-md-heading tracking-[-0.96px]">{copy.latestVideo}</h2>
                  <div className="relative w-full aspect-video rounded-md-lg overflow-hidden bg-md-neutral-400">
                     <iframe
                        src={`https://www.youtube.com/embed/${DEMO_VIDEO_ID}`}
                        title={copy.latestVideoTitle}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="absolute inset-0 w-full h-full"
                     />
                  </div>
               </div>

               <NeedMoreHelp showTeamLink />
            </div>
         </div>
      </div>
   );
}
