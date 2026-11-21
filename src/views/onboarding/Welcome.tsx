import { type FormEvent, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { fetchJourneyV2, fetchPrescreenPath, JOURNEY_V2_PATH, needsJourneyV2, PRE_KYC_CONNECT_PATH } from '@/hooks/usePreKycGate';
import { useWalletLast } from '@/hooks/useWalletLast';

import { useLocalization } from '@/i18n/LocalizationProvider';
import type { LocaleCode } from '@/i18n/translations';
import { applyInviteCode } from '@/lib/friendReferrals';
import { codeStepDone } from '@/lib/inviteCodeStep';
import { ID_PATHS } from '@/lib/idTrack';
import { hasPrescreenPathFlag } from '@/lib/preScreening';
import type { RootState } from '@/store/store';
import { useIdTrackStatus } from '@/views/indonesia/idFlow';
import { OnboardingHeader } from '@/views/onboarding/OnboardingHeader';
import { OnboardingLanguagePicker } from '@/views/onboarding/OnboardingLanguagePicker';

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
      setupBody: 'Set up your account, meet our team on a quick call, then verify your ID to access credit',
      startSetup: 'Start Setup',
      watchTutorial: 'Watch Tutorial',
      checkFirstTitle: 'Check It Out First',
      noCommitment: 'No commitment',
      checkFirstBody: 'Explore features, compare rates, and see how it all works',
      previewItems: ['Browse Features', 'View rates', 'Learn How It Works!'],
      exploreMoodeng: 'Explore Moodeng',
      codeTitle: 'Did someone invite you?',
      codeHint: 'Type their code so they get credit.',
      codePlaceholder: 'Their code',
      codeAdd: 'Add',
      codeAdded: 'Code added: {code}',
      codeInvalid: 'That code didn’t work. Check the spelling.',
      codeAlready: 'Your account already has a code{code}.',
      codeSelf: 'You can’t use your own code.',
      codeOld: 'Codes only work for new accounts.',
      codeError: 'Couldn’t add it. Try again.'
   },
   fil: {
      title: 'Pagsisimula',
      lenderHeadline: 'Magpahiram sa totoong tao at tulungan silang bumuo ng credit.',
      lenderSubtitle: 'Kumita onchain gamit ang Base.',
      borrowerHeadline: 'Bumubuo ka ng reputasyon na madadala ng wallet mo kahit saan.',
      borrowerSubtitle: 'Humiram nang responsable. Bumuo ng tiwala. Mag-unlock ng mas mataas na limit habang tumatagal.',
      getStartedTitle: 'Magsimula ngayon',
      recommended: 'Inirerekomenda',
      setupBody: 'I-set up ang account mo, makipag-usap sa team namin sa mabilis na call, tapos i-verify ang ID mo para makahiram',
      startSetup: 'Simulan ang setup',
      watchTutorial: 'Panoorin ang tutorial',
      checkFirstTitle: 'Tingnan muna',
      noCommitment: 'Walang obligasyon',
      checkFirstBody: 'I-explore ang mga feature, ikumpara ang mga rate, at alamin kung paano ito gumagana',
      previewItems: ['Tingnan ang mga feature', 'Tingnan ang mga rate', 'Alamin kung paano gumagana'],
      exploreMoodeng: 'I-explore ang Moodeng',
      codeTitle: 'May nag-invite ba sa’yo?',
      codeHint: 'I-type ang code nila para ma-credit sila.',
      codePlaceholder: 'Code nila',
      codeAdd: 'Idagdag',
      codeAdded: 'Naidagdag ang code: {code}',
      codeInvalid: 'Hindi gumana ang code. I-check ang spelling.',
      codeAlready: 'May code na ang account mo{code}.',
      codeSelf: 'Hindi mo puwedeng gamitin ang sarili mong code.',
      codeOld: 'Para lang sa bagong account ang code.',
      codeError: 'Hindi naidagdag. Subukan ulit.'
   },
   id: {
      title: 'Persiapan akun',
      lenderHeadline: 'Beri pinjaman kepada orang sungguhan dan bantu mereka membangun kredit.',
      lenderSubtitle: 'Dapatkan imbal hasil onchain dengan Base.',
      borrowerHeadline: 'Kamu sedang membangun reputasi yang bisa dibawa dompetmu ke mana saja.',
      borrowerSubtitle: 'Pinjam dengan bertanggung jawab. Bangun kepercayaan. Buka limit lebih besar dari waktu ke waktu.',
      getStartedTitle: 'Mulai sekarang',
      recommended: 'Direkomendasikan',
      setupBody: 'Siapkan akun, kenalan dengan tim kami lewat panggilan singkat, lalu verifikasi ID kamu untuk mengakses kredit',
      startSetup: 'Mulai persiapan',
      watchTutorial: 'Tonton tutorial',
      checkFirstTitle: 'Lihat dulu',
      noCommitment: 'Tanpa komitmen',
      checkFirstBody: 'Jelajahi fitur, bandingkan suku bunga, dan lihat cara kerjanya',
      previewItems: ['Lihat fitur', 'Lihat suku bunga', 'Pelajari cara kerjanya'],
      exploreMoodeng: 'Jelajahi Moodeng',
      codeTitle: 'Ada yang mengundangmu?',
      codeHint: 'Ketik kodenya supaya mereka dapat kredit.',
      codePlaceholder: 'Kode mereka',
      codeAdd: 'Tambah',
      codeAdded: 'Kode ditambahkan: {code}',
      codeInvalid: 'Kode tidak berlaku. Cek ejaannya.',
      codeAlready: 'Akunmu sudah punya kode{code}.',
      codeSelf: 'Kamu tidak bisa memakai kodemu sendiri.',
      codeOld: 'Kode hanya untuk akun baru.',
      codeError: 'Gagal menambahkan. Coba lagi.'
   },
   th: {
      title: 'เริ่มต้น',
      lenderHeadline: 'ปล่อยกู้ให้คนจริง และช่วยให้พวกเขาสร้างเครดิต',
      lenderSubtitle: 'รับผลตอบแทนแบบออนเชนบน Base',
      borrowerHeadline: 'คุณกำลังสร้างประวัติความน่าเชื่อถือที่ติดตัวไปกับกระเป๋าเงินได้ทุกที่',
      borrowerSubtitle: 'ยืมอย่างรับผิดชอบ สร้างความน่าเชื่อถือ แล้วปลดล็อกวงเงินที่สูงขึ้นเมื่อเวลาผ่านไป',
      getStartedTitle: 'เริ่มต้นเลย',
      recommended: 'แนะนำ',
      setupBody: 'ตั้งค่าบัญชี คุยกับทีมเราสั้น ๆ ทางวิดีโอคอล แล้วยืนยันตัวตนเพื่อเข้าถึงเครดิต',
      startSetup: 'เริ่มตั้งค่า',
      watchTutorial: 'ดูบทแนะนำ',
      checkFirstTitle: 'ลองดูก่อน',
      noCommitment: 'ไม่มีข้อผูกมัด',
      checkFirstBody: 'สำรวจฟีเจอร์ เปรียบเทียบอัตราดอกเบี้ย และดูว่าทุกอย่างทำงานอย่างไร',
      previewItems: ['ดูฟีเจอร์', 'ดูอัตราดอกเบี้ย', 'เรียนรู้วิธีการทำงาน'],
      exploreMoodeng: 'สำรวจ Moodeng',
      codeTitle: 'มีคนชวนคุณมาไหม?',
      codeHint: 'ใส่โค้ดของเขาเพื่อให้เขาได้เครดิต',
      codePlaceholder: 'โค้ดของเขา',
      codeAdd: 'เพิ่ม',
      codeAdded: 'เพิ่มโค้ดแล้ว: {code}',
      codeInvalid: 'โค้ดใช้ไม่ได้ ตรวจตัวสะกดอีกครั้ง',
      codeAlready: 'บัญชีของคุณมีโค้ดแล้ว{code}',
      codeSelf: 'ใช้โค้ดของตัวเองไม่ได้',
      codeOld: 'โค้ดใช้ได้กับบัญชีใหม่เท่านั้น',
      codeError: 'เพิ่มไม่สำเร็จ ลองอีกครั้ง'
   },
   vi: {
      title: 'Bắt đầu',
      lenderHeadline: 'Cho người thật vay và giúp họ xây dựng tín dụng.',
      lenderSubtitle: 'Kiếm tiền onchain — hoạt động trên Base.',
      borrowerHeadline: 'Bạn đang xây dựng uy tín mà ví của bạn có thể mang đi mọi nơi.',
      borrowerSubtitle: 'Vay có trách nhiệm. Xây dựng niềm tin. Mở khóa thêm theo thời gian.',
      getStartedTitle: 'Bắt đầu ngay',
      recommended: 'Khuyên dùng',
      setupBody: 'Thiết lập tài khoản, gặp đội ngũ của chúng tôi qua một cuộc gọi ngắn, rồi xác minh danh tính để tiếp cận tín dụng',
      startSetup: 'Bắt đầu thiết lập',
      watchTutorial: 'Xem hướng dẫn',
      checkFirstTitle: 'Xem trước',
      noCommitment: 'Không cam kết',
      checkFirstBody: 'Khám phá tính năng, so sánh lãi suất và xem mọi thứ hoạt động ra sao',
      previewItems: ['Xem tính năng', 'Xem lãi suất', 'Tìm hiểu cách hoạt động'],
      exploreMoodeng: 'Khám phá Moodeng',
      codeTitle: 'Có ai mời bạn không?',
      codeHint: 'Nhập mã của họ để họ được ghi nhận.',
      codePlaceholder: 'Mã của họ',
      codeAdd: 'Thêm',
      codeAdded: 'Đã thêm mã: {code}',
      codeInvalid: 'Mã không đúng. Kiểm tra lại chính tả.',
      codeAlready: 'Tài khoản của bạn đã có mã{code}.',
      codeSelf: 'Bạn không thể dùng mã của chính mình.',
      codeOld: 'Mã chỉ dùng cho tài khoản mới.',
      codeError: 'Không thêm được. Thử lại.'
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
      codeTitle: string;
      codeHint: string;
      codePlaceholder: string;
      codeAdd: string;
      codeAdded: string;
      codeInvalid: string;
      codeAlready: string;
      codeSelf: string;
      codeOld: string;
      codeError: string;
   }
