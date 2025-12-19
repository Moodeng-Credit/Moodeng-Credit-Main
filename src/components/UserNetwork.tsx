import { Link, useNavigate } from 'react-router-dom';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useDispatch, useSelector } from 'react-redux';
import { useAccount } from 'wagmi';

import { ALLOWED_CHAIN_DISPLAY_NAME, ALLOWED_CHAIN_ID, getNetworkSvg } from '@/config/wagmiConfig';
import { logoutUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';

export default function UserNetwork() {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const account = useAccount();
   const username = useSelector((state: RootState) => state.auth.username);

   const handleLogout = () => {
      // Don't disconnect wallet - let wagmi persist the connection
      // The wallet will auto-reconnect on next login via WalletSyncInitializer
      dispatch(logoutUser());
      navigate('/login');
   };

   return (
      <div className="absolute top-0 right-0 flex flex-wrap justify-center gap-6 pr-2 pt-12 z-[1]">
         {!username ? (
            <section className="h-full bg-white rounded-xl border border-solid border-gray-300 shadow-md w-60 flex flex-col justify-between transform transition-all duration-300 ease-out animate-in slide-in-from-top-2 fade-in-0">
               <div>
                  <div className="flex justify-between items-center border-b border-gray-200 border-solid px-4 py-3">
                     <p className="text-sm font-normal text-black">Guest User</p>
                     <button
                        className="bg-pink-500 text-white text-xs font-semibold rounded-md px-3 pb-1 pt-[0.375rem] hover:bg-pink-600 transition-all duration-200 hover:scale-105 hover:shadow-md"
                        type="button"
                     >
                        VERIFY
                     </button>
                  </div>
                  <nav className="flex flex-col gap-3 px-4 py-3 text-sm font-normal text-gray-400">
                     <p>More</p>
                  </nav>
                  <nav className="flex flex-col gap-3 px-4 text-sm font-normal text-black mb-4">
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
                  onClick={() => navigate('/login')}
                  className="bg-blue-600 text-white font-bold text-sm rounded-b-xl w-full py-3 hover:bg-blue-700 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                  type="button"
               >
                  SIGN IN
               </button>
            </section>
         ) : null}

         {username ? (
            <section className="h-full bg-white rounded-xl border border-solid border-gray-300 shadow-md w-72 flex flex-col justify-between transform transition-all duration-300 ease-out animate-in slide-in-from-top-2 fade-in-0">
               <div>
                  <div className="flex justify-between items-center border-b border-gray-200 border-solid px-4 py-3">
                     <Link to="/profile">
                        <p className="text-sm font-normal text-black">{username}</p>
                     </Link>
                     <button
                        className="bg-purple-600 text-white text-xs font-semibold rounded-md px-3 pb-1 pt-[0.375rem] flex items-center gap-1 hover:bg-purple-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                        type="button"
                     >
                        <i className="fas fa-coins"></i> IOU 50000
                     </button>
                  </div>
                  {account.isConnected ? (
                     <div className="flex border-b border-gray-200 border-solid">
                        <div className="flex items-center gap-2 w-2/3 px-4 py-3 text-sm font-normal">
                           Network
                           <i className="fas fa-exchange-alt"></i>
                        </div>
                        <div
                           className={`
                     bg-[#ffffff]
                    w-1/3 text-black font-extrabold text-sm flex items-center justify-center gap-[5px]`}
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
                  <div className="px-4 py-3 text-xs font-normal text-gray-400">Account Settings</div>
                  <nav className="flex flex-col gap-3 px-4 text-sm font-normal text-black">
                     <Link
                        to="/profile"
                        className="flex justify-between items-center hover:text-blue-600 transition-colors duration-200 hover:translate-x-1"
                     >
                        Profile <i className="fas fa-chevron-right"></i>
                     </Link>
                     <Link
                        to="/profile"
                        className="flex justify-between items-center hover:text-blue-600 transition-colors duration-200 hover:translate-x-1"
                     >
                        Repay Loans <i className="fas fa-chevron-right"></i>
                     </Link>
                     <Link
                        to="/dashboard"
                        className="flex justify-between items-center hover:text-blue-600 transition-colors duration-200 hover:translate-x-1"
                     >
                        Connect Account <i className="fas fa-plus"></i>
                     </Link>
                     <Link
                        to="/profile"
                        className="flex justify-between items-center hover:text-blue-600 transition-colors duration-200 hover:translate-x-1"
                     >
                        View Loan History <i className="fas fa-chevron-right"></i>
                     </Link>
                     <Link
                        to="/profile"
                        className="flex justify-between items-center hover:text-blue-600 transition-colors duration-200 hover:translate-x-1"
                     >
                        View Lending History <i className="fas fa-chevron-right"></i>
                     </Link>
                  </nav>
                  <div className="border-t border-gray-200 border-solid px-4 py-3 text-xs font-normal text-gray-400">Information</div>
                  <nav className="flex flex-col gap-3 px-4 text-sm font-normal text-black mb-4">
                     <a
                        href="#"
                        className="flex justify-between items-center hover:text-blue-600 transition-colors duration-200 hover:translate-x-1"
                     >
                        Increase Credit Limit <i className="fas fa-chevron-right"></i>
                     </a>
                     <a
                        href="#"
                        className="flex justify-between items-center hover:text-blue-600 transition-colors duration-200 hover:translate-x-1"
                     >
                        What are IOU Points? <i className="fas fa-chevron-right"></i>
                     </a>
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
      </div>
   );
}
