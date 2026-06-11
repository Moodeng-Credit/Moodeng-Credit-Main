import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import { useLocalization } from '@/i18n/LocalizationProvider';
import type { LocaleCode } from '@/i18n/translations';
import type { RootState } from '@/store/store';
import { OnboardingHeader } from '@/views/onboarding/OnboardingHeader';

const TUTORIAL_URL = 'https://youtube.com/shorts/fKpBC9zD6Hk';

const WELCOME_COPY = {
   en: {
      title: 'Onboarding',
      lenderHeadline: 'Lend to real people and help them build credit.',
      lenderSubtitle: 'Earn onchain — powered by Base.',
      borrowerHeadline: "You're building a reputation your wallet can carry anywhere.",
      borrowerSubtitle: 'Borrow responsibly. Build trust. Unlock more over time.',
      getStartedTitle: 'Get Started Now',
      recommended: 'Recommended',
      setupBody: 'Set up your account and verify your identity to access credit',
      startSetup: 'Start Setup',
      watchTutorial: 'Watch Tutorial',
      checkFirstTitle: 'Check It Out First',
      noCommitment: 'No commitment',
      checkFirstBody: 'Explore features, compare rates, and see how it all works',
      previewItems: ['Browse Features', 'View rates', 'Learn How It Works!'],
      exploreMoodeng: 'Explore Moodeng'
   },
   fil: {
      title: 'Pagsisimula',
      lenderHeadline: 'Magpahiram sa totoong tao at tulungan silang bumuo ng credit.',
      lenderSubtitle: 'Kumita onchain gamit ang Base.',
      borrowerHeadline: 'Bumubuo ka ng reputasyon na madadala ng wallet mo kahit saan.',
      borrowerSubtitle: 'Humiram nang responsable. Bumuo ng tiwala. Mag-unlock ng mas mataas na limit habang tumatagal.',
      getStartedTitle: 'Magsimula ngayon',
      recommended: 'Inirerekomenda',
      setupBody: 'I-set up ang account mo at i-verify ang pagkakakilanlan para ma-access ang credit',
      startSetup: 'Simulan ang setup',
      watchTutorial: 'Panoorin ang tutorial',
      checkFirstTitle: 'Tingnan muna',
      noCommitment: 'Walang obligasyon',
      checkFirstBody: 'I-explore ang mga feature, ikumpara ang mga rate, at alamin kung paano ito gumagana',
      previewItems: ['Tingnan ang mga feature', 'Tingnan ang mga rate', 'Alamin kung paano gumagana'],
      exploreMoodeng: 'I-explore ang Moodeng'
   },
   id: {
      title: 'Mulai',
      lenderHeadline: 'Beri pinjaman kepada orang sungguhan dan bantu mereka membangun kredit.',
      lenderSubtitle: 'Dapatkan imbal hasil onchain dengan Base.',
      borrowerHeadline: 'Kamu sedang membangun reputasi yang bisa dibawa wallet kamu ke mana saja.',
      borrowerSubtitle: 'Pinjam dengan bertanggung jawab. Bangun kepercayaan. Buka limit lebih besar dari waktu ke waktu.',
      getStartedTitle: 'Mulai sekarang',
      recommended: 'Direkomendasikan',
      setupBody: 'Siapkan akun dan verifikasi identitas kamu untuk mengakses kredit',
      startSetup: 'Mulai setup',
      watchTutorial: 'Tonton tutorial',
      checkFirstTitle: 'Lihat dulu',
      noCommitment: 'Tanpa komitmen',
      checkFirstBody: 'Jelajahi fitur, bandingkan rate, dan lihat cara kerjanya',
      previewItems: ['Lihat fitur', 'Lihat rate', 'Pelajari cara kerjanya'],
      exploreMoodeng: 'Jelajahi Moodeng'
   },
   th: {
      title: 'เริ่มต้น',
      lenderHeadline: 'ให้กู้กับคนจริงและช่วยพวกเขาสร้างเครดิต',
      lenderSubtitle: 'รับผลตอบแทน onchain ด้วย Base',
      borrowerHeadline: 'คุณกำลังสร้างชื่อเสียงที่กระเป๋าของคุณพาไปได้ทุกที่',
      borrowerSubtitle: 'ยืมอย่างรับผิดชอบ สร้างความน่าเชื่อถือ และปลดล็อกเพิ่มขึ้นเมื่อเวลาผ่านไป',
      getStartedTitle: 'เริ่มตอนนี้',
      recommended: 'แนะนำ',
      setupBody: 'ตั้งค่าบัญชีและยืนยันตัวตนเพื่อเข้าถึงเครดิต',
      startSetup: 'เริ่มตั้งค่า',
      watchTutorial: 'ดูบทแนะนำ',
      checkFirstTitle: 'ดูก่อน',
      noCommitment: 'ไม่มีข้อผูกมัด',
      checkFirstBody: 'สำรวจฟีเจอร์ เปรียบเทียบอัตรา และดูว่าทำงานอย่างไร',
      previewItems: ['ดูฟีเจอร์', 'ดูอัตรา', 'เรียนรู้วิธีทำงาน'],
      exploreMoodeng: 'สำรวจ Moodeng'
   },
   vi: {
      title: 'Bắt đầu',
      lenderHeadline: 'Cho người thật vay và giúp họ xây dựng tín dụng.',
      lenderSubtitle: 'Kiếm lợi suất onchain với Base.',
      borrowerHeadline: 'Bạn đang xây dựng uy tín mà ví của bạn có thể mang đi mọi nơi.',
      borrowerSubtitle: 'Vay có trách nhiệm. Xây dựng niềm tin. Mở khóa thêm theo thời gian.',
      getStartedTitle: 'Bắt đầu ngay',
      recommended: 'Đề xuất',
      setupBody: 'Thiết lập tài khoản và xác minh danh tính để truy cập tín dụng',
      startSetup: 'Bắt đầu thiết lập',
      watchTutorial: 'Xem hướng dẫn',
      checkFirstTitle: 'Xem trước',
      noCommitment: 'Không cam kết',
      checkFirstBody: 'Khám phá tính năng, so sánh lãi suất và xem cách hoạt động',
      previewItems: ['Xem tính năng', 'Xem lãi suất', 'Tìm hiểu cách hoạt động'],
      exploreMoodeng: 'Khám phá Moodeng'
   }
} satisfies Record<
   LocaleCode,
   {
      title: string;
      lenderHeadline: string;
      lenderSubtitle: string;
      borrowerHeadline: string;
      borrowerSubtitle: string;
      getStartedTitle: string;
      recommended: string;
      setupBody: string;
      startSetup: string;
      watchTutorial: string;
      checkFirstTitle: string;
      noCommitment: string;
      checkFirstBody: string;
      previewItems: string[];
      exploreMoodeng: string;
   }