>;

type WelcomeCopy = (typeof WELCOME_COPY)['en'];

// "Who invited you?" — friends who signed up without the affiliate's link (typed moodeng.app, switched
// to Chrome) can still credit them here, right after picking Borrower (Mahjid's ask, 2026-11-19).
function InviteCodeBox({ copy }: { copy: WelcomeCopy }) {
   const [code, setCode] = useState('');
   const [busy, setBusy] = useState(false);
   const [added, setAdded] = useState<string | null>(null);
   const [error, setError] = useState('');

   const submit = async (event: FormEvent) => {
      event.preventDefault();
      if (!code.trim() || busy) return;
      setBusy(true);
      setError('');
      const result = await applyInviteCode(code);
      setBusy(false);
      if (result.ok) {
         setAdded(result.code);
         return;
      }
      const messages = { invalid: copy.codeInvalid, self: copy.codeSelf, old_account: copy.codeOld, error: copy.codeError };
      setError(
         result.reason === 'already'
            ? copy.codeAlready.replace('{code}', result.linkedCode ? ` (${result.linkedCode})` : '')
            : messages[result.reason]
      );
   };

   if (added) {
      return (
         <p className="w-full rounded-[12px] border border-md-green-600/40 bg-md-green-600/10 px-md-4 py-md-3 text-md-b2 font-semibold text-md-heading">
            ✅ {copy.codeAdded.replace('{code}', added)}
         </p>
      );
   }

   return (
      <form
         onSubmit={submit}
         className="flex flex-col gap-md-2 w-full rounded-[12px] border border-md-neutral-300 dark:border-white/15 p-md-4"
      >
         <div className="flex flex-col gap-md-0">
            <h3 className="text-md-b1 font-semibold text-md-heading">{copy.codeTitle}</h3>
            <p className="text-md-b2 text-md-neutral-700">{copy.codeHint}</p>
         </div>
         <div className="flex gap-md-2 w-full">
            <input
               value={code}
               onChange={(event) => {
                  setCode(event.target.value.toUpperCase());
                  setError('');
               }}
               placeholder={copy.codePlaceholder}
               autoCapitalize="characters"
               autoComplete="off"
               spellCheck={false}
               maxLength={24}
               aria-label={copy.codeTitle}
               className="flex-1 min-w-0 rounded-md-lg border border-md-neutral-300 dark:border-white/20 bg-white dark:bg-white/5 px-md-3 py-md-2 text-md-b1 font-semibold tracking-wide text-md-heading placeholder:font-normal placeholder:tracking-normal placeholder:text-md-neutral-500 outline-none focus:border-md-primary-1200"
            />
            <button
               type="submit"
               disabled={!code.trim() || busy}
               className="shrink-0 rounded-md-lg border border-md-primary-1200 px-md-4 py-md-2 text-md-b1 font-semibold text-md-primary-1200 disabled:opacity-40"
            >
               {busy ? '…' : copy.codeAdd}
            </button>
         </div>
         {error ? <p className="text-md-b3 font-medium text-md-red-600">{error}</p> : null}
      </form>
   );
}

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
   // Journey v2: no wallet yet — proof of income + the 3 videos come first (the wallet waits for the team's ✅).
   const { data: v2 } = useQuery({
      queryKey: ['journey-v2-welcome', user?.id],
      queryFn: fetchJourneyV2,
      enabled: Boolean(user) && !isPreview,
      staleTime: 15_000
   });
   // Wallet last: no wallet at sign-up either — it's made as the last step of the loan request.
   const { walletLast } = useWalletLast();
   // Pre-screening path (affiliate link): Facebook + the pre-screening first, the wallet after the team's ✅.
   const { data: prescreenPath } = useQuery({
      queryKey: ['prescreen-path-welcome', user?.id],
      queryFn: fetchPrescreenPath,
      enabled: Boolean(user) && !isPreview,
      staleTime: 15_000
   });
   const walletPath = isPreview
      ? '/onboarding/wallet-preview'
      : needsJourneyV2(v2)
        ? JOURNEY_V2_PATH
        : walletLast || hasPrescreenPathFlag() || prescreenPath?.on_path
          ? PRE_KYC_CONNECT_PATH
          : '/onboarding/wallet';
   // Indonesia track: its own onboarding (/id/onboarding) replaces this welcome.
   const idTrack = useIdTrackStatus();
   // Borrowers with no code yet (hasReferral is read at sign-in, so the ✅ stays after they add one here).
   // Not again for someone who answered "Who invited you?" on the first screen: their code is attached
   // a moment after sign-in, after hasReferral was read, so the box would ask a second time.
   const showCodeBox = isPreview || (Boolean(user) && user?.userRole !== 'lender' && !user?.hasReferral && !codeStepDone());
   if (!isPreview && idTrack.isIndo) return <Navigate replace to={ID_PATHS.onboarding} />;

   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f] flex flex-col max-w-[440px] mx-auto w-full">
         <OnboardingHeader title={copy.title} />

         <div className="flex flex-col gap-md-4 p-md-4">
            {/* The language chips sit in the open space beside the hippo, so "Get started" fits on the
                first screen without scrolling. */}
            <div className="flex items-start gap-md-3 w-full">
               <img src="/hippos/welcome.png" alt="Moodeng hippo" className="w-[96px] h-[84px] object-cover shrink-0" />
               <OnboardingLanguagePicker compact />
            </div>

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

            {showCodeBox ? <InviteCodeBox copy={copy} /> : null}

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
                        <span className="inline-flex items-center justify-center px-md-1 py-md-0 rounded-md-sm bg-md-primary-300 dark:bg-md-primary-1500 text-md-b3 font-semibold text-md-primary-1200 dark:text-[#f1e9fd]">
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
                     <p className="text-md-b1 text-md-blue-800 dark:text-md-blue-200">{copy.checkFirstBody}</p>
                     <ul className="flex flex-col gap-md-0 pt-md-1">
                        {copy.previewItems.map((item) => (
                           <li
                              key={item}
                              className="flex gap-md-1 items-center text-md-b2 font-semibold text-md-blue-1000 dark:text-md-blue-200"
                           >
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
