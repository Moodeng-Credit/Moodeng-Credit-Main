import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';

import { AuthFooter } from '@/components/auth/AuthFooter';
import { TOAST_TYPES } from '@/components/ToastSystem/types';
import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { updateUserRole } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { UserRole } from '@/types/authTypes';

const ROLE_COPY: Record<
   UserRole,
   {
      title: string;
      description: string;
   }
> = {
   borrower: {
      title: 'I am a Borrower',
      description: 'Request USDC loans and build trust through on-time repayment.'
   },
   lender: {
      title: 'I am a Lender',
      description: 'Fund loan requests and earn returns by supporting trusted borrowers.'
   }
};

export default function RoleSelectPage(): JSX.Element {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((s: RootState) => s.auth?.user);
   const { showToast } = useToast();
   const [selected, setSelected] = useState<UserRole>('borrower');
   const [submitting, setSubmitting] = useState(false);

   useEffect(() => {
      if (user?.userRole) {
         navigate('/dashboard', { replace: true });
      }
   }, [user?.userRole, navigate]);

   const handleConfirm = async () => {
      setSubmitting(true);
      const resultAction = await dispatch(updateUserRole(selected));
      setSubmitting(false);
      if (updateUserRole.rejected.match(resultAction)) {
         const msg =
            (typeof resultAction.payload === 'string' ? resultAction.payload : null) ||
            resultAction.error.message ||
            'Could not save your role.';
         showToast(TOAST_TYPES.ERROR, 'Something went wrong', msg);
         return;
      }
      navigate('/onboarding/welcome', { replace: true });
   };

   return (
      <div className="relative isolate flex min-h-dvh flex-col bg-white font-sans antialiased">
         <Link
            to="/faq"
            className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[#8336F0] text-[#8336F0] hover:bg-[rgba(105,17,229,0.08)]"
            aria-label="Help"
         >
            <HelpCircle className="h-5 w-5" strokeWidth={2} />
         </Link>

         <div className="flex flex-1 flex-col items-center">
            <div className="flex w-full max-w-[440px] flex-1 flex-col justify-between px-5 py-4 sm:px-6">
               <div className="flex flex-col gap-5 pt-10 sm:pt-12">
                  <div className="flex w-full justify-center">
                     <img
                        src="/onboarding-image.png"
                        alt=""
                        className="h-[200px] w-[228px] max-w-full shrink-0 object-contain"
                     />
                  </div>

                  <div className="flex flex-col gap-1">
                     <h1 className="text-[34px] font-[590] leading-[1.2] tracking-[-0.04em] text-[#040033]">
                        How would you like to use Moodeng Credit?
                     </h1>
                     <p className="text-base font-[510] leading-6 tracking-[-0.02em] text-[#6D6D6D]">
                        Request short-term loans, repay clearly, and build trust over time.
                     </p>
                  </div>

                  <div className="flex flex-col gap-5">
                     {(['borrower', 'lender'] as const).map((role) => {
                        const isSelected = selected === role;
                        const copy = ROLE_COPY[role];
                        return (
                           <button
                              key={role}
                              type="button"
                              onClick={() => setSelected(role)}
                              className={`flex flex-col items-stretch gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6010D2] ${
                                 isSelected
                                    ? 'border-[#8336F0] bg-[rgba(105,17,229,0.1)]'
                                    : 'border-[#B5ACBE] bg-[#FDFCFD] hover:border-[#9B92A8]'
                              }`}
                           >
                              <p className="text-lg font-[590] leading-[1.2] tracking-[-0.04em] text-[#040033]">
                                 {copy.title}
                              </p>
                              <p className="text-sm font-[510] leading-[21px] tracking-[-0.02em] text-[#45556C]">
                                 {copy.description}
                              </p>
                           </button>
                        );
                     })}
                  </div>

                  <button
                     type="button"
                     disabled={submitting}
                     onClick={handleConfirm}
                     className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#6010D2] px-5 text-base font-[590] leading-6 tracking-[-0.02em] text-[#FDFCFD] transition-opacity hover:opacity-95 disabled:opacity-60"
                  >
                     {submitting ? 'Saving…' : 'Confirm'}
                  </button>
               </div>

               <div className="shrink-0 pb-4 pt-10">
                  <AuthFooter />
               </div>
            </div>
         </div>
      </div>
   );
}
