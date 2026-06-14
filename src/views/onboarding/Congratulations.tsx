import { useNavigate } from 'react-router-dom';

import { useLocalization } from '@/i18n/LocalizationProvider';
import type { LocaleCode } from '@/i18n/translations';
import { OnboardingHeader } from '@/views/onboarding/OnboardingHeader';

const TELEGRAM_URL =
   'https://t.me/jimmymoodengcredit?text=Hi%2C%20I%20found%20you%20through%20Moodeng%20Credit%20and%20I%27d%20like%20to%20learn%20more.';

const FACEBOOK_PAGE_URL = 'https://www.facebook.com/profile.php?id=61589106561061';
const FACEBOOK_COMMUNITY_URL = 'https://www.facebook.com/groups/1593629908540434';

const CONGRATULATIONS_COPY = {
   en: {
      headerTitle: 'Verify World ID',
      title: 'Congratulations! 🎉',
      body: "Your Moodeng account is fully set up and you're ready to go!",
      nextTitle: "What's Next?",
      rows: {
         guides: {
            title: 'Browse Guides',
            subtitle: 'Quick Start for New Users'
         },
         telegram: {
            title: 'Get Help via Telegram',
            subtitle: 'Message us for wallet help, deposits, or questions'
         },
         facebook: {
            title: 'Contact Us on Facebook',
            subtitle: 'Join our community and ask questions'
         },
         creditLeveling: {
            title: 'Learn Credit Leveling System',
            subtitle: 'Grow Limits, Build Trust'
         }
      },
      exploreRequestBoard: 'Explore the Request Board',
      exploreNote: 'You can now explore Moodeng Credit and begin your journey with confidence.',
      communityTitle: 'Voices Against Unfair Loans',
      communityBody: 'Join Our Facebook Community. Connect with other Moodeng Credit users',
      joinCommunity: 'Join Our Community'
   },
   fil: {
      headerTitle: 'I-verify ang World ID',
      title: 'Binabati ka namin! 🎉',
      body: 'Naka-set up na ang Moodeng account mo at handa ka nang magsimula!',
      nextTitle: 'Ano ang susunod?',
      rows: {
         guides: {
            title: 'Tingnan ang mga gabay',
            subtitle: 'Mabilisang simula para sa bagong gumagamit'
         },
         telegram: {
            title: 'Humingi ng tulong sa Telegram',
            subtitle: 'Mag-message para sa tulong sa wallet, deposito, o mga tanong'
         },
         facebook: {
            title: 'Kontakin kami sa Facebook',
            subtitle: 'Sumali sa komunidad at magtanong'
         },
         creditLeveling: {
            title: 'Alamin ang sistema ng pagpapataas ng antas ng kredito',
            subtitle: 'Palakihin ang limit, bumuo ng tiwala'
         }
      },
      exploreRequestBoard: 'I-explore ang Request Board',
      exploreNote: 'Puwede mo nang i-explore ang Moodeng Credit at simulan ang journey mo nang may kumpiyansa.',
      communityTitle: 'Boses laban sa hindi patas na pautang',
      communityBody: 'Sumali sa aming komunidad sa Facebook. Makipag-ugnayan sa ibang gumagamit ng Moodeng Credit.',
      joinCommunity: 'Sumali sa komunidad'
   },
   id: {
      headerTitle: 'Verifikasi World ID',
      title: 'Selamat! 🎉',
      body: 'Akun Moodeng kamu sudah siap dan kamu bisa mulai sekarang!',
      nextTitle: 'Berikutnya apa?',
      rows: {
         guides: {
            title: 'Lihat panduan',
            subtitle: 'Mulai cepat untuk pengguna baru'
         },
         telegram: {
            title: 'Dapatkan bantuan lewat Telegram',
            subtitle: 'Kirim pesan untuk bantuan wallet, deposit, atau pertanyaan'
         },
         facebook: {
            title: 'Hubungi kami di Facebook',
            subtitle: 'Gabung komunitas dan ajukan pertanyaan'
         },
         creditLeveling: {
            title: 'Pelajari sistem peningkatan level kredit',
            subtitle: 'Naikkan limit, bangun kepercayaan'
         }
      },
      exploreRequestBoard: 'Jelajahi Papan Permintaan',
      exploreNote: 'Kamu sekarang bisa menjelajahi Moodeng Credit dan memulai perjalanan dengan percaya diri.',
      communityTitle: 'Suara melawan pinjaman tidak adil',
      communityBody: 'Gabung komunitas Facebook kami. Terhubung dengan pengguna Moodeng Credit lainnya.',
      joinCommunity: 'Gabung komunitas'
   },
   th: {
      headerTitle: 'ยืนยัน World ID',
      title: 'ยินดีด้วย! 🎉',
      body: 'บัญชี Moodeng ของคุณตั้งค่าเสร็จแล้วและพร้อมเริ่มใช้งาน',
      nextTitle: 'ต่อไปคืออะไร?',
      rows: {
         guides: {
            title: 'ดูคู่มือ',
            subtitle: 'เริ่มต้นอย่างรวดเร็วสำหรับผู้ใช้ใหม่'
         },
         telegram: {
            title: 'รับความช่วยเหลือผ่าน Telegram',
            subtitle: 'ส่งข้อความหาเราสำหรับความช่วยเหลือเรื่องกระเป๋า การฝาก หรือคำถาม'
         },
         facebook: {
            title: 'ติดต่อเราบน Facebook',
            subtitle: 'เข้าร่วมชุมชนและถามคำถาม'
         },
         creditLeveling: {
            title: 'เรียนรู้ระบบการเพิ่มระดับเครดิต',
            subtitle: 'เพิ่มวงเงิน สร้างความน่าเชื่อถือ'
         }
      },
      exploreRequestBoard: 'สำรวจกระดานคำขอ',
      exploreNote: 'คุณสามารถสำรวจ Moodeng Credit และเริ่มต้นได้อย่างมั่นใจแล้ว',
      communityTitle: 'เสียงต่อต้านเงินกู้ที่ไม่เป็นธรรม',
      communityBody: 'เข้าร่วมชุมชน Facebook ของเรา เชื่อมต่อกับผู้ใช้ Moodeng Credit คนอื่น',
      joinCommunity: 'เข้าร่วมชุมชน'
   },
   vi: {
      headerTitle: 'Xác minh World ID',
      title: 'Chúc mừng! 🎉',
      body: 'Tài khoản Moodeng của bạn đã được thiết lập và sẵn sàng sử dụng!',
      nextTitle: 'Tiếp theo là gì?',
      rows: {
         guides: {
            title: 'Xem hướng dẫn',
            subtitle: 'Bắt đầu nhanh cho người dùng mới'
         },
         telegram: {
            title: 'Nhận trợ giúp qua Telegram',
            subtitle: 'Nhắn cho chúng tôi để được hỗ trợ về ví, nạp tiền hoặc câu hỏi'
         },
         facebook: {
            title: 'Liên hệ với chúng tôi trên Facebook',
            subtitle: 'Tham gia cộng đồng và đặt câu hỏi'
         },
         creditLeveling: {
            title: 'Tìm hiểu hệ thống nâng hạng tín dụng',
            subtitle: 'Tăng hạn mức, xây dựng niềm tin'
         }
      },
      exploreRequestBoard: 'Khám phá Bảng yêu cầu',
      exploreNote: 'Bạn có thể khám phá Moodeng Credit và bắt đầu hành trình với sự tự tin.',
      communityTitle: 'Tiếng nói chống khoản vay không công bằng',
      communityBody: 'Tham gia cộng đồng Facebook của chúng tôi. Kết nối với người dùng Moodeng Credit khác.',
      joinCommunity: 'Tham gia cộng đồng'
   }
} satisfies Record<
   LocaleCode,
   {
      headerTitle: string;
      title: string;
      body: string;
      nextTitle: string;
      rows: {
         guides: { title: string; subtitle: string };
         telegram: { title: string; subtitle: string };
         facebook: { title: string; subtitle: string };
         creditLeveling: { title: string; subtitle: string };
      };
      exploreRequestBoard: string;
      exploreNote: string;
      communityTitle: string;
      communityBody: string;
      joinCommunity: string;
   }
