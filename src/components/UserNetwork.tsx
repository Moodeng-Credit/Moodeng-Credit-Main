'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { type Chain, ConnectButton } from '@rainbow-me/rainbowkit';
import { useDispatch, useSelector } from 'react-redux';
import { useAccount, useDisconnect, useSwitchChain } from 'wagmi';

import { useClickOutside } from '@/hooks/useClickOutside';

import { chainConfig, chainsWithIcons, type CustomChainConfig, getNetworkSvg } from '@/config/wagmiConfig';
import { logoutUser, updateUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';

export default function UserNetwork() {
   const dispatch = useDispatch<AppDispatch>();
   const router = useRouter();
   const account = useAccount();
   const { switchChain } = useSwitchChain();
   const { disconnect } = useDisconnect();
   const [showNetwork, setShowNetwork] = useState(false);
   const username = useSelector((state: RootState) => state.auth.username);
   const currentWalletAddress = useSelector((state: RootState) => state.auth.user?.walletAddress);

   const handleLogout = () => {
      disconnect();
      dispatch(logoutUser());

      router.push('/login');
   };

   // Available chains from Wagmi config
   const availableChains = chainsWithIcons;

   const getNetworkColor = (chainId: number) => {
      const config = (chainConfig as Record<number, CustomChainConfig>)[chainId];
      return config ? [config.bgColor, config.shortName] : ['bg-gray-600', 'Unknown'];
   };

   useEffect(() => {
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach((checkbox) => {
         checkbox.addEventListener('change', (e: Event) => {
            const target = e.target as HTMLInputElement;
            const span = target.nextElementSibling;
            if (target.checked) {
               span?.classList.add('bg-purple-600');
               span?.classList.remove('bg-gray-300');
               span?.firstElementChild?.classList.add('translate-x-5');
               span?.firstElementChild?.classList.remove('translate-x-0');
            } else {
               span?.classList.remove('bg-purple-600');
               span?.classList.add('bg-gray-300');
               span?.firstElementChild?.classList.remove('translate-x-5');
               span?.firstElementChild?.classList.add('translate-x-0');
            }
         });
      });
   }, [username]);

   useEffect(() => {
      if (account.isConnected && account.address && username) {
         if (currentWalletAddress !== account.address) {
            dispatch(updateUser({ walletAddress: account.address }))
               .unwrap()
               .then(() => {
                  console.log('Wallet address saved successfully');
               })
               .catch((error) => {
                  console.error('Failed to save wallet address:', error);
               });
         }
      }
   }, [account.isConnected, account.address, username, currentWalletAddress, dispatch]);

   // Use the click outside hook for the network dropdown
   const networkDropdownRef = useClickOutside<HTMLDivElement>(() => setShowNetwork(false), showNetwork);

   // Handle chain switching
   const handleSwitchChain = async (chainId: number) => {
      try {
         if (account.isConnected && chainId) {
            switchChain({ chainId });
            setShowNetwork(false);
         }
      } catch (error) {
         console.error('Failed to switch chain:', error);
      }
   };

   // Toggle network selection dropdown
   const toggleNetworkSelection = () => {
      setShowNetwork(!showNetwork);
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
                  onClick={() => router.push('login')}
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
                     <Link href="/profile">
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
                     <div className="relative network-dropdown" ref={networkDropdownRef}>
                        <div
                           className="flex border-b border-gray-200 border-solid cursor-pointer hover:bg-gray-50 transition-colors duration-200"
                           onClick={toggleNetworkSelection}
                        >
                           <div className="flex items-center gap-2 w-2/3 px-4 py-3 text-sm font-normal">
                              Network
                              <i className="fas fa-exchange-alt"></i>
                           </div>
                           <div
                              className={`
                      bg-[#ffffff]
                     w-1/3 text-black font-extrabold text-sm flex items-center justify-center gap-[5px]`}
                           >
                              {getNetworkSvg(account.chainId || 0)}
                              {getNetworkColor(account.chainId || 0)[1]}
                           </div>
                        </div>

                        {/* Chain Selection Dropdown */}
                        {showNetwork ? (
                           <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-b-lg shadow-lg z-10 transform transition-all duration-300 ease-out animate-in slide-in-from-top-2 fade-in-0 scale-95 origin-top">
                              {availableChains.map((chain: Chain) => {
                                 const displayConfig = chainConfig[chain.id] as CustomChainConfig;
                                 return (
                                    <div
                                       key={chain.id}
                                       className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-all duration-200 hover:scale-[1.02] hover:shadow-sm"
                                       onClick={() => handleSwitchChain(chain.id)}
                                    >
                                       <div className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden">
                                          {getNetworkSvg(chain.id)}
                                       </div>
                                       <span className="text-sm font-medium text-gray-700">
                                          {displayConfig?.displayName || 'Unknown Network'}
                                       </span>
                                       {account.chainId === chain.id ? <i className="fas fa-check text-green-500 ml-auto"></i> : null}
                                    </div>
                                 );
                              })}
                           </div>
                        ) : null}
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
                        href="/profile"
                        className="flex justify-between items-center hover:text-blue-600 transition-colors duration-200 hover:translate-x-1"
                     >
                        Profile <i className="fas fa-chevron-right"></i>
                     </Link>
                     <Link
                        href="/profile"
                        className="flex justify-between items-center hover:text-blue-600 transition-colors duration-200 hover:translate-x-1"
                     >
                        Repay Loans <i className="fas fa-chevron-right"></i>
                     </Link>
                     <Link
                        href="/dashboard"
                        className="flex justify-between items-center hover:text-blue-600 transition-colors duration-200 hover:translate-x-1"
                     >
                        Connect Account <i className="fas fa-plus"></i>
                     </Link>
                     <Link
                        href="/profile"
                        className="flex justify-between items-center hover:text-blue-600 transition-colors duration-200 hover:translate-x-1"
                     >
                        View Loan History <i className="fas fa-chevron-right"></i>
                     </Link>
                     <Link
                        href="/profile"
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