>;

export default function Welcome() {
   const navigate = useNavigate();
   const location = useLocation();
   const user = useSelector((state: RootState) => state.auth.user);
   const { locale } = useLocalization();
   const copy = WELCOME_COPY[locale] ?? WELCOME_COPY.en;
   const isPreview = import.meta.env.DEV && location.pathname.includes('start-preview');
   const requestBoardTourPath = import.meta.env.DEV ? '/request-board?tourPreview=1' : '/request-board?tour=1';
   const returnTo =
      (location.state as { returnTo?: string } | null)?.returnTo || new URLSearchParams(location.search).get('returnTo') || undefined;
   const walletPath = isPreview ? '/onboarding/wallet-preview' : '/onboarding/wallet';

   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f] flex flex-col max-w-[440px] mx-auto w-full">
         <OnboardingHeader title={copy.title} />

         <div className="flex flex-col gap-md-4 p-md-4">
            <img src="/hippos/welcome.png" alt="Moodeng hippo" className="w-[110px] h-[96px] object-cover" />

            <div className="flex flex-col gap-md-0 w-full">
               {user?.userRole === 'lender' ? (
                  <>
                     <h2 className="text-md-display text-md-heading">{copy.lenderHeadline}</h2>
                     <p className="text-md-b1 text-md-neutral-700 font-medium">{copy.lenderSubtitle}</p>
                  </>
               ) : (
                  <>
                     <h2 className="text-md-display text-md-heading">{copy.borrowerHeadline}</h2>
                     <p className="text-md-b1 text-md-neutral-700 font-medium">{copy.borrowerSubtitle}</p>
                  </>
               )}
            </div>

            <div className="flex flex-col gap-md-4 p-md-4 rounded-[12px] border border-md-primary-900 bg-md-primary-900/10 w-full">
               <div className="flex gap-md-3 items-start w-full">
                  <div className="size-10 rounded-md-sm-md bg-md-primary-2100 inline-flex items-center justify-center shrink-0">
                     <span
                        className="block size-5 bg-white"
                        style={{
                           WebkitMaskImage: "url('/icons/lightning.svg')",
                           maskImage: "url('/icons/lightning.svg')",
                           WebkitMaskRepeat: 'no-repeat',
                           maskRepeat: 'no-repeat',
                           WebkitMaskPosition: 'center',
                           maskPosition: 'center',
                           WebkitMaskSize: 'contain',
                           maskSize: 'contain'
                        }}
                     />
                  </div>
                  <div className="flex flex-col gap-md-1 flex-1 min-w-0">
                     <div className="flex flex-wrap items-center gap-md-1">
                        <h3 className="text-md-h5 text-md-heading">{copy.getStartedTitle}</h3>
                        <span className="inline-flex items-center justify-center px-md-1 py-md-0 rounded-md-sm bg-md-primary-300 dark:bg-md-primary-1500 text-md-b3 font-semibold text-md-primary-1200">
                           {copy.recommended}
                        </span>
                     </div>
                     <p className="text-md-b1 text-md-primary-1500 dark:text-[#c8a6f8]">{copy.setupBody}</p>
                  </div>
               </div>

               <div className="flex flex-col gap-md-3 w-full">
                  <button
                     type="button"
                     onClick={() => navigate(walletPath, returnTo ? { state: { returnTo } } : undefined)}
                     className="flex items-center justify-center gap-md-1 w-full px-md-4 py-md-3 rounded-md-lg bg-md-primary-1200 text-md-b1 font-semibold text-md-neutral-100"
                  >
                     <span
                        className="block size-6 bg-md-neutral-100"
                        style={{
                           WebkitMaskImage: "url('/icons/lightning.svg')",
                           maskImage: "url('/icons/lightning.svg')",
                           WebkitMaskRepeat: 'no-repeat',
                           maskRepeat: 'no-repeat',
                           WebkitMaskPosition: 'center',
                           maskPosition: 'center',
                           WebkitMaskSize: 'contain',
                           maskSize: 'contain'
                        }}
                     />
                     {copy.startSetup}
                  </button>

                  <button
                     type="button"
                     onClick={() => window.open(TUTORIAL_URL, '_blank', 'noopener,noreferrer')}
                     className="inline-flex items-center justify-center gap-md-1 w-full text-md-b2 font-semibold text-md-primary-1200"
                  >
                     <span
                        className="block size-6 bg-md-primary-1200"
                        style={{
                           WebkitMaskImage: "url('/icons/play.svg')",
                           maskImage: "url('/icons/play.svg')",
                           WebkitMaskRepeat: 'no-repeat',
                           maskRepeat: 'no-repeat',
                           WebkitMaskPosition: 'center',
                           maskPosition: 'center',
                           WebkitMaskSize: 'contain',
                           maskSize: 'contain'
                        }}
                     />
                     {copy.watchTutorial}
                  </button>
               </div>
            </div>

            <div className="flex flex-col gap-md-4 p-md-4 rounded-[12px] border border-md-blue-600 bg-md-blue-600/10 w-full">
               <div className="flex gap-md-3 items-start w-full">
                  <div className="size-10 rounded-md-sm-md bg-md-blue-700 inline-flex items-center justify-center shrink-0">
                     <span
                        className="block size-5 bg-white"
                        style={{
                           WebkitMaskImage: "url('/icons/eye.svg')",
                           maskImage: "url('/icons/eye.svg')",
                           WebkitMaskRepeat: 'no-repeat',
                           maskRepeat: 'no-repeat',
                           WebkitMaskPosition: 'center',
                           maskPosition: 'center',
                           WebkitMaskSize: 'contain',
                           maskSize: 'contain'
                        }}
                     />
                  </div>
                  <div className="flex flex-col gap-md-1 flex-1 min-w-0">
                     <div className="flex flex-wrap items-center gap-md-1">
                        <h3 className="text-md-h5 text-md-heading">{copy.checkFirstTitle}</h3>
                        <span className="inline-flex items-center justify-center px-md-1 py-md-0 rounded-md-sm bg-md-blue-200 text-md-b3 font-semibold text-md-blue-800">
                           {copy.noCommitment}
                        </span>
                     </div>
                     <p className="text-md-b1 text-md-blue-800">{copy.checkFirstBody}</p>
                     <ul className="flex flex-col gap-md-0 pt-md-1">
                        {copy.previewItems.map((item) => (
                           <li key={item} className="flex gap-md-1 items-center text-md-b2 font-semibold text-md-blue-1000 dark:text-md-blue-200">
                              <span className="size-[6px] rounded-full bg-md-blue-700 shrink-0" />
                              {item}
                           </li>
                        ))}
                     </ul>
                  </div>
               </div>

               <button
                  type="button"
                  onClick={() => navigate(requestBoardTourPath)}
                  className="flex items-center justify-center gap-md-1 w-full px-md-4 py-md-3 rounded-md-lg border border-md-blue-600 text-md-b1 font-semibold text-md-blue-600"
               >
                  {copy.exploreMoodeng}
                  <span
                     className="block size-6 bg-md-blue-600"
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
            </div>
         </div>
      </div>
   );
}
