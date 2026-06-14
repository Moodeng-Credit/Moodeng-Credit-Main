import { useEffect, useRef, useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useNavigate } from 'react-router-dom';

import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { TOAST_TYPES } from '@/components/ToastSystem/types';

import { useLocalization } from '@/i18n/LocalizationProvider';
import type { LocaleCode } from '@/i18n/translations';
import { updateUserRole } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { UserRole } from '@/types/authTypes';
import { hasPendingFundIntent } from '@/views/lender/loanNote/fundingPopup';

const ROLE_SELECTION_COPY = {
   en: {
      errorTitle: 'Something went wrong',
      errorBody: 'Failed to save your role. Please try again.',
      title: 'How would you like to use Moodeng Credit?',
      subtitle: 'Request short-term loans, repay clearly, and build trust over time.',
      borrowerTitle: 'I am a Borrower',
      borrowerBody: 'Request USDC loans and build trust through on-time repayment.',
      lenderTitle: 'I am a Lender',
      lenderBody: 'Fund loan requests and earn returns by supporting trusted borrowers.',
      confirming: 'Confirming...',
      confirm: 'Confirm',
      footerLinks: ['Privacy', 'Terms', 'Docs'],
      copyright: '© 2026 Moodeng Credit All Rights Reserved'
   },
   fil: {
      errorTitle: 'May nangyaring mali',
      errorBody: 'Hindi na-save ang role mo. Subukan ulit.',
      title: 'Paano mo gustong gamitin ang Moodeng Credit?',
      subtitle: 'Humiling ng panandaliang pautang, magbayad nang malinaw, at bumuo ng tiwala habang tumatagal.',
      borrowerTitle: 'Humihiram ako',
      borrowerBody: 'Humiling ng USDC loan at bumuo ng tiwala sa pamamagitan ng pagbabayad sa tamang oras.',
      lenderTitle: 'Nagpapahiram ako',
      lenderBody: 'Pondohan ang mga loan request at kumita habang sumusuporta sa mapagkakatiwalaang humihiram.',
      confirming: 'Kinukumpirma...',
      confirm: 'Kumpirmahin',
      footerLinks: ['Pribasiya', 'Mga Tuntunin', 'Dokumento'],
      copyright: '© 2026 Moodeng Credit. Nakareserba ang lahat ng karapatan'
   },
   id: {
      errorTitle: 'Ada yang salah',
      errorBody: 'Role kamu gagal disimpan. Coba lagi.',
      title: 'Bagaimana kamu ingin menggunakan Moodeng Credit?',
      subtitle: 'Ajukan pinjaman jangka pendek, bayar dengan jelas, dan bangun kepercayaan dari waktu ke waktu.',
      borrowerTitle: 'Saya peminjam',
      borrowerBody: 'Ajukan pinjaman USDC dan bangun kepercayaan lewat pembayaran tepat waktu.',
      lenderTitle: 'Saya pemberi pinjaman',
      lenderBody: 'Danai permintaan pinjaman dan dapatkan imbal hasil sambil mendukung peminjam tepercaya.',
      confirming: 'Mengonfirmasi...',
      confirm: 'Konfirmasi',
      footerLinks: ['Privasi', 'Ketentuan', 'Dokumen'],
      copyright: '© 2026 Moodeng Credit. Semua hak dilindungi'
   },
   th: {
      errorTitle: 'มีบางอย่างผิดพลาด',
      errorBody: 'บันทึกบทบาทไม่สำเร็จ โปรดลองอีกครั้ง',
      title: 'คุณต้องการใช้ Moodeng Credit อย่างไร?',
      subtitle: 'ขอเงินกู้ระยะสั้น ชำระคืนอย่างชัดเจน และสร้างความน่าเชื่อถือเมื่อเวลาผ่านไป',
      borrowerTitle: 'ฉันเป็นผู้ยืม',
      borrowerBody: 'ขอเงินกู้ USDC และสร้างความน่าเชื่อถือผ่านการชำระคืนตรงเวลา',
      lenderTitle: 'ฉันเป็นผู้ให้กู้',
      lenderBody: 'ให้ทุนคำขอเงินกู้และรับผลตอบแทนด้วยการสนับสนุนผู้ยืมที่น่าเชื่อถือ',
      confirming: 'กำลังยืนยัน...',
      confirm: 'ยืนยัน',
      footerLinks: ['ความเป็นส่วนตัว', 'ข้อกำหนด', 'เอกสาร'],
      copyright: '© 2026 Moodeng Credit. สงวนลิขสิทธิ์'
   },
   vi: {
      errorTitle: 'Có lỗi xảy ra',
      errorBody: 'Không thể lưu vai trò của bạn. Vui lòng thử lại.',
      title: 'Bạn muốn dùng Moodeng Credit như thế nào?',
      subtitle: 'Yêu cầu khoản vay ngắn hạn, trả rõ ràng và xây dựng niềm tin theo thời gian.',
      borrowerTitle: 'Tôi là người vay',
      borrowerBody: 'Yêu cầu khoản vay USDC và xây dựng niềm tin qua trả đúng hạn.',
      lenderTitle: 'Tôi là người cho vay',
      lenderBody: 'Cấp vốn cho yêu cầu vay và kiếm lợi suất bằng cách hỗ trợ người vay đáng tin cậy.',
      confirming: 'Đang xác nhận...',
      confirm: 'Xác nhận',
      footerLinks: ['Quyền riêng tư', 'Điều khoản', 'Tài liệu'],
      copyright: '© 2026 Moodeng Credit. Bảo lưu mọi quyền'
   }
} satisfies Record<
   LocaleCode,
   {
      errorTitle: string;
      errorBody: string;
      title: string;
      subtitle: string;
      borrowerTitle: string;
      borrowerBody: string;
      lenderTitle: string;
      lenderBody: string;
      confirming: string;
      confirm: string;
      footerLinks: string[];
      copyright: string;
   }
