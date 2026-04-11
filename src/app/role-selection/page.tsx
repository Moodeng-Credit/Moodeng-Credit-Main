import { useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useNavigate } from 'react-router-dom';

import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { TOAST_TYPES } from '@/components/ToastSystem/types';
import { updateUserRole } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { UserRole } from '@/types/authTypes';

export default function RoleSelectionPage() {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const user = useSelector((state: RootState) => state.auth.user);
   const { showToast } = useToast();
   const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
   const [isSubmitting, setIsSubmitting] = useState(false);

   if (user?.userRole) {
      return <Navigate to="/dashboard" replace />;
   }

   const handleConfirm = async () => {
      if (!selectedRole || isSubmitting) return;
      setIsSubmitting(true);
      try {
         await dispatch(updateUserRole(selectedRole)).unwrap();
         navigate('/dashboard', { replace: true });
      } catch {
         showToast(TOAST_TYPES.ERROR, 'Something went wrong', 'Failed to save your role. Please try again.');
      } finally {
         setIsSubmitting(false);
      }
   };

   return (
      <div className="min-h-screen bg-white flex flex-col max-w-[440px] mx-auto px-5">
         <div className="flex flex-col flex-1 justify-between py-4">
            <div className="flex flex-col gap-5">
               <img
                  src="/hippos/role-selection.png"
                  alt="Moodeng hippo"
                  className="w-[228px] h-[200px] object-cover"
               />

               <div className="flex flex-col gap-1">
                  <h1 className="text-[34px] font-semibold leading-[1.2] tracking-[-0.04em] text-md-heading">
                     How would you like to use Moodeng Credit?
                  </h1>
                  <p className="text-md-b1 text-md-neutral-700 tracking-[-0.02em]">
                     Request short-term loans, repay clearly, and build trust over time.
                  </p>
               </div>

               <button
                  type="button"
                  onClick={() => setSelectedRole('borrower')}
                  className={[
                     'flex flex-col gap-3 items-start p-4 rounded-[12px] border w-full text-left transition-colors',
                     selectedRole === 'borrower'
                        ? 'bg-md-primary-900/10 border-md-primary-900'
                        : 'bg-md-neutral-100 border-md-neutral-600'
                  ].join(' ')}
               >
                  <span className="text-md-h5 font-semibold tracking-[-0.04em] text-md-heading">
                     I am a Borrower
                  </span>
                  <span className="text-md-b2 text-[#45556c] tracking-[-0.02em] leading-[21px]">
                     Request USDC loans and build trust through on-time repayment.
                  </span>
               </button>

               <button
                  type="button"
                  onClick={() => setSelectedRole('lender')}
                  className={[
                     'flex flex-col gap-3 items-start p-4 rounded-[12px] border w-full text-left transition-colors',
                     selectedRole === 'lender'
                        ? 'bg-md-primary-900/10 border-md-primary-900'
                        : 'bg-md-neutral-100 border-md-neutral-600'
                  ].join(' ')}
               >
                  <span className="text-md-h5 font-semibold tracking-[-0.04em] text-md-heading">
                     I am a Lender
                  </span>
                  <span className="text-md-b2 text-[#45556c] tracking-[-0.02em] leading-[21px]">
                     Fund loan requests and earn returns by supporting trusted borrowers.
                  </span>
               </button>

               <button
                  type="button"
                  disabled={!selectedRole || isSubmitting}
                  onClick={handleConfirm}
                  className="flex items-center justify-center gap-2 w-full py-4 px-5 rounded-md-lg font-semibold text-md-b1 text-md-neutral-100 tracking-[-0.02em] bg-md-primary-1200 disabled:opacity-50 transition-opacity"
               >
                  {isSubmitting ? 'Confirming…' : 'Confirm'}
               </button>
            </div>

            <div className="flex flex-col gap-4 items-center py-4">
               <div className="w-full border-t border-md-neutral-500" />
               <div className="flex gap-5 text-md-b2 text-md-neutral-1500 tracking-[-0.02em]">
                  <span>Privacy</span>
                  <span>Terms</span>
                  <span>Docs</span>
               </div>
               <p className="text-[12px] text-md-neutral-1500 tracking-[-0.02em] leading-[18px]">
                  ⓒ 2026 Moodeng Credit All Rights Reserved
               </p>
            </div>
         </div>
      </div>
   );
}