>;

interface ActionRowProps {
   icon: React.ReactNode;
   title: string;
   subtitle: string;
   onClick: () => void;
   noBorder?: boolean;
}

function ActionRow({ icon, title, subtitle, onClick, noBorder }: ActionRowProps) {
   return (
      <button
         type="button"
         onClick={onClick}
         className={`flex w-full items-center gap-[10px] py-3 text-left active:scale-[0.99] ${!noBorder ? 'border-b border-md-neutral-600' : ''}`}
      >
         <div className="flex min-w-0 flex-1 items-center gap-[10px]">
            {icon}
            <div className="flex min-w-0 flex-1 flex-col justify-center">
               <p className="truncate text-[16px] font-[510] leading-6 tracking-[-0.02em] text-[#0f172b]">{title}</p>
               <p className="truncate text-[12px] font-normal leading-[18px] tracking-[-0.02em] text-[#45556c]">{subtitle}</p>
            </div>
         </div>
         <span
            className="block size-6 shrink-0 bg-md-primary-2000"
            style={{
               WebkitMaskImage: "url('/icons/chevron-right.svg')",
               maskImage: "url('/icons/chevron-right.svg')",
               WebkitMaskRepeat: 'no-repeat',
               maskRepeat: 'no-repeat',
               WebkitMaskPosition: 'center',
               maskPosition: 'center',
               WebkitMaskSize: 'contain',
               maskSize: 'contain'
            }}
         />
      </button>
   );
}