>;

export default function RoleSelectionPage() {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const user = useSelector((state: RootState) => state.auth.user);
   const { showToast } = useToast();
   const { locale } = useLocalization();
   const copy = ROLE_SELECTION_COPY[locale] ?? ROLE_SELECTION_COPY.en;
   const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
   const [isSubmitting, setIsSubmitting] = useState(false);

   // Link arrivals (came from a "fund this loan" link) are lenders by intent — skip the
   // role question, auto-assign lender, and send them straight into wallet onboarding.
   const autoLenderRef = useRef(false);
   useEffect(() => {
      if (autoLenderRef.current) return;
      if (user?.id && !user.userRole && hasPendingFundIntent()) {
         autoLenderRef.current = true;
         dispatch(updateUserRole('lender'))
            .unwrap()
            .then(() => navigate('/onboarding/wallet', { replace: true }))
            .catch(() => {
               autoLenderRef.current = false; // fall back to manual selection
            });
      }
   }, [user?.id, user?.userRole, dispatch, navigate]);

   if (user?.userRole) {
      return <Navigate to={user.userRole === 'lender' ? '/lender/dashboard' : '/dashboard'} replace />;
   }

   const handleConfirm = async () => {
      if (!selectedRole || isSubmitting) return;
      setIsSubmitting(true);
      try {
         await dispatch(updateUserRole(selectedRole)).unwrap();
         const next = selectedRole === 'borrower' ? '/onboarding/welcome' : '/onboarding/wallet';
         navigate(next, { replace: true });
      } catch (err) {
         console.error('[RoleSelection] updateUserRole failed:', err);
         showToast(TOAST_TYPES.ERROR, copy.errorTitle, copy.errorBody);
      } finally {
         setIsSubmitting(false);
      }
   };

   return (
      <div className="min-h-screen bg-white dark:bg-[#100d17] flex flex-col max-w-[440px] mx-auto px-5">
         <div className="flex flex-col flex-1 justify-between py-4">
            <div className="flex flex-col gap-5">
               <img src="/hippos/role-selection.png" alt="Moodeng hippo" className="w-[228px] h-[200px] object-cover" />

               <div className="flex flex-col gap-1">
                  <h1 className="text-[34px] font-semibold leading-[1.2] tracking-[-0.04em] text-md-heading dark:text-white">{copy.title}</h1>
                  <p className="text-md-b1 text-md-neutral-700 dark:text-md-neutral-500 tracking-[-0.02em]">{copy.subtitle}</p>
               </div>

               <button
                  type="button"
                  onClick={() => setSelectedRole('borrower')}
                  className={[
                     'flex flex-col gap-3 items-start p-4 rounded-[12px] border w-full text-left transition-colors',
                     selectedRole === 'borrower'
                        ? 'bg-md-primary-900/10 border-md-primary-900'
                        : 'bg-md-neutral-100 dark:bg-white/5 border-md-neutral-600 dark:border-white/10'
                  ].join(' ')}
               >
                  <span className="text-md-h5 font-semibold tracking-[-0.04em] text-md-heading dark:text-white">{copy.borrowerTitle}</span>
                  <span className="text-md-b2 text-[#45556c] dark:text-md-neutral-500 tracking-[-0.02em] leading-[21px]">{copy.borrowerBody}</span>
               </button>

               <button
                  type="button"
                  onClick={() => setSelectedRole('lender')}
                  className={[
                     'flex flex-col gap-3 items-start p-4 rounded-[12px] border w-full text-left transition-colors',
                     selectedRole === 'lender'
                        ? 'bg-md-primary-900/10 border-md-primary-900'
                        : 'bg-md-neutral-100 dark:bg-white/5 border-md-neutral-600 dark:border-white/10'
                  ].join(' ')}
               >
                  <span className="text-md-h5 font-semibold tracking-[-0.04em] text-md-heading dark:text-white">{copy.lenderTitle}</span>
                  <span className="text-md-b2 text-[#45556c] dark:text-md-neutral-500 tracking-[-0.02em] leading-[21px]">{copy.lenderBody}</span>
               </button>

               <button
                  type="button"
                  disabled={!selectedRole || isSubmitting}
                  onClick={handleConfirm}
                  className="flex items-center justify-center gap-2 w-full py-4 px-5 rounded-md-lg font-semibold text-md-b1 text-md-neutral-100 tracking-[-0.02em] bg-md-primary-1200 disabled:opacity-50 transition-opacity"
               >
                  {isSubmitting ? copy.confirming : copy.confirm}
               </button>
            </div>

            <div className="flex flex-col gap-4 items-center py-4">
               <div className="w-full border-t border-md-neutral-500 dark:border-white/10" />
               <div className="flex gap-5 text-md-b2 text-md-neutral-1500 dark:text-md-neutral-800 tracking-[-0.02em]">
                  {copy.footerLinks.map((link) => (
                     <span key={link}>{link}</span>
                  ))}
               </div>
               <p className="text-[12px] text-md-neutral-1500 dark:text-md-neutral-800 tracking-[-0.02em] leading-[18px]">{copy.copyright}</p>
            </div>
         </div>
      </div>
   );
}
