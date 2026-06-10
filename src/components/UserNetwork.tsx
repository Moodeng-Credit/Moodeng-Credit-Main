import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';

import IouPointHistoryModal from '@/components/IouPointHistoryModal';

import { ALLOWED_CHAIN_DISPLAY_NAME, ALLOWED_CHAIN_ID, getNetworkSvg } from '@/config/wagmiConfig';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { formatPointsMajor } from '@/shared/points';
import { logoutUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { ProfileTab, UserRole } from '@/views/profile/types';

export default function UserNetwork() {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const account = useAccount();
   const username = useSelector((state: RootState) => state.auth.username);
   const user = useSelector((state: RootState) => state.auth.user);
   const userId = user.id;
   const isLender = user.userRole === 'lender';
   const isVerifiedBorrower = user.isWorldId === 'ACTIVE';
   const [pointsTotal, setPointsTotal] = useState<number | null>(null);
   const [isPointsLoading, setIsPointsLoading] = useState(false);
   const [showIouHistory, setShowIouHistory] = useState(false);

   useEffect(() => {
      if (!isLender || !userId) {
         setPointsTotal(null);
         setIsPointsLoading(false);
         return;
      }

      let isActive = true;
      setIsPointsLoading(true);

      const fetchUserPoints = async () => {
         const supabase = getSupabaseBrowserClient();
         const { data, error } = await supabase.from('user_points').select('points_total').eq('user_id', userId).maybeSingle();

         if (!isActive) return;

         if (error) {
            console.error('Failed to fetch IOU points:', error.message);
            setPointsTotal(0);
            setIsPointsLoading(false);
            return;
         }

         setPointsTotal(data?.points_total ?? 0);
         setIsPointsLoading(false);
      };

      fetchUserPoints();

      return () => {
         isActive = false;
      };
   }, [isLender, userId]);

   const handleLogout = () => {
      // Don't disconnect wallet - let wagmi persist the connection
      // The wallet will auto-reconnect on next login via WalletSyncInitializer
      dispatch(logoutUser());
      navigate('/sign-in');
   };

   return (
      <div className="absolute top-0 right-0 flex flex-wrap justify-center gap-6 pr-2 pt-12 z-[1]">
         {!username ? (
            <section className="h-full bg-white dark:bg-[#21162c] rounded-xl border border-solid border-gray-300 dark:border-[#2e203d] shadow-md w-60 flex flex-col justify-between transform transition-all duration-300 ease-out animate-in slide-in-from-top-2 fade-in-0">
               <div>
                  <div className="flex justify-between items-center border-b border-gray-200 dark:border-[#2e203d] border-solid px-4 py-3">
                     <p className="text-sm font-normal text-black dark:text-[#f0e9f8]">Guest User</p>
                     <button
                        className="bg-pink-500 text-white text-xs font-semibold rounded-md px-3 pb-1 pt-[0.375rem] hover:bg-pink-600 transition-all duration-200 hover:scale-105 hover:shadow-md"
                        type="button"
                     >
                        VERIFY
                     </button>
                  </div>
                  <nav className="flex flex-col gap-3 px-4 py-3 text-sm font-normal text-gray-400 dark:text-[#9d88b8]">
                     <p>More</p>
                  </nav>
                  <nav className="flex flex-col gap-3 px-4 text-sm font-normal text-black dark:text-[#f0e9f8] mb-4">
                     <a
                        href="#"
                        className="flex justify-between items-center hover:text-blue-600 transition-colors duration-200 hover:translate-x-1"
                     >
                        Moodeng Credit <i className="fas fa-chevron-right"></i>
                     </a>
                     <a
                        href="#"
                        className="flex justify-between items-center hover:text-blue-600 transition-colors duration-200 hover:translate-x-1"
                     >
                        Privacy policy <i className="fas fa-chevron-right"></i>
                     </a>
                     <a
                        href="#"
                        className="flex justify-between items-center hover:text-blue-600 transition-colors duration-200 hover:translate-x-1"
                     >
                        Terms and conditions <i className="fas fa-chevron-right"></i>
                     </a>
                  </nav>
               </div>
               <button
                  onClick={() => navigate('/sign-in')}
                  className="bg-blue-600 text-white font-bold text-sm rounded-b-xl w-full py-3 hover:bg-blue-700 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                  type="button"
               >
                  SIGN IN
               </button>
            </section>
         ) : null}

         {username ? (
            <section className="h-full bg-white dark:bg-[#21162c] rounded-xl border border-solid border-gray-300 dark:border-[#2e203d] shadow-md w-72 flex flex-col justify-between transform transition-all duration-300 ease-out animate-in slide-in-from-top-2 fade-in-0">
               <div>
                  <div className="flex justify-between items-center border-b border-gray-200 dark:border-[#2e203d] border-solid px-4 py-3">
                     <Link to="/profile" className="max-w-[150px]">
                        <p className="text-sm font-normal text-black dark:text-[#f0e9f8] truncate" title={username ?? ''}>
                           {username}
                        </p>
                     </Link>
                     {isLender ? (
                        <button
                           onClick={() => setShowIouHistory(true)}
                           className="bg-purple-600 text-white text-xs font-semibold rounded-md px-3 pb-1 pt-[0.375rem] flex items-center gap-1 hover:bg-purple-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                           type="button"
                           title="View IOU point history"
                        >
                           <i className="fas fa-coins"></i>{' '}
                           {isPointsLoading ? 'IOU Loading' : `IOU ${formatPointsMajor(pointsTotal ?? 0)}`}
                        </button>
                     ) : (
                        <span
                           className={`text-xs font-semibold rounded-md px-3 pb-1 pt-[0.375rem] ${
                              isVerifiedBorrower ? 'bg-md-green-100 text-md-green-900' : 'bg-md-red-100 text-md-red-800'
                           }`}
                        >
                           {isVerifiedBorrower ? 'Verified' : 'Not Verified'}
                        </span>
                     )}
                  </div>
                  {account.isConnected ? (
                     <div className="flex border-b border-gray-200 dark:border-[#2e203d] border-solid">
                        <div className="flex items-center gap-2 w-2/3 px-4 py-3 text-sm font-normal">
                           Network
                           <i className="fas fa-exchange-alt"></i>
                        </div>
                        <div
                           className={`
                     bg-white dark:bg-[#21162c]
                    w-1/3 text-black dark:text-[#f0e9f8] font-extrabold text-sm flex items-center justify-center gap-[5px]`}
                        >
                           {getNetworkSvg(ALLOWED_CHAIN_ID)}
                           {ALLOWED_CHAIN_DISPLAY_NAME}
                        </div>
                     </div>
                  ) : null}

                  {account.isDisconnected ? (
                     <div className="flex flex-col md:flex-row justify-center items-center">
                        <ConnectButton />
                     </div>
                  ) : null}
                  <div className="px-4 py-3 text-xs font-normal text-gray-400 dark:text-[#9d88b8]">Account Settings</div>
                  <nav className="flex flex-col gap-3 px-4 text-sm font-normal text-black dark:text-[#f0e9f8]">
                     <Link
                        to="/profile"
                        state={{ targetTab: ProfileTab.DASHBOARD }}
                        className="flex justify-between items-center hover:text-blue-600 transition-colors duration-200 hover:translate-x-1"
                     >
                        Profile <i className="fas fa-chevron-right"></i>
                     </Link>
                     <Link
                        to="/profile"
                        state={{ targetTab: ProfileTab.LOAN_SUMMARY, userRole: UserRole.BORROWER }}
                        className="flex justify-between items-center hover:text-blue-600 transition-colors duration-200 hover:translate-x-1"
                     >
                        Repay Loans <i className="fas fa-chevron-right"></i>
                     </Link>
                     <Link to="/dashboard"
                        className="flex justify-between items-center hover:text-blue-600 transition-colors duration-200 hover:translate-x-1"
                     >
                        Connect Account <i className="fas fa-plus"></i>
                     </Link>
                     <Link to="/profile"
                        className="flex justify-between items-center hover:text-blue-600 transition-colors duration-200 hover:translate-x-1"
                     >
                        View Loan History <i className="fas fa-chevron-right"></i>
                     </Link>
                     <Link to="/profile"
                        className="flex justify-between items-center hover:text-blue-600 transition-colors duration-200 hover:translate-x-1"
                     >
                        View Lending History <i className="fas fa-chevron-right"></i>
                     </Link>
                  </nav>
                  <div className="border-t border-gray-200 dark:border-[#2e203d] border-solid px-4 py-3 text-xs font-normal text-gray-400 dark:text-[#9d88b8]">Information</div>
                  <nav className="flex flex-col gap-3 px-4 text-sm font-normal text-black dark:text-[#f0e9f8] mb-4">
                     <a
                        href="#"
                        className="flex justify-between items-center hover:text-blue-600 transition-colors duration-200 hover:translate-x-1"
                     >
                        Increase Credit Limit <i className="fas fa-chevron-right"></i>
                     </a>
                     {isLender ? (
                        <a
                           href="#"
                           className="flex justify-between items-center hover:text-blue-600 transition-colors duration-200 hover:translate-x-1"
                        >
                           What are IOU Points? <i className="fas fa-chevron-right"></i>
                        </a>
                     ) : null}
                     <a
                        href="#"
                        className="flex justify-between items-center hover:text-blue-600 transition-colors duration-200 hover:translate-x-1"
                     >
                        How to get verified? <i className="fas fa-chevron-right"></i>
                     </a>
                  </nav>
               </div>
               <button
                  onClick={() => handleLogout()}
                  className="bg-pink-500 text-white font-bold text-sm rounded-b-xl w-full py-3 flex justify-center items-center gap-2 hover:bg-pink-600 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                  type="button"
               >
                  SIGN OUT <i className="fas fa-sign-out-alt"></i>
               </button>
            </section>
         ) : null}

         <IouPointHistoryModal userId={isLender ? userId : null} isOpen={showIouHistory} onClose={() => setShowIouHistory(false)} />
      </div>
   );
}
