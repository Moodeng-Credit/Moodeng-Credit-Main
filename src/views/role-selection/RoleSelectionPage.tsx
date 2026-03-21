import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { Banknote, Wallet } from 'lucide-react';

import Loading from '@/components/Loading';
import { AuthFooter } from '@/components/auth';
import { updateUserRole } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import type { RootState } from '@/store/store';
import type { UserRole } from '@/types/authTypes';
import '@/views/signup/styles/signup.css';

export default function RoleSelectionPage() {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);
   const [isLoading, setIsLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const handleSelect = async (role: UserRole) => {
      setError(null);
      setIsLoading(true);
      try {
         await dispatch(updateUserRole(role)).unwrap();
         navigate('/dashboard');
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Failed to save selection');
      } finally {
         setIsLoading(false);
      }
   };

   useEffect(() => {
      if (user?.userRole) {
         navigate('/dashboard', { replace: true });
      }
   }, [user?.userRole, navigate]);

   if (user?.userRole) return null;
   if (isLoading) return <Loading />;

   return (
      <div className="flex justify-center items-center min-h-screen py-6 sm:py-12 px-4">
         <div
            className="flex flex-col w-full max-w-[440px] min-h-[calc(100vh-3rem)] sm:min-h-[calc(100vh-6rem)] items-center rounded-[20px] overflow-y-auto shrink-0"
            style={{
               background: 'linear-gradient(180deg, #FBFAFD 0%, #FFFFFF 100%)',
               isolation: 'isolate'
            }}
         >
            <div className="flex flex-1 flex-col items-center justify-center w-full px-5 py-6 sm:py-10">
               <img
                  src="/auth-screen.png"
                  alt="Moodeng Mascot"
                  className="w-[110px] h-[96px] object-contain mb-5"
               />
               <h1 className="text-[34px] font-semibold leading-[1.2] tracking-[-0.04em] text-[#040033] text-center mb-1">
                  How would you like to use Moodeng Credit?
               </h1>
               <p className="text-base font-medium leading-6 tracking-[-0.02em] text-[#6D6D6D] text-center mb-8 max-w-[400px]">
                  Choose your role to get started. You can explore different features based on your selection.
               </p>

               <div className="flex flex-col gap-4 w-full max-w-[400px]">
                  <button
                     type="button"
                     onClick={() => handleSelect('borrower')}
                     className="flex flex-row items-center gap-4 w-full p-5 rounded-xl border border-[#B5ACBE] bg-[#FDFCFD] shadow-[0px_2px_4px_rgba(27,28,29,0.04)] hover:border-[#8336F0] hover:bg-purple-50/50 transition-colors text-left"
                  >
                     <div className="shrink-0 w-12 h-12 rounded-xl bg-[#8336F0]/10 flex items-center justify-center">
                        <Banknote className="w-6 h-6 text-[#8336F0]" />
                     </div>
                     <div>
                        <h2 className="text-lg font-semibold text-[#040033] tracking-[-0.02em]">
                           Borrower
                        </h2>
                        <p className="text-sm text-[#6D6D6D] tracking-[-0.02em] mt-0.5">
                           Request loans, repay clearly, and build your credit over time. Wallet: Coinbase.
                        </p>
                     </div>
                  </button>

                  <button
                     type="button"
                     onClick={() => handleSelect('lender')}
                     className="flex flex-row items-center gap-4 w-full p-5 rounded-xl border border-[#B5ACBE] bg-[#FDFCFD] shadow-[0px_2px_4px_rgba(27,28,29,0.04)] hover:border-[#8336F0] hover:bg-purple-50/50 transition-colors text-left"
                  >
                     <div className="shrink-0 w-12 h-12 rounded-xl bg-[#8336F0]/10 flex items-center justify-center">
                        <Wallet className="w-6 h-6 text-[#8336F0]" />
                     </div>
                     <div>
                        <h2 className="text-lg font-semibold text-[#040033] tracking-[-0.02em]">
                           Lender
                        </h2>
                        <p className="text-sm text-[#6D6D6D] tracking-[-0.02em] mt-0.5">
                           Fund loans and earn. All wallets: Coinbase, Phantom, MetaMask, WalletConnect, Other.
                        </p>
                     </div>
                  </button>
               </div>

               {error && (
                  <p className="mt-4 text-sm text-red-500 text-center">{error}</p>
               )}
            </div>

            <AuthFooter />
         </div>
      </div>
   );
}
