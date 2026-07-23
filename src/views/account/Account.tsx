import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import IouPointHistoryModal from '@/components/IouPointHistoryModal';
import UserAvatar from '@/components/UserAvatar';
import WalletActivity from '@/views/account/WalletActivity';
import WalletBalanceCard from '@/views/account/WalletBalanceCard';

import { type LocaleCode, useLocalization } from '@/i18n';
import { isUserVerified } from '@/lib/isUserVerified';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { formatPointsMajor } from '@/shared/points';
import { logoutUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { getAccountFaqsForLocale } from '@/views/account/data/accountFaqs';

// TODO: Replace with YouTube video URL when available
const CREDIT_GUIDE_URL = '/credit-leveling-guide';

const ICON_MASK_BASE: React.CSSProperties = {
   WebkitMaskSize: 'contain',
   maskSize: 'contain',
   WebkitMaskRepeat: 'no-repeat',
   maskRepeat: 'no-repeat',
   WebkitMaskPosition: 'center',
   maskPosition: 'center'
};

const ACCOUNT_ITEMS = [
   { id: 'settings', path: '/account/settings' },
   { id: 'loanHistory', path: '/history' }
] as const;

const TELEGRAM_SUPPORT_URL =
   'https://t.me/jimmymoodengcredit?text=Hi%2C%20I%20found%20you%20through%20Moodeng%20Credit%20and%20I%27d%20like%20to%20learn%20more.';

const FACEBOOK_PAGE_URL = 'https://www.facebook.com/profile.php?id=61589106561061';
const FACEBOOK_GROUP_URL = 'https://www.facebook.com/groups/1593629908540434';

const CONTACT_ITEMS = [
   { id: 'community', url: FACEBOOK_GROUP_URL },
   { id: 'help', url: FACEBOOK_PAGE_URL },
   { id: 'contact', url: TELEGRAM_SUPPORT_URL }
] as const;

type AccountItemId = (typeof ACCOUNT_ITEMS)[number]['id'];
type ContactItemId = (typeof CONTACT_ITEMS)[number]['id'];

const ACCOUNT_COPY: Record<
   LocaleCode,
   {
      accountInformation: string;
      accountItems: Record<AccountItemId, string>;
      contactItems: Record<ContactItemId, string>;
      getInTouch: string;
      commonQuestions: string;
      viewMore: string;
      creditGuide: string;
      verified: string;
      notVerified: string;
      connectWallet: string;
      addBaseWallet: string;
      signOut: string;
      signOutTitle: string;
      signOutBody: string;
      signingOut: string;
      cancel: string;
      settingsAria: string;
      helpLabel: string;
   }
> = {
   en: {
      accountInformation: 'Account Information',
      accountItems: {
         settings: 'Account Settings',
         loanHistory: 'View Loan Transaction History'
      },
      contactItems: {
         community: 'Join Our Community',
         help: 'Get Help',
         contact: 'Contact Us'
      },
      getInTouch: 'Get in Touch',
      commonQuestions: 'Common questions',
      viewMore: 'View More',
      creditGuide: 'Watch our Credit Levelling Guide',
      verified: 'Verified',
      notVerified: 'Not Verified',
      connectWallet: 'Connect Wallet',
      addBaseWallet: 'Set up wallet',
      signOut: 'Sign Out',
      signOutTitle: 'Sign out?',
      signOutBody: 'You can sign back in anytime. Your Trust Score stays with your wallet.',
      signingOut: 'Signing Out...',
      cancel: 'Cancel',
      settingsAria: 'Go to Account Settings',
      helpLabel: 'Help'
   },
   fil: {
      accountInformation: 'Impormasyon ng account',
      accountItems: {
         settings: 'Mga setting ng account',
         loanHistory: 'Tingnan ang kasaysayan ng loan transactions'
      },
      contactItems: {
         community: 'Sumali sa community',
         help: 'Humingi ng tulong',
         contact: 'Kontakin kami'
      },
      getInTouch: 'Makipag-ugnayan',
      commonQuestions: 'Mga karaniwang tanong',
      viewMore: 'Tingnan pa',
      creditGuide: 'Panoorin ang gabay sa pagpapataas ng antas ng kredito',
      verified: 'Beripikado',
      notVerified: 'Hindi beripikado',
      connectWallet: 'Ikonek ang wallet',
      addBaseWallet: 'I-set up ang wallet',
      signOut: 'Mag-sign out',
      signOutTitle: 'Mag-sign out?',
      signOutBody: 'Puwede kang mag-sign in ulit anumang oras. Mananatili sa wallet mo ang Trust Score mo.',
      signingOut: 'Nag-sign out...',
      cancel: 'Kanselahin',
      settingsAria: 'Pumunta sa Account Settings',
      helpLabel: 'Tulong'
   },
   id: {
      accountInformation: 'Informasi akun',
      accountItems: {
         settings: 'Pengaturan akun',
         loanHistory: 'Lihat riwayat transaksi pinjaman'
      },
      contactItems: {
         community: 'Bergabung dengan komunitas',
         help: 'Dapatkan bantuan',
         contact: 'Hubungi kami'
      },
      getInTouch: 'Hubungi kami',
      commonQuestions: 'Pertanyaan umum',
      viewMore: 'Lihat lainnya',
      creditGuide: 'Tonton panduan peningkatan level kredit',
      verified: 'Terverifikasi',
      notVerified: 'Belum terverifikasi',
      connectWallet: 'Hubungkan wallet',
      addBaseWallet: 'Siapkan dompet',
      signOut: 'Keluar',
      signOutTitle: 'Keluar?',
      signOutBody: 'Kamu bisa masuk lagi kapan saja. Trust Score tetap bersama wallet kamu.',
      signingOut: 'Keluar...',
      cancel: 'Batal',
      settingsAria: 'Buka Pengaturan Akun',
      helpLabel: 'Bantuan'
   },
   th: {
      accountInformation: 'ข้อมูลบัญชี',
      accountItems: {
         settings: 'การตั้งค่าบัญชี',
         loanHistory: 'ดูประวัติธุรกรรมเงินกู้'
      },
      contactItems: {
         community: 'เข้าร่วมชุมชน',
         help: 'ขอความช่วยเหลือ',
         contact: 'ติดต่อเรา'
      },
      getInTouch: 'ติดต่อเรา',
      commonQuestions: 'คำถามที่พบบ่อย',
      viewMore: 'ดูเพิ่มเติม',
      creditGuide: 'ดูคู่มือการเพิ่มระดับเครดิต',
      verified: 'ยืนยันแล้ว',
      notVerified: 'ยังไม่ได้ยืนยัน',
      connectWallet: 'เชื่อมต่อกระเป๋าเงิน',
      addBaseWallet: 'ตั้งค่ากระเป๋าเงิน',
      signOut: 'ออกจากระบบ',
      signOutTitle: 'ออกจากระบบ?',
      signOutBody: 'คุณสามารถเข้าสู่ระบบใหม่ได้ทุกเมื่อ Trust Score จะยังอยู่กับกระเป๋าเงินของคุณ',
      signingOut: 'กำลังออกจากระบบ...',
      cancel: 'ยกเลิก',
      settingsAria: 'ไปที่การตั้งค่าบัญชี',
      helpLabel: 'ช่วยเหลือ'
   },
   vi: {
      accountInformation: 'Thông tin tài khoản',
      accountItems: {
         settings: 'Cài đặt tài khoản',
         loanHistory: 'Xem lịch sử giao dịch khoản vay'
      },
      contactItems: {
         community: 'Tham gia cộng đồng',
         help: 'Nhận trợ giúp',
         contact: 'Liên hệ chúng tôi'
      },
      getInTouch: 'Liên hệ',
      commonQuestions: 'Câu hỏi thường gặp',
      viewMore: 'Xem thêm',
      creditGuide: 'Xem hướng dẫn nâng hạng tín dụng',
      verified: 'Đã xác minh',
      notVerified: 'Chưa xác minh',
      connectWallet: 'Kết nối ví',
      addBaseWallet: 'Thiết lập ví',
      signOut: 'Đăng xuất',
      signOutTitle: 'Đăng xuất?',
      signOutBody: 'Bạn có thể đăng nhập lại bất cứ lúc nào. Trust Score vẫn đi cùng ví của bạn.',
      signingOut: 'Đang đăng xuất...',
      cancel: 'Hủy',
      settingsAria: 'Đi tới Cài đặt tài khoản',
      helpLabel: 'Trợ giúp'
   }
};

function ChevronRight() {
   return (
      <div
         className="w-6 h-6 shrink-0 bg-md-primary-900"
         style={{
            ...ICON_MASK_BASE,
            WebkitMaskImage: "url('/icons/chevron-right.svg')",
            maskImage: "url('/icons/chevron-right.svg')"
         }}
      />
   );
}

function PlayIcon() {
   return (
      <div
         className="w-6 h-6 shrink-0 bg-md-primary-900"
         style={{
            ...ICON_MASK_BASE,
            WebkitMaskImage: "url('/icons/play.svg')",
            maskImage: "url('/icons/play.svg')"
         }}
      />
   );
}

function ExternalLinkIcon() {
   return (
      <div
         className="w-6 h-6 shrink-0 bg-md-primary-900"
         style={{
            ...ICON_MASK_BASE,
            WebkitMaskImage: "url('/icons/view_link.svg')",
            maskImage: "url('/icons/view_link.svg')"
         }}
      />
   );
}

function ChevronDown({ isOpen }: { isOpen: boolean }) {
   return (
      <div
         className="w-6 h-6 shrink-0 bg-md-primary-900 transition-transform duration-200"
         style={{
            ...ICON_MASK_BASE,
            WebkitMaskImage: "url('/icons/chevron-down.svg')",
            maskImage: "url('/icons/chevron-down.svg')",
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
         }}
      />
   );
}

export default function Account() {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const { locale } = useLocalization();
   const user = useSelector((state: RootState) => state.auth.user);
   const [showSignOutModal, setShowSignOutModal] = useState(false);
   const [isSigningOut, setIsSigningOut] = useState(false);
   const [openFaqId, setOpenFaqId] = useState<string | null>(null);
   const [showIouHistory, setShowIouHistory] = useState(false);

   const displayName = user?.displayName || user?.username || 'User';
   const hasWallet = Boolean(user?.walletAddress);
   const isLender = user?.userRole === 'lender';
   const isVerified = isUserVerified(user);
   const copy = ACCOUNT_COPY[locale];
   const walletSetupLabel = isLender ? copy.connectWallet : copy.addBaseWallet;
   const { data: userPointsData } = useQuery({
      queryKey: ['account-user-points', user?.id],
      queryFn: async () => {
         const supabase = getSupabaseBrowserClient();
         const { data, error } = await supabase.from('user_points').select('points_total').eq('user_id', user!.id).maybeSingle();
         if (error) throw error;
         return data;
      },
      enabled: isLender && Boolean(user?.id)
   });
   const iouPoints = formatPointsMajor(userPointsData?.points_total ?? 0);

   const faqs = getAccountFaqsForLocale(locale, isLender);

   const handleSignOut = async () => {
      setIsSigningOut(true);
      await dispatch(logoutUser());
      navigate('/sign-in', { replace: true });
   };

   const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28 flex flex-col">
            {/* User header */}
            <div className="flex items-center justify-between gap-3 px-md-5 py-md-3">
               <div className="flex min-w-0 flex-1 gap-4 items-center">
                  <button
                     type="button"
                     onClick={() => navigate('/account/settings')}
                     className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2"
                     aria-label={copy.settingsAria}
                  >
                     <UserAvatar size={48} />
                  </button>
                  <div className="flex min-w-0 flex-col gap-1">
                     <p className="max-w-full break-words text-md-h6 font-semibold leading-tight text-md-heading [overflow-wrap:anywhere]">
                        {displayName}
                     </p>
                     {isLender ? (
                        <button
                           type="button"
                           onClick={() => setShowIouHistory(true)}
                           className="bg-md-primary-900 rounded-md-sm px-2 py-1 self-start hover:opacity-90 transition-opacity"
                           title="View IOU point history"
                        >
                           <p className="text-md-b3 font-semibold text-md-neutral-100 capitalize">IOU {isVerified ? iouPoints : '0'}</p>
                        </button>
                     ) : isVerified ? (
                        <span className="inline-flex w-fit items-center gap-1 rounded-md-sm bg-md-green-100 px-md-1 py-md-0">
                           <span className="flex h-3 w-3 items-center justify-center rounded-full bg-md-green-900">
                              <span className="text-[8px] font-bold text-white">&#10003;</span>
                           </span>
                           <span className="text-md-b3 font-semibold text-md-green-900">{copy.verified}</span>
                        </span>
                     ) : (
                        <span className="inline-flex w-fit items-center gap-1 rounded-md-sm bg-md-red-100 px-md-1 py-md-0">
                           <span className="flex h-3 w-3 items-center justify-center rounded-full bg-md-red-800">
                              <span className="text-[8px] font-bold text-white">!</span>
                           </span>
                           <span className="text-md-b3 font-semibold text-md-red-800">{copy.notVerified}</span>
                        </span>
                     )}
                  </div>
               </div>

               <div className="flex shrink-0 items-center gap-2">
                  {!hasWallet ? (
                     <button
                        type="button"
                        onClick={() => navigate('/onboarding/wallet')}
                        className="flex items-center gap-2.5 border border-md-blue-400 rounded-md-pill px-4 py-3 bg-white shrink-0"
                     >
                        <div
                           className="w-5 h-5 shrink-0 bg-md-blue-400"
                           style={{
                              ...ICON_MASK_BASE,
                              WebkitMaskImage: "url('/icons/wallet.png')",
                              maskImage: "url('/icons/wallet.png')"
                           }}
                        />
                        <span className="text-md-b2 font-semibold text-md-blue-400">{walletSetupLabel}</span>
                     </button>
                  ) : null}
                  {/* Help lives here now, not on the nav bar. */}
                  <button
                     type="button"
                     onClick={() => navigate('/help')}
                     className="flex items-center gap-2 border border-md-neutral-500 rounded-md-pill px-3.5 py-3 bg-white shrink-0"
                  >
                     <div
                        className="w-5 h-5 shrink-0 bg-md-neutral-1200"
                        style={{
                           ...ICON_MASK_BASE,
                           WebkitMaskImage: "url('/icons/question_light.svg')",
                           maskImage: "url('/icons/question_light.svg')"
                        }}
                     />
                     <span className="text-md-b2 font-semibold text-md-neutral-1200">{copy.helpLabel}</span>
                  </button>
               </div>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-5 px-md-4">
               {/* Wallet home — the borrower's "money" view (balance + cash out). Renders only
                   when the instant wallet is on (the card self-gates); Base Account borrowers
                   and lenders keep their own wallet flows. */}
               {!isLender && hasWallet ? (
                  <>
                     <WalletBalanceCard />
                     <WalletActivity />
                  </>
               ) : null}

               {/* Account Information */}
               <div className="flex flex-col gap-3">
                  <p className="text-md-b2 font-medium text-md-neutral-700">{copy.accountInformation}</p>
                  {ACCOUNT_ITEMS.map((item) => (
                     <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(item.path)}
                        className="flex items-center justify-between px-md-5 py-md-3 border border-md-neutral-400 rounded-md-md w-full text-left"
                     >
                        <span className="text-md-b1 font-medium text-md-neutral-1900 tracking-[-0.02em]">{copy.accountItems[item.id]}</span>
                        <ChevronRight />
                     </button>
                  ))}
                  <a
                     href="#account-get-in-touch"
                     className="flex items-center justify-between px-md-5 py-md-3 border border-md-neutral-400 rounded-md-md w-full text-left"
                  >
                     <span className="text-md-b1 font-medium text-md-neutral-1900 tracking-[-0.02em]">{copy.getInTouch}</span>
                     <ChevronRight />
                  </a>
               </div>

               {/* Common questions */}
               <div id="account-common-questions" className="scroll-mt-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                     <p className="text-md-b2 font-medium text-md-neutral-700">{copy.commonQuestions}</p>
                     <button
                        type="button"
                        onClick={() => navigate('/support')}
                        className="rounded-md-sm px-2 py-1 text-md-b2 font-medium text-md-primary-900 transition-all duration-150 hover:bg-md-primary-100 active:scale-[0.96] active:bg-md-primary-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-1200"
                     >
                        {copy.viewMore}
                     </button>
                  </div>

                  {/* Video guide link */}
                  {!isLender ? (
                     <button
                        type="button"
                        onClick={() => navigate(CREDIT_GUIDE_URL)}
                        className="flex items-center justify-between px-md-5 py-md-3 border border-md-neutral-400 rounded-md-md w-full text-left"
                     >
                        <span className="text-md-b1 font-medium text-md-neutral-1900 tracking-[-0.02em]">
                           {copy.creditGuide}
                        </span>
                        <PlayIcon />
                     </button>
                  ) : null}

                  {/* FAQ accordion */}
                  {faqs.map((item) => {
                     const isOpen = openFaqId === item.id;
                     return (
                        <div key={item.id} className="border border-md-neutral-400 rounded-md-md w-full overflow-hidden">
                           <button
                              type="button"
                              onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                              aria-expanded={isOpen}
                              className="flex items-center justify-between gap-md-2 px-md-5 py-md-3 w-full text-left"
                           >
                              <span className="text-md-b1 font-medium text-md-neutral-1900 tracking-[-0.02em] flex-1">{item.question}</span>
                              <ChevronDown isOpen={isOpen} />
                           </button>
                           {isOpen ? (
                              <div className="px-md-5 pb-md-3 text-md-b2 text-md-neutral-1200 whitespace-pre-line">
                                 {item.answer}
                                 {item.readMorePath ? (
                                    <button
                                       type="button"
                                       onClick={() => navigate(item.readMorePath!)}
                                       className="mt-md-2 block text-md-b2 font-semibold text-md-primary-1200 underline underline-offset-2"
                                    >
                                       {item.readMoreLabel ?? 'Read the full guide'}
                                    </button>
                                 ) : null}
                              </div>
                           ) : null}
                        </div>
                     );
                  })}
               </div>

               {/* Get in touch */}
               <div id="account-get-in-touch" className="scroll-mt-4 flex flex-col gap-3">
                  <p className="text-md-b2 font-medium text-md-neutral-700">{copy.getInTouch}</p>
                  {CONTACT_ITEMS.map((item) => (
                     <button
                        key={item.id}
                        type="button"
                        onClick={() => openExternal(item.url)}
                        className="flex items-center justify-between px-md-5 py-md-3 border border-md-neutral-400 rounded-md-md w-full text-left"
                     >
                        <span className="text-md-b1 font-medium text-md-neutral-1900 tracking-[-0.02em]">{copy.contactItems[item.id]}</span>
                        <ExternalLinkIcon />
                     </button>
                  ))}
               </div>

               {/* Sign Out */}
               <button
                  type="button"
                  onClick={() => setShowSignOutModal(true)}
                  className="flex items-center justify-center gap-2.5 px-md-5 py-md-3 border border-md-red-300 rounded-md-md w-full"
               >
                  <span className="text-md-h5 font-semibold text-md-red-300">{copy.signOut}</span>
                  <div
                     className="w-6 h-6 shrink-0 bg-md-red-300"
                     style={{
                        ...ICON_MASK_BASE,
                        WebkitMaskImage: "url('/icons/sign-out.svg')",
                        maskImage: "url('/icons/sign-out.svg')"
                     }}
                  />
               </button>
            </div>
         </div>

         {/* Sign Out Modal */}
         {showSignOutModal ? (
            <div
               className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-5"
               onClick={() => setShowSignOutModal(false)}
            >
               <div
                  className="bg-white rounded-md-lg p-md-4 w-full max-w-modal flex flex-col gap-md-3 items-center"
                  onClick={(e) => e.stopPropagation()}
               >
                  <div className="flex flex-col gap-md-1 items-center text-center">
                     <h2 className="text-md-h4 font-semibold text-md-heading">{copy.signOutTitle}</h2>
                     <p className="text-md-b1 text-md-neutral-1200">{copy.signOutBody}</p>
                  </div>
                  <button
                     type="button"
                     disabled={isSigningOut}
                     onClick={handleSignOut}
                     className="w-full py-md-3 px-md-4 bg-md-red-500 rounded-md-lg text-md-b1 font-semibold text-md-neutral-100 disabled:opacity-50"
                  >
                     {isSigningOut ? copy.signingOut : copy.signOut}
                  </button>
                  <button
                     type="button"
                     onClick={() => setShowSignOutModal(false)}
                     className="w-full py-md-3 px-md-4 border border-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-primary-1200"
                  >
                     {copy.cancel}
                  </button>
               </div>
            </div>
         ) : null}

         <IouPointHistoryModal userId={user?.id} isOpen={showIouHistory} onClose={() => setShowIouHistory(false)} />
      </div>
   );
}