function IconBadge({ color, iconPath, rounded }: { color: string; iconPath: string; rounded?: boolean }) {
   return (
      <div
         className={`size-[32px] flex items-center justify-center flex-shrink-0 ${rounded ? 'rounded-full' : 'rounded-[10px]'}`}
         style={{ background: color }}
      >
         <span
            className="block size-[20px] bg-white"
            style={{
               WebkitMaskImage: `url('${iconPath}')`,
               maskImage: `url('${iconPath}')`,
               WebkitMaskSize: 'contain',
               maskSize: 'contain',
               WebkitMaskRepeat: 'no-repeat',
               maskRepeat: 'no-repeat',
               WebkitMaskPosition: 'center',
               maskPosition: 'center'
            }}
         />
      </div>
   );
}

function ImageIconBadge({ src }: { src: string }) {
   return <img src={src} alt="" className="size-8 shrink-0" />;
}

export default function Congratulations() {
   const navigate = useNavigate();
   const { locale } = useLocalization();
   const copy = CONGRATULATIONS_COPY[locale] ?? CONGRATULATIONS_COPY.en;
   const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');
   const requestBoardTourPath = import.meta.env.DEV ? '/request-board?referralTest=1&tourPreview=1' : '/request-board?tour=1';

   return (
      <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col overflow-hidden rounded-[20px] bg-gradient-to-b from-[#fbfafd] to-white dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f]">
         <OnboardingHeader title={copy.headerTitle} />

         <main className="flex flex-1 flex-col gap-5 px-5 pb-5 pt-3">
            <img src="/hippos/party.png" alt="Moodeng celebrating" className="h-24 w-[110px] object-contain" />

            <div className="flex flex-col gap-1">
               <h1 className="text-[34px] font-[590] leading-[1.2] tracking-[-0.04em] text-[#040033]">{copy.title}</h1>
               <p className="text-[16px] font-[510] leading-6 tracking-[-0.02em] text-[#45556c]">{copy.body}</p>
            </div>

            <section className="flex flex-col gap-1">
               <h2 className="text-[18px] font-[590] leading-[1.2] tracking-[-0.04em] text-[#0a0a0a]">{copy.nextTitle}</h2>
               <div className="flex flex-col">
                  <ActionRow
                     icon={<IconBadge color="#155dfc" iconPath="/icons/book-open.svg" />}
                     title={copy.rows.guides.title}
                     subtitle={copy.rows.guides.subtitle}
                     onClick={() => navigate('/support/guides')}
                  />
                  <ActionRow
                     icon={<ImageIconBadge src="/icons/telegram-classic-filled.png" />}
                     title={copy.rows.telegram.title}
                     subtitle={copy.rows.telegram.subtitle}
                     onClick={() => openExternal(TELEGRAM_URL)}
                  />
                  <ActionRow
                     icon={<IconBadge color="#1877f2" iconPath="/icons/facebook.svg" />}
                     title={copy.rows.facebook.title}
                     subtitle={copy.rows.facebook.subtitle}
                     onClick={() => openExternal(FACEBOOK_PAGE_URL)}
                  />
                  <ActionRow
                     noBorder
                     icon={<IconBadge color="#9810fa" iconPath="/icons/trend-up.svg" />}
                     title={copy.rows.creditLeveling.title}
                     subtitle={copy.rows.creditLeveling.subtitle}
                     onClick={() => navigate('/support/getting-started')}
                  />
               </div>
            </section>

            <section className="flex flex-col gap-2">
               <button
                  type="button"
                  onClick={() => navigate(requestBoardTourPath)}
                  className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#6010d2] px-5 py-4 text-[16px] font-[590] leading-6 tracking-[-0.02em] text-[#fdfcfd] active:scale-[0.99]"
               >
                  {copy.exploreRequestBoard}
                  <span
                     className="block size-6 bg-white flex-shrink-0"
                     style={{
                        WebkitMaskImage: "url('/icons/chevron-right.svg')",
                        maskImage: "url('/icons/chevron-right.svg')",
                        WebkitMaskRepeat: 'no-repeat',
                        maskRepeat: 'no-repeat',
                        WebkitMaskPosition: 'center',
                        maskPosition: 'center',
                        WebkitMaskSize: 'contain',
                        maskSize: 'contain'
                     }}
                  />
               </button>
               <p className="px-5 text-center text-[12px] font-normal leading-[18px] tracking-[-0.02em] text-[#62748e]">
                  {copy.exploreNote}
               </p>
            </section>

            <section className="flex min-h-[136px] w-full items-end gap-3 overflow-hidden rounded-[16px] border border-md-neutral-600 bg-md-neutral-300">
               <div className="flex h-[136px] w-[144px] shrink-0 items-end justify-center overflow-hidden">
                  <img src="/hippos/thinking.png" alt="Moodeng community hippo" className="h-[132px] w-auto object-contain object-bottom" />
               </div>
               <div className="flex min-w-0 flex-1 flex-col items-start gap-2 self-center py-4 pr-4">
                  <div className="flex w-full flex-col">
                     <p className="truncate text-[16px] font-[510] leading-6 tracking-[-0.02em] text-[#0f172b]">{copy.communityTitle}</p>
                     <p className="line-clamp-2 text-[12px] font-normal leading-[18px] tracking-[-0.02em] text-[#45556c]">
                        {copy.communityBody}
                     </p>
                  </div>
                  <button
                     type="button"
                     onClick={() => openExternal(FACEBOOK_COMMUNITY_URL)}
                     className="flex items-center gap-1 rounded-[12px] border border-[#6010d2] px-3 py-2 text-[14px] font-[590] leading-[21px] tracking-[-0.02em] text-[#6010d2] active:scale-[0.98]"
                  >
                     <span className="whitespace-nowrap">{copy.joinCommunity}</span>
                     <span
                        className="block size-[18px] bg-[#6010d2] flex-shrink-0"
                        style={{
                           WebkitMaskImage: "url('/icons/view_link.svg')",
                           maskImage: "url('/icons/view_link.svg')",
                           WebkitMaskSize: 'contain',
                           maskSize: 'contain',
                           WebkitMaskRepeat: 'no-repeat',
                           maskRepeat: 'no-repeat',
                           WebkitMaskPosition: 'center',
                           maskPosition: 'center'
                        }}
                     />
                  </button>
               </div>
            </section>
         </main>
      </div>
   );
}
